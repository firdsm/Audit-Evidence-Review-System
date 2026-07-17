'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'

interface Institution {
  id: string
  name: string
  category: string
}

interface F03ManagementClientProps {
  institutions: Institution[]
  initialScores: Record<string, number>
  categories: string[]
}

export default function F03ManagementClient({
  institutions,
  initialScores,
  categories,
}: F03ManagementClientProps) {
  const [f03Scores, setF03Scores] = useState<Record<string, number>>(initialScores)
  const [singleId, setSingleId] = useState('')
  const [singleScore, setSingleScore] = useState('')

  // Combobox states
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Click outside auto-close handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  
  // Bulk state
  const [bulkCategory, setBulkCategory] = useState('ALL')
  const [bulkScore, setBulkScore] = useState('')
  const [exceptions, setExceptions] = useState<string[]>([])
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filter list preview
  const previewTargets = institutions.filter((inst) => {
    const matchCategory = bulkCategory === 'ALL' || inst.category === bulkCategory
    const isExcluded = exceptions.includes(inst.id)
    return matchCategory && !isExcluded
  })

  // Handle single submit
  const handleSingleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!singleId || !singleScore) return
    const scoreVal = parseFloat(singleScore)
    if (isNaN(scoreVal) || scoreVal < 1.0 || scoreVal > 5.0) {
      setMessage({ type: 'error', text: 'Skor harus berkisar antara 1.0 sampai 5.0' })
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/scores/f03', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'single',
          institutionId: singleId,
          score: scoreVal,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai')

      setF03Scores((prev) => ({ ...prev, [singleId]: scoreVal }))
      setMessage({ type: 'success', text: 'Nilai F-03 berhasil disimpan.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Handle bulk submit
  const handleBulkSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkScore) return
    const scoreVal = parseFloat(bulkScore)
    if (isNaN(scoreVal) || scoreVal < 1.0 || scoreVal > 5.0) {
      setMessage({ type: 'error', text: 'Skor harus berkisar antara 1.0 sampai 5.0' })
      return
    }

    if (previewTargets.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada instansi target yang terpilih untuk bulk update.' })
      return
    }

    const conf = window.confirm(
      `Apakah Anda yakin ingin menerapkan nilai ${scoreVal} ke ${previewTargets.length} instansi sekaligus?`
    )
    if (!conf) return

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/scores/f03', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bulk',
          score: scoreVal,
          category: bulkCategory,
          exceptions,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menerapkan bulk nilai')

      // Sync local state values
      const updatedScores = { ...f03Scores }
      for (const t of previewTargets) {
        updatedScores[t.id] = scoreVal
      }
      setF03Scores(updatedScores)

      setMessage({
        type: 'success',
        text: `Berhasil menerapkan F-03 secara massal ke ${data.count || previewTargets.length} instansi.`,
      })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Exception list toggler
  const toggleException = (id: string) => {
    setExceptions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.06),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 space-y-8 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
          <div className="space-y-1">
            <Link href="/dashboard" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  Kelola Nilai F-03
                </h1>
                <p className="text-xs text-zinc-500">
                  Input dan perbarui data manual F-03 instansi (Skala 1.0 - 5.0).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {message && (
          <div
            className={`p-4 rounded-xl text-xs font-medium border ${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECTION 1: Single Form Input */}
          <div className="bg-zinc-900/15 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">1. Input Per Instansi</h2>
              <p className="text-[11px] text-zinc-500">Pilih dan perbarui skor F-03 instansi tertentu secara manual.</p>
            </div>

            <form onSubmit={handleSingleSave} className="space-y-4">
              {/* Combobox Searchable Select */}
              <div className="space-y-2 relative" ref={dropdownRef}>
                <label className="text-xs text-zinc-400 font-semibold block">Pilih Instansi</label>
                
                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-left text-zinc-200 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
                >
                  <span className="truncate">
                    {(() => {
                      const sel = institutions.find(i => i.id === singleId)
                      return sel ? `[${sel.category}] ${sel.name}` : '-- Pilih Instansi --'
                    })()}
                  </span>
                  <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="absolute z-30 w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black overflow-hidden flex flex-col">
                    {/* Search Field */}
                    <div className="p-2 border-b border-zinc-800 bg-zinc-950">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ketik nama atau kategori untuk mencari..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                        autoFocus
                      />
                    </div>
                    
                    {/* List Items */}
                    <div className="max-h-60 overflow-y-auto divide-y divide-zinc-850/40 py-1">
                      {(() => {
                        const filtered = institutions.filter(i => 
                          i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          i.category.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        
                        if (filtered.length === 0) {
                          return (
                            <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                              Tidak ada instansi ditemukan
                            </div>
                          )
                        }

                        return filtered.map((i) => {
                          const hasScore = f03Scores[i.id] !== undefined
                          const scoreVal = f03Scores[i.id]
                          const isSelected = i.id === singleId
                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => {
                                setSingleId(i.id)
                                setSingleScore(scoreVal?.toString() || '')
                                setIsOpen(false)
                                setSearchQuery('')
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors hover:bg-zinc-800/80 ${
                                isSelected ? 'bg-violet-600/10 text-violet-400 font-semibold' : 'text-zinc-300'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-medium truncate">{i.name}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">{i.category}</div>
                              </div>
                              <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                hasScore 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : 'bg-zinc-950 text-zinc-500 border-zinc-850'
                              }`}>
                                {hasScore ? `Skor: ${scoreVal.toFixed(2)}` : 'Belum Diisi'}
                              </span>
                            </button>
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold block">Nilai F-03 (1.0 - 5.0)</label>
                <input
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={singleScore}
                  onChange={(e) => setSingleScore(e.target.value)}
                  placeholder="Contoh: 4.3"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !singleId}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 text-white border border-zinc-700/80 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Nilai'}
              </button>
            </form>
          </div>

          {/* SECTION 2: Bulk Form Input */}
          <div className="bg-zinc-900/15 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">2. Input Massal (Bulk Update)</h2>
              <p className="text-[11px] text-zinc-500">Terapkan satu nilai F-03 sekaligus ke sekelompok instansi target.</p>
            </div>

            <form onSubmit={handleBulkSave} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold block">Target Kategori</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      Kategori {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold block">Nilai F-03 Baru (1.0 - 5.0)</label>
                <input
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={bulkScore}
                  onChange={(e) => setBulkScore(e.target.value)}
                  placeholder="Contoh: 3.5"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  required
                />
              </div>

              {/* Exception selector checklist */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold block">
                  Daftar Pengecualian (Kecualikan dari Bulk Update)
                </label>
                <div className="max-h-40 overflow-y-auto border border-zinc-850 rounded-xl p-3 bg-zinc-950/40 space-y-2 thin-scrollbar text-xs">
                  {institutions
                    .filter((i) => bulkCategory === 'ALL' || i.category === bulkCategory)
                    .map((i) => {
                      const isChecked = exceptions.includes(i.id)
                      return (
                        <label key={i.id} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleException(i.id)}
                            className="rounded border-zinc-800 text-violet-600 focus:ring-violet-500 bg-zinc-900"
                          />
                          <span className={`${isChecked ? 'text-red-400 line-through' : 'text-zinc-300'}`}>
                            [{i.category}] {i.name}
                          </span>
                        </label>
                      )
                    })}
                </div>
              </div>

              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[11px] text-blue-400 flex items-center justify-between">
                <span>Instansi target yang akan terpengaruh:</span>
                <span className="font-extrabold text-xs">{previewTargets.length} Instansi</span>
              </div>

              <button
                type="submit"
                disabled={loading || previewTargets.length === 0}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/15 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Menerapkan...' : 'Terapkan Masal (Bulk)'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
