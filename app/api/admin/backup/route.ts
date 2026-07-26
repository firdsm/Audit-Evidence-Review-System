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
    // Fetch all tables in parallel
    const [
      { data: auditors, error: e1 },
      { data: institutions, error: e2 },
      { data: aspects, error: e3 },
      { data: indicators, error: e4 },
      { data: assessments, error: e5 },
      { data: documentReviews, error: e6 },
      { data: folderMappings, error: e7 },
    ] = await Promise.all([
      supabase.from('auditors').select('*').order('id'),
      supabase.from('institutions').select('*').order('id'),
      supabase.from('aspects').select('*').order('id'),
      supabase.from('indicators').select('*').order('id'),
      supabase.from('assessments').select('*').order('id'),
      supabase.from('assessment_document_reviews').select('*').order('id'),
      supabase.from('indicator_folder_mapping').select('*').order('id'),
    ])

    // Check for errors
    const errors = [e1, e2, e3, e4, e5, e6, e7].filter(Boolean)
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

    // Build SQL content
    const lines: string[] = []

    // ── Header ──────────────────────────────────────────────────────────────
    lines.push('-- =====================================================')
    lines.push('-- AERS Database Backup')
    lines.push(`-- Generated : ${displayTimestamp}`)
    lines.push('-- Database  : PostgreSQL (Supabase)')
    lines.push('-- Tables    : auditors, institutions, aspects, indicators,')
    lines.push('--             assessments, assessment_document_reviews,')
    lines.push('--             indicator_folder_mapping')
    lines.push('-- =====================================================')
    lines.push('')

    lines.push('BEGIN;')
    lines.push('')

    // ── TRUNCATE (child-first to respect FK constraints) ─────────────────────
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- TRUNCATE (child → parent order)')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('TRUNCATE TABLE assessment_document_reviews CASCADE;')
    lines.push('TRUNCATE TABLE assessments CASCADE;')
    lines.push('TRUNCATE TABLE indicator_folder_mapping CASCADE;')
    lines.push('TRUNCATE TABLE indicators CASCADE;')
    lines.push('TRUNCATE TABLE aspects CASCADE;')
    lines.push('TRUNCATE TABLE institutions CASCADE;')
    lines.push('TRUNCATE TABLE auditors CASCADE;')
    lines.push('')

    // ── INSERT helpers ────────────────────────────────────────────────────────
    function escapeValue(val: unknown): string {
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
      if (typeof val === 'number') return String(val)
      if (typeof val === 'object') {
        // JSON / array
        const json = JSON.stringify(val)
        return `'${json.replace(/'/g, "''")}'`
      }
      // String: escape single quotes, keep everything else as-is
      const escaped = String(val).replace(/'/g, "''")
      return `'${escaped}'`
    }

    function buildInserts(tableName: string, rows: Record<string, unknown>[] | null): string[] {
      if (!rows || rows.length === 0) {
        return [`-- No data in ${tableName}`, '']
      }
      const columns = Object.keys(rows[0])
      const colList = columns.map((c) => `"${c}"`).join(', ')
      const result: string[] = []
      for (const row of rows) {
        const values = columns.map((c) => escapeValue(row[c])).join(', ')
        result.push(`INSERT INTO ${tableName} (${colList}) VALUES (${values});`)
      }
      result.push('')
      return result
    }

    // ── INSERT (parent-first order) ───────────────────────────────────────────
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: auditors')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('auditors', auditors as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: institutions')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('institutions', institutions as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: aspects')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('aspects', aspects as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: indicators')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('indicators', indicators as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: assessments')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('assessments', assessments as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: assessment_document_reviews')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('assessment_document_reviews', documentReviews as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- DATA: indicator_folder_mapping')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push(...buildInserts('indicator_folder_mapping', folderMappings as Record<string, unknown>[] | null))

    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('-- COMMIT')
    lines.push('-- ─────────────────────────────────────────────────────────')
    lines.push('COMMIT;')
    lines.push('')

    const sqlContent = lines.join('\n')

    // Return as downloadable SQL file
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
