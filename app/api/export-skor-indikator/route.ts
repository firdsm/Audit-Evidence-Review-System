import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'

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

    // 2. Superadmin-only guard
    const role = await getAuditorRole()
    if (role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    // 2. Fetch institution name
    const { data: institution, error: instError } = await supabase
      .from('institutions')
      .select('id, name')
      .eq('id', institutionId)
      .single()

    if (instError || !institution) {
      return NextResponse.json(
        { error: 'Institusi tidak ditemukan' },
        { status: 404 }
      )
    }

    // 3. Fetch all indicators with their aspect's order_number
    //    We use !inner so only indicators that have a valid aspect are returned.
    //    We will LEFT JOIN assessments manually via a second query.
    const { data: indicators, error: indError } = await supabase
      .from('indicators')
      .select(`
        id,
        code,
        order_number,
        aspects!inner (
          order_number
        )
      `)

    if (indError || !indicators) {
      return NextResponse.json(
        { error: 'Gagal memuat data indikator' },
        { status: 500 }
      )
    }

    // 4. Fetch assessments for this institution (score only)
    const { data: assessments, error: assessError } = await supabase
      .from('assessments')
      .select('indicator_id, score')
      .eq('institution_id', institutionId)

    if (assessError) {
      return NextResponse.json(
        { error: 'Gagal memuat data penilaian' },
        { status: 500 }
      )
    }

    // 5. Build score lookup: indicator_id → score (undefined if no row)
    const idToScore = new Map<string, number | null>(
      (assessments || []).map((a) => [a.indicator_id, a.score])
    )

    // 6. Sort indicators: primarily by aspect.order_number, then indicator.order_number
    const sortedIndicators = [...indicators].sort((a, b) => {
      const aspA = (a.aspects as unknown as { order_number: number }).order_number
      const aspB = (b.aspects as unknown as { order_number: number }).order_number
      if (aspA !== aspB) return aspA - aspB
      return a.order_number - b.order_number
    })

    // 7. Build ExcelJS workbook — simple 2-column sheet
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AERS'
    const worksheet = workbook.addWorksheet('Skor Indikator')

    // Column definitions
    worksheet.columns = [
      { key: 'code',  width: 16 },
      { key: 'score', width: 10 },
    ]

    // Freeze pane: keep header row visible while scrolling
    worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]

    // Header row
    const headerRow = worksheet.addRow(['ID Indikator', 'Nilai'])
    headerRow.height = 20
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }, // slate-200
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left:   { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right:  { style: 'thin', color: { argb: 'FFCBD5E1' } },
      }
    })
    // Left-align "ID Indikator" header cell
    headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

    // Data rows
    for (const ind of sortedIndicators) {
      const rawScore = idToScore.get(ind.id)
      // undefined = no assessment row at all → '-'
      // null      = assessment row exists but score not filled → '-'
      // number    = actual score 1-5
      const scoreValue: number | string =
        rawScore !== undefined && rawScore !== null ? rawScore : '-'

      const dataRow = worksheet.addRow([ind.code, scoreValue])
      dataRow.height = 18

      dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left:   { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right:  { style: 'thin', color: { argb: 'FFCBD5E1' } },
        }

        if (colNum === 1) {
          // ID Indikator — left-aligned with indent
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
        } else {
          // Nilai — center-aligned; dim '-' placeholders
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
          if (scoreValue === '-') {
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FF9CA3AF' } }
          }
        }
      })
    }

    // 8. Generate buffer
    const outputBuffer = await workbook.xlsx.writeBuffer()

    // 9. Sanitize filename (strip illegal characters: / \ : * ? " < > |)
    const sanitizedName = institution.name
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`Skor Indikator - ${sanitizedName}.xlsx`)}`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengekspor Skor Indikator'
    console.error('Error exporting Skor Indikator:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
