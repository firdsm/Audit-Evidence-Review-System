import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import {
  CELL_NAMA_INSTANSI,
  CELL_LINK_DRIVE,
  TEMPLATE_SHEET_NAME,
  INDICATOR_SCORE_MAPPING,
} from '@/lib/export/hasil-audit-mapping'

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
      .select('id, name, category, drive_folder_id')
      .eq('id', institutionId)
      .single()

    if (instError || !institution) {
      return NextResponse.json(
        { error: 'Institusi tidak ditemukan' },
        { status: 404 }
      )
    }

    // 3. Fetch all indicators (we need code + id mapping)
    const { data: indicators, error: indError } = await supabase
      .from('indicators')
      .select('id, code')

    if (indError || !indicators) {
      return NextResponse.json(
        { error: 'Gagal memuat data indikator' },
        { status: 500 }
      )
    }

    // 4. Fetch assessments for this institution
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

    // 5. Load template file
    const templatePath = path.join(
      process.cwd(),
      'public',
      'templates',
      'hasil-audit-template.xlsx'
    )

    let templateBuffer: Buffer
    try {
      templateBuffer = await fs.readFile(templatePath)
    } catch {
      return NextResponse.json(
        { error: 'File template hasil-audit-template.xlsx tidak ditemukan di public/templates/' },
        { status: 500 }
      )
    }

    // 6. Load into ExcelJS workbook
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer)

    const worksheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME)
    if (!worksheet) {
      return NextResponse.json(
        { error: `Worksheet "${TEMPLATE_SHEET_NAME}" tidak ditemukan di template` },
        { status: 500 }
      )
    }

    // 7. Fill institution name
    worksheet.getCell(CELL_NAMA_INSTANSI).value = institution.name

    // 8. Fill Drive link as clickable hyperlink
    if (institution.drive_folder_id) {
      const driveUrl = `https://drive.google.com/drive/folders/${institution.drive_folder_id}`
      worksheet.getCell(CELL_LINK_DRIVE).value = {
        text: driveUrl,
        hyperlink: driveUrl,
      } as ExcelJS.CellHyperlinkValue
    }
    // If drive_folder_id is null, leave the cell empty (don't write anything)

    // 9. Build lookup: indicator code → assessment score
    const codeToId = new Map(indicators.map((ind) => [ind.code, ind.id]))
    const idToScore = new Map(
      (assessments || []).map((a) => [a.indicator_id, a.score])
    )

    // 10. Fill scores per indicator based on mapping
    for (const [indicatorCode, cellAddress] of Object.entries(INDICATOR_SCORE_MAPPING)) {
      const indicatorId = codeToId.get(indicatorCode)
      if (!indicatorId) continue // Unknown indicator code, skip

      const score = idToScore.get(indicatorId)

      if (score != null) {
        // Write numeric score value
        worksheet.getCell(cellAddress).value = score
      }
      // If score is null/undefined → SKIP, leave cell empty
      // This ensures template formulas (SUM/AVERAGE) don't get polluted
    }

    // 11. Generate output buffer
    const outputBuffer = await workbook.xlsx.writeBuffer()

    // 12. Sanitize filename (strip karakter ilegal untuk nama file: / \ : * ? " < > |)
    const sanitizedName = institution.name
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`Kertas Kerja - ${sanitizedName}.xlsx`)}`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting Hasil Audit:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengekspor Hasil Audit' },
      { status: 500 }
    )
  }
}
