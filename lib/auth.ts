import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type AuditorRole = 'auditor' | 'superadmin'

/**
 * Ambil role auditor yang sedang login.
 * Lookup via email karena tabel auditors tidak menyimpan user_id.
 * Return null kalau tidak ada sesi atau tidak ada record di tabel auditors.
 */
export async function getAuditorRole(): Promise<AuditorRole | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const { data, error } = await supabase
    .from('auditors')
    .select('role')
    .eq('email', user.email)
    .single()

  if (error || !data) return null

  return data.role as AuditorRole
}

/**
 * Guard untuk Server Components / Pages.
 * - Kalau tidak login → redirect ke /login
 * - Kalau bukan superadmin → redirect ke /dashboard
 */
export async function requireSuperAdmin(): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('auditors')
    .select('role')
    .eq('email', user.email)
    .single()

  if (error || !data || data.role !== 'superadmin') {
    redirect('/dashboard')
  }
}

/**
 * Guard untuk API Routes.
 * Return NextResponse 403 kalau bukan superadmin, null kalau boleh lanjut.
 */
export async function requireSuperAdminApi(): Promise<NextResponse | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('auditors')
    .select('role')
    .eq('email', user.email)
    .single()

  if (error || !data || data.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'Forbidden: Akses hanya untuk superadmin' },
      { status: 403 }
    )
  }

  return null
}
