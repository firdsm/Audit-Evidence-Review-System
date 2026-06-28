'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

interface SyncSummary {
  newAdded: number
  updatedExisting: number
  totalSynced: number
}

interface Institution {
  id: string
  name: string
  category: string
  drive_folder_id: string
  last_synced_at: string
}

export default function SyncPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [stage, setStage] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  // Defer date formatting to client-only to avoid SSR/client hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSync() {
    setLoading(true)
    setError(null)
    setSummary(null)
    setStage('Memulai sinkronisasi...')

    try {
      setStage('Menghubungkan ke Google Drive & membaca folder...')
      const response = await fetch('/api/sync-institutions', {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Terjadi kesalahan saat sinkronisasi')
      }

      setSummary(result.summary)
      setInstitutions(result.institutions)
      setStage('Sinkronisasi selesai!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Gagal menyinkronkan instansi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.1),transparent_50%)]" />

      {/* Main Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 space-y-8">
        
        {/* Header / Breadcrumb */}
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <Link href="/dashboard" className="text-sm text-blue-500 hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Sinkronisasi Google Drive
            </h1>
          </div>
        </div>

        {/* Sync Panel */}
        <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-2xl backdrop-blur-md space-y-6 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/5">
            <RefreshCw size={32} className={loading ? 'animate-spin' : ''} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Sinkronisasikan Instansi</h2>
            <p className="text-sm text-zinc-400">
              Sistem akan memindai folder tingkat 1 (Kategori) dan folder tingkat 2 (Instansi) dari Root Google Drive Anda, lalu menyimpannya ke database Supabase.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl text-sm text-red-400 text-left flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <strong className="block font-bold">Sinkronisasi Gagal:</strong>
                <span>{error}</span>
                <span className="block mt-2 text-xs text-zinc-500">
                  Tip: Pastikan Google Service Account Anda sudah dibagikan hak akses Viewer ke Root Folder ID.
                </span>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium text-zinc-300">{stage}</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-2/3 animate-pulse rounded-full" />
              </div>
            </div>
          )}

          {!loading && !summary && (
            <button
              onClick={handleSync}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              <span>Mulai Sinkronisasi</span>
            </button>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="p-3 bg-green-950/40 border border-green-900/60 rounded-xl text-green-400 text-sm font-semibold">
                ✓ Sinkronisasi berhasil diselesaikan!
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <span className="block text-xl font-extrabold text-blue-500">{summary.newAdded}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Baru</span>
                </div>
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <span className="block text-xl font-extrabold text-purple-500">{summary.updatedExisting}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Diperbarui</span>
                </div>
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                  <span className="block text-xl font-extrabold text-zinc-300">{summary.totalSynced}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Total</span>
                </div>
              </div>

              <button
                onClick={handleSync}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              >
                Sinkronisasi Ulang
              </button>
            </div>
          )}
        </div>

        {/* Results Preview */}
        {institutions.length > 0 && (
          <div className="space-y-4 bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white">Daftar Instansi Tersinkronisasi ({institutions.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="pb-3 pr-4">Nama Instansi</th>
                    <th className="pb-3 px-4">Kategori</th>
                    <th className="pb-3 px-4">Drive Folder ID</th>
                    <th className="pb-3 pl-4 text-right">Terakhir Sinkron</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {institutions.map((inst) => (
                    <tr key={inst.id} className="text-zinc-300 hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 pr-4 font-medium text-white">{inst.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-md text-xs font-medium border border-zinc-700/50">
                          {inst.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-500">{inst.drive_folder_id}</td>
                      <td className="py-3 pl-4 text-right text-xs text-zinc-500">
                        {mounted
                          ? new Date(inst.last_synced_at).toLocaleString('id-ID')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
