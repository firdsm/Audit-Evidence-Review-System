import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface TemuanDocItem {
  id: string
  name: string
  order: number
}

export interface TemuanIndicator {
  id: string
  code: string
  name: string
  requiredDocs: TemuanDocItem[]
}

export interface TemuanAspect {
  id: string
  name: string
  indicators: TemuanIndicator[]
}

export interface TemuanReviewData {
  documentId: string
  checked: boolean
  note: string | null
}

export interface ExportTemuanPDFParams {
  institutionName: string
  aspects: TemuanAspect[]
  // Map indicatorId -> review items
  assessmentReviewsMap: Map<string, TemuanReviewData[]>
}

export function exportTemuanPDF({
  institutionName,
  aspects,
  assessmentReviewsMap,
}: ExportTemuanPDFParams) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const todayStr = new Date().toISOString().split('T')[0]

  // Dimensions & margins
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = { top: 10, right: 8, bottom: 10, left: 8 }
  const effectiveWidth = pageWidth - margin.left - margin.right // 281mm

  // 1. Header Dokumen (Persis Excel Title)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(31, 56, 100) // #1f3864
  doc.text('Pengecekan Dokumen Dukung PEKPPP 2026', pageWidth / 2, 12, {
    align: 'center',
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(31, 56, 100) // #1f3864
  doc.text(institutionName, pageWidth / 2, 18, {
    align: 'center',
  })

  // 2. Prepare Data & Track Aspect Indexes
  const rawRows: {
    no: number
    aspek: string
    indikator: string
    dokumen: string
    status: string
    catatan: string
    hasNote: boolean
    aspectIndex: number
    isFirstRowOfAspect: boolean
    isFirstRowOfIndicator: boolean
  }[] = []

  let rowNo = 0
  let aspectIdx = 0

  aspects.forEach((aspect) => {
    let isFirstInAspect = true

    aspect.indicators.forEach((indicator) => {
      let isFirstInIndicator = true
      const docReviews = assessmentReviewsMap.get(indicator.id) || []
      const requiredDocs = indicator.requiredDocs

      if (requiredDocs.length === 0) {
        rowNo++
        rawRows.push({
          no: rowNo,
          aspek: aspect.name,
          indikator: indicator.name,
          dokumen: '—',
          status: '—',
          catatan: '',
          hasNote: false,
          aspectIndex: aspectIdx,
          isFirstRowOfAspect: isFirstInAspect,
          isFirstRowOfIndicator: isFirstInIndicator,
        })
        isFirstInAspect = false
        isFirstInIndicator = false
      } else {
        const sortedDocs = [...requiredDocs].sort((a, b) => a.order - b.order)
        sortedDocs.forEach((docItem) => {
          rowNo++
          const review = docReviews.find((r) => r.documentId === docItem.id)
          const catatan = review?.note ?? ''
          let status = 'Tidak ada'

          if (review) {
            if (review.checked) {
              status = 'OK'
            } else if (catatan.trim().length > 0) {
              status = 'Ada Catatan'
            } else {
              status = 'Tidak ada'
            }
          }

          rawRows.push({
            no: rowNo,
            aspek: aspect.name,
            indikator: indicator.name,
            dokumen: docItem.name,
            status,
            catatan,
            hasNote: catatan.trim().length > 0,
            aspectIndex: aspectIdx,
            isFirstRowOfAspect: isFirstInAspect,
            isFirstRowOfIndicator: isFirstInIndicator,
          })
          isFirstInAspect = false
          isFirstInIndicator = false
        })
      }
    })
    aspectIdx++
  })

  // Format data: HANYA tampilkan teks Aspek/Indikator pada baris pertama grup (Visual Clean Merge)
  // Cara ini 100% aman dari bug kalkulasi tinggi rowSpan jspdf-autotable yang memicu page break liar
  const tableHeaders = ['No', 'Aspek', 'Indikator', 'Dokumen Dukung', 'Status', 'Catatan']
  const bodyData = rawRows.map((r) => [
    r.no,
    r.isFirstRowOfAspect ? r.aspek : '',
    r.isFirstRowOfIndicator ? r.indikator : '',
    r.dokumen,
    r.status,
    r.catatan,
  ])

  // Alternating Aspect Fills (Persis Excel: #f7f9fc & #edf2f8)
  const ASPECT_FILLS: [number, number, number][] = [
    [247, 249, 252], // #f7f9fc
    [237, 242, 248], // #edf2f8
  ]

  // 3. Render AutoTable
  autoTable(doc, {
    startY: 23,
    margin,
    head: [tableHeaders],
    body: bodyData,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [17, 17, 17], // #111111
      lineColor: [226, 232, 240], // #e2e8f0 (Border halus)
      lineWidth: 0.15,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: [217, 226, 243], // #d9e2f3 (Soft Blue persis Excel)
      textColor: [17, 17, 17],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: effectiveWidth * 0.05 }, // No (5%)
      1: { halign: 'left',   cellWidth: effectiveWidth * 0.18, fontStyle: 'bold', valign: 'top' }, // Aspek (18%)
      2: { halign: 'left',   cellWidth: effectiveWidth * 0.22, valign: 'top' }, // Indikator (22%)
      3: { halign: 'left',   cellWidth: effectiveWidth * 0.25 }, // Dokumen Dukung (25%)
      4: { halign: 'center', cellWidth: effectiveWidth * 0.10 }, // Status (10%)
      5: { halign: 'left',   cellWidth: effectiveWidth * 0.20 }, // Catatan (20%)
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rawRow = rawRows[data.row.index]
        if (!rawRow) return

        // Fill warna per Aspek (alternating per grup aspek persis Excel)
        const fill = ASPECT_FILLS[rawRow.aspectIndex % ASPECT_FILLS.length]
        data.cell.styles.fillColor = fill

        // Hilangkan garis horizontal antar baris dalam Aspek & Indikator yang sama untuk efek Seamless Visual Merge
        if (data.column.index === 1 && !rawRow.isFirstRowOfAspect) {
          // Hanya beri border bawah jika ini baris terakhir dalam grup aspek (atau biarkan seamless)
          data.cell.styles.lineWidth = { top: 0, right: 0.15, bottom: 0, left: 0.15 }
        }
        if (data.column.index === 2 && !rawRow.isFirstRowOfIndicator) {
          data.cell.styles.lineWidth = { top: 0, right: 0.15, bottom: 0, left: 0.15 }
        }

        // Soft yellow highlight pada Dokumen, Status, Catatan jika ada Catatan
        if (rawRow.hasNote && (data.column.index === 3 || data.column.index === 4 || data.column.index === 5)) {
          data.cell.styles.fillColor = [255, 251, 204] // #fffbcc
        }

        // Color coding & formatting khusus kolom Status (col index 4)
        if (data.column.index === 4) {
          const val = String(data.cell.raw)
          if (val === 'OK') {
            data.cell.styles.textColor = [26, 107, 53] // #1a6b35
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'Ada Catatan') {
            data.cell.styles.textColor = [139, 105, 20] // #8b6914
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [170, 170, 170] // #aaaaaa
            data.cell.styles.fontStyle = 'normal'
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1
      const currentPage = data.pageNumber
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Halaman ${currentPage} dari ${pageCount}`,
        pageWidth - margin.right,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'right' }
      )
    },
  })

  // Sanitize filename
  const sanitizedInstName = institutionName
    .replace(/\s+/g, ' ')
    .replace(/[\/\\:*?"<>|]/g, '')
    .trim()

  doc.save(`Pengecekan Dokumen - ${sanitizedInstName}.pdf`)
}
