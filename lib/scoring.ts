/**
 * lib/scoring.ts
 *
 * Pure scoring engine — no DB calls. Takes plain data, returns structured scores.
 *
 * Formula:
 *   pct_indicator = auditor_score / max_score_in_scale × 100
 *   score_aspect  = Σ ( pct_indicator × indicator_weight / 100 )
 *   score_total   = Σ ( score_aspect  × aspect_weight    / 100 )
 *
 * Indicators without scoring_scale contribute 0 (superadmin sets their weight to 0).
 */

export interface ScoringScaleItem {
  score: number
  description: string
}

export interface IndicatorInput {
  id: string
  code: string
  name: string
  aspect_id: string
  scoring_scale: ScoringScaleItem[] | null | undefined
}

export interface AspectInput {
  id: string
  name: string
  order_number: number
}

export interface AssessmentInput {
  indicator_id: string
  score: number | null
}

export interface AspectWeightInput {
  aspect_id: string
  weight: number // 0–100
}

export interface IndicatorWeightInput {
  indicator_id: string
  weight: number // 0–100, relative within the aspect
}

// ── Output shapes ────────────────────────────────────────────────────────────

export interface IndicatorScore {
  indicatorId: string
  code: string
  name: string
  auditorScore: number | null
  maxScore: number
  pctAchieved: number    // 0–100
  weight: number         // % within aspect (0–100)
  weightedContribution: number // pctAchieved × weight / 100
}

export interface AspectScore {
  aspectId: string
  name: string
  orderNumber: number
  score: number          // 0–100 (weighted sum of indicators)
  weight: number         // % of total (0–100)
  weightedContribution: number // score × weight / 100
  indicators: IndicatorScore[]
}

export interface InstitutionScore {
  institutionId: string
  totalScore: number     // 0–100
  aspects: AspectScore[]
}

// ── Core function ────────────────────────────────────────────────────────────

export function calculateInstitutionScore(
  institutionId: string,
  aspects: AspectInput[],
  indicators: IndicatorInput[],
  assessments: AssessmentInput[],
  aspectWeights: AspectWeightInput[],
  indicatorWeights: IndicatorWeightInput[],
): InstitutionScore {
  // Index lookups for O(1) access
  const assessmentByIndicator = new Map<string, number | null>()
  for (const a of assessments) {
    assessmentByIndicator.set(a.indicator_id, a.score)
  }

  const aspectWeightMap = new Map<string, number>()
  for (const aw of aspectWeights) {
    aspectWeightMap.set(aw.aspect_id, aw.weight)
  }

  const indicatorWeightMap = new Map<string, number>()
  for (const iw of indicatorWeights) {
    indicatorWeightMap.set(iw.indicator_id, iw.weight)
  }

  const indicatorsByAspect = new Map<string, IndicatorInput[]>()
  for (const ind of indicators) {
    const list = indicatorsByAspect.get(ind.aspect_id) ?? []
    list.push(ind)
    indicatorsByAspect.set(ind.aspect_id, list)
  }

  let totalScore = 0
  const aspectScores: AspectScore[] = []

  for (const aspect of aspects) {
    const aspectWeight = aspectWeightMap.get(aspect.id) ?? 0
    const aspIndicators = indicatorsByAspect.get(aspect.id) ?? []
    const indicatorScores: IndicatorScore[] = []
    let aspectScore = 0

    for (const ind of aspIndicators) {
      const indWeight = indicatorWeightMap.get(ind.id) ?? 0
      const auditorScore = assessmentByIndicator.get(ind.id) ?? null

      // Determine max score from scoring_scale
      const scale = ind.scoring_scale
      const maxScore =
        scale && scale.length > 0
          ? Math.max(...scale.map((s) => s.score))
          : 0

      // Compute percentage achieved
      const pctAchieved =
        maxScore > 0 && auditorScore !== null
          ? (auditorScore / maxScore) * 100
          : 0

      const weightedContribution = (pctAchieved * indWeight) / 100
      aspectScore += weightedContribution

      indicatorScores.push({
        indicatorId: ind.id,
        code: ind.code,
        name: ind.name,
        auditorScore,
        maxScore,
        pctAchieved,
        weight: indWeight,
        weightedContribution,
      })
    }

    const aspWeightedContribution = (aspectScore * aspectWeight) / 100
    totalScore += aspWeightedContribution

    aspectScores.push({
      aspectId: aspect.id,
      name: aspect.name,
      orderNumber: aspect.order_number,
      score: aspectScore,
      weight: aspectWeight,
      weightedContribution: aspWeightedContribution,
      indicators: indicatorScores,
    })
  }

  return { institutionId, totalScore, aspects: aspectScores }
}
