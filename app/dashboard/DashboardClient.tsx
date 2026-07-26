'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import UserDropdown from '@/components/UserDropdown'
import FullscreenButton from '@/components/FullscreenButton'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import { CategorySelect } from '@/components/CategorySelect'

interface DocCompleteness {
  okCount: number
  noteCount: number
  missingCount: number
  totalRequired: number
  percentage: number | null
}

interface InstitutionData {
  id: string
  name: string
  category: string
  is_priority?: boolean
  last_synced_at: string
  assessmentsCount: number
  docCompleteness?: DocCompleteness
}

interface DashboardClientProps {
  institutions: InstitutionData[]
  totalIndicators: number
  userEmail?: string
  userName?: string
  isSuperAdmin?: boolean
  allCategories: string[]
  initialGlobalDebugMode?: boolean
}

// ── Pagination helper ──────────────────────────────────────────────────────
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p) }

  addPage(1)
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) addPage(p)
  if (current < total - 2) pages.push('...')
  addPage(total)

  return pages
}

export default function DashboardClient({
  institutions,
  totalIndicators,
  userEmail = '',
  userName = '',
  isSuperAdmin = false,
  allCategories,
  initialGlobalDebugMode = false,
}: DashboardClientProps) {
  const router = useRouter()

  type FilterMode = 'per-kategori' | 'opd-prioritas'
  const [filterMode, setFilterMode] = useState<FilterMode>('per-kategori')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportRekapLoading, setExportRekapLoading] = useState(false)
  const [activePopover, setActivePopover] = useState<{
    id: string
    rect: DOMRect
    stats: NonNullable<InstitutionData['docCompleteness']>
  } | null>(null)
  const [namePopover, setNamePopover] = useState<{
    id: string
    name: string
    rect: DOMRect
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleScrollOrResize = () => {
      setActivePopover(null)
      setNamePopover(null)
    }
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [])

  const handleExportTemuan = async (instId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (exportingId) return
    setExportingId(instId)
    try {
      const url = `/api/export-temuan?institutionId=${encodeURIComponent(instId)}`
      window.open(url, '_blank')
    } finally {
      setTimeout(() => setExportingId(null), 1000)
    }
  }

  const togglePopover = (
    instId: string,
    stats: NonNullable<InstitutionData['docCompleteness']>,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation()
    if (activePopover?.id === instId) {
      setActivePopover(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setActivePopover({ id: instId, rect, stats })
    }
  }

  const handleFilterMode = (mode: FilterMode) => {
    if (mode === filterMode) return
    setFilterMode(mode)
    setSelectedCategory('ALL')
    setSearchInput('')
    setCurrentPage(1)
  }

  type SortCol = 'name' | 'assessmentsCount' | 'completeness'
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Filter institutions locally in memory (Search + Category/Priority)
  const filteredInstitutions = React.useMemo(() => {
    return institutions.filter((inst) => {
      const matchSearch = inst.name.toLowerCase().includes(searchInput.toLowerCase())
      const matchPriority = filterMode === 'opd-prioritas' ? !!inst.is_priority : true
      const matchCategory = selectedCategory === 'ALL' || inst.category === selectedCategory
      return matchSearch && matchPriority && matchCategory
    })
  }, [institutions, searchInput, filterMode, selectedCategory])

  // Sort filteredInstitutions — unassessed completeness always stays at the bottom when sorting by completeness
  const sortedInstitutions = React.useMemo(() => {
    return [...filteredInstitutions].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortCol === 'assessmentsCount') {
        cmp = a.assessmentsCount - b.assessmentsCount
      } else if (sortCol === 'completeness') {
        const pA = a.docCompleteness?.percentage ?? null
        const pB = b.docCompleteness?.percentage ?? null

        // Unassessed (null) always stays at the bottom
        if (pA === null && pB !== null) return 1
        if (pA !== null && pB === null) return -1
        if (pA === null && pB === null) return a.name.localeCompare(b.name)

        cmp = (pA ?? 0) - (pB ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredInstitutions, sortCol, sortDir])

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'name' ? 'asc' : 'desc')
    }
    setCurrentPage(1)
  }

  // Export Rekap Kelengkapan Dokumen Excel Handler using ExcelJS
  const handleExportRekapKelengkapan = async () => {
    if (filteredInstitutions.length === 0) return
    setExportRekapLoading(true)
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'AERS'
      const worksheet = workbook.addWorksheet('Kelengkapan Dokumen')

      const TOTAL_COLS = 3

      // ── Row 1: Title ──────────────────────────────────────────────────────
      const titleRow = worksheet.addRow([
        'Rekap Kelengkapan Dokumen PEKPPP 2026',
        '', '',
      ])
      worksheet.mergeCells(1, 1, 1, TOTAL_COLS)
      const titleCell = titleRow.getCell(1)
      titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      titleRow.height = 28

      // ── Row 2: Column headers ─────────────────────────────────────────────
      const HEADERS = ['Nama Institusi', 'Kategori', '% Kelengkapan Dokumen']
      const headerRow = worksheet.addRow(HEADERS)
      headerRow.height = 22
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FF94A3B8' } },
          left:   { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right:  { style: 'thin', color: { argb: 'FF94A3B8' } },
        }
      })

      worksheet.columns = [
        { key: 'name', width: 35 },
        { key: 'category', width: 22 },
        { key: 'completeness', width: 26 },
      ]

      // Freeze panes: keep title + header rows visible
      worksheet.views = [{ state: 'frozen', ySplit: 2, xSplit: 0 }]
      worksheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: TOTAL_COLS } }

      const thinBorder = {
        top:    { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        left:   { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        right:  { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      }

      // ── Data rows ────────────────────────────────────────────────────────
      sortedInstitutions.forEach((inst, idx) => {
        const isEven = idx % 2 === 1
        const rowBg = isEven ? 'FFF1F5F9' : 'FFFFFFFF'
        const percentageVal = inst.docCompleteness?.percentage

        const row = worksheet.addRow({
          name: inst.name,
          category: inst.category,
          completeness: percentageVal !== null && percentageVal !== undefined ? `${percentageVal}%` : 'Belum dicek',
        })
        row.height = 18

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          cell.border = thinBorder
          cell.font = { name: 'Arial', size: 10 }

          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' }
          } else if (colNum === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' }
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            if (percentageVal === null || percentageVal === undefined) {
              cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } }
            }
          }
        })
      })

      // Auto-fit column widths
      worksheet.columns.forEach((col) => {
        let maxLen = 0
        col.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
          if (rowNumber > 1) {
            const valStr = cell.value ? String(cell.value) : ''
            if (valStr.length > maxLen) maxLen = valStr.length
          }
        })
        const headerIdx = (col as any).number - 1
        const headerLen = HEADERS[headerIdx]?.length ?? 0
        col.width = Math.max(maxLen + 3, headerLen + 3, 12)
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fileDateStr = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `Rekap Kelengkapan Dokumen - ${fileDateStr}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export rekap kelengkapan dokumen:', err)
      alert('Gagal mengekspor data ke Excel')
    } finally {
      setExportRekapLoading(false)
    }
  }

  const PAGE_SIZE = 15

  // Get current page's sliced items
  const paginatedInstitutions = React.useMemo(() => {
    const offset = (currentPage - 1) * PAGE_SIZE
    return sortedInstitutions.slice(offset, offset + PAGE_SIZE)
  }, [sortedInstitutions, currentPage])

  const totalCount = sortedInstitutions.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setCurrentPage(1)
  }

  function handleCategoryChange(value: string) {
    setSelectedCategory(value)
    setCurrentPage(1)
  }

  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(currentPage * PAGE_SIZE, totalCount)
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans">
      {/* Background gradient — fixed so it doesn't affect sticky */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.08),transparent_50%)] pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────────────────
          1. TOP BAR — sticky top-0
          Selalu terlihat di paling atas viewport saat scroll.
      ──────────────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  AERS
                </span>
                <span className="hidden md:inline text-xs text-zinc-500 ml-2 border-l border-zinc-800 pl-2">
                  Audit Evidence Review System
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="ml-8 flex items-center gap-6">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-white transition-colors duration-200"
              >
                Daftar Instansi
              </Link>
              <Link
                href="/hasil-penilaian"
                className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors duration-200"
              >
                Hasil Penilaian
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FullscreenButton />
            <UserDropdown
              userName={userName}
              userEmail={userEmail}
              isSuperAdmin={isSuperAdmin}
              initialGlobalDebugMode={initialGlobalDebugMode}
            />
          </div>
        </div>
      </nav>

      {/* ANNOUNCEMENT BANNER */}
      <AnnouncementBanner page="dashboard" />

      {/* ─────────────────────────────────────────────────────────────────────
          Main content — semua di sini scroll normal kecuali filter bar
      ──────────────────────────────────────────────────────────────────────── */}
      <main className="relative z-0 max-w-7xl mx-auto px-6 pt-5 pb-20 space-y-4">

        {/* ─────────────────────────────────────────────────────────────────
            2. HEADING — normal flow, TIDAK sticky.
            Terlihat saat halaman dibuka, lalu scroll keluar dari viewport
            seperti konten biasa.
        ──────────────────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Daftar Instansi
          </h1>
          <p className="text-xs text-zinc-400">
            Pilih instansi untuk melakukan penilaian audit bukti pelayanan publik.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            3. FILTER BAR — sticky top-[65px] (= tinggi top bar).
        ──────────────────────────────────────────────────────────────────── */}
        <div className="sticky top-[65px] z-10 -mx-6 px-6 py-3 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/50 space-y-2">
          {/* ── Top-level filter tabs: Per Kategori / OPD Prioritas ── */}
          <div className="border-b border-zinc-800">
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-none -mb-px">
              {/* Tab: Per Kategori */}
              <button
                id="dashboard-filter-tab-per-kategori"
                onClick={() => handleFilterMode('per-kategori')}
                className={`relative shrink-0 px-5 py-3 text-xs font-semibold transition-colors duration-150 cursor-pointer focus:outline-none ${
                  filterMode === 'per-kategori'
                    ? 'text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Semua Instansi
                {filterMode === 'per-kategori' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />
                )}
              </button>

              {/* Tab: OPD Prioritas */}
              <button
                id="dashboard-filter-tab-opd-prioritas"
                onClick={() => handleFilterMode('opd-prioritas')}
                className={`relative shrink-0 px-5 py-3 text-xs font-semibold transition-colors duration-150 cursor-pointer focus:outline-none ${
                  filterMode === 'opd-prioritas'
                    ? 'text-indigo-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                OPD Prioritas
                {filterMode === 'opd-prioritas' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full" />
                )}
              </button>
            </div>
          </div>

          {/* Search bar, Category Dropdown, & Export Action Container */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-1">
            {/* Search Input (KIRI, flex-1) */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari nama instansi..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Category Dropdown (TENGAH, w-52 di desktop, flex-1 di mobile) */}
            <CategorySelect
              categories={allCategories}
              value={selectedCategory}
              onChange={handleCategoryChange}
            />

            {/* Export Rekap Dokumen Button (KANAN, Outline / Secondary Style) */}
            <button
              onClick={handleExportRekapKelengkapan}
              disabled={exportRekapLoading || filteredInstitutions.length === 0}
              className="h-9 flex items-center justify-center gap-2 px-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:bg-zinc-900/50 disabled:text-zinc-600 disabled:border-zinc-850 disabled:cursor-not-allowed border border-zinc-700/60 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4 text-emerald-400 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exportRekapLoading ? 'Mengekspor...' : 'Export Daftar Instansi'}
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            4. INSTITUTIONS TABLE — normal flow, scroll di bawah filter
        ──────────────────────────────────────────────────────────────────── */}
        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {sortedInstitutions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 mx-auto opacity-30 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="font-medium text-zinc-400">Tidak ada instansi ditemukan</p>
              <p className="text-xs">Coba bersihkan filter pencarian atau sinkronisasikan instansi dari Google Drive.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold bg-zinc-900/10">
                    <th className="py-3 px-4 w-10 text-center">No.</th>
                    {/* Sortable: Nama Instansi */}
                    <th
                      className="py-3 px-5 cursor-pointer select-none hover:text-zinc-200 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        Nama Instansi
                        <span className="text-[10px] opacity-60">
                          {sortCol === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="py-3 px-5 w-40">Kategori</th>
                    {/* Sortable: Progres Penilaian */}
                    <th
                      className="py-3 px-5 w-52 cursor-pointer select-none hover:text-zinc-200 transition-colors"
                      onClick={() => handleSort('assessmentsCount')}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        Progres Penilaian
                        <span className="text-[10px] opacity-60">
                          {sortCol === 'assessmentsCount' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                        </span>
                      </span>
                    </th>
                    {/* Sortable: % Kelengkapan Dokumen */}
                    <th
                      className="py-3 px-5 w-52 text-center cursor-pointer select-none hover:text-zinc-200 transition-colors"
                      onClick={() => handleSort('completeness')}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        % Kelengkapan Dokumen
                        <span className="text-[10px] opacity-60">
                          {sortCol === 'completeness' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                        </span>
                      </span>
                    </th>
                    <th className="py-3 px-4 w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {paginatedInstitutions.map((inst, idx) => {
                    const percentage = totalIndicators > 0
                      ? Math.round((inst.assessmentsCount / totalIndicators) * 100)
                      : 0
                    const docStats = inst.docCompleteness
                    const isExportingThis = exportingId === inst.id
                    const rowNumber = startItem + idx

                    return (
                      <tr
                        key={inst.id}
                        onClick={() => router.push(`/audit/${inst.id}`)}
                        className="hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-4 text-center text-zinc-500 font-mono text-xs">
                          {rowNumber}
                        </td>
                        <td className="py-2.5 px-5 font-semibold text-white group-hover:text-blue-400 transition-colors max-w-[260px]">
                          <span
                            className="block truncate"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setNamePopover({ id: inst.id, name: inst.name, rect })
                            }}
                            onMouseLeave={() => setNamePopover(null)}
                          >
                            {inst.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-5 max-w-[160px]">
                          <span
                            title={inst.category}
                            className="inline-block w-fit max-w-full truncate px-2.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-md text-xs font-semibold border border-zinc-700/30"
                          >
                            {inst.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-5">
                          <div className="space-y-1.5 max-w-xs">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-mono text-zinc-400">
                                {inst.assessmentsCount} / {totalIndicators} Indikator
                              </span>
                              <span className="font-semibold text-blue-500">{percentage}%</span>
                            </div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percentage}%` }}
                                className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                          {docStats && docStats.percentage !== null ? (
                            <div className="inline-block">
                              <button
                                type="button"
                                onClick={(e) => togglePopover(inst.id, docStats, e)}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setActivePopover({ id: inst.id, rect, stats: docStats })
                                }}
                                onMouseLeave={() => setActivePopover(null)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto ${
                                  docStats.percentage >= 80
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : docStats.percentage >= 40
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800'
                                }`}
                              >
                                <span>{docStats.percentage}%</span>
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500 italic">Belum dicek</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleExportTemuan(inst.id, e)}
                            disabled={isExportingThis}
                            title={`Unduh Export Temuan — ${inst.name}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 hover:bg-blue-600/20 hover:border-blue-500/40 border border-zinc-700/80 text-zinc-400 hover:text-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                          >
                            {isExportingThis ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            5. PAGINATION — sticky bottom-0.
            Selalu terlihat di bagian bawah viewport saat scroll.
            z-5: di bawah top bar (z-20) dan filter (z-10).
        ──────────────────────────────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-[5] px-6 py-3 bg-zinc-950 border-t border-zinc-800/80">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-zinc-500 order-2 sm:order-1">
                Menampilkan{' '}
                <span className="text-zinc-300 font-semibold">{startItem}–{endItem}</span>{' '}
                dari{' '}
                <span className="text-zinc-300 font-semibold">{totalCount}</span>{' '}
                instansi
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1 order-1 sm:order-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                  </button>

                  {pageNumbers.map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-xs text-zinc-600">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p as number)}
                        className={`min-w-[32px] px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all
                          ${p === currentPage
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    Next
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ── React Portal Popover (floating over overflow containers) ── */}
      {mounted && activePopover && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${Math.max(10, activePopover.rect.top - 145)}px`,
            left: `${Math.min(window.innerWidth - 245, Math.max(10, activePopover.rect.left + activePopover.rect.width / 2 - 110))}px`,
          }}
          className="w-56 p-3 bg-zinc-900/95 border border-zinc-700/90 rounded-xl shadow-2xl backdrop-blur-md z-50 text-xs text-left pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="font-semibold text-zinc-200 pb-1.5 mb-1.5 border-b border-zinc-800 flex justify-between items-center">
            <span>Kelengkapan Dokumen</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-zinc-300">OK</span>
              </div>
              <span className="font-semibold text-emerald-400 font-mono">
                {Math.round((activePopover.stats.okCount / activePopover.stats.totalRequired) * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-zinc-300">Ada catatan</span>
              </div>
              <span className="font-semibold text-amber-400 font-mono">
                {Math.round((activePopover.stats.noteCount / activePopover.stats.totalRequired) * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span className="text-zinc-400">Tidak ada/belum dicek</span>
              </div>
              <span className="font-semibold text-zinc-400 font-mono">
                {Math.round((activePopover.stats.missingCount / activePopover.stats.totalRequired) * 100)}%
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── React Portal Popover: Full Institution Name ── */}
      {mounted && namePopover && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${Math.max(10, namePopover.rect.top - 42)}px`,
            left: `${Math.max(10, namePopover.rect.left)}px`,
          }}
          className="max-w-xs px-3 py-1.5 bg-zinc-900/95 border border-zinc-700/90 rounded-xl shadow-2xl backdrop-blur-md z-50 text-xs font-semibold text-zinc-100 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          {namePopover.name}
        </div>,
        document.body
      )}
    </div>
  )
}
