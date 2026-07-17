import React from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import F03ManagementClient from './F03ManagementClient'

export default async function F03ManagementPage() {
  // Guard access: superadmin only
  await requireSuperAdmin()

  const supabase = await createClient()

  // 1. Fetch institutions list for targeting
  const { data: institutions, error: instErr } = await supabase
    .from('institutions')
    .select('id, name, category')
    .order('category')
    .order('name')

  if (instErr) {
    console.error('Error fetching institutions:', instErr)
    return notFound()
  }

  // 2. Fetch current F-03 values
  const { data: f03Raw, error: f03Err } = await supabase
    .from('f03_scores')
    .select('institution_id, score')

  if (f03Err) {
    console.error('Error fetching F-03 scores:', f03Err)
  }

  // Create lookup lookup
  const initialScores: Record<string, number> = {}
  for (const f of f03Raw || []) {
    initialScores[f.institution_id] = Number(f.score)
  }

  // 3. Extract unique categories list
  const categories = Array.from(new Set((institutions || []).map((i) => i.category).filter(Boolean)))

  return (
    <F03ManagementClient
      institutions={institutions || []}
      initialScores={initialScores}
      categories={categories}
    />
  )
}
