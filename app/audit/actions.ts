'use server'

import { listFoldersInFolder, listFilesInFolder } from '@/lib/google-drive'
import { createClient } from '@/lib/supabase/server'

/**
 * Action to fetch evidence files for a given institution and indicator code using positional mapping
 */
interface FlatFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  subfolderName?: string
}

import { DriveNotFoundError } from '@/lib/drive-errors'
import { matchAspectFolder } from '@/lib/drive-utils'

/**
 * Recursive helper to collect files from all subfolders up to maxFoldersToScan limit (safety limit)
 */
async function collectFilesRecursive(
  folderId: string,
  scanState: { count: number; limitReached: boolean },
  maxFoldersToScan: number = 3,
  currentPath: string = '',
  throwsOnError: boolean = false
): Promise<FlatFile[]> {
  if (scanState.count >= maxFoldersToScan) {
    scanState.limitReached = true
    return []
  }

  // Count this folder as scanned
  scanState.count++

  try {
    // Run listFilesInFolder and listFoldersInFolder in parallel
    const [rawFiles, subfolders] = await Promise.all([
      listFilesInFolder(folderId),
      listFoldersInFolder(folderId)
    ])

    const files: FlatFile[] = rawFiles.map((f) => ({
      id: f.id || '',
      name: f.name || 'Unnamed File',
      mimeType: f.mimeType || '',
      webViewLink: f.webViewLink || '',
      subfolderName: currentPath || undefined,
    }))

    const sortedSubfolders = subfolders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    if (sortedSubfolders.length === 0) {
      return files
    }

    // Start all subfolder scans in parallel.
    // Since collectFilesRecursive checks and increments scanState.count synchronously at the start of each call,
    // the count limit is respected correctly across all parallel branches.
    const childScanPromises = sortedSubfolders.map((sub) => {
      const childPath = currentPath ? `${currentPath} > ${sub.name}` : sub.name || ''
      return collectFilesRecursive(sub.id!, scanState, maxFoldersToScan, childPath, false)
    })

    const childFilesArray = await Promise.all(childScanPromises)
    for (const childFiles of childFilesArray) {
      files.push(...childFiles)
    }

    return files
  } catch (error: any) {
    const isNotFoundError = error?.status === 404 || error?.code === 404 || 
                            error?.status === 403 || error?.code === 403 ||
                            error?.message?.toLowerCase().includes('not found') ||
                            error?.message?.toLowerCase().includes('access');

    if (throwsOnError && isNotFoundError) {
      throw new DriveNotFoundError(`Folder with ID ${folderId} is not accessible or not found`)
    }

    console.error(`Error in collectFilesRecursive for folder ${folderId}:`, error)
    return []
  }
}

interface CacheEntry {
  data: any
  timestamp: number
}

const evidenceCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function invalidateEvidenceCacheAction(
  institutionFolderId: string,
  indicatorCode: string
) {
  const cacheKey = `${institutionFolderId}:${indicatorCode}`
  evidenceCache.delete(cacheKey)
  console.log(`[Evidence Cache Invalidation] Cleared key: ${cacheKey}`)
  return { success: true }
}

export async function getEvidenceFilesAction(
  institutionFolderId: string,
  indicatorCode: string,
  forceRefresh?: boolean
) {
  const startTime = performance.now()
  const cacheKey = `${institutionFolderId}:${indicatorCode}`

  try {
    if (!institutionFolderId) {
      return { success: false, error: 'Folder ID instansi belum ditentukan' }
    }

    // ==========================================
    // LAYER 1: In-Memory Cache
    // ==========================================
    if (!forceRefresh) {
      const cached = evidenceCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const elapsed = performance.now() - startTime
        console.log(`[Evidence Cache HIT] Key: ${cacheKey} in ${elapsed.toFixed(2)}ms`)
        return cached.data
      }
    }

    const supabase = await createClient()

    // Parallelize metadata fetching (Institution ID & Indicator details)
    const [instResult, indResult] = await Promise.all([
      supabase
        .from('institutions')
        .select('id')
        .eq('drive_folder_id', institutionFolderId)
        .maybeSingle(),
      supabase
        .from('indicators')
        .select(`
          id,
          aspect_id,
          aspects (
            order_number,
            name
          )
        `)
        .eq('code', indicatorCode)
        .maybeSingle()
    ])

    if (instResult.error) {
      throw new Error(`Gagal memuat data instansi: ${instResult.error.message}`)
    }
    if (indResult.error || !indResult.data) {
      return { success: false, error: `Indikator ${indicatorCode} tidak terdaftar` }
    }

    const institution = instResult.data
    const indicator = indResult.data
    const aspect = indicator.aspects as any
    const aspectOrderNumber = aspect?.order_number
    const aspectName = aspect?.name

    // ==========================================
    // LAYER 2: Database Folder ID Lookup
    // ==========================================
    if (institution && indicator) {
      const { data: dbFolder, error: dbFolderError } = await supabase
        .from('institution_indicator_folders')
        .select('drive_folder_id')
        .eq('institution_id', institution.id)
        .eq('indicator_id', indicator.id)
        .maybeSingle()

      if (!dbFolderError && dbFolder?.drive_folder_id) {
        try {
          const scanState = { count: 0, limitReached: false }
          // Scan directly using throwsOnError = true
          const files = await collectFilesRecursive(dbFolder.drive_folder_id, scanState, 10, '', true)

          const response = {
            success: true,
            files,
            folderName: 'Google Drive Folder', // General name since we bypassed list query
            folderExists: true,
            scanLimitReached: scanState.limitReached,
            driveFolderId: dbFolder.drive_folder_id,
            debug: {
              institutionFolderId,
              aspectOrderNumber,
              aspectName,
              expectedIndicatorCount: 0,
              isSingleIndicator: false,
              matchedAspectFolderName: null,
              matchedAspectFolderId: null,
              allAspectFolders: [],
              allIndicatorFolders: [],
              indicatorCode,
              mappedFolderPosition: null,
              mappedIndex: null,
              matchedFolderName: 'Direct Cache/DB Folder',
              matchedFolderId: dbFolder.drive_folder_id,
              folderSource: 'dbFolder (direct)',
              scannedFoldersCount: scanState.count,
              scanLimitReached: scanState.limitReached,
              recursionFilesFound: files.length,
            }
          }
          evidenceCache.set(cacheKey, { data: response, timestamp: Date.now() })
          const elapsed = performance.now() - startTime
          console.log(`[Evidence DB HIT] Key: ${cacheKey} fetched directly in ${elapsed.toFixed(2)}ms`)
          return response
        } catch (error) {
          if (error instanceof DriveNotFoundError) {
            console.warn(`[Stale Folder ID] institution_id: ${institution.id}, indicator_id: ${indicator.id}, folder_id: ${dbFolder.drive_folder_id} — falling back to traversal`)
            
            // Delete the stale database record
            await supabase
              .from('institution_indicator_folders')
              .delete()
              .eq('institution_id', institution.id)
              .eq('indicator_id', indicator.id)

            // Let it fall through to LAYER 3
          } else {
            throw error
          }
        }
      }
    }

    // ==========================================
    // LAYER 3: Traversal Penuh (Fallback / Logika Lama)
    // ==========================================
    console.log(`[Evidence DB MISS / Fallback] Key: ${cacheKey} — Performing full folder traversal`)

    // 2. Fetch all subfolders from the active institution's folder (level aspect folders)
    const aspectFolders = await listFoldersInFolder(institutionFolderId)

    // Sort alphabetically by name
    const sortedAspectFolders = aspectFolders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    // 3. Find the aspect folder: match by prefix number first, fallback to alphabetical order index
    const matchedAspectFolder = matchAspectFolder(sortedAspectFolders, aspectOrderNumber)

    // 4. Fetch indicators count for this aspect to check if it's a single-indicator aspect
    const { count: expectedIndicatorCount, error: countError } = await supabase
      .from('indicators')
      .select('id', { count: 'exact', head: true })
      .eq('aspect_id', indicator.aspect_id)

    if (countError) {
      throw new Error(`Gagal menghitung jumlah indikator aspek: ${countError.message}`)
    }

    const isSingleIndicator = expectedIndicatorCount === 1

    // 5. Fetch mapping ONLY if aspect has more than 1 indicator
    let mapping = null
    if (!isSingleIndicator) {
      const { data: mapData, error: mapError } = await supabase
        .from('indicator_folder_mapping')
        .select('folder_position')
        .eq('indicator_id', indicator.id)
        .maybeSingle()

      if (mapError) {
        throw new Error(`Gagal memuat mapping: ${mapError.message}`)
      }
      mapping = mapData
    }

    // Prepare debug metadata object
    const debug = {
      institutionFolderId,
      aspectOrderNumber,
      aspectName,
      expectedIndicatorCount,
      isSingleIndicator,
      matchedAspectFolderName: matchedAspectFolder?.name || null,
      matchedAspectFolderId: matchedAspectFolder?.id || null,
      allAspectFolders: sortedAspectFolders.map((f, i) => ({
        index: i + 1,
        name: f.name || 'Unnamed',
        id: f.id || '',
      })),
      allIndicatorFolders: [] as any[],
      indicatorCode,
      mappedFolderPosition: mapping ? mapping.folder_position : null,
      mappedIndex: mapping ? mapping.folder_position - 1 : null,
      matchedFolderName: null as string | null,
      matchedFolderId: null as string | null,
      folderSource: isSingleIndicator ? 'aspectFolder (direct)' : 'indicatorFolder',
      scannedFoldersCount: 0,
      scanLimitReached: false,
      recursionFilesFound: 0,
    }

    if (!matchedAspectFolder) {
      const response = {
        success: true,
        files: [],
        folderExists: false,
        message: `Folder untuk aspek "${aspectName}" belum tersedia di Google Drive.`,
        debug,
      }
      evidenceCache.set(cacheKey, { data: response, timestamp: Date.now() })
      const elapsed = performance.now() - startTime
      console.log(`[Evidence Cache MISS] Key: ${cacheKey} (Folder not found) fetched in ${elapsed.toFixed(2)}ms`)
      return response
    }

    // Case A: Aspect only has 1 indicator -> Use Aspect Folder directly!
    if (isSingleIndicator) {
      debug.matchedFolderName = matchedAspectFolder.name || null
      debug.matchedFolderId = matchedAspectFolder.id || null

      // Save resolved folder ID to database asynchronously
      if (institution && indicator && matchedAspectFolder.id) {
        supabase
          .from('institution_indicator_folders')
          .upsert({
            institution_id: institution.id,
            indicator_id: indicator.id,
            drive_folder_id: matchedAspectFolder.id,
            last_resolved_at: new Date().toISOString()
          }, { onConflict: 'institution_id,indicator_id' })
          .then(({ error: upsertError }) => {
            if (upsertError) console.error('[Folder ID Auto-save Error]:', upsertError)
          })
      }

      const scanState = { count: 0, limitReached: false }
      const files = await collectFilesRecursive(matchedAspectFolder.id!, scanState, 10)

      debug.scannedFoldersCount = scanState.count
      debug.scanLimitReached = scanState.limitReached
      debug.recursionFilesFound = files.length

      const response = {
        success: true,
        files,
        folderName: matchedAspectFolder.name,
        folderExists: true,
        scanLimitReached: scanState.limitReached,
        driveFolderId: matchedAspectFolder.id || undefined,
        debug,
      }
      evidenceCache.set(cacheKey, { data: response, timestamp: Date.now() })
      const elapsed = performance.now() - startTime
      console.log(`[Evidence Cache MISS] Key: ${cacheKey} (Single Indicator Aspect) fetched in ${elapsed.toFixed(2)}ms`)
      return response
    }

    // Case B: Aspect has multiple indicators -> Find the specific subfolder at the mapped position index
    const indicatorFolders = await listFoldersInFolder(matchedAspectFolder.id!)
    const sortedIndicatorFolders = indicatorFolders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    debug.allIndicatorFolders = sortedIndicatorFolders.map((f, i) => ({
      index: i + 1,
      name: f.name || 'Unnamed',
      id: f.id || '',
    }))

    if (!mapping) {
      const response = {
        success: true,
        files: [],
        folderExists: false,
        message: `Indikator ${indicatorCode} belum dipetakan ke posisi folder mana pun. Silakan hubungi admin untuk melakukan setup mapping.`,
        debug,
      }
      evidenceCache.set(cacheKey, { data: response, timestamp: Date.now() })
      const elapsed = performance.now() - startTime
      console.log(`[Evidence Cache MISS] Key: ${cacheKey} (No mapping) fetched in ${elapsed.toFixed(2)}ms`)
      return response
    }

    const index = mapping.folder_position - 1

    if (index >= 0 && index < sortedIndicatorFolders.length) {
      const matchedFolder = sortedIndicatorFolders[index]
      if (matchedFolder.id) {
        debug.matchedFolderName = matchedFolder.name || null
        debug.matchedFolderId = matchedFolder.id || null

        // Save resolved folder ID to database asynchronously
        if (institution && indicator && matchedFolder.id) {
          supabase
            .from('institution_indicator_folders')
            .upsert({
              institution_id: institution.id,
              indicator_id: indicator.id,
              drive_folder_id: matchedFolder.id,
              last_resolved_at: new Date().toISOString()
            }, { onConflict: 'institution_id,indicator_id' })
            .then(({ error: upsertError }) => {
              if (upsertError) console.error('[Folder ID Auto-save Error]:', upsertError)
            })
        }

        const scanState = { count: 0, limitReached: false }
        const files = await collectFilesRecursive(matchedFolder.id, scanState, 10)

        debug.scannedFoldersCount = scanState.count
        debug.scanLimitReached = scanState.limitReached
        debug.recursionFilesFound = files.length

        const response = {
          success: true,
          files,
          folderName: matchedFolder.name,
          folderExists: true,
          scanLimitReached: scanState.limitReached,
          driveFolderId: matchedFolder.id || undefined,
          debug,
        }
        evidenceCache.set(cacheKey, { data: response, timestamp: Date.now() })
        const elapsed = performance.now() - startTime
        console.log(`[Evidence Cache MISS] Key: ${cacheKey} (Mapped position) fetched in ${elapsed.toFixed(2)}ms`)
        return response
      }
    }

    const response = {
      success: true,
      files: [],
      folderExists: false,
      message: 'Folder evidence untuk indikator ini belum tersedia di Google Drive',
      debug,
    }
    evidenceCache.set(cacheKey, { data: response, timestamp: Date.now() })
    const elapsed = performance.now() - startTime
    console.log(`[Evidence Cache MISS] Key: ${cacheKey} (Folder missing) fetched in ${elapsed.toFixed(2)}ms`)
    return response
  } catch (error: any) {
    const elapsed = performance.now() - startTime
    console.error(`[Evidence Error] Key: ${cacheKey} in ${elapsed.toFixed(2)}ms:`, error)
    return { success: false, error: error.message || 'Gagal mengambil dokumen bukti' }
  }
}

/**
 * Action to save/upsert an audit assessment
 */
export async function saveAssessmentAction(data: {
  institutionId: string
  indicatorId: string
  score: number | null
  findingStatus: 'tidak_ada_temuan' | 'perlu_perbaikan' | 'bukti_tidak_tersedia'
  notes: string
}) {
  try {
    const supabase = await createClient()

    // 1. Verify user session
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Sesi habis, silakan login kembali' }
    }

    // 2. Fetch auditor record matching logged in user's email
    const { data: auditor, error: auditorError } = await supabase
      .from('auditors')
      .select('id')
      .eq('email', user.email)
      .single()

    if (auditorError || !auditor) {
      return { success: false, error: 'Data auditor Anda tidak terdaftar di database' }
    }

    // 3. Check if the active indicator belongs to "Sistem Antrian" aspect
    const { data: indicator, error: indError } = await supabase
      .from('indicators')
      .select(`
        aspects (
          name
        )
      `)
      .eq('id', data.indicatorId)
      .single()

    if (indError || !indicator) {
      return { success: false, error: 'Indikator tidak valid atau tidak terdaftar' }
    }

    const aspectName = (indicator.aspects as any)?.name || ''
    const isSistemAntrian = aspectName.toLowerCase() === 'sistem antrian'
    
    // Force score to null for Sistem Antrian
    const finalScore = isSistemAntrian ? null : data.score

    // 4. Upsert assessment record
    const { error: upsertError } = await supabase
      .from('assessments')
      .upsert(
        {
          institution_id: data.institutionId,
          indicator_id: data.indicatorId,
          auditor_id: auditor.id,
          score: finalScore,
          finding_status: data.findingStatus,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'institution_id,indicator_id' }
      )

    if (upsertError) {
      throw new Error(upsertError.message)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving assessment:', error)
    return { success: false, error: error.message || 'Gagal menyimpan penilaian' }
  }
}
