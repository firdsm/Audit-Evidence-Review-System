import { requireSuperAdmin } from '@/lib/auth'
import SyncClient from './SyncClient'

export default async function SyncPage() {
  // Hanya superadmin yang boleh akses — redirect ke /dashboard kalau bukan
  await requireSuperAdmin()

  return <SyncClient />
}
