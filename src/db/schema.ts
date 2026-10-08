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
}

export interface Meal extends SyncFields {
  name: string
  servings: number
  note: string | null
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

export class AppDB extends Dexie {
  foods!: EntityTable<Food, 'id'>
  logEntries!: EntityTable<LogEntry, 'id'>
  meals!: EntityTable<Meal, 'id'>
  mealItems!: EntityTable<MealItem, 'id'>
  profile!: EntityTable<Profile, 'id'>
  weightEntries!: EntityTable<WeightEntry, 'id'>
  waterEntries!: EntityTable<WaterEntry, 'id'>

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
  }
}

export const db = new AppDB()
