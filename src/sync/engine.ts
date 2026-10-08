import type { Table } from 'dexie'
import type { AppDB, SyncFields } from '../db/schema'

/**
 * Sync engine (docs/DESIGN.md section 7). Local-first and row-based: every local table row carries
 * `updatedAt`, `deletedAt` and a local-only `dirty` flag. Push uploads dirty rows; pull downloads
 * rows changed on the server since a cursor. When two versions of a row meet, the larger `updatedAt`
 * wins ("newest edit wins"). The server clock decides what is new for the pull cursor, so a device
 * with a wrong clock can never hide its changes from the others.
 */

export interface PushRow {
  entity: string
  id: string
  data: Record<string, unknown>
  updated_at: number
  deleted_at: number | null
}

export interface RemoteRecord extends PushRow {
  /** Server clock, ISO 8601. */
  server_updated_at: string
}

/** The server side, kept behind an interface so the engine can be tested without a network. */
export interface Remote {
  push(rows: PushRow[]): Promise<void>
  /** Rows with server_updated_at after `sinceIso` (all rows when null), in a stable order. */
  pull(sinceIso: string | null, offset: number, limit: number): Promise<RemoteRecord[]>
}

type Row = SyncFields & Record<string, unknown>

/** Entity name on the server -> local Dexie table. */
export function entityTables(db: AppDB): Record<string, Table<Row, string>> {
  return {
    food: db.foods,
    log_entry: db.logEntries,
    meal: db.meals,
    meal_item: db.mealItems,
    profile: db.profile,
    weight_entry: db.weightEntries,
    water_entry: db.waterEntries,
  } as unknown as Record<string, Table<Row, string>>
}

/** Pulls start this long before the newest row seen, to catch rows that committed late. Harmless to repeat. */
export const PULL_OVERLAP_MS = 10_000

export const PUSH_BATCH = 200
export const PULL_PAGE = 500

// ---- device-local state -------------------------------------------------

export async function getMeta<T>(db: AppDB, key: string): Promise<T | undefined> {
  return (await db.syncMeta.get(key))?.value as T | undefined
}

export async function setMeta(db: AppDB, key: string, value: unknown): Promise<void> {
  await db.syncMeta.put({ key, value })
}

export async function countDirty(db: AppDB): Promise<number> {
  const counts = await Promise.all(Object.values(entityTables(db)).map((t) => t.where('dirty').equals(1).count()))
  return counts.reduce((a, b) => a + b, 0)
}

// ---- push ---------------------------------------------------------------

function toPushRow(entity: string, row: Row): PushRow {
  const { dirty: _dirty, ...data } = row
  void _dirty
  return { entity, id: row.id, data, updated_at: row.updatedAt, deleted_at: row.deletedAt }
}

/** Upload every dirty row. Returns how many rows were sent. */
export async function pushDirty(db: AppDB, remote: Remote, batchSize = PUSH_BATCH): Promise<number> {
  let sent = 0
  for (const [entity, table] of Object.entries(entityTables(db))) {
    // The guard only matters if rows are edited faster than they can be uploaded.
    for (let round = 0; round < 1000; round++) {
      const rows = await table.where('dirty').equals(1).limit(batchSize).toArray()
      if (rows.length === 0) break
      await remote.push(rows.map((r) => toPushRow(entity, r)))
      await db.transaction('rw', table, async () => {
        for (const r of rows) {
          const current = await table.get(r.id)
          // A row edited while the upload was running keeps its dirty flag and goes out next round.
          if (current && current.updatedAt === r.updatedAt) await table.update(r.id, { dirty: 0 } as never)
        }
      })
      sent += rows.length
    }
  }
  return sent
}

// ---- pull ---------------------------------------------------------------

/** Postgres returns microseconds; trim to milliseconds so every JS engine parses it. */
export function parseServerTime(iso: string): number {
  return Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'))
}

/** Cheap shape check on a row from the server: an object payload, a string id and numeric times. */
function isWellFormed(rec: RemoteRecord): boolean {
  return (
    typeof rec.id === 'string' &&
    rec.id.length > 0 &&
    typeof rec.data === 'object' &&
    rec.data !== null &&
    !Array.isArray(rec.data) &&
    Number.isFinite(rec.updated_at) &&
    (rec.deleted_at === null || Number.isFinite(rec.deleted_at))
  )
}

/** Apply server rows locally: a row only replaces the local one when it is newer. */
export async function applyRemote(db: AppDB, records: RemoteRecord[]): Promise<number> {
  const tables = entityTables(db)
  let applied = 0
  await db.transaction('rw', Object.values(tables), async () => {
    for (const rec of records) {
      const table = tables[rec.entity]
      if (!table) continue // an entity from a newer version of the app
      if (!isWellFormed(rec)) continue // never store something the app cannot read
      const local = await table.get(rec.id)
      if (local && local.updatedAt >= rec.updated_at) continue
      await table.put({
        ...rec.data,
        id: rec.id,
        updatedAt: rec.updated_at,
        deletedAt: rec.deleted_at,
        dirty: 0,
      } as Row)
      applied++
    }
  })
  return applied
}

/** Download everything changed since the stored cursor. Returns how many local rows were changed. */
export async function pullChanges(db: AppDB, remote: Remote, pageSize = PULL_PAGE): Promise<number> {
  const cursor = (await getMeta<string | null>(db, 'cursor')) ?? null
  let newest = cursor ? Date.parse(cursor) : -Infinity
  let offset = 0
  let applied = 0
  for (;;) {
    const page = await remote.pull(cursor, offset, pageSize)
    applied += await applyRemote(db, page)
    for (const rec of page) newest = Math.max(newest, parseServerTime(rec.server_updated_at) - PULL_OVERLAP_MS)
    if (page.length < pageSize) break
    offset += pageSize
  }
  if (newest > -Infinity) await setMeta(db, 'cursor', new Date(newest).toISOString())
  return applied
}

// ---- reconcile ----------------------------------------------------------

/**
 * Some things are meant to exist once but two devices can each create one before they have synced:
 * the profile, and the weight for a day. Keep one deterministically (every device picks the same)
 * and soft-delete the others, so the devices converge.
 */
export async function reconcile(db: AppDB): Promise<number> {
  const now = Date.now()
  let removed = 0

  const profiles = (await db.profile.filter((p) => p.deletedAt === null).toArray()).sort(
    (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
  )
  for (const loser of profiles.slice(1)) {
    await db.profile.update(loser.id, { deletedAt: now, updatedAt: now, dirty: 1 })
    removed++
  }

  const live = await db.weightEntries.filter((x) => x.deletedAt === null).toArray()
  const byDate = new Map<string, typeof live>()
  for (const w of live) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])
  for (const group of byDate.values()) {
    if (group.length < 2) continue
    group.sort((a, b) => b.measuredAt - a.measuredAt || b.id.localeCompare(a.id))
    for (const loser of group.slice(1)) {
      await db.weightEntries.update(loser.id, { deletedAt: now, updatedAt: now, dirty: 1 })
      removed++
    }
  }
  return removed
}

// ---- one full round -----------------------------------------------------

export interface SyncStats {
  pushed: number
  pulled: number
  reconciled: number
}

/** Sync as `userId`. Signing in as a different user than last time re-uploads everything. */
export async function syncOnce(db: AppDB, remote: Remote, userId: string): Promise<SyncStats> {
  const previousUser = await getMeta<string>(db, 'userId')
  if (previousUser !== userId) {
    await setMeta(db, 'cursor', null)
    for (const table of Object.values(entityTables(db))) await table.toCollection().modify({ dirty: 1 } as never)
    await setMeta(db, 'userId', userId)
  }

  let pushed = await pushDirty(db, remote)
  const pulled = await pullChanges(db, remote)
  const reconciled = await reconcile(db)
  // Anything changed while pulling, or by reconcile, goes out now.
  pushed += await pushDirty(db, remote)
  await setMeta(db, 'lastSyncAt', Date.now())
  return { pushed, pulled, reconciled }
}
