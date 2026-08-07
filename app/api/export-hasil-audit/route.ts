import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { listFoldersInFolder } from '@/lib/google-drive'
import { matchAspectFolder } from '@/lib/drive-utils'
import {
  CELL_NAMA_INSTANSI,
  CELL_LINK_DRIVE,
  CELL_F03_SCORE,
  TEMPLATE_SHEET_NAME,
  INDICATOR_SCORE_MAPPING,
  ASPECT_LINK_MAPPING,
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

    // 2. Fetch institution details and F-03 score in parallel
    const [
      { data: institution, error: instError },
      { data: f03Row, error: f03Error },
    ] = await Promise.all([
      supabase
        .from('institutions')
        .select('id, name, category, drive_folder_id')
        .eq('id', institutionId)
        .single(),
      supabase
        .from('f03_scores')
        .select('score')
        .eq('institution_id', institutionId)
        .maybeSingle(),
    ])

    if (instError || !institution) {
      return NextResponse.json(
        { error: 'Institusi tidak ditemukan' },
        { status: 404 }
      )
    }

    if (f03Error) {
      return NextResponse.json(
        { error: 'Gagal memuat data F-03' },
        { status: 500 }
      )
    }

    // 3. Fetch indicators, assessments, indicator folders, and aspects in parallel
    const [
      { data: indicators, error: indError },
      { data: assessments, error: assessError },
      { data: indicatorFolders, error: folderError },
      { data: aspects, error: aspectError },
    ] = await Promise.all([
      supabase
        .from('indicators')
        .select('id, code'),
      supabase
        .from('assessments')
        .select('indicator_id, score')
        .eq('institution_id', institutionId),
      supabase
        .from('institution_indicator_folders')
        .select('indicator_id, drive_folder_id')
        .eq('institution_id', institutionId),
      supabase
        .from('aspects')
        .select('id, name, order_number')
        .order('order_number', { ascending: true }),
    ])

    if (indError || !indicators) {
      return NextResponse.json(
        { error: 'Gagal memuat data indikator' },
        { status: 500 }
      )
    }

    if (assessError) {
      return NextResponse.json(
        { error: 'Gagal memuat data penilaian' },
        { status: 500 }
      )
    }

    if (folderError) {
      console.warn('Warning: Gagal memuat data indicator folders:', folderError.message)
    }

    if (aspectError) {
      console.warn('Warning: Gagal memuat data aspects:', aspectError.message)
    }

    // 4. Fetch aspect folders directly from Google Drive if institution root folder is available
    let sortedAspectFolders: Array<{ id?: string | null; name?: string | null }> = []
    if (institution.drive_folder_id) {
      try {
        const rawFolders = await listFoldersInFolder(institution.drive_folder_id)
        sortedAspectFolders = rawFolders
          .filter((f) => f.id && f.name)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      } catch (err: any) {
        console.warn('Warning: Gagal mengambil aspect folders dari Drive:', err.message)
      }
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

    // 8. Fill Root Drive link as clickable hyperlink
    if (institution.drive_folder_id) {
      const driveUrl = `https://drive.google.com/drive/folders/${institution.drive_folder_id}`
      worksheet.getCell(CELL_LINK_DRIVE).value = {
        text: driveUrl,
        hyperlink: driveUrl,
      } as ExcelJS.CellHyperlinkValue
    }

    // 8.b Fill F-03 Score if available
    if (f03Row && f03Row.score !== null && f03Row.score !== undefined) {
      worksheet.getCell(CELL_F03_SCORE).value = Number(f03Row.score)
    }

    // 8.c Fill Aspect Drive links into header cells (E7, E17, E23, E30, E35, E40)
    if (aspects && aspects.length > 0) {
      for (const aspect of aspects) {
        const aspectCellAddress = ASPECT_LINK_MAPPING[aspect.order_number]
        if (!aspectCellAddress) continue

        const matchedAspect = matchAspectFolder(sortedAspectFolders, aspect.order_number)
        const aspectFolderId = matchedAspect?.id || institution.drive_folder_id

        if (aspectFolderId) {
          const driveUrl = `https://drive.google.com/drive/folders/${aspectFolderId}`
          worksheet.getCell(aspectCellAddress).value = {
            text: driveUrl,
            hyperlink: driveUrl,
          } as ExcelJS.CellHyperlinkValue
        }
      }
    }

    // 9. Build lookups:
    //    indicator code → indicator id
    //    indicator id   → assessment score
    //    indicator id   → drive folder id
    const codeToId = new Map(indicators.map((ind) => [ind.code, ind.id]))
    const idToScore = new Map(
      (assessments || []).map((a) => [a.indicator_id, a.score])
    )
    const idToFolder = new Map(
      (indicatorFolders || []).map((f) => [f.indicator_id, f.drive_folder_id])
    )

    // 10. Fill scores and Drive links per indicator based on mapping
    for (const [indicatorCode, scoreCellAddress] of Object.entries(INDICATOR_SCORE_MAPPING)) {
      const indicatorId = codeToId.get(indicatorCode)
      if (!indicatorId) continue // Unknown indicator code, skip

      // A. Fill score (Column H)
      const score = idToScore.get(indicatorId)
      if (score != null) {
        worksheet.getCell(scoreCellAddress).value = score
      }

      // B. Fill Drive link (Column E)
      // Extract row number from score cell address (e.g., 'H8' -> row 8 -> cell 'E8')
      const rowMatch = scoreCellAddress.match(/\d+/)
      if (rowMatch) {
        const rowNumber = rowMatch[0]
        const linkCellAddress = `E${rowNumber}`
        const specificFolderId = idToFolder.get(indicatorId) || institution.drive_folder_id

        if (specificFolderId) {
          const driveUrl = `https://drive.google.com/drive/folders/${specificFolderId}`
          worksheet.getCell(linkCellAddress).value = {
            text: driveUrl,
            hyperlink: driveUrl,
          } as ExcelJS.CellHyperlinkValue
        }
      }
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
