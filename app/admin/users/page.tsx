import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import UsersClient from './UsersClient'

export default async function AdminUsersPage() {
  // Hanya superadmin yang boleh akses
  await requireSuperAdmin()

  const supabase = await createClient()

  // Ambil email user yang sedang login (untuk disable self-edit)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch semua auditor — tabel auditors menyimpan: id, email, role
  const { data: auditors, error } = await supabase
    .from('auditors')
    .select('id, email, role')
    .order('email')

  if (error) {
    console.error('Error fetching auditors:', error)
  }

  // Cari record auditor yang sedang login berdasarkan email
  const currentAuditor = (auditors || []).find((a) => a.email === user?.email)

  const formattedAuditors = (auditors || []).map((a: any) => ({
    id: a.id,
    email: a.email || '(email tidak tersedia)',
    role: a.role as 'auditor' | 'superadmin',
  }))

  return (
    <UsersClient
      auditors={formattedAuditors}
      currentUserId={currentAuditor?.id || ''}
    />
  )
}
