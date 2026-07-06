import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import indicatorGuidance from '@/indicator-guidance.json'

// Types
interface RequiredDocumentDef {
  id: string
  name: string
  order: number
  required: boolean
  description?: string
}

interface IndicatorGuidance {
  indicator_code: string
  required_documents: RequiredDocumentDef[]
}

const guidanceData = indicatorGuidance as IndicatorGuidance[]

function getRequiredDocs(code: string): RequiredDocumentDef[] {
  const g = guidanceData.find((g) => g.indicator_code === code)
  return g?.required_documents ?? []
}

export async function GET(request: NextRequest) {
  try {
    const institutionId = request.nextUrl.searchParams.get('institutionId')

    if (!institutionId) {
      return NextResponse.json(
        { error: 'Parameter institutionId diperlukan' },
        { status: 400 }
      )
    }

    // 1. Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Sesi habis, silakan login kembali' },
        { status: 401 }
      )
    }

    // 2. Fetch institution details
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('id, name, category')
      .eq('id', institutionId)
      .single()

    if (instError || !institution) {
      return NextResponse.json(
        { error: 'Institusi tidak ditemukan' },
        { status: 404 }
      )
    }

    // 3. Fetch aspects + indicators (ordered)
    const { data: rawAspects, error: aspectsError } = await supabase
      .from('aspects')
      .select(`
        id,
        name,
        order_number,
        indicators (
          id,
          code,
          name,
          order_number
        )
      `)
      .order('order_number')

    if (aspectsError || !rawAspects) {
      return NextResponse.json(
        { error: 'Gagal memuat data aspek dan indikator' },
        { status: 500 }
      )
    }

    // Sort indicators inside each aspect
    const aspects = rawAspects.map((aspect: any) => ({
      ...aspect,
      indicators: (aspect.indicators || []).sort(
        (a: any, b: any) => a.order_number - b.order_number
      ),
    }))

    // 4. Fetch assessments with document_reviews for this institution
    const { data: assessments, error: assessError } = await supabase
      .from('assessments')
      .select(`
        id,
        indicator_id,
        document_reviews (
          document_id,
          checked,
          note
        )
      `)
      .eq('institution_id', institutionId)

    if (assessError) {
      return NextResponse.json(
        { error: 'Gagal memuat data penilaian' },
        { status: 500 }
      )
    }

    // Build lookup: indicator_id → document_reviews map
    const assessmentByIndicatorId = new Map<string, { document_id: string; checked: boolean; note: string | null }[]>()
    for (const a of assessments || []) {
      assessmentByIndicatorId.set(a.indicator_id, (a as any).document_reviews || [])
    }

    // ---- Build Excel ----
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AERS'
    workbook.created = new Date()

    const ws = workbook.addWorksheet('Pengecekan Dokumen', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    })

    // --- Column widths ---
    ws.columns = [
      { key: 'no',       width: 6  },
      { key: 'aspek',    width: 26 },
      { key: 'indikator',width: 32 },
      { key: 'dokumen',  width: 40 },
      { key: 'status',   width: 18 },
      { key: 'catatan',  width: 46 },
    ]

    // Style helpers
    const TITLE_COLOR = { argb: 'FF1F3864' }
    const TOTAL_COLS = 6

    // --- Row 1: Judul Dokumen ---
    const r1 = ws.addRow(['Pengecekan Dokumen Dukung PEKPPP 2026', '', '', '', '', ''])
    ws.mergeCells(r1.number, 1, r1.number, TOTAL_COLS)
    const r1c1 = r1.getCell(1)
    r1c1.font = { name: 'Calibri', size: 14, bold: true, color: TITLE_COLOR }
    r1c1.alignment = { horizontal: 'center', vertical: 'middle' }
    r1.height = 28

    // --- Row 2: Nama Instansi ---
    const r2 = ws.addRow([institution.name, '', '', '', '', ''])
    ws.mergeCells(r2.number, 1, r2.number, TOTAL_COLS)
    const r2c1 = r2.getCell(1)
    r2c1.font = { name: 'Calibri', size: 12, bold: true, color: TITLE_COLOR }
    r2c1.alignment = { horizontal: 'center', vertical: 'middle' }
    r2.height = 24

    // --- Row 3: spacer ---
    ws.addRow([])

    // --- Row 4: Table header ---
    const tableHeaderRow = ws.addRow(['No', 'Aspek', 'Indikator', 'Dokumen Dukung', 'Status', 'Catatan'])
    const TABLE_HEADER_ROW_NUM = tableHeaderRow.number

    const TABLE_HEADER_FILL: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E2F3' }, // soft blue for dark-text header
    }

    tableHeaderRow.eachCell((cell) => {
      cell.fill = TABLE_HEADER_FILL
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111111' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      }
    })
    tableHeaderRow.height = 28

    // Freeze panes at row 4 header
    ws.views = [{ state: 'frozen', ySplit: TABLE_HEADER_ROW_NUM }]

    // Auto filter on header
    ws.autoFilter = {
      from: { row: TABLE_HEADER_ROW_NUM, column: 1 },
      to: { row: TABLE_HEADER_ROW_NUM, column: 6 },
    }

    // --- Data rows ---
    let rowNo = 0

    // Track merge regions
    type MergeInfo = { startRow: number; endRow: number; col: number }
    const mergeRegions: MergeInfo[] = []

    // Alternating fill per ASPECT for clear grouping (2 soft professional tones)
    const ASPECT_FILLS: ExcelJS.FillPattern[] = [
      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } }, // almost-white blue tint
      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF2F8' } }, // soft steel blue
    ]
    let aspectIndex = 0 // incremented per aspect

    const BORDER_STYLE: Partial<ExcelJS.Borders> = {
      top:    { style: 'thin', color: { argb: 'FFBBBBBB' } },
      left:   { style: 'thin', color: { argb: 'FFBBBBBB' } },
      bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } },
      right:  { style: 'thin', color: { argb: 'FFBBBBBB' } },
    }

    for (const aspect of aspects) {
      const aspectFill = ASPECT_FILLS[aspectIndex % ASPECT_FILLS.length]
      aspectIndex++

      // Collect all rows for this aspect so we can merge later
      const aspectStartRow = (ws.lastRow?.number ?? TABLE_HEADER_ROW_NUM) + 1

      for (const indicator of aspect.indicators) {
        const docReviews = assessmentByIndicatorId.get(indicator.id) || []
        const requiredDocs = getRequiredDocs(indicator.code)

        if (requiredDocs.length === 0) {
          // No required documents — still add one row with a dash
          rowNo++
          const row = ws.addRow([
            rowNo,
            aspect.name,
            indicator.name,
            '—',
            '—',
            '',
          ])
          styleDataRow(row, aspectFill, BORDER_STYLE, false)
          continue
        }

        const indStartRow = (ws.lastRow?.number ?? TABLE_HEADER_ROW_NUM) + 1

        const sortedDocs = [...requiredDocs].sort((a, b) => a.order - b.order)

        for (const doc of sortedDocs) {
          rowNo++
          const review = docReviews.find((r) => r.document_id === doc.id)
          const status = review?.checked ? 'OK' : 'Tidak ada'
          const catatan = review?.note ?? ''

          const row = ws.addRow([
            rowNo,
            aspect.name,
            indicator.name,
            doc.name,
            status,
            catatan,
          ])

          styleDataRow(row, aspectFill, BORDER_STYLE, catatan.length > 0)

          // Auto row height based on longest content (doc name or catatan)
          const CHAR_PER_LINE_DOC = 42   // approx chars per line at col width 40
          const CHAR_PER_LINE_NOTE = 48  // approx chars per line at col width 46
          const LINE_HEIGHT = 15
          const BASE_HEIGHT = 10

          const docLines = Math.ceil(doc.name.length / CHAR_PER_LINE_DOC)
          const noteLines = catatan.length > 0 ? Math.ceil(catatan.length / CHAR_PER_LINE_NOTE) : 1
          const neededLines = Math.max(docLines, noteLines)
          row.height = Math.min(120, Math.max(22, neededLines * LINE_HEIGHT + BASE_HEIGHT))
        }

        // Merge Indikator column (col 3) for all docs of this indicator
        const indEndRow = ws.lastRow!.number
        if (indEndRow > indStartRow) {
          mergeRegions.push({ startRow: indStartRow, endRow: indEndRow, col: 3 })
        }
      }

      // Merge Aspek column (col 2) for all rows in this aspect
      const aspectEndRow = ws.lastRow!.number
      if (aspectEndRow > aspectStartRow) {
        mergeRegions.push({ startRow: aspectStartRow, endRow: aspectEndRow, col: 2 })
      }
    }

    // Apply merges
    for (const m of mergeRegions) {
      ws.mergeCells(m.startRow, m.col, m.endRow, m.col)
      const cell = ws.getCell(m.startRow, m.col)
      // Left-top alignment for merged Aspek/Indikator cells
      cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
      // Reapply border after merge
      cell.border = BORDER_STYLE as ExcelJS.Borders
    }

    // ---- Output ----
    const outputBuffer = await workbook.xlsx.writeBuffer()

    const sanitizedName = institution.name
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`Pengecekan Dokumen - ${sanitizedName}.xlsx`)}`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting Export Temuan:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengekspor data temuan' },
      { status: 500 }
    )
  }
}

// Helper: apply fill, alignment, and border to a data row
function styleDataRow(
  row: ExcelJS.Row,
  fill: ExcelJS.FillPattern,
  border: Partial<ExcelJS.Borders>,
  hasNote: boolean
) {
  const BLACK   = { argb: 'FF111111' }
  const GREEN   = { argb: 'FF1A6B35' }  // professional dark green for 'OK'
  const GREY    = { argb: 'FFAAAAAA' }  // muted grey for '-'
  // Soft yellow highlight for rows with notes (cols 4, 5, 6)
  const NOTE_FILL: ExcelJS.FillPattern = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBCC' },
  }

  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    // Apply yellow highlight on doc+status+catatan cols when row has a note
    const useNoteFill = hasNote && (colNumber === 4 || colNumber === 5 || colNumber === 6)
    cell.fill = useNoteFill ? NOTE_FILL : fill
    cell.border = border as ExcelJS.Borders
    cell.font = { name: 'Calibri', size: 10.5, color: BLACK }

    // Column-specific alignment
    if (colNumber === 1) {
      // No - center
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    } else if (colNumber === 2 || colNumber === 3) {
      // Aspek, Indikator - will be overridden by merge alignment (left-top)
      cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
    } else if (colNumber === 4 || colNumber === 6) {
      // Dokumen Dukung, Catatan - wrap text, left, middle
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    } else if (colNumber === 5) {
      // Status - center
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      const val = String(cell.value ?? '')
      if (val === 'OK') {
        cell.font = { name: 'Calibri', size: 10.5, color: GREEN, bold: true }
      } else {
        cell.font = { name: 'Calibri', size: 10.5, color: GREY }
      }
    }
  })
}
