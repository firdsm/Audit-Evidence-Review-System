import { NextResponse } from 'next/server'
import { listFoldersInFolder } from '@/lib/google-drive'

export async function GET() {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    
    if (!rootFolderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured in .env.local' },
        { status: 400 }
      )
    }

    const folders = await listFoldersInFolder(rootFolderId)
    
    return NextResponse.json({
      success: true,
      rootFolderId,
      folders,
    })
  } catch (error: any) {
    console.error('Error fetching Google Drive folders:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list folders from Google Drive',
      },
      { status: 500 }
    )
  }
}
