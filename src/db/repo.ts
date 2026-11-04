import {
  db as defaultDb,
  type AppDB,
  type Food,
  type LogEntry,
  type Meal,
  type MealItem,
  type Profile,
  type SyncFields,
  type Tag,
  type TagGroup,
  type WaterEntry,
  type WeightEntry,
} from './schema'
import { mealPerServing, mealTotal, type MealIngredient } from '../domain/meals'
import { multiplyMacros, scaleMacros, type Macros, type Slot } from '../domain/nutrition'
import {
  plateChanged,
  plateFromMeal,
  plateMacros,
  savedMealFromPlate,
  scaleFactor,
  type LoggedMealItem,
} from '../domain/loggedMeal'
import { matchesQuery } from '../domain/search'
import { effectiveMealTags } from '../domain/mealTags'
import { buildVocabulary, findGroupByName, findTagByName, liveTagIds, type Vocabulary } from '../domain/tags'
import { BUILTIN_GROUPS, BUILTIN_TAGS } from '../data/builtinTags'
import { GENERIC_FOOD_TAGS } from '../data/genericFoodTags'
import { GENERIC_PREFIX } from '../data/searchGeneric'

/** Everything a caller provides when creating or editing a food. */
export type FoodInput = Omit<Food, keyof SyncFields | 'lastUsedAt' | 'useCount'>

export type ProfileInput = Omit<Profile, keyof SyncFields>

export interface MealInput {
  name: string
  servings: number
  note: string | null
  /** `id` is set for ingredients that already exist, so edits keep their identity. */
  items: { id?: string; foodId: string; grams: number }[]
  /** Left out on an update: the stored value is kept. Left out on create: none. */
  slots?: Slot[]
  addedTagIds?: string[]
  removedTagIds?: string[]
}

export interface MealEntryPlate {
  plate: LoggedMealItem[]
  /** Servings the recipe made when the entry was logged (the saved meal's servings now, for old entries). */
  recipeServings: number
  /** Built from the saved meal as it is now, because the entry predates plates. */
  rebuilt: boolean
  /** Rebuilt, and its total differs from what the entry stored. */
  differsFromStored: boolean
  savedMealExists: boolean
}

export interface MealDetail {
  meal: Meal
  items: (MealItem & { food: Food | undefined })[]
  total: Macros
  perServing: Macros
  /** Meal types; [] for meals stored before tags existed. */
  slots: Slot[]
  /** Live ingredient tags, computed from the ingredients and the hand-made changes, in vocabulary order. */
  tagIds: string[]
}

/** A tag or group name is already used (compared ignoring case, diacritics and spaces). */
export class TagNameTakenError extends Error {
  existingId: string
  constructor(existingId: string) {
    super('That name is already used.')
    this.name = 'TagNameTakenError'
    this.existingId = existingId
  }
}

const BUILTIN_IDS = new Set([...BUILTIN_TAGS.map((t) => t.id), ...BUILTIN_GROUPS.map((g) => g.id)])

function assertCustom(id: string): void {
  if (BUILTIN_IDS.has(id)) throw new Error('Built-in tags and groups cannot be changed.')
}

/** A food's tags; a basic food saved before tags existed (no `tagIds`) has its bundled ones. */
function storedOrBundledTags(f: Food): string[] {
  if (f.tagIds !== undefined) return f.tagIds
  if (!f.externalId?.startsWith(GENERIC_PREFIX)) return []
  return GENERIC_FOOD_TAGS[f.externalId.slice(GENERIC_PREFIX.length)] ?? []
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new Error('A name is required.')
  return trimmed
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

/** A saved meal's ingredients as plate sources, skipping rows whose food is missing. */
function recipeRows(detail: MealDetail) {
  return detail.items.flatMap((i) =>
    i.food
      ? [{ mealItemId: i.id, foodId: i.foodId, name: i.food.name, basis: i.food.basis, per100: i.food.per100, grams: i.grams }]
      : [],
  )
}

export function createRepo(db: AppDB = defaultDb) {
  async function loadMeal(id: string, vocab: Vocabulary): Promise<MealDetail | undefined> {
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
    const ingredientTags = items.map((i) => liveTagIds(vocab, i.food?.tagIds))
    const tags = effectiveMealTags(ingredientTags, {
      addedTagIds: meal.addedTagIds ?? [],
      removedTagIds: meal.removedTagIds ?? [],
    })
    return {
      meal,
      items,
      total: mealTotal(ingredients),
      perServing: mealPerServing(ingredients, meal.servings),
      slots: meal.slots ?? [],
      tagIds: liveTagIds(vocab, tags),
    }
  }

  async function nextGroupOrder(): Promise<number> {
    const groups = await db.tagGroups.filter((g) => g.deletedAt === null).toArray()
    return groups.reduce((max, g) => Math.max(max, g.sortOrder), 0) + 1
  }

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

    /** Log `servings` portions of a saved meal. The plate snapshot comes from the ingredients as they are now. */
    async logMeal(params: { mealId: string; servings: number; date: string; slot: Slot }): Promise<LogEntry> {
      const detail = await this.getMeal(params.mealId)
      if (!detail) throw new Error('Meal not found')
      const items = plateFromMeal(recipeRows(detail), detail.meal.servings, params.servings)
      const entry: LogEntry = {
        ...fresh(),
        ...plateMacros(items),
        date: params.date,
        slot: params.slot,
        foodId: null,
        mealId: detail.meal.id,
        grams: null,
        unit: 'g',
        servings: params.servings,
        label: detail.meal.name,
        loggedAt: Date.now(),
        items,
        recipeServings: detail.meal.servings,
      }
      await db.logEntries.add(entry)
      return entry
    },

    /**
     * The plate of a logged meal. Entries logged before plates existed get one rebuilt from
     * the saved meal as it is now (nothing is written). Null when that isn't possible: an old
     * entry whose saved meal has been deleted.
     */
    async mealEntryPlate(entryId: string): Promise<MealEntryPlate | null> {
      const entry = await db.logEntries.get(entryId)
      if (!entry || !entry.mealId) return null
      const detail = await this.getMeal(entry.mealId)
      const servingsLogged = entry.servings ?? 1
      if (entry.items) {
        return {
          plate: entry.items,
          recipeServings: entry.recipeServings ?? detail?.meal.servings ?? servingsLogged,
          rebuilt: false,
          differsFromStored: false,
          savedMealExists: !!detail,
        }
      }
      if (!detail) return null
      const plate = plateFromMeal(recipeRows(detail), detail.meal.servings, servingsLogged)
      return {
        plate,
        recipeServings: detail.meal.servings,
        rebuilt: true,
        differsFromStored: Math.abs(plateMacros(plate).kcal - entry.kcal) > 0.5,
        savedMealExists: true,
      }
    },

    /**
     * Change a logged meal's slot and, when `plate` differs from the stored one, what is on
     * its plate. With `updateSavedMeal`, the plate changes are also carried over to the saved
     * meal, scaled up to the whole recipe. Other entries never change.
     */
    async updateMealEntry(
      id: string,
      changes: { slot: Slot; plate?: LoggedMealItem[]; updateSavedMeal?: boolean },
    ): Promise<void> {
      await db.transaction('rw', [db.logEntries, db.meals, db.mealItems, db.foods, db.tags, db.tagGroups], async () => {
        const entry = await db.logEntries.get(id)
        if (!entry) return
        const current = changes.plate ? await this.mealEntryPlate(id) : null
        if (!changes.plate || !current || !plateChanged(current.plate, changes.plate)) {
          await db.logEntries.update(id, { slot: changes.slot, ...touch() })
          return
        }
        let plate = changes.plate
        const detail = changes.updateSavedMeal && entry.mealId ? await this.getMeal(entry.mealId) : undefined
        if (detail) {
          const saved = detail.items.map((i) => ({ id: i.id, foodId: i.foodId, grams: i.grams }))
          const factor = scaleFactor(current.recipeServings, entry.servings ?? 1)
          const result = savedMealFromPlate(saved, current.plate, plate, factor)
          await this.saveMeal(
            { name: detail.meal.name, servings: detail.meal.servings, note: detail.meal.note, items: result.items },
            detail.meal.id,
          )
          plate = result.plate
        }
        await db.logEntries.update(id, {
          ...plateMacros(plate),
          items: plate,
          recipeServings: current.recipeServings,
          plateEdited: true,
          slot: changes.slot,
          ...touch(),
        })
      })
    },

    // ---- meals ----------------------------------------------------------

    async saveMeal(input: MealInput, id?: string): Promise<string> {
      return db.transaction('rw', db.meals, db.mealItems, async () => {
        let mealId = id
        if (mealId) {
          await db.meals.update(mealId, {
            name: input.name,
            servings: input.servings,
            note: input.note,
            ...(input.slots && { slots: input.slots }),
            ...(input.addedTagIds && { addedTagIds: input.addedTagIds }),
            ...(input.removedTagIds && { removedTagIds: input.removedTagIds }),
            ...touch(),
          })
        } else {
          const meal: Meal = {
            ...fresh(),
            name: input.name,
            servings: input.servings,
            note: input.note,
            slots: input.slots ?? [],
            addedTagIds: input.addedTagIds ?? [],
            removedTagIds: input.removedTagIds ?? [],
          }
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
              // A caller-chosen id for a new row (a logged meal's plate links to it).
              ...(item.id && { id: item.id }),
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
      return loadMeal(id, await this.vocabulary())
    },

    /** Live meals, most recently logged first, then alphabetically. */
    async listMeals(): Promise<MealDetail[]> {
      const meals = await db.meals.filter((m) => m.deletedAt === null).toArray()
      const vocab = await this.vocabulary()
      const details = (await Promise.all(meals.map((m) => loadMeal(m.id, vocab)))).filter(
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

    /** Live log entries with a date from `from` to `to`, both included. */
    async entriesInRange(from: string, to: string): Promise<LogEntry[]> {
      return db.logEntries
        .where('date')
        .between(from, to, true, true)
        .filter((e) => e.deletedAt === null)
        .toArray()
    },

    /** The days between `from` and `to` that have at least one entry. */
    async datesWithEntries(from: string, to: string): Promise<Set<string>> {
      const rows = await this.entriesInRange(from, to)
      return new Set(rows.map((e) => e.date))
    },

    // ---- tags -----------------------------------------------------------

    /** Built-in tags merged with the owner's own live tags and groups. */
    async vocabulary(): Promise<Vocabulary> {
      const [tags, groups] = await Promise.all([db.tags.toArray(), db.tagGroups.toArray()])
      return buildVocabulary(tags, groups)
    },

    /**
     * Live foods carrying the tag, most used first, then by name. A basic food saved before tags
     * existed (no `tagIds` at all) counts with its bundled tags, so the "Choose" list still offers it.
     */
    async foodsWithTag(tagId: string): Promise<Food[]> {
      if (!(await this.vocabulary()).byId.has(tagId)) return []
      const all = await db.foods.filter((f) => f.deletedAt === null && storedOrBundledTags(f).includes(tagId)).toArray()
      return all.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name))
    },

    /** Give a food a tag it lacks (the owner picked it for a "Choose {tag}" row). */
    /** Returns the food as stored afterwards. */
    async addTagToFood(foodId: string, tagId: string): Promise<Food | undefined> {
      const food = await db.foods.get(foodId)
      if (!food) return undefined
      const current = storedOrBundledTags(food)
      if (food.tagIds !== undefined && current.includes(tagId)) return food
      await db.foods.update(foodId, { tagIds: current.includes(tagId) ? current : [...current, tagId], ...touch() })
      return db.foods.get(foodId)
    },

    async createTag(name: string, groupId: string): Promise<Tag> {
      const clean = cleanName(name)
      const taken = findTagByName(await this.vocabulary(), clean)
      if (taken) throw new TagNameTakenError(taken.id)
      const tag: Tag = { ...fresh(), name: clean, groupId }
      await db.tags.add(tag)
      return tag
    },

    async renameTag(id: string, name: string): Promise<void> {
      assertCustom(id)
      const clean = cleanName(name)
      const taken = findTagByName(await this.vocabulary(), clean, id)
      if (taken) throw new TagNameTakenError(taken.id)
      await db.tags.update(id, { name: clean, ...touch() })
    },

    /** Soft delete. Meals and foods keep the stale id, which is ignored wherever tags are read. */
    async deleteTag(id: string): Promise<void> {
      assertCustom(id)
      await db.tags.update(id, { deletedAt: Date.now(), ...touch() })
    },

    async createTagGroup(name: string): Promise<TagGroup> {
      const clean = cleanName(name)
      const taken = findGroupByName(await this.vocabulary(), clean)
      if (taken) throw new TagNameTakenError(taken.id)
      const group: TagGroup = { ...fresh(), name: clean, sortOrder: await nextGroupOrder() }
      await db.tagGroups.add(group)
      return group
    },

    async renameTagGroup(id: string, name: string): Promise<void> {
      assertCustom(id)
      const clean = cleanName(name)
      const taken = findGroupByName(await this.vocabulary(), clean, id)
      if (taken) throw new TagNameTakenError(taken.id)
      await db.tagGroups.update(id, { name: clean, ...touch() })
    },

    /** Move the group's live tags to `moveTagsTo`, then soft-delete the group. */
    async deleteTagGroup(id: string, moveTagsTo: string): Promise<void> {
      assertCustom(id)
      if (moveTagsTo === id) throw new Error('Choose another group for its tags.')
      await db.transaction('rw', db.tags, db.tagGroups, async () => {
        await db.tags
          .filter((t) => t.groupId === id && t.deletedAt === null)
          .modify({ groupId: moveTagsTo, ...touch() })
        await db.tagGroups.update(id, { deletedAt: Date.now(), ...touch() })
      })
    },

    // ---- backup ---------------------------------------------------------

    /** Every table as plain JSON, including soft-deleted rows. */
    async exportAll() {
      const [foods, logEntries, meals, mealItems, profile, weightEntries, waterEntries, tags, tagGroups] = await Promise.all([
        db.foods.toArray(),
        db.logEntries.toArray(),
        db.meals.toArray(),
        db.mealItems.toArray(),
        db.profile.toArray(),
        db.weightEntries.toArray(),
        db.waterEntries.toArray(),
        db.tags.toArray(),
        db.tagGroups.toArray(),
      ])
      return {
        app: 'calorie-tracker',
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        tables: { foods, logEntries, meals, mealItems, profile, weightEntries, waterEntries, tags, tagGroups },
      }
    },
  }
}

export const repo = createRepo()
