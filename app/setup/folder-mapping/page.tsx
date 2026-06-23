import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MappingClient from './MappingClient'

export default async function FolderMappingSetupPage() {
  const supabase = await createClient()

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Fetch all institutions for selection dropdown
  const { data: institutions, error: instError } = await supabase
    .from('institutions')
    .select('id, name, category, drive_folder_id')
    .order('category')
    .order('name')

  if (instError) {
    console.error('Error fetching institutions:', instError)
  }

  // Filter out institutions without a drive folder id
  const validInstitutions = (institutions || []).filter((inst) => inst.drive_folder_id)

  // 3. Fetch all aspects
  const { data: aspects, error: aspError } = await supabase
    .from('aspects')
    .select('id, name, order_number')
    .order('order_number')

  if (aspError) {
    console.error('Error fetching aspects:', aspError)
  }

  // 4. Fetch all indicators
  const { data: indicators, error: indError } = await supabase
    .from('indicators')
    .select('id, code, name, aspect_id')
    .order('code')

  if (indError) {
    console.error('Error fetching indicators:', indError)
  }

  // Format indicator data for UI select option display
  const formattedIndicators = (indicators || []).map((ind: any) => ({
    id: ind.id,
    code: ind.code,
    name: ind.name,
    aspectId: ind.aspect_id,
  }))

  // 5. Fetch existing mappings
  const { data: existingMappings, error: mapError } = await supabase
    .from('indicator_folder_mapping')
    .select('indicator_id, folder_position')

  if (mapError) {
    console.error('Error fetching existing mappings:', mapError)
  }

  return (
    <MappingClient
      institutions={validInstitutions}
      aspects={aspects || []}
      indicators={formattedIndicators}
      initialMappings={existingMappings || []}
    />
  )
}
