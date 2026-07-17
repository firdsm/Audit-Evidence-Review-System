import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'
import RankingsClient from './RankingsClient'
import { getGlobalDebugMode } from '@/app/settings_actions'

export default async function HasilPenilaianPage() {
  const supabase = await createClient()

  // 1. Auth check (all authenticated roles can access)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Memuat autentikasi...</p>
      </div>
    )
  }

  // 2. Fetch auditor detail & role
  const role = await getAuditorRole()
  const isSuperAdmin = role === 'superadmin'

  const { data: auditorData } = await supabase
    .from('auditors')
    .select('name')
    .eq('email', user.email || '')
    .single()
  const userName = auditorData?.name || ''

  // 3. Fetch debug mode setting
  const globalDebugMode = await getGlobalDebugMode()

  // 4. Fetch all categories for filter
  const { data: categoriesRaw } = await supabase
    .from('institutions')
    .select('category')
    .order('category')
  const allCategories = Array.from(new Set((categoriesRaw || []).map((c: any) => c.category).filter(Boolean)))

  return (
    <RankingsClient
      userEmail={user.email || ''}
      userName={userName}
      isSuperAdmin={isSuperAdmin}
      allCategories={allCategories}
      initialGlobalDebugMode={globalDebugMode}
    />
  )
}
