import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import BackupClient from './BackupClient'

export const metadata = {
  title: 'Backup Database — AERS',
  description: 'Buat file SQL cadangan seluruh data aplikasi AERS',
}

export default async function BackupPage() {
  // Guard: superadmin only — redirects to /dashboard if not superadmin
  await requireSuperAdmin()

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch auditor profile for display name
  const { data: auditor } = await supabase
    .from('auditors')
    .select('email, role')
    .eq('email', user?.email ?? '')
    .single()

  const userName = user?.user_metadata?.full_name || user?.email || ''
  const userEmail = auditor?.email || user?.email || ''

  return (
    <BackupClient
      userEmail={userEmail}
      userName={userName}
    />
  )
}
