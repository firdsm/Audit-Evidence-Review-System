import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'
import AuditClient from './AuditClient'
import { getGlobalDebugMode } from '@/app/settings_actions'

interface PageProps {
  params: Promise<{
    institutionId: string
  }>
}

export default async function AuditPage({ params }: PageProps) {
  const { institutionId } = await params
  
  const supabase = await createClient()

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = await getAuditorRole()
  const isSuperAdmin = role === 'superadmin'

  const globalDebugMode = await getGlobalDebugMode()

  // 2. Fetch institution details
  const { data: institution, error: instError } = await supabase
    .from('institutions')
    .select('id, name, category, drive_folder_id')
    .eq('id', institutionId)
    .single()

  if (instError || !institution) {
    return notFound()
  }

  // 3. Fetch all aspects with indicators
  const { data: rawAspects, error: aspectsError } = await supabase
    .from('aspects')
    .select(`
      id,
      name,
      order_number,
      indicators (
        id,
        aspect_id,
        code,
        name,
        order_number,
        scoring_scale,
        required_documents
      )
    `)
    .order('order_number')

  if (aspectsError) {
    console.error('Error fetching aspects and indicators:', aspectsError)
  }

  // Sort indicators inside aspects in JS to ensure perfect ordering
  const formattedAspects = (rawAspects || []).map((aspect: any) => ({
    ...aspect,
    indicators: (aspect.indicators || []).sort(
      (a: any, b: any) => a.order_number - b.order_number
    ),
  }))

  // 4. Fetch existing assessments for this institution, including document reviews
  const { data: assessments, error: assessError } = await supabase
    .from('assessments')
    .select(`
      id,
      indicator_id,
      score,
      document_reviews (
        id,
        document_id,
        checked,
        note
      )
    `)
    .eq('institution_id', institutionId)

  if (assessError) {
    console.error('Error fetching assessments:', assessError)
  }

  return (
    <AuditClient
      institution={institution}
      aspects={formattedAspects}
      initialAssessments={assessments || []}
      isSuperAdmin={isSuperAdmin}
      globalDebugMode={globalDebugMode}
    />
  )
}
