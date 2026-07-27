import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface RankedInstitutionPDFData {
  rank: string
  name: string
  category: string
  f02: number | null
  f03: number | null
  totalScore: number | null
  scoreKode: string
  scoreMakna: string
}

export function exportRekapHasilPenilaianPDF(rankings: RankedInstitutionPDFData[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const todayStr = new Date().toISOString().split('T')[0]
  const dateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42) // #0f172a
  doc.text('Rekap Hasil Penilaian PEKPPP 2026', doc.internal.pageSize.getWidth() / 2, 16, {
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
  const tableHeaders = [
    'Peringkat',
    'Nama Institusi',
    'Kategori Instansi',
    'F-02',
    'F-03',
    'Nilai Akhir',
    'Kategori',
    'Makna',
  ]

  const tableData = rankings.map((inst) => {
    const f02Str = inst.f02 !== null ? inst.f02.toFixed(2) : 'Belum dilakukan penilaian'
    const f03Str = inst.f02 !== null ? (inst.f03 !== null ? inst.f03.toFixed(2) : 'Belum Diisi') : '-'
    const totalScoreStr =
      inst.f02 !== null
        ? inst.totalScore !== null
          ? inst.totalScore.toFixed(2)
          : '-'
        : 'Belum dilakukan penilaian'
    const kodeStr = inst.f02 !== null ? (inst.scoreKode !== '-' ? inst.scoreKode : '-') : 'Belum dilakukan penilaian'
    const maknaStr =
      inst.f02 !== null ? (inst.scoreMakna !== 'Belum Terkategori' ? inst.scoreMakna : '-') : 'Belum dilakukan penilaian'

    return [
      inst.rank,
      inst.name,
      inst.category,
      f02Str,
      f03Str,
      totalScoreStr,
      kodeStr,
      maknaStr,
    ]
  })

  autoTable(doc, {
    startY: 27,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
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
      0: { halign: 'center', cellWidth: 20 },  // Peringkat
      1: { halign: 'left',   cellWidth: 'auto' }, // Nama Institusi
      2: { halign: 'left',   cellWidth: 35 },  // Kategori Instansi
      3: { halign: 'center', cellWidth: 24 },  // F-02
      4: { halign: 'center', cellWidth: 24 },  // F-03
      5: { halign: 'center', cellWidth: 26 },  // Nilai Akhir
      6: { halign: 'center', cellWidth: 22 },  // Kategori
      7: { halign: 'left',   cellWidth: 38 },  // Makna
    },
    didParseCell: (data) => {
      // Italic grey styling for "Belum dilakukan penilaian" / "Belum Diisi"
      if (data.section === 'body') {
        const val = String(data.cell.raw)
        if (val === 'Belum dilakukan penilaian' || val === 'Belum Diisi') {
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

  doc.save(`Rekap-Hasil-Penilaian-${todayStr}.pdf`)
}
