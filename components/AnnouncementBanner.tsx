'use client'

import React, { useState, useEffect, useCallback } from 'react'

export type AnnouncementPage = 'dashboard' | 'audit' | 'hasil_penilaian'

interface Announcement {
  id: string
  message: string
  target_pages: string[]
}

interface Props {
  page: AnnouncementPage
}

const ROTATE_INTERVAL = 5000 // ms

export default function AnnouncementBanner({ page }: Props) {
  const [all, setAll] = useState<Announcement[]>([])
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true) // controls fade

  // Filtered announcements for this page
  const filtered = all.filter(
    a => a.target_pages.includes('all') || a.target_pages.includes(page)
  )

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements', { cache: 'no-store' })
      if (!res.ok) return
      const data: Announcement[] = await res.json()
      setAll(data)
    } catch {
      // Fail silently — banner just won't render
    }
  }, [])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  // Rotation effect with fade-out/in
  useEffect(() => {
    if (filtered.length <= 1) return

    const timer = setInterval(() => {
      // Fade out
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % filtered.length)
        // Fade in
        setVisible(true)
      }, 400)
    }, ROTATE_INTERVAL)

    return () => clearInterval(timer)
  }, [filtered.length])

  // Reset index when filtered list changes
  useEffect(() => {
    setIdx(0)
    setVisible(true)
  }, [filtered.length])

  if (filtered.length === 0) return null

  const current = filtered[idx % filtered.length]

  return (
    <div
      className="w-full border-b border-amber-500/15 bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-amber-950/60 backdrop-blur-sm"
      role="banner"
      aria-label="Pengumuman"
    >
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 transition-opacity duration-400"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {/* Megaphone icon */}
        <svg
          className="w-4 h-4 text-amber-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>

        {/* Message */}
        <p className="flex-1 text-sm text-amber-100/90 leading-snug font-medium">
          {current.message}
        </p>

        {/* Dots indicator — only when multiple */}
        {filtered.length > 1 && (
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {filtered.map((_, i) => (
              <button
                key={i}
                onClick={() => { setVisible(false); setTimeout(() => { setIdx(i); setVisible(true) }, 200) }}
                className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                  i === idx % filtered.length
                    ? 'bg-amber-400 w-3'
                    : 'bg-amber-700 hover:bg-amber-600'
                }`}
                aria-label={`Pengumuman ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
