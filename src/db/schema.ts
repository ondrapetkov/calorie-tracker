import type { LoggedMealItem } from '../domain/loggedMeal'
import Dexie, { type EntityTable } from 'dexie'
import type { FoodSource, Macros, Slot } from '../domain/nutrition'

/** Fields every synced row carries (see docs/DESIGN.md section 4.1). */
export interface SyncFields {
  id: string
  updatedAt: number
  deletedAt: number | null
  /** 1 when the row has local changes not yet pushed. Local only. */
  dirty: 0 | 1
}

export interface Food extends SyncFields {
  source: FoodSource
  /** Barcode (Open Food Facts) or FDC id (USDA); null for custom foods without a barcode. */
  externalId: string | null
  name: string
  brand: string | null
  /** Whether the nutrition values are per 100 g or per 100 ml. */
  basis: 'g' | 'ml'
  per100: Macros
  defaultServingG: number | null
  defaultServingLabel: string | null
  lastUsedAt: number | null
  useCount: number
  /** Ingredient tag ids. Missing on rows from before tags existed: read as none. */
  tagIds?: string[]
}

export interface LogEntry extends SyncFields, Macros {
  /** Local calendar day, YYYY-MM-DD. */
  date: string
  slot: Slot
  foodId: string | null
  mealId: string | null
  /** Amount eaten in g or ml (for a food); `unit` says which. */
  grams: number | null
  unit: 'g' | 'ml'
  /** Portions eaten (for a meal). */
  servings: number | null
  /** Display name snapshot, so the diary still reads correctly if the food is deleted. */
  label: string
  loggedAt: number
  /**
   * For a meal: what is on the plate, ingredient by ingredient, with its own nutrition.
   * The entry's macros are the sum of these rows. Missing on entries logged before plates existed.
   */
  items?: LoggedMealItem[]
  /** For a meal: how many servings the recipe made when this was logged. Missing on old entries. */
  recipeServings?: number
  /** For a meal: true once its plate has been edited from the diary. */
  plateEdited?: boolean
}

export interface Meal extends SyncFields {
  name: string
  servings: number
  note: string | null
  /** Meal types (diary slots) the meal is tagged with. Missing on old rows: read as none. */
  slots?: Slot[]
  /**
   * Hand-made changes to the meal's ingredient tags. The tags themselves are computed from the
   * ingredients each time (see domain/mealTags.ts). Missing on old rows: read as none.
   */
  addedTagIds?: string[]
  removedTagIds?: string[]
}

export interface MealItem extends SyncFields {
  mealId: string
  foodId: string
  grams: number
  sortOrder: number
}

export interface Profile extends SyncFields {
  sex: 'male' | 'female'
  birthDate: string
  heightCm: number
  activityFactor: number
  goal: 'cut' | 'maintain' | 'bulk'
  calorieOffset: number
  proteinPerKg: number
  fatPerKg: number
  waterGoalMl: number
  waterPresets: { label: string; ml: number }[]
}

export interface WeightEntry extends SyncFields {
  date: string
  kg: number
  measuredAt: number
}

export interface WaterEntry extends SyncFields {
  date: string
  ml: number
  loggedAt: number
}

/** A tag the owner created. Built-in tags live in code (data/builtinTags.ts) and are never stored. */
export interface Tag extends SyncFields {
  name: string
  /** A built-in group id (e.g. 'dairy') or the id of a custom TagGroup. */
  groupId: string
}

/** A tag group the owner created. */
export interface TagGroup extends SyncFields {
  name: string
  sortOrder: number
}

/** Small key-value store for device-local sync state (cursor, last sync time, signed-in user). */
export interface SyncMeta {
  key: string
  value: unknown
}

export class AppDB extends Dexie {
  foods!: EntityTable<Food, 'id'>
  logEntries!: EntityTable<LogEntry, 'id'>
  meals!: EntityTable<Meal, 'id'>
  mealItems!: EntityTable<MealItem, 'id'>
  profile!: EntityTable<Profile, 'id'>
  weightEntries!: EntityTable<WeightEntry, 'id'>
  waterEntries!: EntityTable<WaterEntry, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'key'>
  tags!: EntityTable<Tag, 'id'>
  tagGroups!: EntityTable<TagGroup, 'id'>

  constructor(name = 'calorie-tracker') {
    super(name)
    // All tables from the design are declared up front so later milestones
    // do not need a migration just to add a table.
    this.version(1).stores({
      foods: 'id, externalId, name, lastUsedAt, updatedAt, dirty',
      logEntries: 'id, date, [date+slot], updatedAt, dirty',
      meals: 'id, updatedAt, dirty',
      mealItems: 'id, mealId, updatedAt, dirty',
      profile: 'id, updatedAt, dirty',
      weightEntries: 'id, date, updatedAt, dirty',
      waterEntries: 'id, date, updatedAt, dirty',
    })
    // v2: device-local sync state. Kept in IndexedDB (not localStorage) so it is wiped together with
    // the data it describes; a cursor that outlived its data would hide rows forever.
    this.version(2).stores({ syncMeta: 'key' })
    // v3: the owner's own tags and tag groups. New fields on foods and meals need no migration;
    // rows without them read as untagged.
    this.version(3).stores({ tags: 'id, updatedAt, dirty', tagGroups: 'id, updatedAt, dirty' })
  }
}

export const db = new AppDB()
