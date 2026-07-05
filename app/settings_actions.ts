'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'

/**
 * Get the global debug mode setting from app_settings table.
 * If setting is missing or table does not exist yet, defaults to false.
 */
export async function getGlobalDebugMode(): Promise<boolean> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'global_debug_mode')
      .maybeSingle()

    if (error) {
      console.warn('[Settings] Error fetching global_debug_mode (possibly table not migrated yet):', error.message)
      return false
    }

    return data?.value === 'true'
  } catch (err) {
    console.warn('[Settings] Failed to fetch global_debug_mode:', err)
    return false
  }
}

/**
 * Update the global debug mode setting.
 * Guarded so that only Superadmins can update settings.
 */
export async function updateGlobalDebugMode(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    // Auth guard: only Superadmin can update settings
    await requireSuperAdmin()

    const supabase = await createClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'global_debug_mode',
          value: enabled ? 'true' : 'false',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('[Settings] Error updating global_debug_mode:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[Settings] Failed to update global_debug_mode:', err)
    return { success: false, error: err.message || 'Gagal memperbarui pengaturan' }
  }
}
