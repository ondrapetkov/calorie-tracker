import { useSyncExternalStore } from 'react'
import { createSyncManager, type SyncManager, type SyncStatus } from './manager'
import { createSupabaseBackend } from './supabase'

let manager: SyncManager | undefined

/** The app-wide sync manager, created on first use. */
export function getSyncManager(): SyncManager {
  manager ??= createSyncManager(createSupabaseBackend())
  return manager
}

export function useSyncStatus(): SyncStatus {
  const m = getSyncManager()
  return useSyncExternalStore(m.subscribe, m.getSnapshot)
}
