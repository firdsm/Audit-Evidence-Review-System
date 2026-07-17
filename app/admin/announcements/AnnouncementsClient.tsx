'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface Announcement {
  id: string
  message: string
  is_active: boolean
  target_pages: string[]
  created_at: string
  updated_at: string
}

const PAGE_OPTIONS = [
  { key: 'all', label: 'Semua Halaman' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'audit', label: 'Halaman Audit' },
  { key: 'hasil_penilaian', label: 'Hasil Penilaian (Peringkat)' },
] as const

function pageLabels(pages: string[]): string {
  if (pages.includes('all')) return 'Semua Halaman'
  return pages
    .map(p => PAGE_OPTIONS.find(o => o.key === p)?.label ?? p)
    .join(', ')
}

export default function AnnouncementsClient() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [editId, setEditId] = useState<string | null>(null)
  const [msgText, setMsgText] = useState('')
  const [targetPages, setTargetPages] = useState<string[]>(['all'])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/announcements?all=true')
      if (!res.ok) throw new Error('Gagal memuat data')
      const data = await res.json()
      setAnnouncements(data)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditId(null)
    setMsgText('')
    setTargetPages(['all'])
    setMessage(null)
  }

  const handleEdit = (ann: Announcement) => {
    setEditId(ann.id)
    setMsgText(ann.message)
    setTargetPages(ann.target_pages)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const togglePage = (key: string) => {
    if (key === 'all') {
      setTargetPages(['all'])
      return
    }
    // If 'all' was selected, deselect it and add the specific page
    let next = targetPages.filter(p => p !== 'all')
    if (next.includes(key)) {
      next = next.filter(p => p !== key)
    } else {
      next = [...next, key]
    }
    if (next.length === 0) next = ['all']
    setTargetPages(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!msgText.trim()) {
      setMessage({ type: 'error', text: 'Pesan tidak boleh kosong' })
      return
    }
    if (targetPages.length === 0) {
      setMessage({ type: 'error', text: 'Pilih minimal satu halaman target' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const url = '/api/admin/announcements'
      const method = editId ? 'PATCH' : 'POST'
      const body = editId
        ? { id: editId, message: msgText.trim(), target_pages: targetPages }
        : { message: msgText.trim(), target_pages: targetPages }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan')
      setMessage({ type: 'success', text: editId ? 'Pengumuman diperbarui.' : 'Pengumuman berhasil dibuat.' })
      resetForm()
      await fetchAll()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (ann: Announcement) => {
    setTogglingId(ann.id)
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ann.id, is_active: !ann.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui status')
      await fetchAll()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pengumuman ini?')) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus')
      await fetchAll()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setDeletingId(null)
    }
  }

  const activeCount = announcements.filter(a => a.is_active).length

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.06),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10 space-y-8 pb-24">
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
              <div className="w-9 h-9 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  Kelola Pengumuman
                </h1>
                <p className="text-xs text-zinc-500">
                  Pengumuman banner yang tampil di halaman aplikasi.
                  {activeCount > 0 && <span className="ml-1 text-amber-400 font-semibold">{activeCount} aktif</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {message && (
          <div className={`p-4 rounded-xl text-xs font-medium border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <div className="bg-zinc-900/25 border border-zinc-800/80 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-zinc-300">
            {editId ? '✏️ Edit Pengumuman' : '+ Pengumuman Baru'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Message textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Pesan Pengumuman</label>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                rows={3}
                placeholder="Tulis isi pengumuman di sini…"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
              />
            </div>

            {/* Target pages checkboxes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400">Tampilkan di Halaman</label>
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map(opt => {
                  const checked = targetPages.includes(opt.key)
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => togglePage(opt.key)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        checked
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                      }`}
                    >
                      {checked ? '✓ ' : ''}{opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Inline preview */}
            {msgText.trim() && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-500">Preview Banner</span>
                <div className="flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                  <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <p className="text-sm text-amber-200 leading-snug">{msgText.trim()}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-600/10 cursor-pointer"
              >
                {submitting ? 'Menyimpan…' : editId ? 'Simpan Perubahan' : 'Buat Pengumuman'}
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">Daftar Pengumuman</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-8 bg-zinc-900/10 border border-zinc-800/60 rounded-2xl text-center text-zinc-500 text-sm">
              Belum ada pengumuman.
            </div>
          ) : (
            announcements.map(ann => (
              <div
                key={ann.id}
                className={`p-4 bg-zinc-900/25 border rounded-2xl space-y-2.5 transition-all ${
                  ann.is_active ? 'border-zinc-800/80' : 'border-zinc-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-zinc-200 leading-snug flex-1">{ann.message}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(ann)}
                      disabled={togglingId === ann.id}
                      title={ann.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                        ann.is_active ? 'bg-amber-500' : 'bg-zinc-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${
                        ann.is_active ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => handleEdit(ann)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(ann.id)}
                      disabled={deletingId === ann.id}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer disabled:opacity-40"
                      title="Hapus"
                    >
                      {deletingId === ann.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    ann.is_active
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}>
                    {ann.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] text-zinc-500 font-medium">
                    {pageLabels(ann.target_pages)}
                  </span>
                  <span className="text-[10px] text-zinc-600 ml-auto">
                    {new Date(ann.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
