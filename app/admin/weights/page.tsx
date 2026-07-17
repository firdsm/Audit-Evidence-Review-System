import React from 'react'
import { requireSuperAdmin } from '@/lib/auth'
import WeightsClient from './WeightsClient'

export default async function AdminWeightsPage() {
  // Guard access: superadmin only
  await requireSuperAdmin()

  return <WeightsClient />
}
