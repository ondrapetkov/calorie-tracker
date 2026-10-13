import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/schema'
import { createRepo, type FoodInput } from '../db/repo'
import {
  PULL_OVERLAP_MS,
  countDirty,
  getMeta,
  parseServerTime,
  pullChanges,
  pushDirty,
  syncOnce,
  type PushRow,
  type Remote,
  type RemoteRecord,
} from './engine'

/** A stand-in server with the same rules as docs/supabase-setup.sql. */
class FakeServer implements Remote {
  rows = new Map<string, RemoteRecord>()
  clock = Date.parse('2026-10-08T10:00:00Z')
  pullCalls: { since: string | null; offset: number; limit: number }[] = []
  pushCalls = 0
  failPushes = 0

  async push(rows: PushRow[]): Promise<void> {
    this.pushCalls++
    if (this.failPushes > 0) {
      this.failPushes--
      throw new Error('network down')
    }
    this.clock += 1000
    // one call = one transaction = one timestamp for every row, with microsecond precision like Postgres
    const stamp = new Date(this.clock).toISOString().replace('Z', '123+00:00')
    for (const r of rows) {
      const key = `${r.entity}/${r.id}`
      const existing = this.rows.get(key)
      if (!existing || existing.updated_at < r.updated_at) this.rows.set(key, { ...r, server_updated_at: stamp })
    }
  }

  async pull(since: string | null, offset: number, limit: number): Promise<RemoteRecord[]> {
    this.pullCalls.push({ since, offset, limit })
    const after = since === null ? -Infinity : parseServerTime(since)
    return [...this.rows.values()]
      .filter((r) => parseServerTime(r.server_updated_at) > after)
      .sort(
        (a, b) =>
          a.server_updated_at.localeCompare(b.server_updated_at) ||
          a.entity.localeCompare(b.entity) ||
          a.id.localeCompare(b.id),
      )
      .slice(offset, offset + limit)
  }
}

const oats: FoodInput = {
  source: 'custom',
  externalId: null,
  name: 'Ovesné vločky',
  brand: null,
  basis: 'g',
  per100: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, salt: null },
  defaultServingG: null,
  defaultServingLabel: null,
}

const profile = {
  sex: 'male' as const,
  birthDate: '1996-05-20',
  heightCm: 180,
  activityFactor: 1.55,
  goal: 'cut' as const,
  calorieOffset: -400,
  proteinPerKg: 2,
  fatPerKg: 0.9,
  waterGoalMl: 2500,
  waterPresets: [{ label: 'Shaker', ml: 250 }],
}

interface Device {
  db: AppDB
  repo: ReturnType<typeof createRepo>
}
const device = (): Device => {
  const db = new AppDB(`dev-${Math.random()}`)
  return { db, repo: createRepo(db) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let server: FakeServer
let a: Device
let b: Device
beforeEach(() => {
  server = new FakeServer()
  a = device()
  b = device()
})

describe('push', () => {
  it('uploads dirty rows once and clears their flag', async () => {
    const food = await a.repo.saveFood(oats)
    await a.repo.logFood({ food, grams: 50, date: '2026-10-08', slot: 'breakfast' })
    expect(await countDirty(a.db)).toBe(2)
    expect(await pushDirty(a.db, server)).toBe(2)
    expect(await countDirty(a.db)).toBe(0)
    expect(server.rows.size).toBe(2)
    expect(await pushDirty(a.db, server)).toBe(0)
    const pushed = [...server.rows.values()].find((r) => r.entity === 'food')!
    expect(pushed.data).not.toHaveProperty('dirty')
    expect(pushed.data.name).toBe('Ovesné vločky')
  })

  it('keeps rows dirty when the upload fails, and sends them next time', async () => {
    await a.repo.saveFood(oats)
    server.failPushes = 1
    await expect(pushDirty(a.db, server)).rejects.toThrow('network down')
    expect(await countDirty(a.db)).toBe(1)
    expect(await pushDirty(a.db, server)).toBe(1)
    expect(await countDirty(a.db)).toBe(0)
  })

  it('does not clear the flag of a row edited while it was being uploaded', async () => {
    const food = await a.repo.saveFood(oats)
    let edited = false
    const slowServer: Remote = {
      push: async (rows) => {
        await wait(5)
        if (!edited) {
          edited = true
          await a.repo.updateFood(food.id, { ...oats, name: 'Edited during upload' })
        }
        return server.push(rows)
      },
      pull: (s, o, l) => server.pull(s, o, l),
    }
    await pushDirty(a.db, slowServer)
    // the first round marked nothing clean, the second round uploaded the newer version
    const onServer = [...server.rows.values()].find((r) => r.entity === 'food')!
    expect(onServer.data.name).toBe('Edited during upload')
    expect(await countDirty(a.db)).toBe(0)
  })

  it('sends in batches', async () => {
    const food = await a.repo.saveFood(oats)
    for (let i = 0; i < 5; i++) await a.repo.logFood({ food, grams: 10 + i, date: '2026-10-08', slot: 'snack' })
    const sizes: number[] = []
    const counting: Remote = { push: async (rows) => { sizes.push(rows.length); return server.push(rows) }, pull: (s, o, l) => server.pull(s, o, l) }
    expect(await pushDirty(a.db, counting, 2)).toBe(6)
    expect(sizes).toEqual([1, 2, 2, 1]) // the food, then the five log entries in batches of two
    expect(server.pushCalls).toBe(sizes.length)
  })
})

describe('two devices', () => {
  it('a new device downloads everything on its first sync', async () => {
    const food = await a.repo.saveFood(oats)
    await a.repo.logFood({ food, grams: 50, date: '2026-10-08', slot: 'breakfast' })
    await a.repo.setWeight('2026-10-08', 87)
    await syncOnce(a.db, server, 'user-1')

    const stats = await syncOnce(b.db, server, 'user-1')
    expect(stats.pulled).toBe(3)
    expect((await b.repo.entriesForDate('2026-10-08'))[0].label).toBe('Ovesné vločky')
    expect((await b.repo.latestWeight())?.kg).toBe(87)
    expect(await countDirty(b.db)).toBe(0)
  })

  it('carries an edit and a delete from one device to the other', async () => {
    const food = await a.repo.saveFood(oats)
    const entry = await a.repo.logFood({ food, grams: 50, date: '2026-10-08', slot: 'breakfast' })
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')

    await b.repo.updateEntry(entry.id, { grams: 100, slot: 'lunch' })
    await syncOnce(b.db, server, 'u')
    await syncOnce(a.db, server, 'u')
    const [seenByA] = await a.repo.entriesForDate('2026-10-08')
    expect(seenByA.grams).toBe(100)
    expect(seenByA.slot).toBe('lunch')

    await a.repo.deleteEntry(entry.id)
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    expect(await b.repo.entriesForDate('2026-10-08')).toEqual([])
  })

  it('resolves a conflicting edit in favour of the newest, on both devices', async () => {
    const food = await a.repo.saveFood(oats)
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')

    await a.repo.updateFood(food.id, { ...oats, name: 'From A' })
    await wait(3)
    await b.repo.updateFood(food.id, { ...oats, name: 'From B' }) // later edit
    await syncOnce(b.db, server, 'u')
    await syncOnce(a.db, server, 'u') // A's older edit must not overwrite B's
    await syncOnce(b.db, server, 'u')
    expect((await a.repo.allFoods())[0].name).toBe('From B')
    expect((await b.repo.allFoods())[0].name).toBe('From B')
  })

  it('keeps a newer local edit when an older version arrives', async () => {
    const food = await a.repo.saveFood(oats)
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    await a.repo.updateFood(food.id, { ...oats, name: 'A old' })
    await syncOnce(a.db, server, 'u')
    await wait(3)
    await b.repo.updateFood(food.id, { ...oats, name: 'B newer, not synced yet' })
    await syncOnce(b.db, server, 'u') // pulls A's older version first, must keep B's
    expect((await b.repo.allFoods())[0].name).toBe('B newer, not synced yet')
    await syncOnce(a.db, server, 'u')
    expect((await a.repo.allFoods())[0].name).toBe('B newer, not synced yet')
  })
})

describe('pulling', () => {
  it('reads every page, including rows that share a timestamp', async () => {
    const food = await a.repo.saveFood(oats)
    for (let i = 0; i < 6; i++) await a.repo.logFood({ food, grams: 10 + i, date: '2026-10-08', slot: 'snack' })
    await pushDirty(a.db, server) // all 7 rows go in one transaction with the same server timestamp
    expect(new Set([...server.rows.values()].map((r) => r.server_updated_at)).size).toBeLessThanOrEqual(2)

    expect(await pullChanges(b.db, server, 2)).toBe(7)
    expect(await b.repo.entriesForDate('2026-10-08')).toHaveLength(6)
  })

  it('asks only for recent changes after the first pull, with a safety overlap', async () => {
    await a.repo.saveFood(oats)
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    server.pullCalls = []
    await syncOnce(b.db, server, 'u')
    const since = server.pullCalls[0].since!
    const newest = Math.max(...[...server.rows.values()].map((r) => parseServerTime(r.server_updated_at)))
    expect(parseServerTime(since)).toBe(newest - PULL_OVERLAP_MS)
    expect(await getMeta<string>(b.db, 'cursor')).toBe(since)
  })

  it('never moves the cursor backwards', async () => {
    await a.repo.saveFood(oats)
    await syncOnce(a.db, server, 'u')
    const first = await getMeta<string>(a.db, 'cursor')
    await syncOnce(a.db, server, 'u') // nothing new
    expect(await getMeta<string>(a.db, 'cursor')).toBe(first)
  })

  it('ignores rows that are not shaped like rows, instead of storing them', async () => {
    const bad = (over: Partial<RemoteRecord>): RemoteRecord => ({
      entity: 'food',
      id: 'a',
      data: { name: 'x' },
      updated_at: 1,
      deleted_at: null,
      server_updated_at: '2026-10-08T10:00:00.000000+00:00',
      ...over,
    })
    server.rows.set('1', bad({ id: '' }))
    server.rows.set('2', bad({ id: 'b', data: null as never }))
    server.rows.set('3', bad({ id: 'c', data: [] as never }))
    server.rows.set('4', bad({ id: 'd', updated_at: 'soon' as never }))
    server.rows.set('5', bad({ id: 'e', deleted_at: 'yes' as never }))
    server.rows.set('6', bad({ id: 'f' })) // the one good row
    expect(await pullChanges(a.db, server)).toBe(1)
    expect(await a.db.foods.count()).toBe(1)
  })

  it('skips entities it does not know instead of failing', async () => {
    server.rows.set('hologram/1', {
      entity: 'hologram',
      id: '1',
      data: {},
      updated_at: 1,
      deleted_at: null,
      server_updated_at: '2026-10-08T10:00:00.000000+00:00',
    })
    expect(await pullChanges(a.db, server)).toBe(0)
  })
})

describe('reconcile', () => {
  it('collapses two weigh-ins for the same day to the later one, on both devices', async () => {
    await a.repo.setWeight('2026-10-08', 87)
    await wait(3)
    await b.repo.setWeight('2026-10-08', 86.5) // measured later
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    for (const d of [a, b]) {
      const live = await d.repo.weightEntries()
      expect(live).toHaveLength(1)
      expect(live[0].kg).toBe(86.5)
    }
  })

  it('keeps a single profile, the most recently edited', async () => {
    await a.repo.saveProfile(profile)
    await wait(3)
    await b.repo.saveProfile({ ...profile, heightCm: 182 })
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    await syncOnce(a.db, server, 'u')
    await syncOnce(b.db, server, 'u')
    expect((await a.repo.getProfile())?.heightCm).toBe(182)
    expect((await b.repo.getProfile())?.heightCm).toBe(182)
    expect(await a.db.profile.filter((p) => p.deletedAt === null).count()).toBe(1)
    expect(await b.db.profile.filter((p) => p.deletedAt === null).count()).toBe(1)
  })
})

describe('accounts', () => {
  it('uploads everything again when a different user signs in', async () => {
    await a.repo.saveFood(oats)
    await syncOnce(a.db, server, 'user-1')
    expect(await countDirty(a.db)).toBe(0)
    const other = new FakeServer()
    const stats = await syncOnce(a.db, other, 'user-2')
    expect(stats.pushed).toBe(1)
    expect(other.rows.size).toBe(1)
    expect(await getMeta<string>(a.db, 'userId')).toBe('user-2')
  })

  it('records when it last synced', async () => {
    const before = Date.now()
    await syncOnce(a.db, server, 'u')
    expect((await getMeta<number>(a.db, 'lastSyncAt'))!).toBeGreaterThanOrEqual(before)
  })
})
