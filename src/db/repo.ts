import {
  db as defaultDb,
  type AppDB,
  type Food,
  type LogEntry,
  type Meal,
  type MealItem,
  type Profile,
  type SyncFields,
  type WaterEntry,
  type WeightEntry,
} from './schema'
import { mealPerServing, mealTotal, type MealIngredient } from '../domain/meals'
import { multiplyMacros, scaleMacros, type Macros, type Slot } from '../domain/nutrition'
import { matchesQuery } from '../domain/search'

/** Everything a caller provides when creating or editing a food. */
export type FoodInput = Omit<Food, keyof SyncFields | 'lastUsedAt' | 'useCount'>

export type ProfileInput = Omit<Profile, keyof SyncFields>

export interface MealInput {
  name: string
  servings: number
  note: string | null
  /** `id` is set for ingredients that already exist, so edits keep their identity. */
  items: { id?: string; foodId: string; grams: number }[]
}

export interface MealDetail {
  meal: Meal
  items: (MealItem & { food: Food | undefined })[]
  total: Macros
  perServing: Macros
}

export interface WaterSettings {
  goalMl: number
  presets: { label: string; ml: number }[]
}

/** Default water presets; see docs/DESIGN.md. */
export const DEFAULT_WATER_PRESETS = [
  { label: 'Shaker', ml: 250 },
  { label: 'Sport bottle', ml: 900 },
  { label: 'Stanley', ml: 1100 },
]
export const DEFAULT_WATER_GOAL_ML = 2500

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

    /** Log `servings` portions of a saved meal. Macros come from the ingredients as they are now. */
    async logMeal(params: { mealId: string; servings: number; date: string; slot: Slot }): Promise<LogEntry> {
      const detail = await this.getMeal(params.mealId)
      if (!detail) throw new Error('Meal not found')
      const entry: LogEntry = {
        ...fresh(),
        ...multiplyMacros(detail.perServing, params.servings),
        date: params.date,
        slot: params.slot,
        foodId: null,
        mealId: detail.meal.id,
        grams: null,
        unit: 'g',
        servings: params.servings,
        label: detail.meal.name,
        loggedAt: Date.now(),
      }
      await db.logEntries.add(entry)
      return entry
    },

    /** Change the number of portions and/or the slot of a logged meal, rescaling its snapshot. */
    async updateMealEntry(id: string, changes: { servings: number; slot: Slot }): Promise<void> {
      const entry = await db.logEntries.get(id)
      if (!entry) return
      const ratio = entry.servings && entry.servings > 0 ? changes.servings / entry.servings : 1
      await db.logEntries.update(id, {
        ...multiplyMacros(entry, ratio),
        servings: changes.servings,
        slot: changes.slot,
        ...touch(),
      })
    },

    // ---- meals ----------------------------------------------------------

    async saveMeal(input: MealInput, id?: string): Promise<string> {
      return db.transaction('rw', db.meals, db.mealItems, async () => {
        let mealId = id
        if (mealId) {
          await db.meals.update(mealId, { name: input.name, servings: input.servings, note: input.note, ...touch() })
        } else {
          const meal: Meal = { ...fresh(), name: input.name, servings: input.servings, note: input.note }
          await db.meals.add(meal)
          mealId = meal.id
        }
        const existing = await db.mealItems
          .where('mealId')
          .equals(mealId)
          .filter((i) => i.deletedAt === null)
          .toArray()
        const keptIds = new Set(input.items.map((i) => i.id).filter(Boolean))
        for (const old of existing) {
          if (!keptIds.has(old.id)) await db.mealItems.update(old.id, { deletedAt: Date.now(), ...touch() })
        }
        for (const [index, item] of input.items.entries()) {
          if (item.id && existing.some((e) => e.id === item.id)) {
            await db.mealItems.update(item.id, { foodId: item.foodId, grams: item.grams, sortOrder: index, ...touch() })
          } else {
            await db.mealItems.add({
              ...fresh(),
              mealId,
              foodId: item.foodId,
              grams: item.grams,
              sortOrder: index,
            })
          }
        }
        return mealId
      })
    },

    async getMeal(id: string): Promise<MealDetail | undefined> {
      const meal = await db.meals.get(id)
      if (!meal || meal.deletedAt !== null) return undefined
      const rows = await db.mealItems
        .where('mealId')
        .equals(id)
        .filter((i) => i.deletedAt === null)
        .toArray()
      rows.sort((a, b) => a.sortOrder - b.sortOrder)
      const foods = await db.foods.bulkGet(rows.map((r) => r.foodId))
      const items = rows.map((r, i) => ({ ...r, food: foods[i] }))
      const ingredients: MealIngredient[] = items.flatMap((i) =>
        i.food ? [{ per100: i.food.per100, grams: i.grams }] : [],
      )
      return {
        meal,
        items,
        total: mealTotal(ingredients),
        perServing: mealPerServing(ingredients, meal.servings),
      }
    },

    /** Live meals, most recently logged first, then alphabetically. */
    async listMeals(): Promise<MealDetail[]> {
      const meals = await db.meals.filter((m) => m.deletedAt === null).toArray()
      const details = (await Promise.all(meals.map((m) => this.getMeal(m.id)))).filter(
        (d): d is MealDetail => d !== undefined,
      )
      const entries = await db.logEntries.filter((e) => e.mealId !== null && e.deletedAt === null).toArray()
      const lastLogged = new Map<string, number>()
      for (const e of entries) {
        lastLogged.set(e.mealId!, Math.max(lastLogged.get(e.mealId!) ?? 0, e.loggedAt))
      }
      return details.sort(
        (a, b) =>
          (lastLogged.get(b.meal.id) ?? 0) - (lastLogged.get(a.meal.id) ?? 0) ||
          a.meal.name.localeCompare(b.meal.name),
      )
    },

    async deleteMeal(id: string): Promise<void> {
      await db.transaction('rw', db.meals, db.mealItems, async () => {
        await db.meals.update(id, { deletedAt: Date.now(), ...touch() })
        await db.mealItems.where('mealId').equals(id).modify({ deletedAt: Date.now(), ...touch() })
      })
    },

    // ---- profile and weight ---------------------------------------------

    /**
     * The profile in use. Two devices can each create a profile before their first sync, so there
     * may briefly be more than one row; the most recently edited one wins.
     */
    async getProfile(): Promise<Profile | undefined> {
      const all = await db.profile.filter((p) => p.deletedAt === null).toArray()
      return all.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))[0]
    },

    async saveProfile(input: ProfileInput): Promise<void> {
      const all = await db.profile.filter((p) => p.deletedAt === null).toArray()
      const [current, ...older] = all.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
      if (current) await db.profile.update(current.id, { ...input, ...touch() })
      else await db.profile.add({ ...fresh(), ...input })
      for (const o of older) await db.profile.update(o.id, { deletedAt: Date.now(), ...touch() })
    },

    /** Record the weight for a day, replacing that day's entry if there is one. */
    async setWeight(date: string, kg: number): Promise<void> {
      const existing = await db.weightEntries
        .where('date')
        .equals(date)
        .filter((w) => w.deletedAt === null)
        .first()
      const now = Date.now()
      if (existing) await db.weightEntries.update(existing.id, { kg, measuredAt: now, ...touch() })
      else await db.weightEntries.add({ ...fresh(), date, kg, measuredAt: now })
    },

    async latestWeight(): Promise<WeightEntry | undefined> {
      const all = await db.weightEntries.filter((w) => w.deletedAt === null).toArray()
      return all.sort((a, b) => b.date.localeCompare(a.date) || b.measuredAt - a.measuredAt)[0]
    },

    async weightEntries(): Promise<WeightEntry[]> {
      const all = await db.weightEntries.filter((w) => w.deletedAt === null).toArray()
      return all.sort((a, b) => a.date.localeCompare(b.date) || a.measuredAt - b.measuredAt)
    },

    async deleteWeight(id: string): Promise<void> {
      await db.weightEntries.update(id, { deletedAt: Date.now(), ...touch() })
    },

    async restoreWeight(id: string): Promise<void> {
      await db.weightEntries.update(id, { deletedAt: null, ...touch() })
    },

    // ---- water ----------------------------------------------------------

    async addWater(date: string, ml: number): Promise<WaterEntry> {
      const entry: WaterEntry = { ...fresh(), date, ml, loggedAt: Date.now() }
      await db.waterEntries.add(entry)
      return entry
    },

    async waterEntriesForDate(date: string): Promise<WaterEntry[]> {
      const rows = await db.waterEntries
        .where('date')
        .equals(date)
        .filter((w) => w.deletedAt === null)
        .toArray()
      return rows.sort((a, b) => a.loggedAt - b.loggedAt)
    },

    async deleteWater(id: string): Promise<void> {
      await db.waterEntries.update(id, { deletedAt: Date.now(), ...touch() })
    },

    async restoreWater(id: string): Promise<void> {
      await db.waterEntries.update(id, { deletedAt: null, ...touch() })
    },

    /** Total millilitres per day for the given dates (days without entries are 0). */
    async waterTotals(dates: string[]): Promise<Record<string, number>> {
      const totals: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]))
      const rows = await db.waterEntries
        .where('date')
        .anyOf(dates)
        .filter((w) => w.deletedAt === null)
        .toArray()
      for (const r of rows) totals[r.date] += r.ml
      return totals
    },

    async getWaterSettings(): Promise<WaterSettings> {
      const profile = await this.getProfile()
      return {
        goalMl: profile?.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
        presets: profile?.waterPresets ?? DEFAULT_WATER_PRESETS,
      }
    },

    /** Water settings live on the profile row. Returns false when there is no profile yet. */
    async saveWaterSettings(settings: WaterSettings): Promise<boolean> {
      const profile = await this.getProfile()
      if (!profile) return false
      await db.profile.update(profile.id, { waterGoalMl: settings.goalMl, waterPresets: settings.presets, ...touch() })
      return true
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
