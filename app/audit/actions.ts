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

/**
 * Recursive helper to collect files from all subfolders up to maxFoldersToScan limit (safety limit)
 */
async function collectFilesRecursive(
  folderId: string,
  scanState: { count: number; limitReached: boolean },
  maxFoldersToScan: number = 3,
  currentPath: string = ''
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
      return collectFilesRecursive(sub.id!, scanState, maxFoldersToScan, childPath)
    })

    const childFilesArray = await Promise.all(childScanPromises)
    for (const childFiles of childFilesArray) {
      files.push(...childFiles)
    }

    return files
  } catch (error) {
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

    // 0. Cache lookup
    if (!forceRefresh) {
      const cached = evidenceCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const elapsed = performance.now() - startTime
        console.log(`[Evidence Cache HIT] Key: ${cacheKey} in ${elapsed.toFixed(2)}ms`)
        return cached.data
      }
    }

    const supabase = await createClient()

    // 1. Fetch active indicator and its aspect info
    const { data: indicator, error: indError } = await supabase
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
      .single()

    if (indError || !indicator) {
      return { success: false, error: `Indikator ${indicatorCode} tidak terdaftar` }
    }

    const aspect = indicator.aspects as any
    const aspectOrderNumber = aspect?.order_number
    const aspectName = aspect?.name

    // 2. Fetch all subfolders from the active institution's folder (level aspect folders)
    const aspectFolders = await listFoldersInFolder(institutionFolderId)

    // Sort alphabetically by name
    const sortedAspectFolders = aspectFolders
      .filter((f) => f.id && f.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    // 3. Find the aspect folder: match by prefix number first, fallback to alphabetical order index
    let matchedAspectFolder = sortedAspectFolders.find(f => {
      const m = (f.name || '').match(/^(\d+)/)
      return m ? parseInt(m[1], 10) === aspectOrderNumber : false
    })

    if (!matchedAspectFolder && aspectOrderNumber - 1 < sortedAspectFolders.length) {
      matchedAspectFolder = sortedAspectFolders[aspectOrderNumber - 1]
    }

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
