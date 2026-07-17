'use client'

import React, { useState, useEffect, useTransition } from 'react'
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
  totalScore: number
}

export default function RankingsClient({
  userEmail,
  userName,
  isSuperAdmin,
  allCategories,
  initialGlobalDebugMode = false,
}: RankingsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [rankings, setRankings] = useState<RankedInstitution[]>([])
  const [weightYear, setWeightYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Fetch rankings from the API endpoint
  const fetchRankings = async (categoryFilter: string) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const url =
        categoryFilter === 'ALL'
          ? '/api/scores/all'
          : `/api/scores/all?category=${encodeURIComponent(categoryFilter)}`

      const res = await fetch(url)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      setRankings(data.rankings || [])
      setWeightYear(data.weightConfigYear || null)
    } catch (err: any) {
      console.error('Failed to fetch rankings:', err)
      setErrorMsg(err.message || 'Gagal memuat rekap peringkat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    startTransition(() => {
      fetchRankings(selectedCategory)
    })
  }, [selectedCategory])

  // Real-time statistical values for the active list
  const averageScore = rankings.length
    ? rankings.reduce((sum, inst) => sum + inst.totalScore, 0) / rankings.length
    : 0

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

          {/* Active Weight Configuration Badge */}
          {weightYear !== null && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-semibold self-start md:self-auto shrink-0 shadow-md">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Menggunakan Bobot Tahun {weightYear}</span>
            </div>
          )}
        </div>

        {/* Filters and Search Area */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
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
        ) : rankings.length === 0 ? (
          <div className="p-10 bg-zinc-900/10 border border-zinc-800/60 rounded-2xl text-center text-zinc-500 text-sm">
            Tidak ada instansi yang terdaftar atau belum ada penilaian sama sekali.
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
                    <th className="px-6 py-4 w-48">Kategori</th>
                    <th className="px-6 py-4 w-44 text-right">Skor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-sm">
                  {rankings.map((inst, index) => {
                    const rank = index + 1
                    const isBelowAvg = inst.totalScore < averageScore

                    return (
                      <tr
                        key={inst.institutionId}
                        className="hover:bg-zinc-900/20 transition-colors"
                      >
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                            rank === 1
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5'
                              : rank === 2
                              ? 'bg-slate-300/15 text-slate-300 border border-slate-300/30'
                              : rank === 3
                              ? 'bg-amber-700/15 text-amber-600 border border-amber-700/30'
                              : 'text-zinc-500'
                          }`}>
                            #{rank}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-200">
                          {inst.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-[11px] rounded-lg font-medium text-zinc-300">
                            {inst.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className="font-extrabold text-white text-base">
                              {inst.totalScore.toFixed(1)}%
                            </span>
                            {isBelowAvg && (
                              <span
                                className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase rounded-md shrink-0"
                                title={`Rata-rata: ${averageScore.toFixed(1)}%`}
                              >
                                Di Bawah Rata-Rata
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Stack View */}
            <div className="block md:hidden space-y-3">
              {rankings.map((inst, index) => {
                const rank = index + 1
                const isBelowAvg = inst.totalScore < averageScore

                return (
                  <div
                    key={inst.institutionId}
                    className="p-4 bg-zinc-900/25 border border-zinc-800/80 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${
                        rank === 1
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/5'
                          : rank === 2
                          ? 'bg-slate-300/15 text-slate-300 border border-slate-300/30'
                          : rank === 3
                          ? 'bg-amber-700/15 text-amber-600 border border-amber-700/30'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                      }`}>
                        Peringkat #{rank}
                      </span>
                      <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[10px] rounded-lg font-medium text-zinc-400">
                        {inst.category}
                      </span>
                    </div>

                    <div className="font-semibold text-sm text-zinc-200">
                      {inst.name}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                      <span className="text-xs text-zinc-500">Skor Total:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm">
                          {inst.totalScore.toFixed(1)}%
                        </span>
                        {isBelowAvg && (
                          <span
                            className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase rounded-md shrink-0"
                            title={`Rata-rata: ${averageScore.toFixed(1)}%`}
                          >
                            DIB
                          </span>
                        )}
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
