'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { logout } from '@/app/login/actions'
import { updateGlobalDebugMode } from '@/app/settings_actions'

interface UserDropdownProps {
  userName: string
  userEmail: string
  isSuperAdmin: boolean
  initialGlobalDebugMode?: boolean
}

function getInitials(name: string, email: string): string {
  const source = name || email
  const parts = source.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export default function UserDropdown({
  userName,
  userEmail,
  isSuperAdmin,
  initialGlobalDebugMode = false,
}: UserDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [debugMode, setDebugMode] = useState(initialGlobalDebugMode)

  useEffect(() => {
    setDebugMode(initialGlobalDebugMode)
  }, [initialGlobalDebugMode])

  const handleToggleDebug = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newVal = !debugMode
    setDebugMode(newVal)

    const res = await updateGlobalDebugMode(newVal)
    if (!res.success) {
      alert(res.error || 'Gagal mengubah Debug Mode')
      setDebugMode(!newVal)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const initials = getInitials(userName, userEmail)
  const displayName = userName || userEmail

  return (
    <div ref={ref} className="relative">
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-md
          ${isSuperAdmin
            ? 'bg-gradient-to-tr from-violet-600 to-indigo-500 text-white'
            : 'bg-gradient-to-tr from-zinc-600 to-zinc-500 text-zinc-100'
          }`}
        >
          {initials}
        </div>

        {/* Name + email */}
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{displayName}</span>
            {/* Shield icon — superadmin only */}
            {isSuperAdmin && (
              <svg
                className="w-3.5 h-3.5 text-violet-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Superadmin"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            )}
          </div>
          <span className="text-[11px] text-zinc-500">{userEmail}</span>
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown Panel ── */}
      <div
        className={`absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50
          transition-all duration-200 origin-top-right
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        {/* Header info */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-zinc-800">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
            ${isSuperAdmin
              ? 'bg-gradient-to-tr from-violet-600 to-indigo-500 text-white'
              : 'bg-gradient-to-tr from-zinc-600 to-zinc-500 text-zinc-100'
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
            <span className={`inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md
              ${isSuperAdmin
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {isSuperAdmin ? 'Superadmin' : 'Auditor'}
            </span>
          </div>
        </div>

        {/* Superadmin menu items */}
        {isSuperAdmin && (
          <>
            <div className="py-1.5">
              <Link
                href="/sync"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Google Drive
              </Link>
              <Link
                href="/setup/folder-mapping"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Folder Mapping
              </Link>
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Kelola User
              </Link>
              <button
                onClick={handleToggleDebug}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Debug Mode</span>
                </div>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${debugMode ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${debugMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
            <div className="border-t border-zinc-800" />
          </>
        )}

        {/* Logout — always visible */}
        <div className="py-1.5">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
