import { NextResponse } from 'next/server'
import { listFoldersInFolder } from '@/lib/google-drive'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'

export async function POST() {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured in .env.local' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1a. Role guard — hanya superadmin
    const authError = await requireSuperAdminApi()
    if (authError) return authError

    // 1. Fetch Level 1 folders (Categories)
    const level1Folders = await listFoldersInFolder(rootFolderId)
    
    // We will collect all institution folders here
    const allInstitutionsToSync: Array<{
      name: string
      category: string
      drive_folder_id: string
      last_synced_at: string
    }> = []

    // 2. Fetch Level 2 folders (Institutions) under each Category folder
    for (const catFolder of level1Folders) {
      if (!catFolder.id || !catFolder.name) continue

      // Strip prefix digit + dot (e.g. "1. KECAMATAN" -> "KECAMATAN")
      const cleanedCategory = catFolder.name.replace(/^\d+\.\s*/, '').trim()
      
      const level2Folders = await listFoldersInFolder(catFolder.id)
      
      for (const instFolder of level2Folders) {
        if (!instFolder.id || !instFolder.name) continue

        allInstitutionsToSync.push({
          name: instFolder.name,
          category: cleanedCategory,
          drive_folder_id: instFolder.id,
          last_synced_at: new Date().toISOString(),
        })
      }
    }

    if (allInstitutionsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { newAdded: 0, updatedExisting: 0, totalSynced: 0 },
        message: 'No institution folders found to sync.',
      })
    }

    // 3. Query existing institution drive_folder_ids to determine new vs existing
    const { data: existingInstitutions, error: fetchError } = await supabase
      .from('institutions')
      .select('drive_folder_id')

    if (fetchError) {
      throw new Error(`Failed to fetch existing institutions: ${fetchError.message}`)
    }

    const existingFolderIds = new Set(
      existingInstitutions?.map((inst) => inst.drive_folder_id) || []
    )

    let newAdded = 0
    let updatedExisting = 0

    // Determine counts beforehand based on drive_folder_id existence
    for (const item of allInstitutionsToSync) {
      if (existingFolderIds.has(item.drive_folder_id)) {
        updatedExisting++
      } else {
        newAdded++
      }
    }

    // 4. Batch upsert (chunk size = 20)
    const chunkSize = 20
    for (let i = 0; i < allInstitutionsToSync.length; i += chunkSize) {
      const batch = allInstitutionsToSync.slice(i, i + chunkSize)
      
      const { error: upsertError } = await supabase
        .from('institutions')
        .upsert(batch, { onConflict: 'drive_folder_id' })

      if (upsertError) {
        throw new Error(`Failed to upsert batch starting at index ${i}: ${upsertError.message}`)
      }
    }

    // Fetch the updated list to return in response
    const { data: updatedList } = await supabase
      .from('institutions')
      .select('id, name, category, drive_folder_id, last_synced_at')
      .order('category')
      .order('name')

    return NextResponse.json({
      success: true,
      summary: {
        newAdded,
        updatedExisting,
        totalSynced: allInstitutionsToSync.length,
      },
      institutions: updatedList || [],
    })
  } catch (error: any) {
    console.error('Error syncing institutions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync institutions from Google Drive',
      },
      { status: 500 }
    )
  }
}
