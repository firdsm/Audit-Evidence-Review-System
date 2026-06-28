'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'

export type UpdateRoleResult = { success: true } | { success: false; error: string }

/**
 * Update role auditor. Hanya bisa dipanggil oleh superadmin.
 */
export async function updateAuditorRole(
  auditorId: string,
  newRole: 'auditor' | 'superadmin'
): Promise<UpdateRoleResult> {
  // Guard: hanya superadmin
  const authError = await requireSuperAdminApi()
  if (authError) {
    return { success: false, error: 'Forbidden: Akses hanya untuk superadmin' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('auditors')
    .update({ role: newRole })
    .eq('id', auditorId)

  if (error) {
    console.error('Error updating auditor role:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
