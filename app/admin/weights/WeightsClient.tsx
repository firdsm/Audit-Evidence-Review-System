'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  getWeightConfigurations,
  getWeightConfigurationDetail,
  createWeightConfiguration,
  updateWeights,
  setActiveWeightConfiguration,
} from './actions'

interface Config {
  id: string
  year: number
  is_active: boolean
  created_at: string
}

interface Aspect {
  id: string
  name: string
  order_number: number
}

interface Indicator {
  id: string
  aspect_id: string
  code: string
  name: string
  order_number: number
}

interface AspectWeight {
  aspect_id: string
  weight: number
}

interface IndicatorWeight {
  indicator_id: string
  weight: number
}

export default function WeightsClient() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Configuration detail data
  const [config, setConfig] = useState<Config | null>(null)
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])

  // Weights edit state
  const [aspectWeights, setAspectWeights] = useState<Record<string, number>>({})
  const [indicatorWeights, setIndicatorWeights] = useState<Record<string, number>>({})

  // New configuration dialog state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear())
  const [copySourceId, setCopySourceId] = useState<string>('')
  const [creating, setCreating] = useState(false)

  // Active status confirmation modal
  const [showActiveModal, setShowActiveModal] = useState(false)

  // Saving states
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [, startTransition] = useTransition()

  // 1. Fetch configuration list on mount
  useEffect(() => {
    fetchConfigs()
  }, [])

  async function fetchConfigs(autoSelectActive = true) {
    setLoadingList(true)
    const res = await getWeightConfigurations()
    setLoadingList(false)
    if (res.success) {
      setConfigs(res.data)
      if (res.data.length > 0) {
        if (autoSelectActive) {
          const active = res.data.find((c) => c.is_active)
          setSelectedConfigId(active ? active.id : res.data[0].id)
        }
      }
    }
  }

  // 2. Fetch configuration detail when selected ID changes
  useEffect(() => {
    if (!selectedConfigId) return
    loadDetail(selectedConfigId)
  }, [selectedConfigId])

  async function loadDetail(id: string) {
    setLoadingDetail(true)
    setSaveMessage(null)
    const res = await getWeightConfigurationDetail(id)
    setLoadingDetail(false)
    if (res.success) {
      const { config, aspects, indicators, aspectWeights, indicatorWeights } = res.data
      setConfig(config)
      setAspects(aspects)
      setIndicators(indicators)

      // Map weights to states
      const awMap: Record<string, number> = {}
      aspects.forEach((a: Aspect) => {
        const found = aspectWeights.find((w: any) => w.aspect_id === a.id)
        awMap[a.id] = found ? parseFloat(found.weight) : 0
      })
      setAspectWeights(awMap)

      const iwMap: Record<string, number> = {}
      indicators.forEach((i: Indicator) => {
        const found = indicatorWeights.find((w: any) => w.indicator_id === i.id)
        iwMap[i.id] = found ? parseFloat(found.weight) : 0
      })
      setIndicatorWeights(iwMap)
    }
  }

  // Calculate totals
  const totalAspectWeight = Object.values(aspectWeights).reduce((sum, w) => sum + (w || 0), 0)

  const getIndicatorsForAspect = (aspectId: string) => {
    return indicators.filter((ind) => ind.aspect_id === aspectId)
  }

  const getAspectIndicatorTotalWeight = (aspectId: string) => {
    const aspectInds = getIndicatorsForAspect(aspectId)
    return aspectInds.reduce((sum, ind) => sum + (indicatorWeights[ind.id] || 0), 0)
  }

  // Actions
  async function handleCreateConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!newYear) return
    setCreating(true)
    const res = await createWeightConfiguration(newYear, copySourceId || undefined)
    setCreating(false)
    if (res.success) {
      setShowCreateModal(false)
      await fetchConfigs(false) // reload configs list
      setSelectedConfigId(res.data.id) // select new
    } else {
      alert(res.error || 'Gagal membuat konfigurasi baru')
    }
  }

  async function handleSaveWeights() {
    if (!config) return
    setSaving(true)
    setSaveMessage(null)

    const awList = Object.entries(aspectWeights).map(([aspectId, weight]) => ({
      aspectId,
      weight,
    }))

    const iwList = Object.entries(indicatorWeights).map(([indicatorId, weight]) => ({
      indicatorId,
      weight,
    }))

    const res = await updateWeights(config.id, awList, iwList)
    setSaving(false)

    if (res.success) {
      setSaveMessage({ type: 'success', text: 'Bobot penilaian berhasil disimpan.' })
      setTimeout(() => setSaveMessage(null), 4000)
    } else {
      setSaveMessage({ type: 'error', text: res.error || 'Gagal menyimpan bobot.' })
    }
  }

  async function handleSetActive() {
    if (!config) return
    setShowActiveModal(false)
    setSaving(true)
    const res = await setActiveWeightConfiguration(config.id)
    setSaving(false)
    if (res.success) {
      await fetchConfigs(false) // reload list
      await loadDetail(config.id) // reload detail metadata
      setSaveMessage({ type: 'success', text: `Tahun ${config.year} sekarang diatur sebagai konfigurasi AKTIF.` })
      setTimeout(() => setSaveMessage(null), 4000)
    } else {
      alert(res.error || 'Gagal mengaktifkan konfigurasi')
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans overflow-hidden thin-scrollbar">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.06),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 space-y-8 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
          <div className="space-y-1">
            <Link href="/dashboard" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  Kelola Bobot Penilaian
                </h1>
                <p className="text-xs text-zinc-500">
                  Konfigurasikan pembobotan Aspek dan Indikator per periode tahun.
                </p>
              </div>
            </div>
          </div>

          {/* Configuration selector & tools */}
          <div className="flex items-center gap-2.5">
            {loadingList ? (
              <div className="w-36 h-9 bg-zinc-900/50 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer min-w-[120px]"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    Tahun {c.year} {c.is_active ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => {
                setNewYear(new Date().getFullYear())
                setCopySourceId(configs.find((c) => c.is_active)?.id || '')
                setShowCreateModal(true)}
              }
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              + Buat Tahun Baru
            </button>
          </div>
        </div>

        {loadingDetail || !config ? (
          <div className="space-y-6">
            <div className="h-24 bg-zinc-900/20 border border-zinc-800/40 rounded-2xl animate-pulse" />
            <div className="h-64 bg-zinc-900/20 border border-zinc-800/40 rounded-2xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Status Info Card */}
            <div className="p-5 bg-zinc-900/10 border border-zinc-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-white">Tahun Konfigurasi: {config.year}</span>
                  {config.is_active ? (
                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase rounded-md">
                      Aktif
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold uppercase rounded-md">
                      Draf / Tidak Aktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {config.is_active
                    ? 'Konfigurasi ini sedang digunakan secara live untuk menghitung skor/kepatuhan di sistem.'
                    : 'Konfigurasi tahun ini belum aktif. Nilai di dalamnya tidak memengaruhi kalkulasi kepatuhan live.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {!config.is_active && (
                  <button
                    onClick={() => setShowActiveModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/15 transition-all cursor-pointer"
                  >
                    Jadikan Aktif
                  </button>
                )}

                <button
                  onClick={handleSaveWeights}
                  disabled={saving}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white border border-zinc-700/80 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Bobot'}
                </button>
              </div>
            </div>

            {saveMessage && (
              <div
                className={`p-4 rounded-xl text-xs font-medium border ${
                  saveMessage.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {saveMessage.text}
              </div>
            )}

            {/* SECTION 1: Aspek Weights */}
            <div className="bg-blue-950/10 border border-blue-900/25 rounded-2xl p-6 space-y-4">
              {/* Section header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blue-900/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-600/20 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-blue-200 tracking-tight">Bobot Aspek Penilaian</h2>
                    <p className="text-[11px] text-blue-400/60">Kontribusi setiap aspek ke nilai akhir penilaian.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-zinc-400">Total:</span>
                  <span
                    className={`text-sm font-extrabold px-2.5 py-0.5 rounded-lg border ${
                      totalAspectWeight === 100
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}
                  >
                    {totalAspectWeight}%
                  </span>
                </div>
              </div>

              {totalAspectWeight !== 100 && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2.5 text-xs text-amber-400">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Peringatan: Total bobot seluruh aspek saat ini {totalAspectWeight}%. Idealnya berjumlah 100%.</span>
                </div>
              )}

              {/* Single-column stacked list */}
              <div className="divide-y divide-blue-900/20">
                {aspects.map((aspect) => (
                  <div
                    key={aspect.id}
                    className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1 gap-4"
                  >
                    <span className="text-sm text-zinc-200 font-medium leading-snug flex-1 min-w-0">
                      <span className="text-blue-400/70 font-bold mr-1.5">{aspect.order_number}.</span>
                      {aspect.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={aspectWeights[aspect.id] ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setAspectWeights((prev) => ({ ...prev, [aspect.id]: val }))
                        }}
                        className="w-20 h-10 bg-zinc-950 border border-blue-900/40 rounded-xl text-center px-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50"
                      />
                      <span className="text-xs text-zinc-500 w-4">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: Indikator Weights (Grouped by Aspect) */}
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 pt-2">
                <div className="w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-600/20 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-violet-200 tracking-tight">Bobot Indikator per Aspek</h2>
                  <p className="text-[11px] text-violet-400/60">Kontribusi setiap indikator di dalam aspek induknya.</p>
                </div>
              </div>

              {aspects.map((aspect) => {
                const aspectInds = getIndicatorsForAspect(aspect.id)
                const totalIndWeight = getAspectIndicatorTotalWeight(aspect.id)

                return (
                  <div key={aspect.id} className="bg-zinc-900/20 border border-violet-900/30 rounded-2xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                      <span className="text-xs font-extrabold uppercase text-violet-400 tracking-wider">
                        Aspek {aspect.order_number}: {aspect.name}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 font-medium">Total Bobot Indikator:</span>
                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded-lg border ${
                            totalIndWeight === 100
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}
                        >
                          {totalIndWeight}%
                        </span>
                      </div>
                    </div>

                    {totalIndWeight !== 100 && (
                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2.5 text-xs text-amber-400">
                        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Peringatan: Total bobot indikator untuk Aspek {aspect.order_number} saat ini {totalIndWeight}%. Idealnya total bernilai 100%.</span>
                      </div>
                    )}

                    <div className="divide-y divide-zinc-800/40">
                      {aspectInds.map((ind) => (
                        <div
                          key={ind.id}
                          className="flex items-center justify-between py-3.5 gap-4"
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-md font-mono mr-2">
                              {ind.code}
                            </span>
                            <span className="text-xs text-zinc-300 font-medium">{ind.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={indicatorWeights[ind.id] ?? ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setIndicatorWeights((prev) => ({ ...prev, [ind.id]: val }))
                              }}
                              className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg text-center px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50"
                            />
                            <span className="text-xs text-zinc-500">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom Save Action Panel */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveWeights}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Semua Bobot'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW CONFIGURATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-white mb-4">Buat Tahun Konfigurasi Baru</h3>
            <form onSubmit={handleCreateConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Tahun Evaluasi</label>
                <input
                  type="number"
                  required
                  value={newYear}
                  onChange={(e) => setNewYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Salin Bobot Dari (Opsional)</label>
                <select
                  value={copySourceId}
                  onChange={(e) => setCopySourceId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer"
                >
                  <option value="">Jangan salin (mulai dari 0%)</option>
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      Tahun {c.year} {c.is_active ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Membuat...' : 'Buat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM SET ACTIVE MODAL */}
      {showActiveModal && config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowActiveModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-white mb-2">Aktifkan Konfigurasi?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-5">
              Apakah Anda yakin ingin mengaktifkan konfigurasi tahun <span className="text-zinc-200 font-bold">{config.year}</span>? Tindakan ini akan menonaktifkan konfigurasi tahun lainnya dan memengaruhi hasil perhitungan kepatuhan secara langsung.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowActiveModal(false)}
                className="px-3.5 py-2 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSetActive}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Ya, Aktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
