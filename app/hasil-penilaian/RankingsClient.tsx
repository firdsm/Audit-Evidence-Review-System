'use client'

import React, { useState, useEffect, useTransition, useMemo } from 'react'
import Link from 'next/link'
import UserDropdown from '@/components/UserDropdown'
import FullscreenButton from '@/components/FullscreenButton'

interface RankingsClientProps {
  userEmail: string
  userName: string
  isSuperAdmin: boolean
  allCategories: string[]
  initialGlobalDebugMode?: boolean
}

interface RankedInstitution {
  institutionId: string
  name: string
  category: string
  f02: number
  f03: number | null
  totalScore: number | null
}

interface ValueCategory {
  id: string
  kode: string
  makna: string
  min_score: number
  max_score: number
  color: string
}

// Map db color presets to styles
const COLOR_CLASSES: Record<string, string> = {
  red: 'bg-red-500/15 text-red-400 border-red-500/25',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  zinc: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
}

export default function RankingsClient({
  userEmail,
  userName,
  isSuperAdmin,
  allCategories,
  initialGlobalDebugMode = false,
}: RankingsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [rankings, setRankings] = useState<RankedInstitution[]>([])
  const [valueCategories, setValueCategories] = useState<ValueCategory[]>([])
  const [f02Ratio, setF02Ratio] = useState<number>(0.75)
  const [f03Ratio, setF03Ratio] = useState<number>(0.25)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Fetch rankings and value categories
  const fetchData = async (categoryFilter: string) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const url =
        categoryFilter === 'ALL'
          ? '/api/scores/all'
          : `/api/scores/all?category=${encodeURIComponent(categoryFilter)}`

      const [resRankings, resValueCats] = await Promise.all([
        fetch(url),
        fetch('/api/admin/value-categories'),
      ])

      if (!resRankings.ok) {
        const errJson = await resRankings.json().catch(() => ({}))
        throw new Error(errJson.error || `HTTP error! status: ${resRankings.status}`)
      }

      const data = await resRankings.json()
      setRankings(data.rankings || [])
      if (data.f02Ratio !== undefined) setF02Ratio(data.f02Ratio)
      if (data.f03Ratio !== undefined) setF03Ratio(data.f03Ratio)

      if (resValueCats.ok) {
        const dataCats = await resValueCats.json()
        const parsedCats = (dataCats || []).map((c: any) => ({
          ...c,
          min_score: parseFloat(c.min_score),
          max_score: parseFloat(c.max_score),
        }))
        setValueCategories(parsedCats)
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      setErrorMsg(err.message || 'Gagal memuat rekap peringkat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => {
      fetchData(selectedCategory)
    })
  }, [selectedCategory])

  // Helper function to find category classification for a given score
  const getScoreCategory = (score: number | null): { kode: string; makna: string; class: string } => {
    if (score === null) return { kode: '-', makna: 'Belum Terkategori', class: COLOR_CLASSES.zinc }
    const match = valueCategories.find((c) => score >= c.min_score && score <= c.max_score)
    if (match) {
      return {
        kode: match.kode,
        makna: match.makna,
        class: COLOR_CLASSES[match.color] || COLOR_CLASSES.zinc,
      }
    }
    return { kode: '-', makna: 'Belum Terkategori', class: COLOR_CLASSES.zinc }
  };

  // Filter rankings by search query in real-time
  const filteredRankings = useMemo(() => {
    return rankings.filter((inst) =>
      inst.name.toLowerCase().includes(searchInput.toLowerCase())
    )
  }, [rankings, searchInput])



  // Download Kertas Kerja per institusi — reuses /api/export-hasil-audit endpoint
  const handleDownloadKertasKerja = async (institutionId: string, institutionName: string) => {
    if (downloadingId) return // prevent concurrent downloads
    setDownloadingId(institutionId)
    try {
      const url = `/api/export-hasil-audit?institutionId=${encodeURIComponent(institutionId)}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Gagal mengunduh Kertas Kerja (${res.status})`)
      }
      const blob = await res.blob()
      const objUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      const safeName = institutionName.replace(/[\/\\:*?"<>|]/g, '').trim()
      a.download = `Kertas Kerja - ${safeName}.xlsx`
      a.click()
      window.URL.revokeObjectURL(objUrl)
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh Kertas Kerja')
    } finally {
      setDownloadingId(null)
    }
  }

  // Map app color keys → light ARGB fills for Excel Kode column background
  const COLOR_TO_ARGB: Record<string, string> = {
    emerald: 'FFD1FAE5',
    blue:    'FFDBEAFE',
    amber:   'FFFEF3C7',
    orange:  'FFFFEDD5',
    red:     'FFFEE2E2',
    violet:  'FFEDE9FE',
    zinc:    'FFF4F4F5',
  }

  // Export to Excel handler using exceljs
  const handleExportExcel = async () => {
    if (filteredRankings.length === 0) return
    setExporting(true)
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'AERS'
      const worksheet = workbook.addWorksheet('Peringkat Nilai')

      const TOTAL_COLS = 8

      // ── Row 1: Title ──────────────────────────────────────────────────────
      const titleRow = worksheet.addRow([
        'Rekap Hasil Penilaian PEKPPP 2026',
        '', '', '', '', '', '', '',
      ])
      worksheet.mergeCells(1, 1, 1, TOTAL_COLS)
      const titleCell = titleRow.getCell(1)
      titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      titleRow.height = 28

      // ── Row 2: Column headers ─────────────────────────────────────────────
      const HEADERS = [
        'Peringkat', 'Nama Institusi', 'Kategori Instansi',
        'F-02', 'F-03', 'Nilai Akhir', 'Kategori', 'Makna',
      ]
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

      // Define columns (keys used for auto-width pass below)
      worksheet.columns = [
        { key: 'rank',       width: 10 },
        { key: 'name',       width: 35 },
        { key: 'category',   width: 18 },
        { key: 'f02',        width: 8 },
        { key: 'f03',        width: 8 },
        { key: 'totalScore', width: 12 },
        { key: 'scoreKode',  width: 10 },
        { key: 'scoreMakna', width: 22 },
      ]

      // Freeze panes: keep title + header rows visible while scrolling
      worksheet.views = [{ state: 'frozen', ySplit: 2, xSplit: 0 }]

      // AutoFilter on header row (row 2), spanning all columns
      worksheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: TOTAL_COLS } }

      // Thin border helper
      const thinBorder = {
        top:    { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        left:   { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        right:  { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      }

      // ── Data rows ────────────────────────────────────────────────────────
      filteredRankings.forEach((inst, idx) => {
        const scoreCat = getScoreCategory(inst.totalScore)
        const isEven = idx % 2 === 1
        const rowBg = isEven ? 'FFF1F5F9' : 'FFFFFFFF'

        const row = worksheet.addRow({
          rank:       inst.totalScore !== null ? idx + 1 : '-',
          name:       inst.name,
          category:   inst.category,
          f02:        parseFloat(inst.f02.toFixed(2)),
          f03:        inst.f03 !== null ? parseFloat(inst.f03.toFixed(2)) : 'Belum Diisi',
          totalScore: inst.totalScore !== null ? parseFloat(inst.totalScore.toFixed(2)) : '-',
          scoreKode:  scoreCat.kode !== '-' ? scoreCat.kode : '-',
          scoreMakna: scoreCat.makna !== 'Belum Terkategori' ? scoreCat.makna : '-',
        })
        row.height = 18

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          // Alternating row background
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
          cell.border = thinBorder
          cell.font = { name: 'Arial', size: 10 }

          // Column-specific alignment & format
          switch (colNum) {
            case 1: // Peringkat
              cell.alignment = { horizontal: 'center', vertical: 'middle' }
              cell.font = { name: 'Arial', size: 10, bold: true }
              break
            case 2: // Nama Institusi
              cell.alignment = { horizontal: 'left', vertical: 'middle' }
              break
            case 3: // Kategori Instansi
              cell.alignment = { horizontal: 'left', vertical: 'middle' }
              break
            case 4: // F-02
            case 5: // F-03
            case 6: // Nilai Akhir
              if (typeof cell.value === 'number') {
                cell.numFmt = '0.00'
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
              } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
                cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF9CA3AF' } }
              }
              break
            case 7: // Kode Nilai — colour-coded background
              cell.alignment = { horizontal: 'center', vertical: 'middle' }
              cell.font = { name: 'Arial', size: 10, bold: true }
              if (scoreCat.kode !== '-') {
                const match = valueCategories.find((c) => c.kode === scoreCat.kode)
                const argb = match ? (COLOR_TO_ARGB[match.color] ?? 'FFF4F4F5') : 'FFF4F4F5'
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
              }
              break
            case 8: // Kategori Nilai
              cell.alignment = { horizontal: 'left', vertical: 'middle' }
              break
          }
        })
      })

      // ── Auto-fit column widths based on actual content (fitted to content) ─
      worksheet.columns.forEach((col) => {
        let maxLen = 0
        
        col.eachCell!({ includeEmpty: false }, (cell) => {
          // Jangan sertakan baris judul pertama (row 1) karena di-merge dan sangat panjang
          if (cell.fullAddress.row === 1) return

          let valStr = ''
          const val = cell.value

          if (val === null || val === undefined) {
            valStr = ''
          } else if (typeof val === 'number') {
            // Karena angka F-02, F-03, dan Nilai Akhir ditampilkan dengan format 2 desimal
            valStr = val.toFixed(2)
          } else {
            valStr = val.toString()
          }

          if (valStr.length > maxLen) {
            maxLen = valStr.length
          }
        })

        // Bandingkan juga dengan panjang nama header (baris ke-2)
        const headerIdx = (col as any).number - 1
        const headerLen = HEADERS[headerIdx]?.length ?? 0
        
        // Fitted to content: tambahkan minimal padding (2) untuk spasi pemisah kolom Excel agar rapi
        col.width = Math.max(maxLen + 2, headerLen + 2, 8)
      })

      // ── Download ──────────────────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fileDateStr = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `Peringkat Hasil Penilaian - ${fileDateStr}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export to excel:', err)
      alert('Gagal mengekspor data ke Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.08),transparent_50%)] pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
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
                className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors duration-200"
              >
                Daftar Instansi
              </Link>
              <Link
                href="/hasil-penilaian"
                className="text-xs font-semibold text-white transition-colors duration-200"
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

      {/* MAIN CONTAINER */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-8 pb-20 space-y-6">
        {/* Header & Description */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Hasil Penilaian
            </h1>
            <p className="text-sm text-zinc-400">
              Rekapitulasi peringkat nilai kepatuhan seluruh instansi berdasarkan bobot aktif.
            </p>
          </div>
        </div>

        {/* Filters, Search and Export Area */}
        <div className="space-y-4">
          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-bold shadow-md'
                  : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              Semua Kategori
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-bold shadow-md'
                    : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search bar & Export to Excel action panel */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
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
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={exporting || filteredRankings.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-800 disabled:cursor-not-allowed border border-emerald-500/30 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/10 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Mengekspor...' : 'Export ke Excel'}
            </button>
          </div>
        </div>

        {/* Rankings Listing */}
        {loading ? (
          <div className="space-y-4">
            <div className="h-12 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl animate-pulse" />
            <div className="h-64 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl animate-pulse" />
          </div>
        ) : errorMsg ? (
          <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400">
            {errorMsg}
          </div>
        ) : filteredRankings.length === 0 ? (
          <div className="p-10 bg-zinc-900/10 border border-zinc-800/60 rounded-2xl text-center text-zinc-500 text-sm">
            Tidak ada instansi yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden bg-zinc-900/15 border border-zinc-800/80 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/80 text-xs font-bold text-zinc-400 bg-zinc-900/35">
                    <th className="px-6 py-4 w-24 text-center">Peringkat</th>
                    <th className="px-6 py-4">Nama Institusi</th>
                    <th className="px-6 py-4 w-28 text-center">F-02</th>
                    <th className="px-6 py-4 w-28 text-center">F-03</th>
                    <th className="px-6 py-4 w-32 text-center">Nilai Akhir</th>
                    <th className="px-6 py-4 w-20 text-center">Kategori</th>
                    <th className="px-6 py-4">Makna</th>
                    <th className="px-6 py-4 w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-sm">
                  {filteredRankings.map((inst, index) => {
                    const rank = index + 1
                    const scoreCat = getScoreCategory(inst.totalScore)

                    return (
                      <tr
                        key={inst.institutionId}
                        className="hover:bg-zinc-900/20 transition-colors"
                      >
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                            rank === 1 && inst.totalScore !== null
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5'
                              : rank === 2 && inst.totalScore !== null
                              ? 'bg-slate-300/15 text-slate-300 border border-slate-300/30'
                              : rank === 3 && inst.totalScore !== null
                              ? 'bg-amber-700/15 text-amber-600 border border-amber-700/30'
                              : 'text-zinc-500'
                          }`}>
                            {inst.totalScore !== null ? `#${rank}` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-200">
                          {inst.name}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-zinc-300">
                          {inst.f02.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {inst.f03 !== null ? (
                            <span className="font-medium text-zinc-350">{inst.f03.toFixed(2)}</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/25 text-red-400 text-[9px] font-bold uppercase rounded-md">
                              Belum Diisi
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-extrabold text-white">
                              {inst.totalScore !== null ? inst.totalScore.toFixed(2) : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-default ${scoreCat.class}`}
                            title={scoreCat.makna}
                          >
                            {scoreCat.kode}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-300">
                          {scoreCat.makna !== 'Belum Terkategori' ? scoreCat.makna : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDownloadKertasKerja(inst.institutionId, inst.name)}
                            disabled={downloadingId !== null}
                            title={`Unduh Kertas Kerja — ${inst.name}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 hover:bg-blue-600/20 hover:border-blue-500/40 border border-zinc-700 text-zinc-400 hover:text-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {downloadingId === inst.institutionId ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Mobile Cards Stack View */}
            <div className="block md:hidden space-y-3">
              {filteredRankings.map((inst, index) => {
                const rank = index + 1
                const scoreCat = getScoreCategory(inst.totalScore)

                return (
                  <div
                    key={inst.institutionId}
                    className="p-4 bg-zinc-900/25 border border-zinc-800/80 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${
                        rank === 1 && inst.totalScore !== null
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5'
                          : rank === 2 && inst.totalScore !== null
                          ? 'bg-slate-300/15 text-slate-300 border border-slate-300/30'
                          : rank === 3 && inst.totalScore !== null
                          ? 'bg-amber-700/15 text-amber-600 border border-amber-700/30'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-850'
                      }`}>
                        {inst.totalScore !== null ? `Peringkat #${rank}` : 'Peringkat -'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold cursor-default ${scoreCat.class}`}
                        title={scoreCat.makna}
                      >
                        {scoreCat.kode}
                      </span>
                    </div>

                    <div className="font-semibold text-sm text-zinc-200">
                      {inst.name}
                    </div>

                    <div className="pt-2 border-t border-zinc-800/40 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Skor F-02:</span>
                        <span className="font-semibold text-zinc-300">{inst.f02.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Skor F-03:</span>
                        {inst.f03 !== null ? (
                          <span className="font-semibold text-zinc-300">{inst.f03.toFixed(2)}</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase rounded">
                            Belum Diisi
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-zinc-850">
                        <span className="text-zinc-400 font-semibold">Nilai Akhir:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white text-sm">
                            {inst.totalScore !== null ? inst.totalScore.toFixed(2) : '-'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-3 pt-1.5 border-t border-zinc-850">
                        <span className="text-zinc-400 font-semibold shrink-0">Kategori Nilai:</span>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-lg border text-[9px] font-bold cursor-default ${scoreCat.class}`}
                          >
                            {scoreCat.kode}
                          </span>
                          <span className="text-zinc-300 text-xs truncate">
                            {scoreCat.makna !== 'Belum Terkategori' ? scoreCat.makna : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-zinc-800/40">
                        <button
                          onClick={() => handleDownloadKertasKerja(inst.institutionId, inst.name)}
                          disabled={downloadingId !== null}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-blue-600/15 border border-zinc-700 hover:border-blue-500/40 text-zinc-400 hover:text-blue-400 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {downloadingId === inst.institutionId ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Mengunduh...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Unduh Kertas Kerja
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
