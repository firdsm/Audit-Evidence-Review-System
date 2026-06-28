'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import UserDropdown from '@/components/UserDropdown'

interface InstitutionData {
  id: string
  name: string
  category: string
  last_synced_at: string
  assessmentsCount: number
}

interface DashboardClientProps {
  initialInstitutions: InstitutionData[]
  totalIndicators: number
  userEmail?: string
  userName?: string
  isSuperAdmin?: boolean
}

export default function DashboardClient({
  initialInstitutions,
  totalIndicators,
  userEmail = '',
  userName = '',
  isSuperAdmin = false,
}: DashboardClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // Get unique categories for the dropdown filter
  const categories = ['ALL', ...Array.from(new Set(initialInstitutions.map((inst) => inst.category)))]

  // Filter institutions based on search and category
  const filteredInstitutions = initialInstitutions.filter((inst) => {
    const matchesSearch = inst.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'ALL' || inst.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.08),transparent_50%)]" />

      {/* Navigation */}
      <nav className="relative z-20 border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/10">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                AERS
              </span>
              <span className="hidden md:inline text-xs text-zinc-500 ml-2 border-l border-zinc-800 pl-2">
                Audit Evidence Review System
              </span>
            </div>
          </div>

          {/* User Dropdown */}
          <UserDropdown
            userName={userName}
            userEmail={userEmail}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-6">

        {/* Header Section */}
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Daftar Instansi
          </h1>
          <p className="text-sm text-zinc-400">
            Pilih instansi untuk melakukan penilaian audit bukti pelayanan publik.
          </p>
        </div>

        {/* Filter Section */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Cari nama instansi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative w-full sm:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all appearance-none cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'Semua Kategori' : cat}
                </option>
              ))}
            </select>
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
        </div>

        {/* Institutions Table */}
        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {filteredInstitutions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 mx-auto opacity-30 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="font-medium text-zinc-400">Tidak ada instansi ditemukan</p>
              <p className="text-xs">Coba bersihkan filter pencarian atau sinkronisasikan instansi dari Google Drive.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold bg-zinc-900/10">
                    <th className="py-4 px-6">Nama Instansi</th>
                    <th className="py-4 px-6 w-48">Kategori</th>
                    <th className="py-4 px-6 w-64">Progress Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredInstitutions.map((inst) => {
                    const percentage = totalIndicators > 0 ? Math.round((inst.assessmentsCount / totalIndicators) * 100) : 0

                    return (
                      <tr
                        key={inst.id}
                        onClick={() => router.push(`/audit/${inst.id}`)}
                        className="hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                      >
                        {/* Name */}
                        <td className="py-4 px-6 font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {inst.name}
                        </td>

                        {/* Category */}
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-md text-xs font-semibold border border-zinc-700/30">
                            {inst.category}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="py-4 px-6">
                          <div className="space-y-1.5 max-w-xs">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-mono text-zinc-400">
                                {inst.assessmentsCount} / {totalIndicators} Indikator
                              </span>
                              <span className="font-semibold text-blue-500">
                                {percentage}%
                              </span>
                            </div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percentage}%` }}
                                className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
