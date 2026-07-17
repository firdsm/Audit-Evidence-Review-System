import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/scores/institution?institutionId=<uuid>
 *
 * Updates F-02 to scale 1-5, LEFT JOINs F-03, and yields Nilai Akhir
 * for a single institution.
 */
export async function GET(request: NextRequest) {
  const institutionId = request.nextUrl.searchParams.get('institutionId')
  if (!institutionId) {
    return NextResponse.json({ error: 'Parameter institutionId diperlukan' }, { status: 400 })
  }

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parallel fetch: calculate scores via RPC, lookup F-03, and read active config ratios
  const [
    { data: rows, error: rpcErr },
    { data: f03Row, error: f03Err },
    { data: activeConfig, error: cfgErr },
  ] = await Promise.all([
    supabase.rpc('calculate_institution_scores', { p_institution_id: institutionId }),
    supabase.from('f03_scores').select('score').eq('institution_id', institutionId).maybeSingle(),
    supabase.from('weight_configurations').select('f02_ratio, f03_ratio').eq('is_active', true).maybeSingle(),
  ])

  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  if (f03Err) return NextResponse.json({ error: f03Err.message }, { status: 500 })
  if (cfgErr) return NextResponse.json({ error: cfgErr.message }, { status: 500 })

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: 'Tidak ada data skor. Pastikan konfigurasi bobot aktif tersedia.' },
      { status: 404 }
    )
  }

  const f02Val = rows[0].total_score
  const f03Val = f03Row ? Number(f03Row.score) : null
  const f02Ratio = parseFloat(activeConfig?.f02_ratio ?? 0.75)
  const f03Ratio = parseFloat(activeConfig?.f03_ratio ?? 0.25)
  const finalScore = f03Val !== null ? (f02Ratio * f02Val) + (f03Ratio * f03Val) : null

  const aspectMap = new Map<string, any>()
  for (const row of rows) {
    if (!aspectMap.has(row.aspect_id)) {
      aspectMap.set(row.aspect_id, {
        aspectId: row.aspect_id,
        aspectName: row.aspect_name,
        aspectOrder: row.aspect_order,
        aspectWeight: row.aspect_weight,
        scoreAspect: row.score_aspect,
        indicators: [],
      })
    }
    aspectMap.get(row.aspect_id)!.indicators.push({
      indicatorId: row.indicator_id,
      code: row.indicator_code,
      name: row.indicator_name,
      auditorScore: row.auditor_score,
      maxScore: row.max_score,
      pctAchieved: row.pct_achieved,
      weight: row.indicator_weight,
    })
  }

  return NextResponse.json({
    institutionId,
    institutionName: rows[0].institution_name,
    category: rows[0].category,
    f02: f02Val,
    f03: f03Val,
    totalScore: finalScore,
    aspects: [...aspectMap.values()].sort((a, b) => a.aspectOrder - b.aspectOrder),
  })
}
