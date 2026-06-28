/**
 * Mapping konfigurasi untuk export Hasil Audit berbasis template.
 *
 * Edit file ini untuk menyesuaikan posisi cell di template Excel.
 * Format cell: "A1", "C10", "B5", dst.
 */

// Cell untuk nama instansi (di bagian judul/header template)
export const CELL_NAMA_INSTANSI = 'B2' // ← sesuaikan dengan template Anda

// Cell untuk link Google Drive folder root institusi
export const CELL_LINK_DRIVE = 'E8' // ← sesuaikan dengan template Anda

// Nama worksheet di template (biasanya 'Sheet1')
export const TEMPLATE_SHEET_NAME = 'Kertas Kerja' // ← sesuaikan jika nama sheet berbeda

/**
 * Mapping indicator code → cell coordinate (untuk NILAI/SCORE saja)
 *
 * Format: 'KODE_INDIKATOR': 'CELL_ADDRESS'
 *
 * ⚠️ ISI MAPPING INI sesuai template Anda.
 * Contoh: jika indikator IND-01 nilainya di cell C10, tulis:
 *   'IND-01': 'C10',
 */
export const INDICATOR_SCORE_MAPPING: Record<string, string> = {
  // TODO: Isi mapping setelah template & daftar indikator dikonfirmasi
  'IND-01': 'H8',
  'IND-02': 'H9',
  'IND-03': 'H10',
  'IND-04': 'H11',
  'IND-05': 'H12',
  'IND-06': 'H13',
  'IND-07': 'H14',
  'IND-08': 'H15',
  'IND-09': 'H16',
  'IND-10': 'H18',
  'IND-11': 'H19',
  'IND-12': 'H20',
  'IND-13': 'H21',
  'IND-14': 'H22',
  'IND-15': 'H24',
  'IND-16': 'H25',
  'IND-17': 'H26',
  'IND-18': 'H27',
  'IND-19': 'H28',
  'IND-20': 'H29',
  'IND-21': 'H31',
  'IND-22': 'H32',
  'IND-23': 'H33',
  'IND-24': 'H34',
  'IND-25': 'H36',
  'IND-26': 'H37',
  'IND-27': 'H38',
  'IND-28': 'H39',
  'IND-29': 'H41',
  'IND-30': 'H42',
}
