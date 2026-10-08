import { liveQuery } from 'dexie'
import { db as defaultDb, type AppDB } from '../db/schema'
import { countDirty, getMeta, syncOnce } from './engine'
import { AuthExpiredError, type AuthUser, type SyncBackend } from './ports'

export type SyncPhase = 'signed-out' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  phase: SyncPhase
  email: string | null
  lastSyncAt: number | null
  /** Local changes not yet uploaded. */
  pending: number
  error: string | null
  offline: boolean
}

export interface SyncOptions {
  db?: AppDB
  /** Wait this long after a local change before uploading, so a burst of edits goes out together. */
  debounceMs?: number
  /** Retry delay after a failed sync. */
  retryMs?: number
  /** Do not sync on tab focus more often than this. */
  focusThrottleMs?: number
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export function describeError(e: unknown, offline: boolean): string {
  if (offline) return 'Offline. Changes are kept on this device and upload when you are back online.'
  const message = e instanceof Error ? e.message : String(e)
  if (e instanceof AuthExpiredError) return message
  if (/failed to fetch|load failed|networkerror|network request failed|fetch/i.test(message)) {
    return 'Cannot reach the server. If your connection is fine, the Supabase project may be paused: open the Supabase dashboard and press Restore.'
  }
  return message
}

export function createSyncManager(backend: SyncBackend, options: SyncOptions = {}) {
  const db = options.db ?? defaultDb
  const debounceMs = options.debounceMs ?? 2500
  const retryMs = options.retryMs ?? 60_000
  const focusThrottleMs = options.focusThrottleMs ?? 30_000

  let user: AuthUser | null = null
  let started = false
  let running = false
  let rerun = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastAttempt = 0
  const cleanups: (() => void)[] = []
  const listeners = new Set<() => void>()

  let status: SyncStatus = {
    phase: 'signed-out',
    email: null,
    lastSyncAt: null,
    pending: 0,
    error: null,
    offline: false,
  }

  const set = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch }
    listeners.forEach((l) => l())
  }

  const schedule = (delay: number) => {
    if (!user) return
    clearTimeout(timer)
    timer = setTimeout(() => void run(), delay)
  }

  async function run(): Promise<void> {
    if (!user) return
    if (running) {
      rerun = true
      return
    }
    running = true
    lastAttempt = Date.now()
    set({ phase: 'syncing', error: null })
    try {
      await syncOnce(db, backend.remote, user.id)
      set({ phase: 'idle', error: null, offline: false, lastSyncAt: (await getMeta<number>(db, 'lastSyncAt')) ?? null })
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        user = null
        set({ phase: 'signed-out', email: null, error: describeError(e, false) })
      } else {
        const offline = isOffline()
        set({ phase: 'error', offline, error: describeError(e, offline) })
        schedule(retryMs)
      }
    } finally {
      running = false
      if (rerun) {
        rerun = false
        schedule(0)
      }
    }
  }

  function setUser(next: AuthUser | null) {
    user = next
    if (next) {
      set({ phase: status.phase === 'syncing' ? 'syncing' : 'idle', email: next.email, error: null })
      schedule(0)
    } else {
      clearTimeout(timer)
      set({ phase: 'signed-out', email: null })
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    getSnapshot: (): SyncStatus => status,

    /** Begin watching the login, local changes, connectivity and tab focus. Safe to call once. */
    async start() {
      if (started) return
      started = true
      set({ lastSyncAt: (await getMeta<number>(db, 'lastSyncAt')) ?? null })

      const subscription = liveQuery(() => countDirty(db)).subscribe({
        next: (pending) => {
          set({ pending })
          if (pending > 0 && user && !running) schedule(debounceMs)
        },
        error: () => {},
      })
      cleanups.push(() => subscription.unsubscribe())
      cleanups.push(backend.auth.onChange((next) => setUser(next)))

      if (typeof window !== 'undefined') {
        const onOnline = () => void run()
        const onVisible = () => {
          if (document.visibilityState === 'visible' && Date.now() - lastAttempt > focusThrottleMs) void run()
        }
        window.addEventListener('online', onOnline)
        document.addEventListener('visibilitychange', onVisible)
        cleanups.push(() => {
          window.removeEventListener('online', onOnline)
          document.removeEventListener('visibilitychange', onVisible)
        })
      }

      setUser(await backend.auth.getUser())
    },

    async signIn(email: string, password: string) {
      await backend.auth.signIn(email.trim(), password)
      setUser(await backend.auth.getUser())
    },

    /** Sign out. Data stays on this device; it just stops syncing. */
    async signOut() {
      await backend.auth.signOut()
      setUser(null)
    },

    async syncNow() {
      clearTimeout(timer)
      await run()
    },

    /** Resolves when no sync is running (used by tests). */
    async idle() {
      while (running) await new Promise((r) => setTimeout(r, 5))
    },

    dispose() {
      clearTimeout(timer)
      cleanups.splice(0).forEach((c) => c())
      started = false
    },
  }
}

export type SyncManager = ReturnType<typeof createSyncManager>
