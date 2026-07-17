import React from 'react'
import { requireSuperAdmin } from '@/lib/auth'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AnnouncementsAdminPage() {
  await requireSuperAdmin()
  return <AnnouncementsClient />
}
