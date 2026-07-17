-- Migration: 20260717030000_update_scoring_function_to_scale_5.sql
-- Drop the old calculation function first
DROP FUNCTION IF EXISTS calculate_institution_scores(UUID);

-- Recreate function calculate_institution_scores mapping scores to scale 1-5 instead of percent 0-100.
-- F-02 = aspect_score * 5.0 (out of 5 max)
-- We multiply fraction by 5 instead of 100.
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
  aspect_weight    NUMERIC,   -- 0-100
  score_aspect     NUMERIC,   -- 0-5, aspect score scaled (weighted sum of its indicators)
  indicator_id     UUID,
  indicator_code   TEXT,
  indicator_name   TEXT,
  indicator_weight NUMERIC,   -- 0-100
  auditor_score    INTEGER,   -- raw
  max_score        NUMERIC,
  pct_achieved     NUMERIC,   -- 0-5, achievement for this indicator scaled to 5 max
  total_score      NUMERIC    -- 0-5, final F-02 weighted score (out of 5)
)
LANGUAGE sql
STABLE
AS $$

WITH
active_cfg AS (
  SELECT id AS cfg_id
  FROM   weight_configurations
  WHERE  is_active = true
  LIMIT  1
),

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

-- Map indicator raw score to a 0-5 scale: (auditor_score / max_score) * 5
indicator_pct AS (
  SELECT
    ass.institution_id,
    ass.indicator_id,
    ass.score AS auditor_score,
    im.max_score,
    CASE
      WHEN im.max_score > 0 AND ass.score IS NOT NULL
        THEN (ass.score::NUMERIC / im.max_score) * 5
      ELSE 0
    END AS pct_achieved
  FROM  assessments ass
  JOIN  indicator_max im ON im.indicator_id = ass.indicator_id
  WHERE (p_institution_id IS NULL OR ass.institution_id = p_institution_id)
),

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

aspect_scores AS (
  SELECT
    institution_id,
    aspect_id,
    SUM(ind_weighted_contrib) AS score_aspect
  FROM  indicator_weighted
  GROUP BY institution_id, aspect_id
),

-- Aggregate to total F-02 score in scale 0-5
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

GRANT EXECUTE ON FUNCTION calculate_institution_scores(UUID) TO authenticated;
