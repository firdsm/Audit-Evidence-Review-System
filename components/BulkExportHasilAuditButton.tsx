'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface InstitutionData {
  id: string
  name: string
  category: string
  isPriority?: boolean
}

interface BulkExportHasilAuditButtonProps {
  institutions: InstitutionData[]
  disabled?: boolean
}

// ── Progress modal state ──────────────────────────────────────────────────────
interface ProgressState {
  current: number
  total: number
  currentName: string
}

// ── Dropdown panel approx height ─────────────────────────────────────────────
const DROPDOWN_H = 200

// ── Trigger button class (identik dengan ExportDropdown.tsx) ─────────────────
const TRIGGER_CLS =
  'h-9 flex items-center justify-center gap-2 px-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:bg-zinc-900/50 disabled:text-zinc-600 disabled:cursor-not-allowed border border-zinc-700/60 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer'

// ── Icon: spreadsheet/zip ─────────────────────────────────────────────────────
const IconSpreadsheetZip = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
    />
  </svg>
)

export function BulkExportHasilAuditButton({
  institutions,
  disabled = false,
}: BulkExportHasilAuditButtonProps) {
  const [mounted, setMounted] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0, currentName: '' })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Unique categories sorted alphabetically
  const categories = React.useMemo(() => {
    const unique = Array.from(new Set(institutions.map((i) => i.category).filter(Boolean)))
    return unique.sort((a, b) => a.localeCompare(b, 'id'))
  }, [institutions])

  // ── Dropdown positioning ────────────────────────────────────────────────────
  const calcPos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= DROPDOWN_H + 4 ? rect.bottom + 4 : rect.top - DROPDOWN_H - 4
    const left = rect.right - 192 // w-48
    setDropdownPos({ top, left })
  }, [])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (exporting || disabled) return
      if (!dropdownOpen) calcPos()
      setDropdownOpen((prev) => !prev)
    },
    [exporting, disabled, dropdownOpen, calcPos],
  )

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return
      setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Recalc on scroll/resize
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = () => calcPos()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [dropdownOpen, calcPos])

  // ── Bulk export logic ───────────────────────────────────────────────────────
  const startBulkExport = useCallback(
    async (categoryFilter: string | 'ALL') => {
      setDropdownOpen(false)

      const filtered =
        categoryFilter === 'ALL'
          ? institutions
          : categoryFilter === 'OPD_PRIORITAS'
            ? institutions.filter((i) => !!i.isPriority)
            : institutions.filter((i) => i.category === categoryFilter)

      if (filtered.length === 0) {
        alert('Tidak ada instansi untuk diekspor.')
        return
      }

      const categoryLabel =
        categoryFilter === 'ALL'
          ? 'Semua-Kategori'
          : categoryFilter === 'OPD_PRIORITAS'
            ? 'OPD-Prioritas'
            : categoryFilter.replace(/\s+/g, '-')

      setExporting(true)
      cancelRef.current = false
      setProgress({ current: 0, total: filtered.length, currentName: '' })

      try {
        const JSZipModule = await import('jszip')
        const JSZip = JSZipModule.default
        const { saveAs } = await import('file-saver')

        const zip = new JSZip()
        const folder = zip.folder('Kertas-Kerja-PEKPPP-2026')

        for (let i = 0; i < filtered.length; i++) {
          // Check cancel
          if (cancelRef.current) {
            cancelRef.current = false
            setExporting(false)
            setProgress({ current: 0, total: 0, currentName: '' })
            return
          }

          const inst = filtered[i]
          setProgress({ current: i + 1, total: filtered.length, currentName: inst.name })

          try {
            const res = await fetch(
              `/api/export-hasil-audit?institutionId=${encodeURIComponent(inst.id)}`,
            )
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const blob = await res.blob()

            const fileName = inst.name
              .replace(/[/\\:*?"<>|]/g, '-')
              .replace(/\s+/g, ' ')
              .trim()

            folder?.file(`Kertas Kerja - ${fileName}.xlsx`, blob)
          } catch (err) {
            console.warn(`Skip ${inst.name}:`, err)
          }

          // Small delay between requests
          await new Promise((r) => setTimeout(r, 100))
        }

        // Check cancel before generating ZIP
        if (cancelRef.current) {
          cancelRef.current = false
          setExporting(false)
          setProgress({ current: 0, total: 0, currentName: '' })
          return
        }

        const today = new Date().toISOString().split('T')[0]
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        })

        saveAs(zipBlob, `Kertas-Kerja-PEKPPP-2026-${categoryLabel}-${today}.zip`)
      } catch (err) {
        console.error('Bulk export failed:', err)
        alert('Gagal mengekspor. Silakan coba lagi.')
      } finally {
        setExporting(false)
        setProgress({ current: 0, total: 0, currentName: '' })
      }
    },
    [institutions],
  )

  const handleCancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  const progressPct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={exporting || disabled}
        className={TRIGGER_CLS}
        title="Export semua kertas kerja per kategori sebagai ZIP"
      >
        <IconSpreadsheetZip className="w-4 h-4 text-emerald-400 opacity-90" />
        Export Semua Kertas Kerja
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {mounted && (
        <>
          {/* ── Kategori Dropdown ── */}
          {dropdownOpen &&
            dropdownPos &&
            createPortal(
              <div
                ref={panelRef}
                style={{
                  position: 'fixed',
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  zIndex: 9999,
                  width: 192,
                }}
                className="py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Semua Kategori */}
                <button
                  type="button"
                  onClick={() => startBulkExport('ALL')}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 shrink-0 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  Semua Kategori
                </button>

                {/* OPD Prioritas */}
                <button
                  type="button"
                  onClick={() => startBulkExport('OPD_PRIORITAS')}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 shrink-0 text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  OPD Prioritas
                </button>

                {/* Separator */}
                {categories.length > 0 && (
                  <div className="my-1 border-t border-zinc-800" />
                )}

                {/* Per Kategori */}
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => startBulkExport(cat)}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 shrink-0 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span className="truncate">{cat}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )}

          {/* ── Progress Modal ── */}
          {exporting &&
            createPortal(
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{ width: 400 }}
                  className="bg-zinc-900 border border-zinc-700/60 rounded-xl p-6 shadow-2xl space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <IconSpreadsheetZip className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Mengekspor Kertas Kerja...</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Mengunduh dan mengemas Kertas Kerja ke ZIP
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">
                        {progress.current === 0
                          ? 'Memulai...'
                          : `Memproses ${progress.current} dari ${progress.total} instansi`}
                      </span>
                      <span className="text-xs font-semibold text-zinc-300 tabular-nums">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full overflow-hidden" style={{ height: 6 }}>
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Current institution name */}
                  <div className="bg-zinc-800/60 rounded-lg px-3 py-2 min-h-[32px]">
                    {progress.currentName ? (
                      <p className="text-xs text-zinc-400 truncate">
                        <span className="text-zinc-500">Sedang memproses: </span>
                        <span className="text-zinc-300">{progress.currentName}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600 italic">Menyiapkan...</p>
                    )}
                  </div>

                  {/* Cancel button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </>
      )}
    </>
  )
}
