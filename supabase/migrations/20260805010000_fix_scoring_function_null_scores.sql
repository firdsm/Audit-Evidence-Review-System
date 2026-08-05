-- Migration: 20260805010000_fix_scoring_function_null_scores.sql
--
-- FIX:
-- 1. In CTE `indicator_pct`, return NULL instead of 0 when `ass.score IS NULL`.
--    This ensures that indicators without numeric scores (where auditor only uploaded
--    documents/notes) do NOT artificially produce a 0 score.
-- 2. Only include non-null `pct_achieved` in `aspect_scores` and `institution_totals`.
--    If an institution has ZERO numeric scores, `total_score` will be NULL ("Belum dilakukan penilaian").
--    If an institution has explicit score = 0, `pct_achieved = 0` (non-null), producing total_score = 0.00.

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
-- Return NULL if ass.score IS NULL
indicator_pct AS (
  SELECT
    ass.institution_id,
    ass.indicator_id,
    ass.score                                   AS auditor_score,
    im.max_score,
    CASE
      WHEN im.max_score > 0 AND ass.score IS NOT NULL
        THEN (ass.score::NUMERIC / im.max_score) * 5
      ELSE NULL
    END                                         AS pct_achieved
  FROM  assessments ass
  JOIN  indicator_max im ON im.indicator_id = ass.indicator_id
  WHERE (p_institution_id IS NULL OR ass.institution_id = p_institution_id)
),

-- Weighted contribution per indicator (only for indicators with non-null pct_achieved)
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
    CASE
      WHEN ip.pct_achieved IS NOT NULL
        THEN (ip.pct_achieved * iw.weight / 100)
      ELSE NULL
    END                                 AS ind_weighted_contrib
  FROM  indicator_pct ip
  JOIN  indicators i ON i.id = ip.indicator_id
  CROSS JOIN active_cfg
  JOIN  indicator_weights iw
    ON  iw.indicator_id            = ip.indicator_id
    AND iw.weight_configuration_id = active_cfg.cfg_id
),

-- Score per aspect per institution (only for institutions WITH valid non-null assessments)
aspect_scores AS (
  SELECT
    institution_id,
    aspect_id,
    SUM(ind_weighted_contrib) AS score_aspect
  FROM  indicator_weighted
  WHERE pct_achieved IS NOT NULL
  GROUP BY institution_id, aspect_id
),

-- Final F-02 total score per institution (only for institutions WITH valid non-null assessments)
institution_totals AS (
  SELECT
    acs.institution_id,
    SUM(acs.score_aspect * aw.weight / 100) AS total_score
  FROM  aspect_scores acs
  CROSS JOIN active_cfg
  JOIN  aspect_weights aw
    ON  aw.aspect_id               = acs.aspect_id
    AND aw.weight_configuration_id = active_cfg.cfg_id
  WHERE acs.score_aspect IS NOT NULL
  GROUP BY acs.institution_id
)

-- ──────────────────────────────────────────────────────────────────────────────
-- FINAL SELECT: drive from institutions × aspects
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
CROSS JOIN active_cfg
JOIN  aspects asp ON true
JOIN  aspect_weights aw
  ON  aw.aspect_id               = asp.id
  AND aw.weight_configuration_id = active_cfg.cfg_id
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
