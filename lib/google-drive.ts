import { google } from 'googleapis'

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !privateKey) {
    throw new Error('Google Service Account credentials are not defined in environment variables')
  }

  // Handle escaped newlines in private key
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n')

  const auth = new google.auth.JWT({
    email,
    key: formattedPrivateKey,
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
