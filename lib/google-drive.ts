import { google } from 'googleapis'

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64

  console.log('[DEBUG Google Auth] email exists:', !!email)
  console.log('[DEBUG Google Auth] raw private key exists:', !!privateKey)
  console.log('[DEBUG Google Auth] base64 private key exists:', !!base64Key)

  let finalKey = ''

  if (base64Key) {
    try {
      const decoded = Buffer.from(base64Key, 'base64').toString('utf8')
      console.log('[DEBUG Google Auth] Decoded base64 key length:', decoded.length)
      console.log('[DEBUG Google Auth] Decoded key starts with header:', decoded.trim().startsWith('-----BEGIN PRIVATE KEY-----'))
      console.log('[DEBUG Google Auth] Decoded key ends with footer:', decoded.trim().endsWith('-----END PRIVATE KEY-----'))
      
      const first5 = decoded.substring(0, 5)
      const last5 = decoded.substring(decoded.length - 5)
      console.log('[DEBUG Google Auth] First 5 chars hex:', Buffer.from(first5).toString('hex'))
      console.log('[DEBUG Google Auth] Last 5 chars hex:', Buffer.from(last5).toString('hex'))
      
      finalKey = decoded
    } catch (e: any) {
      console.error('[DEBUG Google Auth] Failed to decode base64 key:', e.message)
    }
  } else if (privateKey) {
    console.log('[DEBUG Google Auth] Raw private key length:', privateKey.length)
    console.log('[DEBUG Google Auth] Raw key starts with header:', privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'))
    console.log('[DEBUG Google Auth] Raw key ends with footer:', privateKey.trim().endsWith('-----END PRIVATE KEY-----'))
    
    const formatted = privateKey.replace(/\\n/g, '\n')
    console.log('[DEBUG Google Auth] Formatted private key length:', formatted.length)
    console.log('[DEBUG Google Auth] Formatted key starts with header:', formatted.trim().startsWith('-----BEGIN PRIVATE KEY-----'))
    console.log('[DEBUG Google Auth] Formatted key ends with footer:', formatted.trim().endsWith('-----END PRIVATE KEY-----'))

    finalKey = formatted
  }

  if (!email || !finalKey) {
    throw new Error('Google Service Account credentials are not defined in environment variables')
  }

  const auth = new google.auth.JWT({
    email,
    key: finalKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  return google.drive({ version: 'v3', auth })
}

/**
 * Returns a list of subfolders (id and name) inside the given folderId
 */
export async function listFoldersInFolder(folderId: string) {
  const drive = getDriveClient()
  
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    orderBy: 'name',
    pageSize: 1000,
  })

  return response.data.files || []
}

/**
 * Returns a list of files (id, name, mimeType, webViewLink) inside the given folderId
 */
export async function listFilesInFolder(folderId: string) {
  const drive = getDriveClient()

  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    orderBy: 'name',
    pageSize: 1000,
  })

  return response.data.files || []
}
