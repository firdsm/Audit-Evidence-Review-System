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
  const priority = request.nextUrl.searchParams.get('priority') === 'true'

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch configurations, F-03 scores, and ALL institutions (for fallback)
  const [
    { data: activeConfig, error: configErr },
    { data: f03Raw, error: f03Err },
    { data: allInstitutionsRaw, error: priorityErr },
  ] = await Promise.all([
    supabase.from('weight_configurations').select('id, year, f02_ratio, f03_ratio').eq('is_active', true).maybeSingle(),
    supabase.from('f03_scores').select('institution_id, score'),
    supabase.from('institutions').select('id, name, category, is_priority'),
  ])

  if (configErr) return NextResponse.json({ error: configErr.message }, { status: 500 })
  if (f03Err) return NextResponse.json({ error: f03Err.message }, { status: 500 })
  if (priorityErr) return NextResponse.json({ error: priorityErr.message }, { status: 500 })

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

  // Create lookup maps from full institutions list
  const priorityMap = new Map<string, boolean>()
  const institutionMeta = new Map<string, { name: string; category: string; isPriority: boolean }>()
  for (const inst of allInstitutionsRaw || []) {
    priorityMap.set(inst.id, !!inst.is_priority)
    institutionMeta.set(inst.id, {
      name: inst.name,
      category: inst.category,
      isPriority: !!inst.is_priority,
    })
  }

  // 2. Fetch all scores via SQL view/function (F-02 in scale 1-5)
  const { data: rows, error: rpcErr } = await supabase.rpc('calculate_institution_scores', {
    p_institution_id: null,
  })

  if (rpcErr) {
    console.error('[scores/all] RPC error:', rpcErr)
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  // Note: rows may be empty if NO institution has been assessed yet.
  // We still need to run the fallback below to include unassessed institutions.

  // 3. Group flat rows into per-institution objects
  const institutionMap = new Map<string, {
    institutionId: string
    name: string
    category: string
    isPriority: boolean
    f02: number | null
    f03: number | null
    totalScore: number | null
    aspects: Map<string, {
      aspectId: string
      aspectName: string
      aspectOrder: number
      aspectWeight: number
      scoreAspect: number
      indicators: any[]
    }>
  }>()

  const f02Ratio = parseFloat(activeConfig.f02_ratio ?? 0.75)
  const f03Ratio = parseFloat(activeConfig.f03_ratio ?? 0.25)

  for (const row of rows || []) {
    if (category && row.category !== category) continue

    const isPri = priorityMap.get(row.institution_id) ?? false
    if (priority && !isPri) continue

    if (!institutionMap.has(row.institution_id)) {
      const f03Val = f03Map.get(row.institution_id) ?? null
      // total_score from RPC is NULL when institution has no assessments
      const f02Val: number | null = row.total_score ?? null

      // Final score: only computable when both F-02 and F-03 are available
      const finalScore =
        f02Val !== null && f03Val !== null
          ? f02Ratio * f02Val + f03Ratio * f03Val
          : null

      institutionMap.set(row.institution_id, {
        institutionId: row.institution_id,
        name: row.institution_name,
        category: row.category,
        isPriority: isPri,
        f02: f02Val,
        f03: f03Val,
        totalScore: finalScore,
        aspects: new Map(),
      })
    }

    const inst = institutionMap.get(row.institution_id)!

    if (row.aspect_id && !inst.aspects.has(row.aspect_id)) {
      inst.aspects.set(row.aspect_id, {
        aspectId: row.aspect_id,
        aspectName: row.aspect_name,
        aspectOrder: row.aspect_order ?? 0,
        aspectWeight: row.aspect_weight ?? 0,
        scoreAspect: row.score_aspect ?? 0,
        indicators: [],
      })
    }

    if (row.aspect_id && row.indicator_id) {
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
  }

  // 4. Fallback: inject institutions that never appeared in RPC rows at all
  //    (i.e., they have ZERO assessments so the SQL function returned no rows for them)
  for (const [id, meta] of institutionMeta) {
    if (institutionMap.has(id)) continue  // already processed via RPC

    // Apply same filters
    if (category && meta.category !== category) continue
    if (priority && !meta.isPriority) continue

    institutionMap.set(id, {
      institutionId: id,
      name: meta.name,
      category: meta.category,
      isPriority: meta.isPriority,
      f02: null,
      f03: f03Map.get(id) ?? null,
      totalScore: null,
      aspects: new Map(),
    })
  }

  // Convert map to rankings list and sorting
  const rankings = [...institutionMap.values()]
    .map((inst) => ({
      ...inst,
      aspects: [...inst.aspects.values()].sort((a, b) => a.aspectOrder - b.aspectOrder),
    }))
    .sort((a, b) => {
      // 1. Unassessed (f02 === null) always go to the bottom
      if (a.f02 === null && b.f02 !== null) return 1
      if (a.f02 !== null && b.f02 === null) return -1
      if (a.f02 === null && b.f02 === null) return 0

      // 2. Float NULL totalScore (e.g. F-03 not filled yet) to the bottom of assessed list but above unassessed
      if (a.totalScore === null && b.totalScore !== null) return 1
      if (a.totalScore !== null && b.totalScore === null) return -1
      if (a.totalScore === null && b.totalScore === null) return 0

      // 3. Otherwise sort by totalScore DESC
      return (b.totalScore || 0) - (a.totalScore || 0)
    })

  return NextResponse.json({
    weightConfigYear: activeConfig.year,
    f02Ratio: parseFloat(activeConfig.f02_ratio ?? 0.75),
    f03Ratio: parseFloat(activeConfig.f03_ratio ?? 0.25),
    rankings,
  })
}
