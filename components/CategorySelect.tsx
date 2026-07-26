'use client'

import React from 'react'

interface CategorySelectProps {
  categories: string[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CategorySelect({ categories, value, onChange, disabled }: CategorySelectProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const cleanCategories = categories.filter((c) => c !== 'ALL')

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = value === 'ALL' ? 'Semua Instansi' : value

  return (
    <div ref={containerRef} className="relative shrink-0 w-full sm:w-52">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-9 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate text-zinc-200">{selectedLabel}</span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
            open ? 'rotate-180 text-blue-400' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Floating Menu Popover */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 py-1.5 bg-zinc-900/95 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md z-50 max-h-56 overflow-y-auto scrollbar-thin animate-in fade-in zoom-in-95 duration-100">
          {/* Option: Semua Instansi */}
          <button
            type="button"
            onClick={() => {
              onChange('ALL')
              setOpen(false)
            }}
            className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
              value === 'ALL'
                ? 'bg-blue-600/15 text-blue-400 font-semibold'
                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
            }`}
          >
            <span>Semua Instansi</span>
            {value === 'ALL' && (
              <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {cleanCategories.length > 0 && <div className="my-1 border-t border-zinc-800/80" />}

          {/* List Kategori */}
          {cleanCategories.map((cat) => {
            const isSelected = value === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onChange(cat)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600/15 text-blue-400 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                }`}
              >
                <span className="truncate">{cat}</span>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
