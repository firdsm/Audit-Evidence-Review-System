-- Migration: 20260726020000_fix_scoring_function_unassessed.sql
--
-- ROOT CAUSE: indicator_pct CTE dimulai dari tabel `assessments`, sehingga
-- institusi yang belum punya baris assessment tidak masuk ke pipeline CTE
-- manapun. LEFT JOIN di final SELECT tidak bisa memunculkan institusi yang
-- memang tidak ada di semua CTE sebelumnya.
--
-- FIX: Pisahkan kalkulasi skor per institusi ke CTE "institution_totals" yang
-- dimulai dari `institutions`, lalu LEFT JOIN ke data assessment.
-- Final SELECT menggunakan `institutions` sebagai driving table, JOIN ke
-- `aspects` langsung (bukan via aspect_scores), sehingga institusi tanpa
-- assessment tetap menghasilkan baris dengan total_score = NULL.

DROP FUNCTION IF EXISTS calculate_institution_scores(UUID);

CREATE OR REPLACE FUNCTION calculate_institution_scores(
  p_institution_id UUID DEFAULT NULL
)
RETURNS TABLE (
  institution_id   UUID,
  institution_name TEXT,
  category         TEXT,
  aspect_id        UUID,
  aspect_name      TEXT,
  aspect_order     INTEGER,
  aspect_weight    NUMERIC,
  score_aspect     NUMERIC,
  indicator_id     UUID,
  indicator_code   TEXT,
  indicator_name   TEXT,
  indicator_weight NUMERIC,
  auditor_score    INTEGER,
  max_score        NUMERIC,
  pct_achieved     NUMERIC,
  total_score      NUMERIC
)
LANGUAGE sql
STABLE
AS $$

WITH
-- Active weight configuration
active_cfg AS (
  SELECT id AS cfg_id
  FROM   weight_configurations
  WHERE  is_active = true
  LIMIT  1
),

-- Max possible score per indicator (from JSON scoring_scale)
indicator_max AS (
  SELECT
    i.id AS indicator_id,
    COALESCE(
      (SELECT MAX((elem->>'score')::NUMERIC)
       FROM   jsonb_array_elements(i.scoring_scale) AS elem),
      0
    ) AS max_score
  FROM indicators i
),

-- Per indicator, per institution: scale raw score to 0-5
-- Starts from assessments — only institutions WITH assessments appear here
indicator_pct AS (
  SELECT
    ass.institution_id,
    ass.indicator_id,
    ass.score                                   AS auditor_score,
    im.max_score,
    CASE
      WHEN im.max_score > 0 AND ass.score IS NOT NULL
        THEN (ass.score::NUMERIC / im.max_score) * 5
      ELSE 0
    END                                         AS pct_achieved
  FROM  assessments ass
  JOIN  indicator_max im ON im.indicator_id = ass.indicator_id
  WHERE (p_institution_id IS NULL OR ass.institution_id = p_institution_id)
),

-- Weighted contribution per indicator
indicator_weighted AS (
  SELECT
    ip.institution_id,
    i.aspect_id,
    ip.indicator_id,
    i.code                              AS indicator_code,
    i.name                              AS indicator_name,
    iw.weight                           AS indicator_weight,
    ip.auditor_score,
    ip.max_score,
    ip.pct_achieved,
    (ip.pct_achieved * iw.weight / 100) AS ind_weighted_contrib
  FROM  indicator_pct ip
  JOIN  indicators i ON i.id = ip.indicator_id
  CROSS JOIN active_cfg
  JOIN  indicator_weights iw
    ON  iw.indicator_id            = ip.indicator_id
    AND iw.weight_configuration_id = active_cfg.cfg_id
),

-- Score per aspect per institution (only for institutions WITH assessments)
aspect_scores AS (
  SELECT
    institution_id,
    aspect_id,
    SUM(ind_weighted_contrib) AS score_aspect
  FROM  indicator_weighted
  GROUP BY institution_id, aspect_id
),

-- Final F-02 total score per institution (only for institutions WITH assessments)
institution_totals AS (
  SELECT
    acs.institution_id,
    SUM(acs.score_aspect * aw.weight / 100) AS total_score
  FROM  aspect_scores acs
  CROSS JOIN active_cfg
  JOIN  aspect_weights aw
    ON  aw.aspect_id               = acs.aspect_id
    AND aw.weight_configuration_id = active_cfg.cfg_id
  GROUP BY acs.institution_id
)

-- ──────────────────────────────────────────────────────────────────────────────
-- FINAL SELECT: drive from institutions × aspects (so unassessed institutions
-- still produce rows — one per aspect — with NULL scores).
-- ──────────────────────────────────────────────────────────────────────────────
SELECT
  inst.id                   AS institution_id,
  inst.name                 AS institution_name,
  inst.category,
  asp.id                    AS aspect_id,
  asp.name                  AS aspect_name,
  asp.order_number          AS aspect_order,
  aw.weight                 AS aspect_weight,
  acs.score_aspect,
  iw_full.indicator_id,
  iw_full.indicator_code,
  iw_full.indicator_name,
  iw_full.indicator_weight,
  iw_full.auditor_score,
  iw_full.max_score,
  iw_full.pct_achieved,
  it.total_score
FROM  institutions inst
-- Joining aspects directly (not via aspect_scores) ensures unassessed institutions
-- still get one row per aspect with NULL score data
CROSS JOIN active_cfg
JOIN  aspects asp ON true                -- cartesian: every institution × every aspect
JOIN  aspect_weights aw
  ON  aw.aspect_id               = asp.id
  AND aw.weight_configuration_id = active_cfg.cfg_id
-- LEFT JOIN scoring data — will be NULL for unassessed institutions
LEFT JOIN  institution_totals it
  ON  it.institution_id = inst.id
LEFT JOIN  aspect_scores acs
  ON  acs.institution_id = inst.id
  AND acs.aspect_id      = asp.id
LEFT JOIN  indicator_weighted iw_full
  ON  iw_full.institution_id = inst.id
  AND iw_full.aspect_id      = asp.id
WHERE (p_institution_id IS NULL OR inst.id = p_institution_id)
ORDER BY it.total_score DESC NULLS LAST, asp.order_number, iw_full.indicator_code;

$$;

GRANT EXECUTE ON FUNCTION calculate_institution_scores(UUID) TO authenticated;
