import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/scores/institution?institutionId=<uuid>
 *
 * Returns a full weighted score breakdown for one institution.
 * Calculation is done entirely in the database via the
 * calculate_institution_scores() SQL function (STABLE, read-only).
 * The raw `score` values in `assessments` are never modified.
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

  // Call the DB function — all aggregation happens in Postgres
  const { data: rows, error } = await supabase.rpc('calculate_institution_scores', {
    p_institution_id: institutionId,
  })

  if (error) {
    console.error('[scores/institution] RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: 'Tidak ada data skor. Pastikan konfigurasi bobot aktif tersedia dan assessment telah diisi.' },
      { status: 404 }
    )
  }

  // ── Shape the flat rows into a structured breakdown ──────────────────────
  // Rows are already ordered: aspect_order ASC, indicator_code ASC
  // total_score and score_aspect are repeated on every row — pick from first

  const totalScore: number = rows[0].total_score

  // Group by aspect
  const aspectMap = new Map<string, {
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
  }>()

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
    totalScore,
    aspects: [...aspectMap.values()].sort((a, b) => a.aspectOrder - b.aspectOrder),
  })
}
