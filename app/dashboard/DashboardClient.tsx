'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import UserDropdown from '@/components/UserDropdown'

interface InstitutionData {
  id: string
  name: string
  category: string
  last_synced_at: string
  assessmentsCount: number
}

interface DashboardClientProps {
  institutions: InstitutionData[]
  totalIndicators: number
  userEmail?: string
  userName?: string
  isSuperAdmin?: boolean
  allCategories: string[]
  currentPage: number
  totalPages: number
  totalCount: number
  initialSearch: string
  initialCategory: string
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
  currentPage,
  totalPages,
  totalCount,
  initialSearch,
  initialCategory,
}: DashboardClientProps) {
  const router = useRouter()

  const [searchInput, setSearchInput] = useState(initialSearch)
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const navigate = useCallback(
    (search: string, category: string, page: number) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category && category !== 'ALL') params.set('category', category)
      if (page > 1) params.set('page', String(page))
      const qs = params.toString()
      router.push(`/dashboard${qs ? `?${qs}` : ''}`)
    },
    [router]
  )

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      navigate(value, selectedCategory, 1)
    }, 400)
  }

  function handleCategoryChange(value: string) {
    setSelectedCategory(value)
    navigate(searchInput, value, 1)
  }

  function handlePageChange(page: number) {
    navigate(searchInput, selectedCategory, page)
  }

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * 10 + 1
  const endItem = Math.min(currentPage * 10, totalCount)
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
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                AERS
              </span>
              <span className="hidden md:inline text-xs text-zinc-500 ml-2 border-l border-zinc-800 pl-2">
                Audit Evidence Review System
              </span>
            </div>
          </div>
          <UserDropdown userName={userName} userEmail={userEmail} isSuperAdmin={isSuperAdmin} />
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────────
          Main content — semua di sini scroll normal kecuali filter bar
      ──────────────────────────────────────────────────────────────────────── */}
      <main className="relative z-0 max-w-7xl mx-auto px-6 pt-8 pb-12 space-y-6">

        {/* ─────────────────────────────────────────────────────────────────
            2. HEADING — normal flow, TIDAK sticky.
            Terlihat saat halaman dibuka, lalu scroll keluar dari viewport
            seperti konten biasa.
        ──────────────────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Daftar Instansi
          </h1>
          <p className="text-sm text-zinc-400">
            Pilih instansi untuk melakukan penilaian audit bukti pelayanan publik.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            3. FILTER BAR — sticky top-[65px] (= tinggi top bar).
            Di posisi normalnya berada DI BAWAH heading. Begitu heading
            scroll keluar viewport, filter bar "nangkap" dan menempel
            tepat di bawah top bar. Efek: heading hilang, filter tetap
            terlihat di atas list.

            -mx-6 px-6: extend background full-width tanpa keluar dari max-w
        ──────────────────────────────────────────────────────────────────── */}
        <div className="sticky top-[65px] z-10 -mx-6 px-4 py-8 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/50">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
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
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Category */}
            <div className="relative w-full sm:w-56">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'ALL' ? 'Semua Kategori' : cat}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            4. INSTITUTIONS TABLE — normal flow, scroll di bawah filter
        ──────────────────────────────────────────────────────────────────── */}
        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {institutions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-2">
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
                    <th className="py-4 px-6">Nama Instansi</th>
                    <th className="py-4 px-6 w-48">Kategori</th>
                    <th className="py-4 px-6 w-64">Progress Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {institutions.map((inst) => {
                    const percentage = totalIndicators > 0
                      ? Math.round((inst.assessmentsCount / totalIndicators) * 100)
                      : 0
                    return (
                      <tr
                        key={inst.id}
                        onClick={() => router.push(`/audit/${inst.id}`)}
                        className="hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-6 font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {inst.name}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-md text-xs font-semibold border border-zinc-700/30">
                            {inst.category}
                          </span>
                        </td>
                        <td className="py-4 px-6">
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
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
        )}
      </main>
    </div>
  )
}
