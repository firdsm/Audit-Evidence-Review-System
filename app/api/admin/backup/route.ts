import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'

/**
 * GET /api/admin/backup
 *
 * Generates a full SQL backup of all AERS application tables.
 * Only accessible by superadmin users.
 * Returns a downloadable .sql file.
 */
export async function GET() {
  // Guard: superadmin only
  const denied = await requireSuperAdminApi()
  if (denied) return denied

  const supabase = await createClient()

  try {
    // Fetch all 13 application tables in parallel
    const [
      { data: appSettings,               error: e01 },
      { data: auditors,                  error: e02 },
      { data: institutions,              error: e03 },
      { data: weightConfigurations,      error: e04 },
      { data: aspects,                   error: e05 },
      { data: indicators,                error: e06 },
      { data: aspectWeights,             error: e07 },
      { data: indicatorWeights,          error: e08 },
      { data: indicatorFolderMapping,    error: e09 },
      { data: assessments,               error: e10 },
      { data: institutionIndicatorFolders, error: e11 },
      { data: institutionNotes,          error: e12 },
      { data: documentReviews,           error: e13 },
    ] = await Promise.all([
      supabase.from('app_settings').select('*'),
      supabase.from('auditors').select('*').order('id'),
      supabase.from('institutions').select('*').order('id'),
      supabase.from('weight_configurations').select('*').order('id'),
      supabase.from('aspects').select('*').order('id'),
      supabase.from('indicators').select('*').order('id'),
      supabase.from('aspect_weights').select('*').order('id'),
      supabase.from('indicator_weights').select('*').order('id'),
      supabase.from('indicator_folder_mapping').select('*').order('id'),
      supabase.from('assessments').select('*').order('id'),
      supabase.from('institution_indicator_folders').select('*').order('id'),
      supabase.from('institution_notes').select('*').order('id'),
      supabase.from('document_reviews').select('*').order('id'),
    ])

    // Check for errors — report the first one encountered
    const errors = [e01, e02, e03, e04, e05, e06, e07, e08, e09, e10, e11, e12, e13].filter(Boolean)
    if (errors.length > 0) {
      console.error('[backup] Fetch errors:', errors)
      return NextResponse.json(
        { error: 'Gagal mengambil data dari database: ' + errors[0]?.message },
        { status: 500 }
      )
    }

    // Generate timestamp for header and filename
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const displayTimestamp = `${dateStr} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const filename = `aers-backup-${dateStr}-${timeStr}.sql`

    // ── Helpers ──────────────────────────────────────────────────────────────

    function escapeValue(val: unknown): string {
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
      if (typeof val === 'number') return String(val)
      if (typeof val === 'object') {
        const json = JSON.stringify(val)
        return `'${json.replace(/'/g, "''")}'`
      }
      const escaped = String(val).replace(/'/g, "''")
      return `'${escaped}'`
    }

    function section(tableName: string, rows: Record<string, unknown>[] | null): string[] {
      const out: string[] = []
      out.push(`-- ─────────────────────────────────────────────────────────`)
      out.push(`-- DATA: ${tableName}`)
      out.push(`-- ─────────────────────────────────────────────────────────`)
      if (!rows || rows.length === 0) {
        out.push(`-- (no data)`)
        out.push('')
        return out
      }
      const columns = Object.keys(rows[0])
      const colList = columns.map((c) => `"${c}"`).join(', ')
      for (const row of rows) {
        const values = columns.map((c) => escapeValue(row[c])).join(', ')
        out.push(`INSERT INTO ${tableName} (${colList}) VALUES (${values});`)
      }
      out.push('')
      return out
    }

    // ── Build SQL ─────────────────────────────────────────────────────────────

    const lines: string[] = []

    // Header
    lines.push('-- =====================================================')
    lines.push('-- AERS Database Backup')
    lines.push(`-- Generated : ${displayTimestamp}`)
    lines.push('-- Database  : PostgreSQL (Supabase)')
    lines.push('-- Tables    : app_settings, auditors, institutions,')
    lines.push('--             weight_configurations, aspects, indicators,')
    lines.push('--             aspect_weights, indicator_weights,')
    lines.push('--             indicator_folder_mapping, assessments,')
    lines.push('--             institution_indicator_folders, institution_notes,')
    lines.push('--             document_reviews')
    lines.push('-- =====================================================')
    lines.push('')

    lines.push('BEGIN;')
    lines.push('')

    // TRUNCATE — child-first (CASCADE handles FK automatically)
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- TRUNCATE (child → parent order)')
    lines.push('-- ─────────────────────────────────────────────────────────')
    const truncateOrder = [
      'document_reviews',
      'institution_notes',
      'institution_indicator_folders',
      'assessments',
      'indicator_folder_mapping',
      'indicator_weights',
      'aspect_weights',
      'indicators',
      'aspects',
      'weight_configurations',
      'institutions',
      'auditors',
      'app_settings',
    ]
    for (const tbl of truncateOrder) {
      lines.push(`TRUNCATE TABLE ${tbl} CASCADE;`)
    }
    lines.push('')

    // INSERT — parent-first
    lines.push(...section('app_settings',                appSettings                as Record<string, unknown>[] | null))
    lines.push(...section('auditors',                    auditors                   as Record<string, unknown>[] | null))
    lines.push(...section('institutions',                institutions               as Record<string, unknown>[] | null))
    lines.push(...section('weight_configurations',       weightConfigurations       as Record<string, unknown>[] | null))
    lines.push(...section('aspects',                     aspects                    as Record<string, unknown>[] | null))
    lines.push(...section('indicators',                  indicators                 as Record<string, unknown>[] | null))
    lines.push(...section('aspect_weights',              aspectWeights              as Record<string, unknown>[] | null))
    lines.push(...section('indicator_weights',           indicatorWeights           as Record<string, unknown>[] | null))
    lines.push(...section('indicator_folder_mapping',   indicatorFolderMapping     as Record<string, unknown>[] | null))
    lines.push(...section('assessments',                 assessments                as Record<string, unknown>[] | null))
    lines.push(...section('institution_indicator_folders', institutionIndicatorFolders as Record<string, unknown>[] | null))
    lines.push(...section('institution_notes',           institutionNotes           as Record<string, unknown>[] | null))
    lines.push(...section('document_reviews',            documentReviews            as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- COMMIT')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('COMMIT;')
    lines.push('')

    const sqlContent = lines.join('\n')

    return new NextResponse(sqlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    console.error('[backup] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Terjadi kesalahan tidak terduga saat membuat backup.' },
      { status: 500 }
    )
  }
}
