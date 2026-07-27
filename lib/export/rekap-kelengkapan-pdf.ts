import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InstitutionDocCompletenessData {
  name: string
  category: string
  docCompleteness?: {
    percentage: number | null
  }
}

export function exportRekapKelengkapanPDF(institutions: InstitutionDocCompletenessData[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const todayStr = new Date().toISOString().split('T')[0]

  // Formatted date for header: "27 Juli 2026"
  const dateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42) // #0f172a
  doc.text('Rekap Kelengkapan Dokumen PEKPPP 2026', doc.internal.pageSize.getWidth() / 2, 16, {
    align: 'center',
  })

  // Date Generated
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139) // #64748b
  doc.text(`Dicetak pada: ${dateFormatted}`, doc.internal.pageSize.getWidth() - 14, 23, {
    align: 'right',
  })

  // Table columns & rows
  const tableHeaders = ['Nama Institusi', 'Kategori', '% Kelengkapan Dokumen']

  const tableData = institutions.map((inst) => {
    const p = inst.docCompleteness?.percentage
    const completenessStr = p !== null && p !== undefined ? `${p}%` : 'Belum dicek'
    return [inst.name, inst.category, completenessStr]
  })

  autoTable(doc, {
    startY: 27,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240], // #e2e8f0
      lineWidth: 0.15,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59], // #1e293b
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #f8fafc
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 'auto' },
      1: { halign: 'left', cellWidth: 50 },
      2: { halign: 'center', cellWidth: 50 },
    },
    didParseCell: (data) => {
      // Italic grey for "Belum dicek"
      if (data.section === 'body' && data.column.index === 2) {
        if (data.cell.raw === 'Belum dicek') {
          data.cell.styles.fontStyle = 'italic'
          data.cell.styles.textColor = [100, 116, 139]
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1
      const currentPage = data.pageNumber
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Halaman ${currentPage} dari ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'right' }
      )
    },
  })

  doc.save(`Rekap-Kelengkapan-Dokumen-${todayStr}.pdf`)
}
