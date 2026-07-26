import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'
import DashboardClient from './DashboardClient'
import { getGlobalDebugMode } from '@/app/settings_actions'

import indicatorGuidance from '@/indicator-guidance.json'

interface RequiredDocumentDef {
  id: string
  name: string
  order: number
  required: boolean
}

interface IndicatorGuidanceItem {
  indicator_code: string
  required_documents: RequiredDocumentDef[]
}

const guidanceData = indicatorGuidance as IndicatorGuidanceItem[]
const TOTAL_REQUIRED_DOCUMENTS = guidanceData.reduce(
  (acc, curr) => acc + (curr.required_documents ? curr.required_documents.length : 0),
  0
)

const PAGE_SIZE = 15

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
      is_priority,
      last_synced_at,
      assessments (
        id,
        score,
        document_reviews (
          checked,
          note
        ),
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
        // Sistem Antrian: no numeric score — considered complete if any doc is checked
        const reviews: { checked: boolean }[] = a.document_reviews || []
        return reviews.some((r) => r.checked)
      } else {
        // All other indicators: complete when score is set
        return a.score !== null && a.score !== undefined
      }
    }).length

    // Calculate Document Completeness Stats
    let totalReviewedDocs = 0
    let okCount = 0
    let noteCount = 0

    const assessmentsList = inst.assessments || []
    for (const a of assessmentsList) {
      const docReviews: { checked: boolean; note: string | null }[] = a.document_reviews || []
      for (const r of docReviews) {
        totalReviewedDocs++
        const noteText = r.note ? r.note.trim() : ''
        if (r.checked && noteText === '') {
          okCount++
        } else if (r.checked && noteText !== '') {
          noteCount++
        }
      }
    }

    const hasReviews = totalReviewedDocs > 0
    const missingCount = TOTAL_REQUIRED_DOCUMENTS - okCount - noteCount
    const percentage = hasReviews
      ? Math.round((okCount / TOTAL_REQUIRED_DOCUMENTS) * 100)
      : null

    return {
      id: inst.id,
      name: inst.name,
      category: inst.category,
      is_priority: !!inst.is_priority,
      last_synced_at: inst.last_synced_at || '',
      assessmentsCount: completedCount,
      docCompleteness: {
        okCount,
        noteCount,
        missingCount: Math.max(0, missingCount),
        totalRequired: TOTAL_REQUIRED_DOCUMENTS,
        percentage,
      },
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
