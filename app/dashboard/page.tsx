import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Fetch current logged in user/auditor
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1b. Fetch role + name dari tabel auditors
  const role = await getAuditorRole()
  const isSuperAdmin = role === 'superadmin'

  const { data: auditorData } = await supabase
    .from('auditors')
    .select('name')
    .eq('email', user?.email || '')
    .single()
  const userName = auditorData?.name || ''

  // 2. Fetch total count of indicators
  const { count: totalIndicatorsCount, error: indError } = await supabase
    .from('indicators')
    .select('*', { count: 'exact', head: true })

  if (indError) {
    console.error('Error fetching indicators count:', indError)
  }

  // 3. Fetch institutions and join assessments to calculate progress
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

  if (instError) {
    console.error('Error fetching institutions list:', instError)
  }

  // Format institutions list data to pass cleanly to client component
  const institutionsData = (rawInstitutions || []).map((inst: any) => {
    const completedCount = (inst.assessments || []).filter((a: any) => {
      const aspectName = a.indicators?.aspects?.name || ''
      const isSistemAntrian = aspectName.toLowerCase() === 'sistem antrian'
      if (isSistemAntrian) {
        // Completed if finding_status is filled (not null/undefined)
        return a.finding_status !== null && a.finding_status !== undefined
      } else {
        // Completed if BOTH score and finding_status are filled
        return a.score !== null && a.score !== undefined && a.finding_status !== null && a.finding_status !== undefined
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

  return (
    <DashboardClient
      initialInstitutions={institutionsData}
      totalIndicators={totalIndicatorsCount || 0}
      userEmail={user?.email || ''}
      userName={userName}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
