'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, ChevronDown, ChevronUp, FolderOpen, Info, FileText, Files } from 'lucide-react'
import { getEvidenceFilesAction, saveAssessmentAction } from '../actions'

interface Indicator {
  id: string
  aspect_id: string
  code: string
  name: string
  order_number: number
  scoring_scale?: Array<{ score: number; description: string }> | null
  required_documents?: string[] | null
}

interface Aspect {
  id: string
  name: string
  order_number: number
  indicators: Indicator[]
}

interface Assessment {
  id?: string
  indicator_id: string
  score: number | null
  finding_status: 'tidak_ada_temuan' | 'perlu_perbaikan' | 'bukti_tidak_tersedia'
  notes: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  subfolderName?: string
}

interface AuditClientProps {
  institution: {
    id: string
    name: string
    category: string
    drive_folder_id: string | null
  }
  aspects: Aspect[]
  initialAssessments: Assessment[]
}

export default function AuditClient({
  institution,
  aspects,
  initialAssessments,
}: AuditClientProps) {
  // Find first indicator to set as default active
  const firstIndicator = aspects[0]?.indicators[0] || null
  const [activeIndicator, setActiveIndicator] = useState<Indicator | null>(firstIndicator)

  const activeAspect = aspects.find(a => a.indicators.some(i => i.id === activeIndicator?.id))
  const isSistemAntrian = activeAspect?.name.toLowerCase() === 'sistem antrian'

  // Assessments state
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)

  // Active indicator form state
  const [score, setScore] = useState<number | null>(null)
  const [findingStatus, setFindingStatus] = useState<
    'tidak_ada_temuan' | 'perlu_perbaikan' | 'bukti_tidak_tersedia'
  >('tidak_ada_temuan')
  const [notes, setNotes] = useState('')

  // Auto-save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Evidence files state
  const [files, setFiles] = useState<DriveFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<DriveFile | null>(null)
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null)

  // Folder exists state for active indicator
  const [folderExists, setFolderExists] = useState<boolean>(true)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)

  // Status message for empty folder / no mapping fallback
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Scan recursion limit reached state
  const [scanLimitReached, setScanLimitReached] = useState<boolean>(false)

  // Debug states
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState<boolean>(false)
  const [showGuidance, setShowGuidance] = useState<boolean>(false)
  const [showDocsPopover, setShowDocsPopover] = useState<boolean>(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowDocsPopover(false)
      }
    }
    if (showDocsPopover) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDocsPopover])

  // Debounce ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to fetch evidence files (supports manual forceRefresh)
  const fetchEvidenceFiles = useCallback((forceRefresh = false) => {
    if (!activeIndicator || !institution.drive_folder_id) return

    setFilesLoading(true)
    setFiles([])
    setActiveFile(null)
    setFilesError(null)
    setFolderExists(true)
    setActiveFolderId(null)
    setStatusMessage(null)
    setDebugInfo(null)
    setScanLimitReached(false)
    setLoadingFileId(null)

    getEvidenceFilesAction(institution.drive_folder_id, activeIndicator.code, forceRefresh).then((res) => {
      setFilesLoading(false)
      if (res.success) {
        setStatusMessage(res.message || null)
        setFolderExists(res.folderExists !== false)
        setFiles(res.files || [])
        setDebugInfo(res.debug || null)
        setScanLimitReached(!!res.scanLimitReached)
        
        // Save the active folder ID
        const resolvedFolderId = (res as any).driveFolderId || res.debug?.matchedFolderId
        if (resolvedFolderId) {
          setActiveFolderId(resolvedFolderId)
        }
        
        // DO NOT set activeFile automatically!
        setActiveFile(null)
      } else {
        setFilesError(res.error || 'Gagal memuat dokumen bukti')
        setFolderExists(true)
        setScanLimitReached(false)
        setDebugInfo(null)
      }
    })
  }, [activeIndicator, institution.drive_folder_id])

  // 1a. Load active indicator's saved assessment values
  useEffect(() => {
    if (!activeIndicator) return

    const saved = assessments.find((a) => a.indicator_id === activeIndicator.id)
    
    setScore(saved ? saved.score : null)
    setFindingStatus(saved ? saved.finding_status : 'tidak_ada_temuan')
    setNotes(saved ? saved.notes : '')
    setSaveStatus('idle')
    setShowGuidance(false)
    setShowDocsPopover(false)
  }, [activeIndicator])

  // 1b. Fetch evidence files on indicator switch
  useEffect(() => {
    fetchEvidenceFiles(false)
  }, [activeIndicator, institution.drive_folder_id, fetchEvidenceFiles])

  // 2. Debounced Auto-save trigger (driven by user events, not passive effects)
  const triggerAutoSave = useCallback((
    currentScore: number | null,
    currentStatus: 'tidak_ada_temuan' | 'perlu_perbaikan' | 'bukti_tidak_tersedia',
    currentNotes: string
  ) => {
    if (!activeIndicator) return

    setSaveStatus('saving')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const response = await saveAssessmentAction({
        institutionId: institution.id,
        indicatorId: activeIndicator.id,
        score: currentScore,
        findingStatus: currentStatus,
        notes: currentNotes,
      })

      if (response.success) {
        setSaveStatus('saved')
        
        // Update local assessments array so checkmarks and status sync correctly
        setAssessments((prev) => {
          const index = prev.findIndex((a) => a.indicator_id === activeIndicator.id)
          const newVal: Assessment = {
            indicator_id: activeIndicator.id,
            score: currentScore,
            finding_status: currentStatus,
            notes: currentNotes,
          }
          if (index > -1) {
            const updated = [...prev]
            updated[index] = newVal
            return updated
          }
          return [...prev, newVal]
        })
      } else {
        setSaveStatus('error')
        setErrorMessage(response.error || 'Terjadi kesalahan sistem')
      }
    }, 1000)
  }, [activeIndicator, institution.id])

  // Handlers for user interactions
  const handleScoreChange = (val: number | null) => {
    setScore(val)
    triggerAutoSave(val, findingStatus, notes)
  }

  const handleStatusChange = (val: 'tidak_ada_temuan' | 'perlu_perbaikan' | 'bukti_tidak_tersedia') => {
    setFindingStatus(val)
    triggerAutoSave(score, val, notes)
  }

  const handleNotesChange = (val: string) => {
    setNotes(val)
    triggerAutoSave(score, findingStatus, val)
  }

  // Helper to check if indicator is evaluated
  const isEvaluated = (indicatorId: string, aspectName: string) => {
    const isSistemAntrian = aspectName.toLowerCase() === 'sistem antrian'
    const assessment = assessments.find((a) => a.indicator_id === indicatorId)
    if (!assessment) return false

    if (isSistemAntrian) {
      return assessment.finding_status !== null && assessment.finding_status !== undefined
    } else {
      return (
        assessment.score !== null &&
        assessment.score !== undefined &&
        assessment.finding_status !== null &&
        assessment.finding_status !== undefined
      )
    }
  }

  // Google Drive folder URL for manual fallback checks
  const driveFolderUrl = institution.drive_folder_id
    ? `https://drive.google.com/drive/folders/${institution.drive_folder_id}`
    : '#'

  // Export Hasil Audit via server-side template-based XLSX
  const exportHasilAudit = () => {
    const url = `/api/export-hasil-audit?institutionId=${encodeURIComponent(institution.id)}`
    window.open(url, '_blank')
  }

  // Export Temuan Audit to CSV (compatible with Excel)
  const exportTemuanCSV = () => {
    const csvRows = []
    
    // Header Row
    csvRows.push(['Kode Indikator', 'Nama Indikator', 'Aspek', 'Nilai Kepatuhan', 'Status Temuan', 'Catatan Auditor'])
    
    aspects.forEach(aspect => {
      const isAspectSistemAntrian = aspect.name.toLowerCase() === 'sistem antrian'
      aspect.indicators.forEach(ind => {
        const assessment = assessments.find(a => a.indicator_id === ind.id)
        
        // Empty string if it's Sistem Antrian, otherwise show score value or empty if missing
        const scoreVal = isAspectSistemAntrian 
          ? '' 
          : (assessment?.score !== undefined && assessment?.score !== null ? assessment.score : '')
          
        const statusVal = assessment?.finding_status || 'belum_diisi'
        const notesVal = assessment?.notes || ''

        // For Temuan Audit report, filter only assessments with findings
        if (statusVal === 'tidak_ada_temuan' || statusVal === 'belum_diisi') {
          return
        }

        csvRows.push([
          ind.code,
          ind.name,
          aspect.name,
          scoreVal,
          statusVal,
          notesVal
        ])
      })
    })

    // Generate CSV content with UTF-8 BOM for Excel compatibility
    const csvString = "\ufeff" + csvRows.map(row => 
      row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Temuan_Audit_${institution.name.replace(/[^a-z0-9]/gi, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="relative h-screen bg-zinc-950 text-white font-sans flex flex-col overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.05),transparent_50%)]" />

      {/* Header Bar */}
      <header className="relative z-10 border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{institution.name}</h1>
            <p className="text-xs text-zinc-400">
              Kategori: <span className="text-blue-500 font-semibold">{institution.category}</span>
            </p>
          </div>
        </div>

        {/* Global Save Indicator and Export Buttons */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={exportHasilAudit}
              className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 rounded-xl text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-black/20"
              title="Ekspor Hasil Penilaian ke Excel (Template)"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Hasil Penilaian</span>
            </button>
            <button
              onClick={exportTemuanCSV}
              className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 rounded-xl text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-black/20"
              title="Ekspor Temuan Audit ke Excel/CSV"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Export Temuan</span>
            </button>
          </div>

          {saveStatus === 'saving' && (
            <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
              <svg className="animate-spin h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Menyimpan...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-green-500 flex items-center gap-1 font-semibold">
              ✓ Tersimpan
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-500 font-semibold">
              ⚠ Gagal: {errorMessage}
            </span>
          )}
        </div>
      </header>

      {/* 3-Panel Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* PANEL KIRI: Aspects & Indicators */}
        <aside className="w-80 border-r border-zinc-800 bg-zinc-900/10 flex flex-col overflow-hidden shrink-0 select-none">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Daftar Indikator Penilaian</span>
          </div>

          <div className="flex-1 divide-y divide-zinc-900 overflow-y-auto">
            {aspects.map((aspect) => (
              <div key={aspect.id} className="p-2 space-y-1">
                <h4 className="px-3 py-2 text-xs font-extrabold text-zinc-400 uppercase tracking-tight">
                  {aspect.order_number}. {aspect.name}
                </h4>
                
                <div className="space-y-0.5">
                  {aspect.indicators.map((ind) => {
                    const active = activeIndicator?.id === ind.id
                    const completed = isEvaluated(ind.id, aspect.name)
                    
                    return (
                      <button
                        key={ind.id}
                        onClick={() => setActiveIndicator(ind)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex justify-between items-start gap-2 ${
                          active
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                        }`}
                      >
                        <span className="leading-relaxed">
                          <span className="font-bold mr-1">{ind.code}</span> {ind.name}
                        </span>
                        
                        {completed && (
                          <span className={`shrink-0 mt-0.5 ${active ? 'text-white' : 'text-green-500'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* PANEL TENGAH: Google Drive Evidence Preview */}
        <section className="flex-1 flex flex-col bg-zinc-900/5 overflow-hidden border-r border-zinc-800">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 flex justify-between items-center shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Berkas Bukti (Google Drive)</span>
            <div className="flex items-center gap-2">
              {folderExists && (
                <button
                  onClick={() => fetchEvidenceFiles(true)}
                  disabled={filesLoading}
                  className="p-1 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors cursor-pointer mr-1"
                  title="Segarkan berkas bukti (Refresh Cache)"
                >
                  <RefreshCw size={16} className={filesLoading ? 'animate-spin' : ''} />
                </button>
              )}
              <button
                onClick={() => {
                  if (activeFolderId) {
                    window.open(`https://drive.google.com/drive/folders/${activeFolderId}`, '_blank', 'noopener,noreferrer')
                  }
                }}
                disabled={filesLoading || !activeFolderId}
                className="p-1 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                title={activeFolderId ? "Buka folder Google Drive indikator" : "Folder Google Drive tidak tersedia untuk indikator ini"}
              >
                <FolderOpen size={16} />
              </button>
              {debugInfo && (
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono rounded border border-zinc-700 cursor-pointer"
                >
                  {showDebug ? 'Sembunyikan Debug' : 'Tampilkan Debug'}
                </button>
              )}
              {activeFile && folderExists && (
                <span className="text-xs text-zinc-400 max-w-xs truncate" title={activeFile.name}>
                  Preview: {activeFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Debug panel */}
          {showDebug && debugInfo && (
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 text-xs font-mono text-emerald-400 overflow-y-auto max-h-80 shrink-0 select-text">
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-zinc-800">
                <span className="font-bold text-white text-[10px] uppercase">AERS Debugging Panel</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
                    alert('Debug info copied to clipboard!')
                  }}
                  className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer text-[10px]"
                >
                  Salin JSON
                </button>
              </div>
              <p className="text-zinc-500 mb-1">// ID Folder Instansi yang Dipakai:</p>
              <p className="text-zinc-200 mb-2 font-bold">{debugInfo.institutionFolderId}</p>

              <p className="text-zinc-500 mb-1">// Target Aspek Indikator:</p>
              <p className="text-zinc-200 mb-2">
                Aspek: <span className="text-blue-400 font-bold">"{debugInfo.aspectName}"</span> (Urutan ke-{debugInfo.aspectOrderNumber})
              </p>
              
              <p className="text-zinc-500 mb-1">// Folder Aspek yang Ditemukan di Google Drive:</p>
              <p className="text-zinc-200 mb-2">
                {debugInfo.matchedAspectFolderId ? (
                  <>Nama: <span className="text-amber-400 font-bold">"{debugInfo.matchedAspectFolderName}"</span> | ID: <span className="text-zinc-300 font-bold">{debugInfo.matchedAspectFolderId}</span></>
                ) : (
                  <span className="text-red-400 font-bold">Tidak ditemukan folder aspek yang cocok</span>
                )}
              </p>

              <p className="text-zinc-500 mb-1">// Daftar SEMUA Subfolder Instansi di Google Drive (Level Aspek - Sorted Alphabetically):</p>
              <ul className="list-decimal pl-5 space-y-1 text-zinc-300 mb-2">
                {debugInfo.allAspectFolders?.map((f: any) => (
                  <li key={f.id} className={f.id === debugInfo.matchedAspectFolderId ? 'text-amber-400 font-semibold bg-amber-500/10 px-1 rounded' : ''}>
                    Index {f.index}: <span className="text-white">"{f.name}"</span> (ID: <span className="text-zinc-500">{f.id}</span>)
                  </li>
                ))}
              </ul>

              <p className="text-zinc-500 mb-1">// Posisi Indikator Relatif Terhadap Aspek (Database Mappings):</p>
              <p className="text-zinc-200 mb-2">
                Posisi Relatif: <span className="text-blue-400 font-bold">{debugInfo.mappedFolderPosition ?? 'Belum dipetakan'}</span> 
                {debugInfo.mappedIndex !== null && ` (Index: ${debugInfo.mappedIndex})`}
              </p>

              <p className="text-zinc-500 mb-1">// Folder Indikator yang Terpilih (Posisi Relatif):</p>
              <p className="text-zinc-200 mb-2">
                {debugInfo.matchedFolderId ? (
                  <>Nama: <span className="text-amber-400 font-bold">"{debugInfo.matchedFolderName}"</span> | ID: <span className="text-zinc-300 font-bold">{debugInfo.matchedFolderId}</span></>
                ) : (
                  <span className="text-red-400 font-bold">Tidak ada subfolder indikator terpilih (out of bounds)</span>
                )}
              </p>

              <p className="text-zinc-500 mb-1">// Daftar SEMUA Subfolder Indikator di dalam Aspek (Level Indikator - Sorted Alphabetically):</p>
              <ul className="list-decimal pl-5 space-y-1 text-zinc-300 mb-2">
                {debugInfo.allIndicatorFolders?.map((f: any) => (
                  <li key={f.id} className={f.id === debugInfo.matchedFolderId ? 'text-amber-400 font-semibold bg-amber-500/10 px-1 rounded' : ''}>
                    Index {f.index}: <span className="text-white">"{f.name}"</span> (ID: <span className="text-zinc-500">{f.id}</span>)
                  </li>
                ))}
              </ul>

              <p className="text-zinc-500 mb-1">// Hasil Mentah Berkas di Subfolder Indikator Terpilih (raw response):</p>
              <pre className="text-[10px] text-zinc-400 bg-zinc-900/50 p-2 rounded border border-zinc-900 overflow-x-auto max-h-40">
                {JSON.stringify(debugInfo.rawFilesFromDrive, null, 2)}
              </pre>
            </div>
          )}

          {/* Top Banner Warning for missing folder */}
          {!folderExists && (
            <div className="p-4 bg-zinc-900/60 border-b border-zinc-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 text-zinc-400">
                  <svg className="w-5 h-5 text-zinc-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">Folder Evidence Belum Tersedia</h4>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    {statusMessage || 'Folder evidence untuk indikator ini belum tersedia di Google Drive.'}
                  </p>
                </div>
              </div>
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Buka Google Drive</span>
              </a>
            </div>
          )}

          {/* Scan recursion limit reached banner */}
          {scanLimitReached && (
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-xs flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-4.5 h-4.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Struktur folder cukup kompleks, sebagian file mungkin belum ditampilkan.</span>
              </div>
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-400 font-semibold cursor-pointer shrink-0"
              >
                Buka di Drive
              </a>
            </div>
          )}

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Sidebar file list */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-900/10 flex flex-col overflow-y-auto shrink-0">
              {filesLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-2 text-zinc-500">
                  <svg className="animate-spin h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs">Memindai bukti...</span>
                </div>
              ) : filesError ? (
                <div className="p-4 text-xs text-red-400 bg-red-950/20 rounded-xl m-4 border border-red-900/40">
                  {filesError}
                </div>
              ) : files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-2">
                  <svg className="w-8 h-8 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs font-semibold text-zinc-400">Tidak ada berkas</p>
                  <p className="text-[10px] text-zinc-600 leading-relaxed max-w-[200px] mx-auto">
                    {statusMessage || 'Folder bukti kosong / tidak terdeteksi'}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {files.map((file) => {
                    const isPreviewable =
                      file.mimeType === 'application/pdf' ||
                      file.mimeType.startsWith('image/')
                    const isActive = activeFile?.id === file.id

                    return (
                      <button
                        key={file.id}
                        onClick={() => {
                          if (file.id === activeFile?.id) return
                          setActiveFile(file)
                          if (isPreviewable) {
                            setLoadingFileId(file.id)
                          } else {
                            setLoadingFileId(null)
                          }
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all text-xs flex items-start gap-2.5 ${
                          isActive
                            ? 'bg-zinc-800 border border-zinc-700 text-white'
                            : 'border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                        }`}
                      >
                        <span className="shrink-0 mt-0.5 text-zinc-500">
                          {loadingFileId === file.id ? (
                            <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : file.mimeType === 'application/pdf' ? (
                            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M4 4a2 2 0 012-2h4.586A1 1 0 0112 2.586L15.414 6A1 1 0 0116 6.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                            </svg>
                          ) : file.mimeType.startsWith('image/') ? (
                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A1 1 0 0112 2.586L15.414 6A1 1 0 0116 6.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6h8v2H6v-2z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        
                        <div className="space-y-0.5 truncate">
                          <p className="font-medium truncate leading-tight">{file.name}</p>
                          {file.subfolderName && (
                            <p className="text-[10px] text-amber-500/90 font-medium truncate pt-0.5">
                              📁 subfolder: {file.subfolderName}
                            </p>
                          )}
                          <p className="text-[9px] text-zinc-600 truncate uppercase pt-0.5">
                            {isPreviewable ? 'Preview Ready' : 'Download Only'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Document preview viewport */}
            <div className="flex-1 bg-zinc-950 p-4 flex flex-col justify-between overflow-y-auto min-h-[300px]">
              {activeFile ? (
                <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                  {/* Preview Area */}
                  <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative">
                    {activeFile.mimeType === 'application/pdf' ||
                    activeFile.mimeType.startsWith('image/') ? (
                      <>
                        <iframe
                          src={`https://drive.google.com/file/d/${activeFile.id}/preview`}
                          className="w-full h-full border-0"
                          allow="autoplay"
                          onLoad={() => setLoadingFileId(null)}
                        />
                        {loadingFileId === activeFile.id && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm gap-3 transition-opacity duration-300">
                            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-xs text-zinc-400 font-medium">Memuat dokumen pratinjau...</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <div className="w-16 h-16 bg-zinc-800 border border-zinc-700/60 rounded-2xl flex items-center justify-center text-zinc-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-white">{activeFile.name}</h4>
                          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                            Format berkas ini tidak mendukung pratinjau langsung di dalam sistem. Silakan buka di Google Drive atau unduh berkas.
                          </p>
                        </div>
                        <a
                          href={activeFile.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span>Buka di Google Drive</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions for PDF/Images */}
                  {(activeFile.mimeType === 'application/pdf' ||
                    activeFile.mimeType.startsWith('image/')) && (
                    <div className="flex justify-between items-center text-xs px-2 shrink-0">
                      <span className="text-zinc-500 font-mono">Format: {activeFile.mimeType}</span>
                      <a
                        href={activeFile.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1 font-semibold"
                      >
                        Buka di Google Drive Tab Baru
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-2">
                  <svg className="w-12 h-12 opacity-25 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <p className="font-semibold text-zinc-400">
                    {!folderExists ? 'Folder Belum Tersedia' : 'Pilih Berkas Pratinjau'}
                  </p>
                  <p className="text-xs max-w-xs mx-auto">
                    {!folderExists 
                      ? 'Silakan unggah dokumen bukti atau gunakan tombol Google Drive di atas.' 
                      : 'Klik berkas di bilah kiri panel untuk menampilkan dokumen bukti di sini secara instan.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PANEL KANAN: Form Penilaian Audit (Auto-Save) */}
        <main className="w-96 bg-zinc-900/10 p-6 flex flex-col overflow-y-auto shrink-0 select-none space-y-6">
          {activeIndicator ? (
            <>
              {/* Active Indicator Title */}
              <div className="space-y-1">
                <div className="flex items-center justify-between relative">
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-md text-[10px] font-extrabold uppercase border border-blue-500/20">
                    {activeIndicator.code}
                  </span>
                  {activeIndicator?.required_documents && activeIndicator.required_documents.length > 0 && (
                    <div className="relative inline-block" ref={popoverRef}>
                      <button
                        type="button"
                        onClick={() => setShowDocsPopover(!showDocsPopover)}
                        className="bg-transparent border border-zinc-800 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors leading-none"
                        aria-label="Lihat dokumen yang perlu dilampirkan"
                      >
                        <Files size={12} aria-hidden="true" />
                        <span>List Dokumen</span>
                      </button>
                      
                      {showDocsPopover && (
                        <div className="absolute right-0 mt-2 z-50 w-[260px] p-3 rounded-[12px] bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col">
                          <h4 className="text-[12px] font-semibold text-zinc-400 m-0 pb-[10px] mb-[10px] border-b-[0.5px] border-zinc-800/60 leading-none">
                            Dokumen yang perlu dilampirkan
                          </h4>
                          <ul className="space-y-[6px] m-0 p-0 list-none max-h-[320px] overflow-y-auto thin-scrollbar">
                            {activeIndicator.required_documents.map((doc, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[12px] text-zinc-300 leading-[1.5] p-0">
                                <FileText size={13} className="text-zinc-500 shrink-0 mt-[1px]" />
                                <span>{doc}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight pt-1 leading-tight">
                  {activeIndicator.name}
                </h3>
              </div>

              {/* Form Input fields */}
              <div className="space-y-5">
                                {/* 1. Score Rating (0-5) */}
                {!isSistemAntrian && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-[6px] mb-[10px] relative">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 m-0">
                        Nilai kepatuhan
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-[6px]">
                      {(() => {
                        const scales = activeIndicator?.scoring_scale && activeIndicator.scoring_scale.length > 0
                          ? activeIndicator.scoring_scale
                          : [0, 1, 2, 3, 4, 5].map(v => ({ score: v, description: `Skor ${v}` }));

                        return scales.map((item) => {
                          const selected = score === item.score;
                          
                          // Style variables based on score
                          let rowClass = "bg-zinc-950 border-[0.5px] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200";
                          let badgeClass = "bg-zinc-900 border-[0.5px] border-zinc-800 text-zinc-400";
                          let textClass = "text-zinc-500 font-normal";

                          if (selected) {
                            if (item.score === 0) {
                              rowClass = "bg-zinc-900 border-[1.5px] border-zinc-400 text-zinc-200";
                              badgeClass = "bg-zinc-800 border-[0.5px] border-zinc-600 text-zinc-200";
                              textClass = "text-zinc-300 font-medium";
                            } else if (item.score === 1 || item.score === 2) {
                              rowClass = "bg-amber-500/5 border-[1.5px] border-amber-500/40 text-amber-400";
                              badgeClass = "bg-amber-500/10 border border-amber-500/30 text-amber-400";
                              textClass = "text-amber-400 font-medium";
                            } else if (item.score === 3 || item.score === 4) {
                              rowClass = "bg-emerald-500/5 border-[1.5px] border-emerald-500/40 text-emerald-400";
                              badgeClass = "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400";
                              textClass = "text-emerald-400 font-medium";
                            } else if (item.score === 5) {
                              rowClass = "bg-blue-500/5 border-[1.5px] border-blue-500/40 text-blue-400";
                              badgeClass = "bg-blue-500/10 border border-blue-500/30 text-blue-400";
                              textClass = "text-blue-400 font-medium";
                            }
                          }

                          return (
                            <button
                              key={item.score}
                              type="button"
                              onClick={() => handleScoreChange(item.score)}
                              className={`flex items-center gap-[10px] p-[8px_10px] rounded-xl border transition-all text-left cursor-pointer ${rowClass}`}
                            >
                              <div className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-[13px] font-medium ${badgeClass}`}>
                                {item.score}
                              </div>
                              <p className={`text-xs leading-[1.4] m-0 ${textClass}`}>
                                {item.description}
                              </p>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
                {/* 2. Finding Status (Dropdown) */}
                <div className="space-y-2">
                  <label htmlFor="finding-status" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Status Temuan
                  </label>
                  <div className="relative">
                    <select
                      id="finding-status"
                      value={findingStatus}
                      onChange={(e: any) => handleStatusChange(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="tidak_ada_temuan">Tidak Ada Temuan</option>
                      <option value="perlu_perbaikan">Perlu Perbaikan</option>
                      <option value="bukti_tidak_tersedia">Bukti Tidak Tersedia</option>
                    </select>
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* 3. Notes (Textarea) */}
                <div className="space-y-2">
                  <label htmlFor="audit-notes" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Catatan Temuan / Penjelasan
                  </label>
                  <textarea
                    id="audit-notes"
                    rows={8}
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Tulis catatan penelaahan bukti di sini. Penilaian otomatis disimpan ketika Anda selesai mengetik..."
                    className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all resize-none placeholder-zinc-700"
                  />
                </div>

              </div>

              {/* Status Save Indicator Footer */}
              <div className="pt-4 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between items-center">
                <span>Auto-save aktif</span>
                <span>Pencocokan via (institution_id, indicator_id)</span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
              <p className="text-sm font-semibold">Pilih Indikator</p>
              <p className="text-xs">Silakan pilih indikator di panel kiri untuk membuka form penilaian.</p>
            </div>
          )}
        </main>

      </div>
    </div>
  )
}
