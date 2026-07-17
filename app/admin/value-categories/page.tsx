import React from 'react'
import { requireSuperAdmin } from '@/lib/auth'
import ValueCategoriesClient from './ValueCategoriesClient'

export default async function ValueCategoriesAdminPage() {
  // Guard access: superadmin only
  await requireSuperAdmin()

  return <ValueCategoriesClient />
}
