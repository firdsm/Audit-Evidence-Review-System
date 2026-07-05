import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'
import DashboardClient from './DashboardClient'
import { getGlobalDebugMode } from '@/app/settings_actions'

const PAGE_SIZE = 10

export default async function DashboardPage() {
  const supabase = await createClient()
  const startTime = performance.now()
  const serverTimestamp = Date.now()
  console.log(`[DashboardPage Server] Start query at: ${new Date(serverTimestamp).toLocaleTimeString()} (ms: ${serverTimestamp})`)

  // 1. Auth: user + role + name
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const role = await getAuditorRole()
  const isSuperAdmin = role === 'superadmin'

  const { data: auditorData } = await supabase
    .from('auditors')
    .select('name')
    .eq('email', user?.email || '')
    .single()
  const userName = auditorData?.name || ''

  // 2. Fetch global debug mode setting from DB
  const globalDebugMode = await getGlobalDebugMode()

  // 3. Total count of indicators (untuk progress bar)
  const { count: totalIndicatorsCount } = await supabase
    .from('indicators')
    .select('*', { count: 'exact', head: true })

  // 4. Fetch all institutions
  const { data: rawInstitutions, error: instError } = await supabase
    .from('institutions')
    .select(`
      id,
      name,
      category,
      last_synced_at,
      assessments (
        id,
        score,
        finding_status,
        indicators (
          id,
          aspects (
            name
          )
        )
      )
    `)
    .order('category')
    .order('name')
  if (instError) console.error('Error fetching institutions:', instError)

  // 5. All unique categories for filter dropdown
  const { data: categoriesRaw } = await supabase
    .from('institutions')
    .select('category')
    .order('category')
  const allCategories = [
    'ALL',
    ...Array.from(new Set((categoriesRaw || []).map((c: any) => c.category).filter(Boolean))),
  ]

  // 6. Format data
  const institutionsData = (rawInstitutions || []).map((inst: any) => {
    const completedCount = (inst.assessments || []).filter((a: any) => {
      const aspectName = a.indicators?.aspects?.name || ''
      const isSistemAntrian = aspectName.toLowerCase() === 'sistem antrian'
      if (isSistemAntrian) {
        return a.finding_status !== null && a.finding_status !== undefined
      } else {
        return (
          a.score !== null &&
          a.score !== undefined &&
          a.finding_status !== null &&
          a.finding_status !== undefined
        )
      }
    }).length

    return {
      id: inst.id,
      name: inst.name,
      category: inst.category,
      last_synced_at: inst.last_synced_at || '',
      assessmentsCount: completedCount,
    }
  })

  const elapsed = performance.now() - startTime
  console.log(`[DashboardPage Server] Querying and loading finished in ${elapsed.toFixed(2)}ms`)

  return (
    <DashboardClient
      institutions={institutionsData}
      totalIndicators={totalIndicatorsCount || 0}
      userEmail={user?.email || ''}
      userName={userName}
      isSuperAdmin={isSuperAdmin}
      allCategories={allCategories}
      initialGlobalDebugMode={globalDebugMode}
    />
  )
}
