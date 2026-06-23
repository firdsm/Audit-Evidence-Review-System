'use server'

import { listFoldersInFolder } from '@/lib/google-drive'
import { createClient } from '@/lib/supabase/server'

/**
 * Fetch indicator subfolders inside a selected aspect folder of an institution, sorted alphabetically
 */
export async function getDriveSubfoldersAction(institutionFolderId: string, aspectOrderNumber: number) {
  try {
    if (!institutionFolderId) {
      return { success: false, error: 'Folder ID instansi belum ditentukan' }
    }

    if (!aspectOrderNumber) {
      return { success: false, error: 'Aspek belum dipilih' }
    }

    const supabase = await createClient()

    // 1. Get aspect ID by order_number
    const { data: aspect, error: aspError } = await supabase
      .from('aspects')
      .select('id')
      .eq('order_number', aspectOrderNumber)
      .single()

    if (aspError || !aspect) {
      return { success: false, error: `Aspek dengan urutan ${aspectOrderNumber} tidak terdaftar` }
    }

    // 2. Count indicators belonging to this aspect
    const { count: expectedIndicatorCount, error: countError } = await supabase
      .from('indicators')
      .select('id', { count: 'exact', head: true })
      .eq('aspect_id', aspect.id)

    if (countError) {
      throw new Error(`Gagal menghitung indikator aspek: ${countError.message}`)
    }

    const isSingleIndicator = expectedIndicatorCount === 1

    // 3. Fetch aspect folders under the institution folder
    const folders = await listFoldersInFolder(institutionFolderId)
    
    // Sort alphabetically by name
    const sortedAspectFolders = folders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    // 4. Find aspect folder (prefix match first, fallback to index)
    let matchedAspectFolder = sortedAspectFolders.find(f => {
      const m = (f.name || '').match(/^(\d+)/)
      return m ? parseInt(m[1], 10) === aspectOrderNumber : false
    })

    if (!matchedAspectFolder && aspectOrderNumber - 1 < sortedAspectFolders.length) {
      matchedAspectFolder = sortedAspectFolders[aspectOrderNumber - 1]
    }

    if (!matchedAspectFolder) {
      return { success: false, error: `Folder aspek ke-${aspectOrderNumber} tidak ditemukan di Google Drive.` }
    }

    // If aspect only has 1 indicator, we skip subfolder level and return early
    if (isSingleIndicator) {
      return {
        success: true,
        folders: [],
        isSingleIndicator: true,
        aspectFolderName: matchedAspectFolder.name,
      }
    }

    // 5. Fetch subfolders under this aspect folder (indicator level folders)
    const indicatorFolders = await listFoldersInFolder(matchedAspectFolder.id!)
    const sortedIndicatorFolders = indicatorFolders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    return {
      success: true,
      folders: sortedIndicatorFolders.map((f) => ({
        id: f.id || '',
        name: f.name || '',
      })),
      isSingleIndicator: false,
      aspectFolderName: matchedAspectFolder.name,
    }
  } catch (error: any) {
    console.error('Error fetching subfolders:', error)
    return { success: false, error: error.message || 'Gagal membaca folder Google Drive' }
  }
}

/**
 * Save folder mapping configuration to Supabase scoped to a specific aspect
 */
export async function saveFolderMappingsAction(
  mappings: Array<{ folder_position: number; indicator_id: string }>,
  aspectId: string
) {
  try {
    const supabase = await createClient()

    // 1. Verify user session
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Sesi habis, silakan login kembali' }
    }

    if (!aspectId) {
      return { success: false, error: 'ID Aspek tidak valid' }
    }

    // 2. Fetch all indicators for this aspect
    const { data: indicators, error: indError } = await supabase
      .from('indicators')
      .select('id')
      .eq('aspect_id', aspectId)

    if (indError) {
      throw new Error(`Gagal memuat daftar indikator aspek: ${indError.message}`)
    }

    const indicatorIds = (indicators || []).map((ind) => ind.id)

    // 3. Clear existing mappings only for this aspect's indicators to preserve other aspects
    if (indicatorIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('indicator_folder_mapping')
        .delete()
        .in('indicator_id', indicatorIds)

      if (deleteError) {
        throw new Error(`Gagal membersihkan pemetaan lama: ${deleteError.message}`)
      }
    }

    // 4. Insert new mappings if list is not empty
    if (mappings.length > 0) {
      const { error: insertError } = await supabase
        .from('indicator_folder_mapping')
        .insert(mappings)

      if (insertError) {
        throw new Error(`Gagal menyimpan pemetaan baru: ${insertError.message}`)
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving folder mappings:', error)
    return { success: false, error: error.message || 'Gagal menyimpan konfigurasi pemetaan' }
  }
}
