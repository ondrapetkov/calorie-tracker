import { db as defaultDb, type AppDB, type Food, type LogEntry, type SyncFields } from './schema'
import { multiplyMacros, scaleMacros, type Slot } from '../domain/nutrition'
import { matchesQuery } from '../domain/search'

/** Everything a caller provides when creating or editing a food. */
export type FoodInput = Omit<Food, keyof SyncFields | 'lastUsedAt' | 'useCount'>

function fresh(): SyncFields {
  return { id: crypto.randomUUID(), updatedAt: Date.now(), deletedAt: null, dirty: 1 }
}

/** Fields to merge into a row on every local write. */
function touch(): Pick<SyncFields, 'updatedAt' | 'dirty'> {
  return { updatedAt: Date.now(), dirty: 1 }
}

export function createRepo(db: AppDB = defaultDb) {
  return {
    // ---- foods ----------------------------------------------------------

    async saveFood(input: FoodInput): Promise<Food> {
      const food: Food = { ...fresh(), ...input, lastUsedAt: null, useCount: 0 }
      await db.foods.add(food)
      return food
    },

    async updateFood(id: string, input: FoodInput): Promise<void> {
      await db.foods.update(id, { ...input, ...touch() })
    },

    async deleteFood(id: string): Promise<void> {
      await db.foods.update(id, { deletedAt: Date.now(), ...touch() })
    },

    async findFoodByExternalId(externalId: string): Promise<Food | undefined> {
      return db.foods
        .where('externalId')
        .equals(externalId)
        .filter((f) => f.deletedAt === null)
        .first()
    },

    /** All live foods whose name or brand matches every word in the query. */
    async searchFoods(query: string): Promise<Food[]> {
      const all = await db.foods.filter((f) => f.deletedAt === null).toArray()
      const hits = all.filter((f) => matchesQuery(`${f.name} ${f.brand ?? ''}`, query))
      return hits.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name))
    },

    /** Foods used most recently, for the empty search state. */
    async recentFoods(limit = 15): Promise<Food[]> {
      const all = await db.foods.filter((f) => f.deletedAt === null && f.lastUsedAt !== null).toArray()
      return all.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).slice(0, limit)
    },

    async allFoods(): Promise<Food[]> {
      const all = await db.foods.filter((f) => f.deletedAt === null).toArray()
      return all.sort((a, b) => a.name.localeCompare(b.name))
    },

    // ---- log entries ----------------------------------------------------

    /** Log `grams` of a food. The macros are snapshotted onto the entry. */
    async logFood(params: { food: Food; grams: number; date: string; slot: Slot }): Promise<LogEntry> {
      const { food, grams, date, slot } = params
      const now = Date.now()
      const entry: LogEntry = {
        ...fresh(),
        ...scaleMacros(food.per100, grams),
        date,
        slot,
        foodId: food.id,
        mealId: null,
        grams,
        unit: food.basis,
        servings: null,
        label: food.brand ? `${food.name} · ${food.brand}` : food.name,
        loggedAt: now,
      }
      await db.transaction('rw', db.logEntries, db.foods, async () => {
        await db.logEntries.add(entry)
        await db.foods.update(food.id, {
          lastUsedAt: now,
          useCount: food.useCount + 1,
          ...touch(),
        })
      })
      return entry
    },

    /**
     * Change an entry's amount and/or slot. The existing snapshot is rescaled by the
     * ratio of the new amount to the old one, so editing never reaches back into the
     * food (which may have changed or been deleted since).
     */
    async updateEntry(id: string, changes: { grams: number; slot: Slot }): Promise<void> {
      const entry = await db.logEntries.get(id)
      if (!entry) return
      const ratio = entry.grams && entry.grams > 0 ? changes.grams / entry.grams : 1
      await db.logEntries.update(id, {
        ...multiplyMacros(entry, ratio),
        grams: changes.grams,
        slot: changes.slot,
        ...touch(),
      })
    },

    async deleteEntry(id: string): Promise<void> {
      await db.logEntries.update(id, { deletedAt: Date.now(), ...touch() })
    },

    async restoreEntry(id: string): Promise<void> {
      await db.logEntries.update(id, { deletedAt: null, ...touch() })
    },

    async entriesForDate(date: string): Promise<LogEntry[]> {
      const rows = await db.logEntries
        .where('date')
        .equals(date)
        .filter((e) => e.deletedAt === null)
        .toArray()
      return rows.sort((a, b) => a.loggedAt - b.loggedAt)
    },

    // ---- backup ---------------------------------------------------------

    /** Every table as plain JSON, including soft-deleted rows. */
    async exportAll() {
      const [foods, logEntries, meals, mealItems, profile, weightEntries, waterEntries] = await Promise.all([
        db.foods.toArray(),
        db.logEntries.toArray(),
        db.meals.toArray(),
        db.mealItems.toArray(),
        db.profile.toArray(),
        db.weightEntries.toArray(),
        db.waterEntries.toArray(),
      ])
      return {
        app: 'calorie-tracker',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        tables: { foods, logEntries, meals, mealItems, profile, weightEntries, waterEntries },
      }
    },
  }
}

export const repo = createRepo()
