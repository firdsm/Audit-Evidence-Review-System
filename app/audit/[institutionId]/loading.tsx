import React from 'react'

export default function AuditLoading() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-white font-sans flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.08),transparent_50%)] pointer-events-none" />
      
      {/* Glowing Loading Spinner */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          {/* Inner pulse */}
          <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
          {/* Outer spinner */}
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-blue-500 animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-zinc-200 tracking-wide animate-pulse">
            Memuat Halaman Audit...
          </p>
          <p className="text-[11px] text-zinc-500">
            Menyiapkan berkas & parameter penilaian
          </p>
        </div>
      </div>
    </div>
  )
}
