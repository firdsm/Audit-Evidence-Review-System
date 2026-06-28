'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateAuditorRole } from './actions'

interface Auditor {
  id: string
  email: string
  role: 'auditor' | 'superadmin'
}

interface UsersClientProps {
  auditors: Auditor[]
  currentUserId: string
}

export default function UsersClient({ auditors, currentUserId }: UsersClientProps) {
  const [roles, setRoles] = useState<Record<string, 'auditor' | 'superadmin'>>(
    Object.fromEntries(auditors.map((a) => [a.id, a.role]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({})
  const [, startTransition] = useTransition()

  async function handleRoleChange(auditorId: string, newRole: 'auditor' | 'superadmin') {
    setSaving((prev) => ({ ...prev, [auditorId]: true }))
    setMessages((prev) => ({ ...prev, [auditorId]: undefined as any }))

    startTransition(async () => {
      const result = await updateAuditorRole(auditorId, newRole)
      setSaving((prev) => ({ ...prev, [auditorId]: false }))

      if (result.success) {
        setRoles((prev) => ({ ...prev, [auditorId]: newRole }))
        setMessages((prev) => ({
          ...prev,
          [auditorId]: { type: 'success', text: 'Role diperbarui' },
        }))
        // Clear message setelah 3 detik
        setTimeout(() => {
          setMessages((prev) => ({ ...prev, [auditorId]: undefined as any }))
        }, 3000)
      } else {
        setMessages((prev) => ({
          ...prev,
          [auditorId]: { type: 'error', text: result.error || 'Gagal menyimpan' },
        }))
      }
    })
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.08),transparent_50%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 space-y-8">

        {/* Header / Breadcrumb */}
        <div className="space-y-1">
          <Link href="/dashboard" className="text-sm text-blue-500 hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Kelola Role Auditor
              </h1>
              <p className="text-sm text-zinc-500">
                Ubah role antara <span className="text-zinc-300 font-medium">auditor</span> dan <span className="text-violet-400 font-medium">superadmin</span> untuk setiap akun.
              </p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl text-sm text-zinc-400">
          <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Untuk menambah atau menonaktifkan akun auditor, lakukan secara manual di{' '}
            <span className="text-zinc-200 font-medium">Supabase Auth Dashboard</span>.
            Halaman ini hanya untuk mengubah role akun yang sudah terdaftar.
          </span>
        </div>

        {/* Auditors Table */}
        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {auditors.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 mx-auto opacity-30 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <p className="font-medium text-zinc-400">Tidak ada auditor ditemukan</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold bg-zinc-900/10">
                  <th className="py-4 px-6">Email Auditor</th>
                  <th className="py-4 px-6 w-56">Role</th>
                  <th className="py-4 px-6 w-32 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {auditors.map((auditor) => {
                  const isCurrentUser = auditor.id === currentUserId
                  const currentRole = roles[auditor.id]
                  const isSaving = saving[auditor.id]
                  const message = messages[auditor.id]

                  return (
                    <tr key={auditor.id} className="hover:bg-zinc-900/30 transition-colors">
                      {/* Email */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                            {auditor.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-white font-medium">{auditor.email}</span>
                            {isCurrentUser && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md font-semibold">
                                Anda
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-4 px-6">
                        <select
                          value={currentRole}
                          disabled={isSaving || isCurrentUser}
                          onChange={(e) =>
                            handleRoleChange(auditor.id, e.target.value as 'auditor' | 'superadmin')
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer appearance-none
                            ${currentRole === 'superadmin'
                              ? 'bg-violet-950/40 text-violet-300 border-violet-700/50 hover:border-violet-600/60'
                              : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:border-zinc-600/60'
                            }
                            ${(isSaving || isCurrentUser) ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                          title={isCurrentUser ? 'Tidak bisa mengubah role akun sendiri' : undefined}
                        >
                          <option value="auditor">Auditor</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        {isSaving ? (
                          <span className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs">
                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Menyimpan...
                          </span>
                        ) : message ? (
                          <span
                            className={`text-xs font-medium ${
                              message.type === 'success' ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {message.type === 'success' ? '✓ ' : '✗ '}
                            {message.text}
                          </span>
                        ) : (
                          <span className="text-zinc-700 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-zinc-600 text-center">
          {auditors.length} akun terdaftar · Perubahan role berlaku segera
        </p>
      </div>
    </div>
  )
}
