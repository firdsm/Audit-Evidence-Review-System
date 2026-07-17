import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/scores/all?category=<optional>
 *
 * Calculates F-02 real-time in scale 1-5, LEFT JOINs F-03 scores,
 * and yields Final Score: 75% F-02 + 25% F-03.
 * Returns rankings sorted by Final Score DESC.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const category = request.nextUrl.searchParams.get('category')

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch configurations & F-03 scores
  const [
    { data: activeConfig, error: configErr },
    { data: f03Raw, error: f03Err },
  ] = await Promise.all([
    supabase.from('weight_configurations').select('id, year, f02_ratio, f03_ratio').eq('is_active', true).maybeSingle(),
    supabase.from('f03_scores').select('institution_id, score'),
  ])

  if (configErr) return NextResponse.json({ error: configErr.message }, { status: 500 })
  if (f03Err) return NextResponse.json({ error: f03Err.message }, { status: 500 })

  if (!activeConfig) {
    return NextResponse.json(
      { error: 'Tidak ada konfigurasi bobot aktif. Aktifkan salah satu konfigurasi terlebih dahulu.' },
      { status: 404 }
    )
  }

  // Create lookup map for F-03
  const f03Map = new Map<string, number>()
  for (const f of f03Raw || []) {
    f03Map.set(f.institution_id, Number(f.score))
  }

  // 2. Fetch all scores via SQL view/function (F-02 in scale 1-5)
  const { data: rows, error: rpcErr } = await supabase.rpc('calculate_institution_scores', {
    p_institution_id: null,
  })

  if (rpcErr) {
    console.error('[scores/all] RPC error:', rpcErr)
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ rankings: [] })
  }

  // 3. Group flat rows into per-institution objects
  const institutionMap = new Map<string, {
    institutionId: string
    name: string
    category: string
    f02: number
    f03: number | null
    totalScore: number | null // Final integrated score: (0.75 * f02) + (0.25 * f03)
    aspects: Map<string, {
      aspectId: string
      aspectName: string
      aspectOrder: number
      aspectWeight: number
      scoreAspect: number
      indicators: any[]
    }>
  }>()

  for (const row of rows) {
    if (category && row.category !== category) continue

    if (!institutionMap.has(row.institution_id)) {
      const f03Val = f03Map.get(row.institution_id) ?? null
      const f02Val = row.total_score // F-02 in 0-5 scale

      // Final score formula using configurable ratios from the active weight_configuration
      // If F-03 is not filled, Nilai Akhir is NULL (rendered as "-")
      const f02Ratio = parseFloat(activeConfig.f02_ratio ?? 0.75)
      const f03Ratio = parseFloat(activeConfig.f03_ratio ?? 0.25)
      const finalScore = f03Val !== null ? (f02Ratio * f02Val) + (f03Ratio * f03Val) : null

      institutionMap.set(row.institution_id, {
        institutionId: row.institution_id,
        name: row.institution_name,
        category: row.category,
        f02: f02Val,
        f03: f03Val,
        totalScore: finalScore,
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

  // Convert map to rankings list and sorting
  const rankings = [...institutionMap.values()]
    .map((inst) => ({
      ...inst,
      aspects: [...inst.aspects.values()].sort((a, b) => a.aspectOrder - b.aspectOrder),
    }))
    .sort((a, b) => {
      // Float NULL scores to the bottom
      if (a.totalScore === null && b.totalScore !== null) return 1
      if (a.totalScore !== null && b.totalScore === null) return -1
      if (a.totalScore === null && b.totalScore === null) return 0
      return (b.totalScore || 0) - (a.totalScore || 0)
    })

  return NextResponse.json({
    weightConfigYear: activeConfig.year,
    f02Ratio: parseFloat(activeConfig.f02_ratio ?? 0.75),
    f03Ratio: parseFloat(activeConfig.f03_ratio ?? 0.25),
    rankings,
  })
}
