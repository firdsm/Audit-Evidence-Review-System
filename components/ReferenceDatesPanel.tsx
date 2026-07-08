'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { NotebookPen, X } from 'lucide-react'
import { upsertInstitutionNoteAction } from '@/app/audit/actions'

interface ReferenceDatesPanelProps {
  institutionId: string
  initialNote: string | null
}

export default function ReferenceDatesPanel({
  institutionId,
  initialNote,
}: ReferenceDatesPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  // Initialise from prefetched prop — no fetch needed on open
  const [note, setNote] = useState(initialNote ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Sync note if institution changes (e.g. navigating between institutions)
  useEffect(() => {
    setNote(initialNote ?? '')
  }, [initialNote])

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Auto-save on blur
  const handleBlur = useCallback(
    async (value: string) => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
      setSaveStatus('saving')
      setSaveError('')

      const res = await upsertInstitutionNoteAction(institutionId, value.trim() || null)

      if (res.success) {
        setSaveStatus('saved')
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus('error')
        setSaveError(res.error || 'Gagal menyimpan')
      }
    },
    [institutionId]
  )

  return (
    <div
      ref={panelRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none"
    >
      {/* ── Slide-up Panel ─────────────────────────────────────────────── */}
      <div
        className={`
          w-[calc(100vw-3rem)] max-w-xs
          transition-all duration-300 ease-out origin-bottom-right
          ${isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          }
        `}
        aria-hidden={!isOpen}
      >
        <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
            <div className="flex items-center gap-2">
              <NotebookPen size={14} className="text-violet-400 shrink-0" />
              <span className="text-xs font-bold text-white tracking-wide">
                Catatan
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
              aria-label="Tutup panel"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body — textarea always ready, no loading state */}
          <div className="p-4">
            <textarea
              id="institution-note-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={(e) => handleBlur(e.target.value)}
              placeholder="Tulis catatan referensi untuk institusi ini..."
              rows={7}
              className="
                w-full px-3 py-2.5 rounded-xl border border-zinc-700
                bg-zinc-950 text-white text-xs leading-relaxed
                focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/60
                transition-all resize-none placeholder-zinc-600
                min-h-[120px]
              "
            />
          </div>

          {/* Footer — save status */}
          <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between min-h-[36px]">
            <span className="text-[10px] text-zinc-600">Auto-save saat selesai mengetik</span>
            <span className="text-[10px] font-medium">
              {saveStatus === 'saving' && (
                <span className="text-zinc-400 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Menyimpan...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-green-500">✓ Tersimpan</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400" title={saveError}>⚠ Gagal simpan</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── FAB Button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Tutup catatan' : 'Buka catatan institusi'}
        aria-expanded={isOpen}
        className={`
          w-14 h-14 rounded-full flex items-center justify-center
          shadow-xl shadow-violet-900/40
          transition-all duration-200
          cursor-pointer
          pointer-events-auto
          ${isOpen
            ? 'bg-violet-700 ring-2 ring-violet-500/60 rotate-[8deg]'
            : 'bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-700/50 hover:scale-105 active:scale-95'
          }
        `}
      >
        <NotebookPen size={22} className="text-white" />
      </button>
    </div>
  )
}
