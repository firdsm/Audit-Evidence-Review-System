'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import UserDropdown from '@/components/UserDropdown'

interface BackupClientProps {
  userEmail: string
  userName: string
}

export default function BackupClient({ userEmail, userName }: BackupClientProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null)

  const handleGenerateBackup = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/backup')

      if (!response.ok) {
        let errMsg = `Gagal membuat backup (HTTP ${response.status})`
        try {
          const json = await response.json()
          if (json.error) errMsg = json.error
        } catch {
          // non-JSON response
        }
        setError(errMsg)
        return
      }

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `aers-backup.sql`

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setLastDownloaded(filename)
    } catch (err: unknown) {
      console.error('[BackupClient] Error:', err)
      setError('Terjadi kesalahan koneksi. Periksa koneksi internet dan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-white text-sm font-semibold">Backup Database</span>
        </div>
        <UserDropdown
          userName={userName}
          userEmail={userEmail}
          isSuperAdmin={true}
        />
      </header>

      {/* ── Content ── */}
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Backup Database
          </h1>
          <p className="text-xs text-zinc-400">
            Buat file SQL cadangan seluruh data aplikasi AERS untuk keperluan pemulihan data.
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-5 backdrop-blur-md">
          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-white">Tentang Fitur Backup</h2>
            </div>
            <div className="text-xs text-zinc-400 leading-relaxed space-y-2 pl-10">
              <p>
                Fitur ini membuat cadangan seluruh <strong className="text-zinc-200">data aplikasi AERS</strong> dalam format file SQL PostgreSQL standar.
              </p>
              <p>
                File yang dihasilkan dapat langsung dijalankan melalui <strong className="text-zinc-200">Supabase SQL Editor</strong> untuk memulihkan data jika terjadi kehilangan atau kerusakan.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-800/60" />

          {/* Included Tables */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-zinc-300">Tabel yang dibackup:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'auditors',
                'institutions',
                'aspects',
                'indicators',
                'assessments',
                'assessment_document_reviews',
                'indicator_folder_mapping',
              ].map((tbl) => (
                <div key={tbl} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
                  <code className="font-mono text-[11px] text-zinc-300">{tbl}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-800/60" />

          {/* Warning */}
          <div className="flex items-start gap-3 px-3.5 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Backup ini <strong className="text-amber-200">hanya mencakup data aplikasi AERS</strong> — tidak termasuk konfigurasi Supabase, auth users, storage, atau tabel internal Supabase lainnya.
            </p>
          </div>
        </div>

        {/* Generate Backup Button */}
        <div className="space-y-3">
          <button
            id="btn-generate-backup"
            onClick={handleGenerateBackup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10 transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sedang membuat backup...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Generate Backup
              </>
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Success message */}
          {lastDownloaded && !error && (
            <div className="flex items-start gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
              <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-emerald-300 space-y-0.5">
                <p className="font-semibold">Backup berhasil diunduh</p>
                <p className="text-emerald-400/70 font-mono text-[11px]">{lastDownloaded}</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Cara Restore dari File Backup
          </h3>
          <ol className="text-xs text-zinc-400 leading-relaxed space-y-1.5 list-decimal list-inside">
            <li>Buka <strong className="text-zinc-200">Supabase Dashboard</strong> → pilih project AERS</li>
            <li>Masuk ke menu <strong className="text-zinc-200">SQL Editor</strong></li>
            <li>Buat query baru, lalu <strong className="text-zinc-200">paste seluruh isi file .sql</strong></li>
            <li>Klik <strong className="text-zinc-200">Run</strong> untuk menjalankan restore</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
