'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface Category {
  id: string
  kode: string
  makna: string
  min_score: number
  max_score: number
  color: string
}

// Preset color options matching Tailwind configurations
const COLOR_PRESETS = [
  { key: 'red', name: 'Merah', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { key: 'orange', name: 'Oranye', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { key: 'amber', name: 'Kuning/Amber', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { key: 'emerald', name: 'Hijau', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { key: 'blue', name: 'Biru', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { key: 'violet', name: 'Ungu/Violet', bg: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  { key: 'zinc', name: 'Abu-Abu', bg: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
]

export default function ValueCategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form states
  const [editId, setEditId] = useState<string | null>(null)
  const [kode, setKode] = useState('')
  const [makna, setMakna] = useState('')
  const [minScore, setMinScore] = useState('')
  const [maxScore, setMaxScore] = useState('')
  const [color, setColor] = useState('zinc')

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/value-categories')
      if (!res.ok) throw new Error('Gagal memuat kategori')
      const data = await res.json()
      const parsed = (data || []).map((cat: any) => ({
        ...cat,
        min_score: parseFloat(cat.min_score),
        max_score: parseFloat(cat.max_score),
      }))
      setCategories(parsed)
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Gagal memuat data' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!kode.trim()) {
      setMessage({ type: 'error', text: 'Kode kategori tidak boleh kosong (contoh: "A", "A-", "B")' })
      return
    }
    if (!makna.trim()) {
      setMessage({ type: 'error', text: 'Makna/nama kategori tidak boleh kosong' })
      return
    }

    const minNum = parseFloat(minScore)
    const maxNum = parseFloat(maxScore)

    if (isNaN(minNum) || isNaN(maxNum) || minNum < 0 || maxNum > 5) {
      setMessage({ type: 'error', text: 'Rentang nilai harus berkisar antara 0.00 sampai 5.00' })
      return
    }

    if (minNum >= maxNum) {
      setMessage({ type: 'error', text: 'Batas bawah (Min) harus lebih kecil dari batas atas (Max)' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/value-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId || undefined,
          kode: kode.trim(),
          makna: makna.trim(),
          min_score: minNum,
          max_score: maxNum,
          color,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan kategori')

      setMessage({ type: 'success', text: 'Kategori nilai berhasil disimpan.' })
      resetForm()
      await fetchCategories()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const conf = window.confirm('Apakah Anda yakin ingin menghapus kategori nilai ini?')
    if (!conf) return

    try {
      const res = await fetch(`/api/admin/value-categories?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menghapus kategori')
      }
      setMessage({ type: 'success', text: 'Kategori nilai berhasil dihapus.' })
      await fetchCategories()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleEdit = (cat: Category) => {
    setEditId(cat.id)
    setKode(cat.kode)
    setMakna(cat.makna)
    setMinScore(cat.min_score.toString())
    setMaxScore(cat.max_score.toString())
    setColor(cat.color)
    setMessage(null)
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditId(null)
    setKode('')
    setMakna('')
    setMinScore('')
    setMaxScore('')
    setColor('zinc')
  }

  // Calculate gaps in coverage.
  // STEP = 0.01 (smallest precision used in the 0-5 scale with 2 decimal places).
  // A difference of exactly 1 STEP between consecutive boundaries is treated as
  // contiguous — e.g. max=1.50 / min=1.51 is NOT a gap, only diff > 0.01 is.
  const gaps = React.useMemo(() => {
    const STEP = 0.01
    const list: { from: number; to: number }[] = []
    if (categories.length === 0) {
      list.push({ from: 0.0, to: 5.0 })
      return list
    }

    // Gap before the first category (only real if first min > 1 step above 0)
    if (categories[0].min_score > STEP) {
      list.push({ from: 0.0, to: categories[0].min_score })
    }

    // Gaps between consecutive categories
    for (let i = 0; i < categories.length - 1; i++) {
      const currentMax = categories[i].max_score
      const nextMin = categories[i + 1].min_score
      // Round to avoid floating-point noise (e.g. 0.1 + 0.2 !== 0.3)
      const diff = Math.round((nextMin - currentMax) * 10000) / 10000
      if (diff > STEP) {
        list.push({ from: currentMax, to: nextMin })
      }
    }

    // Gap after the last category (only real if last max is more than 1 step below 5)
    const lastMax = categories[categories.length - 1].max_score
    if (Math.round((5.0 - lastMax) * 10000) / 10000 > STEP) {
      list.push({ from: lastMax, to: 5.0 })
    }

    return list
  }, [categories])

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.06),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 space-y-8 pb-24">
        {/* Navigation / Header */}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  Kelola Kategori Nilai
                </h1>
                <p className="text-xs text-zinc-500">
                  Definisikan rentang predikat klasifikasi Nilai Akhir (Skala 0.00 - 5.00).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Banners */}
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

        {/* Visualizer Scale Track */}
        <div className="bg-zinc-900/25 border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <span className="text-xs font-bold text-zinc-300">Visualisasi Rentang Nilai Kategori</span>
          <div className="h-7 w-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex relative">
            {categories.length === 0 ? (
              <div className="w-full h-full bg-zinc-900/50 flex items-center justify-center text-[10px] text-zinc-600">
                Belum ada kategori terdaftar
              </div>
            ) : (
              categories.map((cat, idx) => {
                const isLast = idx === categories.length - 1
                const widthPct = ((cat.max_score - cat.min_score) / 5) * 100
                let colorClass = 'bg-zinc-700/40 text-zinc-400'
                if (cat.color === 'red') colorClass = 'bg-red-500/30 text-red-300'
                else if (cat.color === 'orange') colorClass = 'bg-orange-500/30 text-orange-300'
                else if (cat.color === 'amber') colorClass = 'bg-amber-500/30 text-amber-300'
                else if (cat.color === 'emerald') colorClass = 'bg-emerald-500/30 text-emerald-300'
                else if (cat.color === 'blue') colorClass = 'bg-blue-500/30 text-blue-300'
                else if (cat.color === 'violet') colorClass = 'bg-violet-500/30 text-violet-300'

                return (
                  <div
                    key={cat.id}
                    className={`h-full flex items-center justify-center text-[10px] font-bold border-r border-zinc-950/20 truncate px-1 ${colorClass}`}
                    style={{
                      width: `${widthPct}%`,
                      // Last segment claims any sub-pixel remainder from floating-point
                      // rounding so the bar always fills flush to the right edge.
                      flexGrow: isLast ? 1 : 0,
                    }}
                    title={`${cat.kode} — ${cat.makna} (${cat.min_score.toFixed(2)} - ${cat.max_score.toFixed(2)})`}
                  >
                    {cat.kode}
                  </div>
                )
              })
            )}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 font-semibold font-mono px-1">
            <span>0.00</span>
            <span>1.25</span>
            <span>2.50</span>
            <span>3.75</span>
            <span>5.00</span>
          </div>

          {/* Gap Warning banner */}
          {gaps.length > 0 && (
            <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2.5 text-xs text-amber-400">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="space-y-1">
                <p className="font-bold">Peringatan: Terdapat celah (gap) skor yang tidak ter-cover kategori:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-medium">
                  {gaps.map((g, idx) => (
                    <li key={idx}>Skor {g.from.toFixed(2)} s/d {g.to.toFixed(2)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* List and form grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form input */}
          <div className="bg-zinc-900/15 border border-zinc-800/80 rounded-2xl p-6 space-y-5 h-fit lg:col-span-1">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {editId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Definisikan kode, makna, dan ambang batas predikat.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Kode */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold block">
                  Kode
                  <span className="text-zinc-600 font-normal ml-1">(contoh: A, A-, B, B-, C)</span>
                </label>
                <input
                  type="text"
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  placeholder='Contoh: "A" atau "A-"'
                  maxLength={8}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 font-mono tracking-wider"
                  required
                />
              </div>

              {/* Makna */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold block">
                  Makna / Nama Predikat
                </label>
                <input
                  type="text"
                  value={makna}
                  onChange={(e) => setMakna(e.target.value)}
                  placeholder="Contoh: Pelayanan Prima"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  required
                />
              </div>

              {/* Score range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold block">Min Skor</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold block">Max Skor</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    placeholder="5.00"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    required
                  />
                </div>
              </div>

              {/* Color picker */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold block">Pilih Warna Badge</label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((p) => {
                    const isSelected = color === p.key
                    let bgClass = 'bg-zinc-800 border-zinc-700'
                    if (p.key === 'red') bgClass = 'bg-red-500/20 border-red-500/30 text-red-400'
                    else if (p.key === 'orange') bgClass = 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                    else if (p.key === 'amber') bgClass = 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                    else if (p.key === 'emerald') bgClass = 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    else if (p.key === 'blue') bgClass = 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                    else if (p.key === 'violet') bgClass = 'bg-violet-500/20 border-violet-500/30 text-violet-400'

                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setColor(p.key)}
                        className={`py-2 px-1 border rounded-lg text-[9px] font-bold transition-all truncate text-center cursor-pointer ${bgClass} ${
                          isSelected ? 'ring-2 ring-violet-500 scale-105 border-transparent' : 'opacity-65'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/15 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
                {editId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl border border-zinc-700/80 transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Table list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900/15 border border-zinc-800/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/40 font-bold">
                    <th className="px-5 py-4 w-20">Kode</th>
                    <th className="px-5 py-4">Makna / Predikat</th>
                    <th className="px-5 py-4 text-center">Rentang</th>
                    <th className="px-5 py-4 text-center w-28">Badge</th>
                    <th className="px-5 py-4 w-28 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center animate-pulse text-zinc-500">
                        Memuat data kategori...
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 font-medium">
                        Belum ada kategori nilai terdaftar.
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => {
                      const colorPreset = COLOR_PRESETS.find((p) => p.key === cat.color) || COLOR_PRESETS[6]
                      return (
                        <tr key={cat.id} className="hover:bg-zinc-900/10 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-mono font-extrabold text-zinc-100 tracking-wide text-sm">
                              {cat.kode}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-zinc-300">{cat.makna}</td>
                          <td className="px-5 py-4 text-center font-mono font-medium text-zinc-400 text-[11px]">
                            {cat.min_score.toFixed(2)} – {cat.max_score.toFixed(2)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${colorPreset.bg}`}
                              title={cat.makna}
                            >
                              {cat.kode}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                onClick={() => handleEdit(cat)}
                                className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                              >
                                Edit
                              </button>
                              <span className="text-zinc-700">|</span>
                              <button
                                onClick={() => handleDelete(cat.id)}
                                className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
