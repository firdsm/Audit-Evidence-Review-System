'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getDriveSubfoldersAction, saveFolderMappingsAction } from './actions'

interface Institution {
  id: string
  name: string
  category: string
  drive_folder_id: string
}

interface Aspect {
  id: string
  name: string
  order_number: number
}

interface Indicator {
  id: string
  code: string
  name: string
  aspectId: string
}

interface Mapping {
  indicator_id: string
  folder_position: number
}

interface DriveSubfolder {
  id: string
  name: string
}

interface MappingClientProps {
  institutions: Institution[]
  aspects: Aspect[]
  indicators: Indicator[]
  initialMappings: Mapping[]
}

export default function MappingClient({
  institutions,
  aspects,
  indicators,
  initialMappings,
}: MappingClientProps) {
  const router = useRouter()
  const [selectedInstId, setSelectedInstId] = useState('')
  const [selectedAspectId, setSelectedAspectId] = useState('')
  
  const [folders, setFolders] = useState<DriveSubfolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [foldersError, setFoldersError] = useState<string | null>(null)
  const [isSingleIndicator, setIsSingleIndicator] = useState(false)
  
  // Local state for mapping values of the active aspect: key is folder_position (1-based), value is indicator_id
  const [mappings, setMappings] = useState<Record<number, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // 1. Populate mapping state for the active aspect when selected aspect or initial mappings change
  useEffect(() => {
    if (!selectedAspectId) {
      setMappings({})
      return
    }

    const aspectMap: Record<number, string> = {}
    // Get indicators for this aspect
    const aspectIndicators = indicators.filter((ind) => ind.aspectId === selectedAspectId)
    const aspectIndicatorIds = aspectIndicators.map((ind) => ind.id)

    initialMappings.forEach((map) => {
      if (aspectIndicatorIds.includes(map.indicator_id)) {
        aspectMap[map.folder_position] = map.indicator_id
      }
    })
    setMappings(aspectMap)
    setSaveStatus('idle')
  }, [selectedAspectId, initialMappings, indicators])

  // 2. Fetch folders when user selects/changes institution or aspect
  useEffect(() => {
    const fetchFolders = async () => {
      setFolders([])
      setFoldersError(null)
      setIsSingleIndicator(false)

      if (!selectedInstId || !selectedAspectId) return

      const inst = institutions.find((i) => i.id === selectedInstId)
      const aspect = aspects.find((a) => a.id === selectedAspectId)
      if (!inst || !inst.drive_folder_id || !aspect) return

      setFoldersLoading(true)
      try {
        const res = await getDriveSubfoldersAction(inst.drive_folder_id, aspect.order_number)
        if (res.success) {
          setFolders(res.folders || [])
          setIsSingleIndicator(!!res.isSingleIndicator)
        } else {
          setFoldersError(res.error || 'Gagal memuat folder Google Drive')
        }
      } catch (err: any) {
        setFoldersError(err.message || 'Gagal terhubung dengan server')
      } finally {
        setFoldersLoading(false)
      }
    }

    fetchFolders()
  }, [selectedInstId, selectedAspectId, institutions, aspects])

  // 3. Update local mapping selection
  const handleSelectChange = (position: number, indicatorId: string) => {
    setMappings((prev) => ({
      ...prev,
      [position]: indicatorId,
    }))
    setSaveStatus('idle')
  }

  // 4. Save current mapping of the active aspect to Supabase
  const handleSave = async () => {
    if (!selectedAspectId) return

    setSaveStatus('saving')
    setErrorMessage('')

    // Convert local record state back to array of mappings
    const mappingsArray = Object.entries(mappings)
      .filter(([_, val]) => val !== '')
      .map(([pos, val]) => ({
        folder_position: parseInt(pos, 10),
        indicator_id: val,
      }))

    try {
      const res = await saveFolderMappingsAction(mappingsArray, selectedAspectId)
      if (res.success) {
        setSaveStatus('saved')
        router.refresh() // Refresh page to reload initialMappings from database
        setTimeout(() => {
          setSaveStatus('idle')
        }, 2000)
      } else {
        setSaveStatus('error')
        setErrorMessage(res.error || 'Terjadi kesalahan sistem')
      }
    } catch (err: any) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Gagal menghubungi server')
    }
  }

  // Filter indicators to only show ones belonging to the selected aspect
  const activeAspectIndicators = indicators.filter((ind) => ind.aspectId === selectedAspectId)

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.1),transparent_50%)]" />

      {/* Main Container */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="space-y-1">
            <Link href="/dashboard" className="text-sm text-blue-500 hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Pengaturan Posisi Folder Evidence
            </h1>
            <p className="text-sm text-zinc-400">
              Petakan nomor posisi subfolder indikator (diurutkan alfabetis per-aspek) ke indikator penilaian yang sesuai.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="text-sm text-zinc-400 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Menyimpan...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-500 font-semibold flex items-center gap-1">
                ✓ Berhasil Disimpan!
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-500 font-semibold">
                ⚠ {errorMessage}
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !selectedAspectId || !selectedInstId || isSingleIndicator}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/10 cursor-pointer"
            >
              Simpan Mapping Aspek
            </button>
          </div>
        </div>

        {/* Setup Selection Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {/* Instansi Select */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl backdrop-blur-md space-y-4">
            <div className="space-y-1">
              <label htmlFor="instansi-select" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Pilih Instansi Contoh
              </label>
              <p className="text-[11px] text-zinc-500">
                Pilih salah satu instansi yang memiliki struktur subfolder paling lengkap.
              </p>
            </div>

            <div className="relative">
              <select
                id="instansi-select"
                value={selectedInstId}
                onChange={(e) => setSelectedInstId(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">-- Pilih Instansi --</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    [{inst.category}] {inst.name}
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

          {/* Aspek Select */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl backdrop-blur-md space-y-4">
            <div className="space-y-1">
              <label htmlFor="aspek-select" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Pilih Aspek Penilaian
              </label>
              <p className="text-[11px] text-zinc-500">
                Lakukan pemetaan per-aspek. Folder indikator di dalam aspek terpilih akan dimuat.
              </p>
            </div>

            <div className="relative">
              <select
                id="aspek-select"
                value={selectedAspectId}
                disabled={!selectedInstId}
                onChange={(e) => setSelectedAspectId(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">-- Pilih Aspek --</option>
                {aspects.map((asp) => (
                  <option key={asp.id} value={asp.id}>
                    {asp.order_number}. {asp.name}
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
        </div>

        {/* Subfolder list and select mapping */}
        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          {foldersLoading ? (
            <div className="p-20 text-center text-zinc-500 space-y-3">
              <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm font-medium">Membaca folder indikator di bawah aspek dari Google Drive...</p>
            </div>
          ) : foldersError ? (
            <div className="p-12 text-center text-red-400 bg-red-950/10 m-6 border border-red-900/30 rounded-2xl">
              <p className="font-semibold">Kesalahan Memuat Folder</p>
              <p className="text-xs mt-1">{foldersError}</p>
            </div>
          ) : !selectedInstId ? (
            <div className="p-16 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 mx-auto opacity-20 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-semibold text-zinc-400">Pilih instansi untuk memulai</p>
              <p className="text-xs max-w-sm mx-auto">Sistem akan memindai folder tingkat 3 pada instansi tersebut.</p>
            </div>
          ) : !selectedAspectId ? (
            <div className="p-16 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 mx-auto opacity-20 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <p className="font-semibold text-zinc-400">Pilih aspek penilaian</p>
              <p className="text-xs max-w-sm mx-auto">Pilih salah satu dari 7 aspek di atas untuk memetakan subfolder indikator yang bersangkutan.</p>
            </div>
          ) : isSingleIndicator ? (
            <div className="p-16 text-center text-zinc-500 space-y-4">
              <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-zinc-300">Aspek Khusus (1 Indikator)</p>
                <p className="text-xs max-w-md mx-auto text-zinc-400 leading-relaxed">
                  Aspek ini hanya memiliki 1 indikator di instrumen audit. Berkas bukti akan ditarik secara otomatis langsung dari folder aspek tersebut di Drive tanpa memerlukan pemetaan manual.
                </p>
              </div>
            </div>
          ) : folders.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 mx-auto opacity-20 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <p className="font-semibold text-zinc-400 font-mono">Folder Aspek Kosong / Belum Dibuat</p>
              <p className="text-xs max-w-sm mx-auto">Tidak terdeteksi subfolder indikator di dalam folder aspek instansi contoh ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold bg-zinc-900/10">
                    <th className="py-4 px-6 w-24">Urutan (No)</th>
                    <th className="py-4 px-6">Nama Subfolder di Google Drive (Alfabetis)</th>
                    <th className="py-4 px-6 w-96">Indikator yang Sesuai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {folders.map((folder, index) => {
                    const position = index + 1
                    const currentIndicatorId = mappings[position] || ''

                    return (
                      <tr key={folder.id} className="hover:bg-zinc-900/40 transition-colors">
                        {/* Position (No) */}
                        <td className="py-4 px-6 font-mono font-bold text-zinc-500">
                          {position}
                        </td>
                        
                        {/* Folder Name */}
                        <td className="py-4 px-6 font-semibold text-white">
                          {folder.name}
                        </td>
                        
                        {/* Dropdown Indicator Select */}
                        <td className="py-4 px-6">
                          <div className="relative">
                            <select
                              value={currentIndicatorId}
                              onChange={(e) => handleSelectChange(position, e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                            >
                              <option value="">-- Abaikan / Tidak Dipetakan --</option>
                              {activeAspectIndicators.map((ind) => (
                                <option key={ind.id} value={ind.id}>
                                  {ind.code} - {ind.name}
                                </option>
                              ))}
                            </select>
                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </span>
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

      </div>
    </div>
  )
}
