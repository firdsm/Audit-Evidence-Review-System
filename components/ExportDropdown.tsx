'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface ExportDropdownItem {
  label: string
  iconColor: string // tailwind text color class, e.g. 'text-emerald-400'
  icon: 'excel' | 'pdf'
  onClick: () => void
}

interface ExportDropdownProps {
  /** Content rendered inside the trigger button (left of chevron) */
  triggerContent: React.ReactNode
  /** Whether the trigger button is disabled */
  disabled?: boolean
  /** Extra class names for the trigger button */
  triggerClassName?: string
  /** Dropdown menu items */
  items: ExportDropdownItem[]
  /** Align dropdown: 'left' = left edge of button, 'right' = right edge (default) */
  align?: 'left' | 'right'
  /** Whether to show the chevron arrow icon (default: true) */
  showChevron?: boolean
}

const ICON_EXCEL = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  />
)

const ICON_PDF = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  />
)

/** Approximate dropdown panel height (2 items × ~32px + padding) */
const DROPDOWN_H = 88

export function ExportDropdown({
  triggerContent,
  disabled = false,
  triggerClassName = '',
  items,
  align = 'right',
  showChevron = true,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropH = DROPDOWN_H
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= dropH + 4 ? rect.bottom + 4 : rect.top - dropH - 4
    const left = align === 'right' ? rect.right - 176 : rect.left // 176 = w-44
    setPos({ top, left })
  }, [align])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (disabled) return
      if (!open) calcPos()
      setOpen((prev) => !prev)
    },
    [disabled, open, calcPos],
  )

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Recalc on scroll / resize
  useEffect(() => {
    if (!open) return
    const handler = () => {
      calcPos()
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [open, calcPos])

  const defaultTriggerCls =
    'h-9 flex items-center justify-center gap-2 px-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white disabled:bg-zinc-900/50 disabled:text-zinc-600 disabled:cursor-not-allowed border border-zinc-700/60 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={triggerClassName || defaultTriggerCls}
      >
        {triggerContent}
        {showChevron && (
          <svg
            className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {mounted &&
        open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
              width: 176,
            }}
            className="py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          >
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <svg
                  className={`w-4 h-4 shrink-0 ${item.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {item.icon === 'excel' ? ICON_EXCEL : ICON_PDF}
                </svg>
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
