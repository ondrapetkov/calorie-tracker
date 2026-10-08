import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/schema'
import { createRepo, type FoodInput } from '../db/repo'
import type { PushRow, Remote, RemoteRecord } from './engine'
import { createSyncManager, describeError, type SyncManager } from './manager'
import { AuthExpiredError, type AuthPort, type AuthUser } from './ports'

const oats: FoodInput = {
  source: 'custom',
  externalId: null,
  name: 'Oats',
  brand: null,
  basis: 'g',
  per100: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, salt: null },
  defaultServingG: null,
  defaultServingLabel: null,
}

class FakeRemote implements Remote {
  rows: RemoteRecord[] = []
  pushes = 0
  failWith: Error | null = null
  async push(rows: PushRow[]) {
    if (this.failWith) throw this.failWith
    this.pushes++
    for (const r of rows) this.rows.push({ ...r, server_updated_at: new Date(Date.now()).toISOString() })
  }
  async pull(): Promise<RemoteRecord[]> {
    if (this.failWith) throw this.failWith
    return []
  }
}

class FakeAuth implements AuthPort {
  user: AuthUser | null
  password = 'secret'
  listeners = new Set<(u: AuthUser | null) => void>()
  constructor(user: AuthUser | null) {
    this.user = user
  }
  async getUser() {
    return this.user
  }
  onChange(l: (u: AuthUser | null) => void) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  async signIn(email: string, password: string) {
    if (password !== this.password) throw new Error('Wrong email or password.')
    this.user = { id: 'user-1', email }
    this.listeners.forEach((l) => l(this.user))
  }
  async signOut() {
    this.user = null
    this.listeners.forEach((l) => l(null))
  }
}

const until = async (cond: () => boolean, ms = 3000) => {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 10))
  }
}

let db: AppDB
let repo: ReturnType<typeof createRepo>
let remote: FakeRemote
let manager: SyncManager

function setup(user: AuthUser | null) {
  const auth = new FakeAuth(user)
  manager = createSyncManager({ auth, remote }, { db, debounceMs: 20, retryMs: 40, focusThrottleMs: 0 })
  return auth
}

beforeEach(() => {
  db = new AppDB(`mgr-${Math.random()}`)
  repo = createRepo(db)
  remote = new FakeRemote()
})
afterEach(() => manager?.dispose())

describe('sync manager', () => {
  it('does nothing while signed out, and keeps local changes safe', async () => {
    setup(null)
    await manager.start()
    await repo.saveFood(oats)
    await new Promise((r) => setTimeout(r, 80))
    expect(manager.getSnapshot().phase).toBe('signed-out')
    expect(remote.pushes).toBe(0)
    await until(() => manager.getSnapshot().pending === 1)
  })

  it('syncs on start when signed in and reports the result', async () => {
    await repo.saveFood(oats)
    setup({ id: 'user-1', email: 'me@example.com' })
    await manager.start()
    await until(() => manager.getSnapshot().phase === 'idle' && manager.getSnapshot().lastSyncAt !== null)
    const s = manager.getSnapshot()
    expect(s.email).toBe('me@example.com')
    expect(s.pending).toBe(0)
    expect(s.error).toBeNull()
    expect(remote.rows.map((r) => r.entity)).toEqual(['food'])
  })

  it('uploads a local change shortly after it is made', async () => {
    setup({ id: 'user-1', email: 'me@example.com' })
    await manager.start()
    await manager.idle()
    await repo.saveFood(oats)
    await until(() => remote.rows.length === 1)
    await until(() => manager.getSnapshot().pending === 0 && manager.getSnapshot().phase === 'idle')
  })

  it('batches a burst of edits into one upload', async () => {
    setup({ id: 'user-1', email: 'x' })
    await manager.start()
    await manager.idle()
    remote.pushes = 0
    const food = await repo.saveFood(oats)
    for (let i = 0; i < 4; i++) await repo.logFood({ food, grams: 10 + i, date: '2026-10-08', slot: 'snack' })
    await until(() => remote.rows.length >= 5)
    await manager.idle()
    expect(remote.pushes).toBeLessThanOrEqual(2)
  })

  it('shows a readable error on failure, then recovers by itself', async () => {
    await repo.saveFood(oats)
    remote.failWith = new Error('TypeError: Failed to fetch')
    setup({ id: 'user-1', email: 'x' })
    await manager.start()
    await until(() => manager.getSnapshot().phase === 'error')
    expect(manager.getSnapshot().error).toMatch(/Cannot reach the server/)
    expect(manager.getSnapshot().error).toMatch(/paused/)
    expect(manager.getSnapshot().pending).toBe(1)
    remote.failWith = null
    await until(() => manager.getSnapshot().phase === 'idle')
    expect(manager.getSnapshot().pending).toBe(0)
  })

  it('goes back to signed out when the server rejects the login', async () => {
    await repo.saveFood(oats)
    remote.failWith = new AuthExpiredError()
    setup({ id: 'user-1', email: 'x' })
    await manager.start()
    await until(() => manager.getSnapshot().phase === 'signed-out')
    expect(manager.getSnapshot().error).toMatch(/Sign in again/)
  })

  it('signs in, syncs, and keeps the data after signing out', async () => {
    const auth = setup(null)
    await repo.saveFood(oats)
    await manager.start()
    await expect(manager.signIn('me@example.com', 'wrong')).rejects.toThrow('Wrong email or password.')
    expect(manager.getSnapshot().phase).toBe('signed-out')
    await manager.signIn('me@example.com', auth.password)
    await until(() => manager.getSnapshot().phase === 'idle' && remote.rows.length === 1)

    await manager.signOut()
    expect(manager.getSnapshot().phase).toBe('signed-out')
    expect(await repo.allFoods()).toHaveLength(1)
    await repo.saveFood({ ...oats, name: 'After sign-out' })
    await new Promise((r) => setTimeout(r, 80))
    expect(remote.rows).toHaveLength(1) // nothing uploaded while signed out
  })

  it('syncNow runs a sync on demand', async () => {
    setup({ id: 'user-1', email: 'x' })
    await manager.start()
    await until(() => manager.getSnapshot().lastSyncAt !== null)
    const before = manager.getSnapshot().lastSyncAt!
    await new Promise((r) => setTimeout(r, 5))
    await manager.syncNow()
    expect(manager.getSnapshot().lastSyncAt!).toBeGreaterThan(before)
  })
})

describe('describeError', () => {
  it('explains the common failures in plain words', () => {
    expect(describeError(new Error('Load failed'), false)).toMatch(/paused/)
    expect(describeError(new Error('anything'), true)).toMatch(/Offline/)
    expect(describeError(new AuthExpiredError(), false)).toMatch(/Sign in again/)
    expect(describeError(new Error('permission denied for table records'), false)).toBe('permission denied for table records')
  })
})
