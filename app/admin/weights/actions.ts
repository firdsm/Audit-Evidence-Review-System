'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'

export type ActionResponse<T = any> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Guard helper.
 */
async function checkSuperAdmin(): Promise<{ success: false; error: string } | null> {
  const authError = await requireSuperAdminApi()
  if (authError) {
    return { success: false, error: 'Forbidden: Akses hanya untuk superadmin' }
  }
  return null
}

/**
 * Get all weight configurations.
 */
export async function getWeightConfigurations(): Promise<ActionResponse<any[]>> {
  const guard = await checkSuperAdmin()
  if (guard) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('weight_configurations')
    .select('*')
    .order('year', { ascending: false })

  if (error) {
    console.error('Error fetching weight configurations:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data || [] }
}

/**
 * Get detailed weights for a configuration.
 */
export async function getWeightConfigurationDetail(configId: string): Promise<ActionResponse> {
  const guard = await checkSuperAdmin()
  if (guard) return guard

  const supabase = await createClient()

  // 1. Fetch config metadata
  const { data: config, error: configError } = await supabase
    .from('weight_configurations')
    .select('*')
    .eq('id', configId)
    .single()

  if (configError || !config) {
    return { success: false, error: configError?.message || 'Konfigurasi tidak ditemukan' }
  }

  // 2. Fetch aspects and indicators
  const { data: aspects, error: aspectsError } = await supabase
    .from('aspects')
    .select('*')
    .order('order_number')

  if (aspectsError) {
    return { success: false, error: aspectsError.message }
  }

  const { data: indicators, error: indicatorsError } = await supabase
    .from('indicators')
    .select('*')
    .order('order_number')

  if (indicatorsError) {
    return { success: false, error: indicatorsError.message }
  }

  // 3. Fetch aspect weights and indicator weights for this config
  const { data: aspectWeights, error: awError } = await supabase
    .from('aspect_weights')
    .select('*')
    .eq('weight_configuration_id', configId)

  if (awError) {
    return { success: false, error: awError.message }
  }

  const { data: indicatorWeights, error: iwError } = await supabase
    .from('indicator_weights')
    .select('*')
    .eq('weight_configuration_id', configId)

  if (iwError) {
    return { success: false, error: iwError.message }
  }

  return {
    success: true,
    data: {
      config,
      aspects: aspects || [],
      indicators: indicators || [],
      aspectWeights: aspectWeights || [],
      indicatorWeights: indicatorWeights || [],
    },
  }
}

/**
 * Create a new weight configuration.
 */
export async function createWeightConfiguration(
  year: number,
  copyFromConfigId?: string
): Promise<ActionResponse> {
  const guard = await checkSuperAdmin()
  if (guard) return guard

  const supabase = await createClient()

  // 1. Insert new weight configuration
  const { data: newConfig, error: createError } = await supabase
    .from('weight_configurations')
    .insert({ year, is_active: false })
    .select()
    .single()

  if (createError) {
    console.error('Error creating weight configuration:', createError)
    return { success: false, error: createError.message }
  }

  // 2. Initialize weights
  if (copyFromConfigId) {
    // Copy from existing config
    const { data: awToCopy } = await supabase
      .from('aspect_weights')
      .select('aspect_id, weight')
      .eq('weight_configuration_id', copyFromConfigId)

    if (awToCopy && awToCopy.length > 0) {
      const inserts = awToCopy.map((aw) => ({
        weight_configuration_id: newConfig.id,
        aspect_id: aw.aspect_id,
        weight: aw.weight,
      }))
      await supabase.from('aspect_weights').insert(inserts)
    }

    const { data: iwToCopy } = await supabase
      .from('indicator_weights')
      .select('indicator_id, weight')
      .eq('weight_configuration_id', copyFromConfigId)

    if (iwToCopy && iwToCopy.length > 0) {
      const inserts = iwToCopy.map((iw) => ({
        weight_configuration_id: newConfig.id,
        indicator_id: iw.indicator_id,
        weight: iw.weight,
      }))
      await supabase.from('indicator_weights').insert(inserts)
    }
  } else {
    // Initialize with 0
    const { data: aspects } = await supabase.from('aspects').select('id')
    if (aspects && aspects.length > 0) {
      const inserts = aspects.map((a) => ({
        weight_configuration_id: newConfig.id,
        aspect_id: a.id,
        weight: 0,
      }))
      await supabase.from('aspect_weights').insert(inserts)
    }

    const { data: indicators } = await supabase.from('indicators').select('id')
    if (indicators && indicators.length > 0) {
      const inserts = indicators.map((ind) => ({
        weight_configuration_id: newConfig.id,
        indicator_id: ind.id,
        weight: 0,
      }))
      await supabase.from('indicator_weights').insert(inserts)
    }
  }

  return { success: true, data: newConfig }
}

/**
 * Update aspect and indicator weights.
 */
export async function updateWeights(
  configId: string,
  aspectWeights: { aspectId: string; weight: number }[],
  indicatorWeights: { indicatorId: string; weight: number }[]
): Promise<ActionResponse> {
  const guard = await checkSuperAdmin()
  if (guard) return guard

  const supabase = await createClient()

  // 1. Bulk Upsert aspect weights
  if (aspectWeights.length > 0) {
    const awUpserts = aspectWeights.map((aw) => ({
      weight_configuration_id: configId,
      aspect_id: aw.aspectId,
      weight: aw.weight,
    }))

    const { error: awError } = await supabase
      .from('aspect_weights')
      .upsert(awUpserts, { onConflict: 'weight_configuration_id,aspect_id' })

    if (awError) {
      console.error('Error updating aspect weights:', awError)
      return { success: false, error: awError.message }
    }
  }

  // 2. Bulk Upsert indicator weights
  if (indicatorWeights.length > 0) {
    const iwUpserts = indicatorWeights.map((iw) => ({
      weight_configuration_id: configId,
      indicator_id: iw.indicatorId,
      weight: iw.weight,
    }))

    const { error: iwError } = await supabase
      .from('indicator_weights')
      .upsert(iwUpserts, { onConflict: 'weight_configuration_id,indicator_id' })

    if (iwError) {
      console.error('Error updating indicator weights:', iwError)
      return { success: false, error: iwError.message }
    }
  }

  return { success: true, data: null }
}

/**
 * Set a configuration as active.
 */
export async function setActiveWeightConfiguration(configId: string): Promise<ActionResponse> {
  const guard = await checkSuperAdmin()
  if (guard) return guard

  const supabase = await createClient()

  // ── Pre-flight validation ───────────────────────────────────────────────
  // 1. Check aspect weights sum to 100
  const { data: aw, error: awFetchErr } = await supabase
    .from('aspect_weights')
    .select('aspect_id, weight')
    .eq('weight_configuration_id', configId)

  if (awFetchErr) return { success: false, error: awFetchErr.message }

  const totalAspect = (aw || []).reduce((s, r) => s + parseFloat(r.weight), 0)
  if (Math.round(totalAspect) !== 100) {
    return {
      success: false,
      error: `Total bobot aspek harus 100% (saat ini ${totalAspect}%).`,
    }
  }

  // 2. For each aspect check that its indicator weights sum to 100
  const { data: aspects } = await supabase.from('aspects').select('id, name, order_number')
  const { data: iw } = await supabase
    .from('indicator_weights')
    .select('indicator_id, weight')
    .eq('weight_configuration_id', configId)

  const { data: indicators } = await supabase
    .from('indicators')
    .select('id, aspect_id')

  const invalidAspects: string[] = []
  for (const aspect of aspects || []) {
    const aspIndIds = new Set(
      (indicators || []).filter((i) => i.aspect_id === aspect.id).map((i) => i.id)
    )
    const total = (iw || [])
      .filter((w) => aspIndIds.has(w.indicator_id))
      .reduce((s, w) => s + parseFloat(w.weight), 0)
    if (Math.round(total) !== 100) {
      invalidAspects.push(`Aspek ${aspect.order_number} (${aspect.name}): ${total}%`)
    }
  }

  if (invalidAspects.length > 0) {
    return {
      success: false,
      error: `Total bobot indikator harus 100% untuk setiap aspek. Belum valid: ${invalidAspects.join('; ')}.`,
    }
  }
  // ── End validation ───────────────────────────────────────────────────────

  // Set all to false first to avoid breaking unique index
  const { error: resetError } = await supabase
    .from('weight_configurations')
    .update({ is_active: false })
    .neq('id', configId) // reset all others

  if (resetError) {
    console.error('Error resetting active configurations:', resetError)
    return { success: false, error: resetError.message }
  }

  // Set selected config to active
  const { error: activeError } = await supabase
    .from('weight_configurations')
    .update({ is_active: true })
    .eq('id', configId)

  if (activeError) {
    console.error('Error setting configuration active:', activeError)
    return { success: false, error: activeError.message }
  }

  return { success: true, data: null }
}
