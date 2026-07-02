import { NextResponse } from 'next/server'
import { listFoldersInFolder } from '@/lib/google-drive'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'
import { matchAspectFolder } from '@/lib/drive-utils'

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

    // Resolve and cache folder IDs for institutions in batches of 5
    if (updatedList && updatedList.length > 0) {
      console.log(`[Sync Resolve] Starting folder resolution for ${updatedList.length} institutions...`)
      const resolveBatchSize = 5
      for (let i = 0; i < updatedList.length; i += resolveBatchSize) {
        const batch = updatedList.slice(i, i + resolveBatchSize)
        await Promise.all(
          batch.map((inst) => resolveInstitutionFolders(supabase, inst))
        )
      }
      console.log(`[Sync Resolve] Completed folder resolution.`)
    }

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

async function resolveInstitutionFolders(
  supabase: any,
  institution: { id: string; name: string; drive_folder_id: string | null }
) {
  try {
    if (!institution.drive_folder_id) return

    // a. Fetch all indicators and their aspect details & mapping
    const { data: indicators, error: indError } = await supabase
      .from('indicators')
      .select(`
        id,
        aspect_id,
        code,
        aspects (
          id,
          order_number,
          name
        ),
        indicator_folder_mapping (
          folder_position
        )
      `)

    if (indError || !indicators) {
      console.error(`[Sync Resolve] Error fetching indicators:`, indError)
      return
    }

    // Count indicators per aspect locally
    const indicatorsByAspect: Record<string, typeof indicators> = {}
    for (const ind of indicators) {
      const aspectId = ind.aspect_id
      if (!indicatorsByAspect[aspectId]) {
        indicatorsByAspect[aspectId] = []
      }
      indicatorsByAspect[aspectId].push(ind)
    }

    // b. Fetch aspect folders from Drive
    const aspectFolders = await listFoldersInFolder(institution.drive_folder_id)
    const sortedAspectFolders = aspectFolders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const upsertPayloads: Array<{
      institution_id: string
      indicator_id: string
      drive_folder_id: string
      last_resolved_at: string
    }> = []

    // Resolve aspects in parallel
    const aspectIds = Object.keys(indicatorsByAspect)
    await Promise.all(
      aspectIds.map(async (aspectId) => {
        const aspectIndicators = indicatorsByAspect[aspectId]
        if (aspectIndicators.length === 0) return

        const aspectObj = aspectIndicators[0].aspects as any
        if (!aspectObj) return
        const aspectOrderNumber = aspectObj.order_number

        // c. Match aspect folder
        const matchedAspect = matchAspectFolder(sortedAspectFolders, aspectOrderNumber)
        if (!matchedAspect) {
          console.warn(`[Sync Resolve] Aspect folder not found for aspect: ${aspectObj.name} in institution: ${institution.name}`)
          return
        }

        const isSingleIndicator = aspectIndicators.length === 1

        if (isSingleIndicator) {
          // d. Sistem Antrian - single indicator aspect maps directly to aspect folder
          const indicator = aspectIndicators[0]
          upsertPayloads.push({
            institution_id: institution.id,
            indicator_id: indicator.id,
            drive_folder_id: matchedAspect.id,
            last_resolved_at: new Date().toISOString()
          })
        } else {
          // e. Fetch indicator folders
          try {
            const indicatorFolders = await listFoldersInFolder(matchedAspect.id)
            const sortedIndicatorFolders = indicatorFolders
              .filter((f) => f.id && f.name)
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

            for (const indicator of aspectIndicators) {
              const mapping = indicator.indicator_folder_mapping as any
              const folderPosition = mapping?.folder_position

              if (folderPosition === undefined || folderPosition === null) {
                // Skip if not mapped yet
                continue
              }

              const index = folderPosition - 1
              if (index >= 0 && index < sortedIndicatorFolders.length) {
                const matchedFolder = sortedIndicatorFolders[index]
                if (matchedFolder.id) {
                  upsertPayloads.push({
                    institution_id: institution.id,
                    indicator_id: indicator.id,
                    drive_folder_id: matchedFolder.id,
                    last_resolved_at: new Date().toISOString()
                  })
                }
              }
            }
          } catch (err: any) {
            console.error(`[Sync Resolve] Error fetching indicator folders for aspect ${aspectObj.name} of ${institution.name}:`, err.message)
          }
        }
      })
    )

    // f. Upsert resolved folder IDs
    if (upsertPayloads.length > 0) {
      const { error: upsertError } = await supabase
        .from('institution_indicator_folders')
        .upsert(upsertPayloads, { onConflict: 'institution_id,indicator_id' })

      if (upsertError) {
        console.error(`[Sync Resolve] Error upserting indicator folders for ${institution.name}:`, upsertError.message)
      } else {
        console.log(`[Sync Resolve] Successfully resolved ${upsertPayloads.length} indicator folders for ${institution.name}`)
      }
    }
  } catch (err: any) {
    console.error(`[Sync Resolve] Failed to resolve folders for ${institution.name}:`, err.message)
  }
}
