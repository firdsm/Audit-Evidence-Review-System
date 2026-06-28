import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'
import DashboardClient from './DashboardClient'

const PAGE_SIZE = 10

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { search = '', category = 'ALL', page = '1' } = await searchParams

  const searchStr = Array.isArray(search) ? search[0] : search
  const categoryStr = Array.isArray(category) ? category[0] : category
  const currentPage = Math.max(1, parseInt(Array.isArray(page) ? page[0] : page) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

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

  // 2. Total count of indicators (untuk progress bar)
  const { count: totalIndicatorsCount } = await supabase
    .from('indicators')
    .select('*', { count: 'exact', head: true })

  // 3. Total count of institutions matching current filter (untuk pagination)
  let countQuery = supabase
    .from('institutions')
    .select('*', { count: 'exact', head: true })
  if (searchStr) countQuery = countQuery.ilike('name', `%${searchStr}%`)
  if (categoryStr && categoryStr !== 'ALL') countQuery = countQuery.eq('category', categoryStr)
  const { count: totalInstitutions } = await countQuery

  // 4. Fetch hanya 10 institutions untuk halaman ini (true server-side pagination)
  let dataQuery = supabase
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
    .range(offset, offset + PAGE_SIZE - 1)
  if (searchStr) dataQuery = dataQuery.ilike('name', `%${searchStr}%`)
  if (categoryStr && categoryStr !== 'ALL') dataQuery = dataQuery.eq('category', categoryStr)

  const { data: rawInstitutions, error: instError } = await dataQuery
  if (instError) console.error('Error fetching institutions:', instError)

  // 5. All unique categories for filter dropdown (tidak dipaginasi)
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

  const totalPages = Math.max(1, Math.ceil((totalInstitutions || 0) / PAGE_SIZE))

  return (
    <DashboardClient
      institutions={institutionsData}
      totalIndicators={totalIndicatorsCount || 0}
      userEmail={user?.email || ''}
      userName={userName}
      isSuperAdmin={isSuperAdmin}
      allCategories={allCategories}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalInstitutions || 0}
      initialSearch={searchStr}
      initialCategory={categoryStr}
    />
  )
}
