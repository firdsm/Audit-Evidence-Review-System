'use client'

import React, { useState, useEffect } from 'react'
import { Maximize, Minimize } from 'lucide-react'

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    // Check support on mount (client-side only)
    const supported = !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    )
    setIsSupported(supported)

    if (!supported) return

    const handleFullscreenChange = () => {
      const active = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(active)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = () => {
    if (!isSupported) return

    if (!isFullscreen) {
      const docEl = document.documentElement
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen()
      } else if ((docEl as any).webkitRequestFullscreen) {
        (docEl as any).webkitRequestFullscreen()
      } else if ((docEl as any).mozRequestFullScreen) {
        (docEl as any).mozRequestFullScreen()
      } else if ((docEl as any).msRequestFullscreen) {
        (docEl as any).msRequestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen()
      }
    }
  }

  if (!isSupported) {
    return (
      <button
        disabled
        className="p-2 bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-500 cursor-not-allowed opacity-50 flex items-center justify-center transition-all duration-200"
        title="Fullscreen tidak didukung oleh browser Anda"
      >
        <Maximize size={16} />
      </button>
    )
  }

  return (
    <button
      onClick={toggleFullscreen}
      className="p-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center transition-all duration-200"
      title={isFullscreen ? 'Keluar Fullscreen' : 'Masuk Fullscreen'}
    >
      {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
    </button>
  )
}
