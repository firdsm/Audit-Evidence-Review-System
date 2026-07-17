-- Migration: 20260717010000_create_scoring_function.sql
-- Creates a read-only (STABLE) SQL function that calculates weighted institution scores
-- using the currently active weight_configuration.
-- No INSERT/UPDATE — purely SELECT + aggregation.

CREATE OR REPLACE FUNCTION calculate_institution_scores(
  p_institution_id UUID DEFAULT NULL   -- NULL = calculate for ALL institutions (ranking)
)
RETURNS TABLE (
  institution_id   UUID,
  institution_name TEXT,
  category         TEXT,
  aspect_id        UUID,
  aspect_name      TEXT,
  aspect_order     INTEGER,
  aspect_weight    NUMERIC,   -- 0-100, weight of aspect in final score
  score_aspect     NUMERIC,   -- 0-100, aspect score (weighted sum of its indicators)
  indicator_id     UUID,
  indicator_code   TEXT,
  indicator_name   TEXT,
  indicator_weight NUMERIC,   -- 0-100, weight of indicator within its aspect
  auditor_score    INTEGER,   -- raw score from assessments — NEVER modified here
  max_score        NUMERIC,   -- highest score value found in scoring_scale JSONB
  pct_achieved     NUMERIC,   -- 0-100, percentage achievement for this indicator
  total_score      NUMERIC    -- 0-100, final weighted score for the institution
)
LANGUAGE sql
STABLE   -- read-only, safe for query-level caching by the planner
AS $$

WITH
-- 1. Active weight configuration
--    Guaranteed to be at most one row by the partial unique index:
--    CREATE UNIQUE INDEX active_weight_config_idx ON weight_configurations (is_active) WHERE is_active = true
active_cfg AS (
  SELECT id AS cfg_id
  FROM   weight_configurations
  WHERE  is_active = true
  LIMIT  1
),

-- 2. Maximum score per indicator derived from scoring_scale JSONB
--    scoring_scale is a JSONB array of objects: [{score: int, description: text}, ...]
--    COALESCE to 0 when NULL or empty → safe for indicators without a scoring scale
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

-- 3. Percentage achievement per (institution × indicator) row
--    pct_achieved = 0 when: max_score = 0 (no scoring_scale) OR auditor has not yet scored
indicator_pct AS (
  SELECT
    ass.institution_id,
    ass.indicator_id,
    ass.score AS auditor_score,
    im.max_score,
    CASE
      WHEN im.max_score > 0 AND ass.score IS NOT NULL
        THEN (ass.score::NUMERIC / im.max_score) * 100
      ELSE 0
    END AS pct_achieved
  FROM  assessments ass
  JOIN  indicator_max im ON im.indicator_id = ass.indicator_id
  WHERE (p_institution_id IS NULL OR ass.institution_id = p_institution_id)
),

-- 4. Attach indicator weight; compute each indicator's weighted contribution to its aspect score
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

-- 5. Aggregate to aspect level: score_aspect = SUM of indicator contributions
aspect_scores AS (
  SELECT
    institution_id,
    aspect_id,
    SUM(ind_weighted_contrib) AS score_aspect
  FROM  indicator_weighted
  GROUP BY institution_id, aspect_id
),

-- 6. Aggregate to institution level: total_score = SUM( score_aspect × aspect_weight / 100 )
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

-- 7. Final join: return full breakdown — one row per indicator per aspect per institution
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
JOIN  institution_totals it
  ON  it.institution_id = inst.id
JOIN  aspect_scores acs
  ON  acs.institution_id = inst.id
JOIN  aspects asp
  ON  asp.id = acs.aspect_id
CROSS JOIN active_cfg
JOIN  aspect_weights aw
  ON  aw.aspect_id               = asp.id
  AND aw.weight_configuration_id = active_cfg.cfg_id
JOIN  indicator_weighted iw_full
  ON  iw_full.institution_id = inst.id
  AND iw_full.aspect_id      = asp.id
WHERE (p_institution_id IS NULL OR inst.id = p_institution_id)
ORDER BY it.total_score DESC, asp.order_number, iw_full.indicator_code;

$$;

-- Grant execute to authenticated role (used by Supabase RLS/auth context)
GRANT EXECUTE ON FUNCTION calculate_institution_scores(UUID) TO authenticated;
