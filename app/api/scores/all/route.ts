import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/scores/all?category=<optional>
 *
 * Returns weighted scores for ALL institutions, sorted by totalScore DESC.
 * Calculation is done entirely in the database via the
 * calculate_institution_scores() SQL function (STABLE, read-only).
 *
 * Performance: one single RPC round-trip — all JOINs and aggregations happen
 * inside Postgres. The raw `score` values in `assessments` are never modified.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const category = request.nextUrl.searchParams.get('category') // optional filter

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Call the DB function with p_institution_id = NULL → all institutions
  const { data: rows, error } = await supabase.rpc('calculate_institution_scores', {
    p_institution_id: null,
  })

  if (error) {
    console.error('[scores/all] RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ rankings: [] })
  }

  // ── Group flat rows into per-institution objects ──────────────────────────
  // Rows arrive ordered by total_score DESC, aspect_order ASC, indicator_code ASC

  const institutionMap = new Map<string, {
    institutionId: string
    name: string
    category: string
    totalScore: number
    aspects: Map<string, {
      aspectId: string
      aspectName: string
      aspectOrder: number
      aspectWeight: number
      scoreAspect: number
      indicators: {
        indicatorId: string
        code: string
        name: string
        auditorScore: number | null
        maxScore: number
        pctAchieved: number
        weight: number
      }[]
    }>
  }>()

  for (const row of rows) {
    // Optional category filter (done in JS to avoid a second DB call)
    if (category && row.category !== category) continue

    if (!institutionMap.has(row.institution_id)) {
      institutionMap.set(row.institution_id, {
        institutionId: row.institution_id,
        name: row.institution_name,
        category: row.category,
        totalScore: row.total_score,
        aspects: new Map(),
      })
    }

    const inst = institutionMap.get(row.institution_id)!

    if (!inst.aspects.has(row.aspect_id)) {
      inst.aspects.set(row.aspect_id, {
        aspectId: row.aspect_id,
        aspectName: row.aspect_name,
        aspectOrder: row.aspect_order,
        aspectWeight: row.aspect_weight,
        scoreAspect: row.score_aspect,
        indicators: [],
      })
    }

    inst.aspects.get(row.aspect_id)!.indicators.push({
      indicatorId: row.indicator_id,
      code: row.indicator_code,
      name: row.indicator_name,
      auditorScore: row.auditor_score,
      maxScore: row.max_score,
      pctAchieved: row.pct_achieved,
      weight: row.indicator_weight,
    })
  }

  // Flatten Map → array, sort aspects inside each institution, rank institutions
  const rankings = [...institutionMap.values()]
    .map((inst) => ({
      ...inst,
      aspects: [...inst.aspects.values()].sort((a, b) => a.aspectOrder - b.aspectOrder),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)

  return NextResponse.json({ rankings })
}
