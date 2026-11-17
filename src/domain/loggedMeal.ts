import { mealTotal } from './meals'
import { multiplyMacros, type Macros } from './nutrition'
import { sameServing, type Serving } from './servings'

/** One ingredient on the plate of a logged meal: a snapshot that keeps its own nutrition. */
export interface LoggedMealItem {
  /** Stable row id within the plate. */
  id: string
  /** The saved-meal item this row maps to; null for rows added on the plate and not yet carried over. */
  mealItemId: string | null
  foodId: string
  name: string
  basis: 'g' | 'ml'
  per100: Macros
  /** Amount on the plate, in g or ml. */
  grams: number
  /** Set when the amount is shown and edited in servings of this size. */
  serving?: Serving
}

/** A saved meal's ingredient, as far as plate edits are concerned. */
export interface SavedMealRow {
  id: string
  foodId: string
  grams: number
  serving?: Serving
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** The plate for `servingsLogged` portions of a recipe that makes `recipeServings`. */
export function plateFromMeal(
  items: {
    mealItemId: string
    foodId: string
    name: string
    basis: 'g' | 'ml'
    per100: Macros
    grams: number
    serving?: Serving
  }[],
  recipeServings: number,
  servingsLogged: number,
): LoggedMealItem[] {
  // Row ids are the saved-meal item ids, so rebuilding the plate of an old entry twice
  // gives the same rows (plate edits are matched to the plate they were made on by id).
  return items.map((i) => ({
    id: i.mealItemId,
    mealItemId: i.mealItemId,
    foodId: i.foodId,
    name: i.name,
    basis: i.basis,
    per100: i.per100,
    grams: (i.grams * servingsLogged) / recipeServings,
    ...(i.serving && { serving: i.serving }),
  }))
}

/** A logged food, as far as saving it into a meal is concerned. */
export type FoodEntryLike = Macros & {
  foodId: string | null
  grams: number | null
  unit: 'g' | 'ml'
  label: string
  serving?: Serving
}

/**
 * The plate for a meal made from logged foods, one row per entry at its logged amount. Nutrition
 * comes from each entry's own snapshot, so the plate adds up to exactly what was logged.
 * `newId` gives each row the id of the saved-meal item it will become.
 */
export function plateFromFoodEntries(entries: FoodEntryLike[], newId: () => string): LoggedMealItem[] {
  return entries.map((e) => {
    const grams = e.grams ?? 0
    const id = newId()
    return {
      id,
      mealItemId: id,
      foodId: e.foodId ?? '',
      name: e.label,
      basis: e.unit,
      // Same rule as editing a food entry: with no amount, the entry's macros stand in for per-100.
      per100: multiplyMacros(e, grams > 0 ? 100 / grams : 1),
      grams,
      ...(e.serving && { serving: e.serving }),
    }
  })
}

/** Whether a diary slot's rows can be saved as one meal: two or more foods that still exist, and no meals. */
export function canSaveSlotAsMeal(
  rows: { foodId: string | null; mealId: string | null }[],
  liveFoodIds: Set<string>,
): boolean {
  return rows.length >= 2 && rows.every((r) => r.mealId === null && r.foodId !== null && liveFoodIds.has(r.foodId))
}

/** What the plate adds up to. */
export function plateMacros(plate: LoggedMealItem[]): Macros {
  return mealTotal(plate)
}

/** True when a row was added, removed, or its amount changed. */
export function plateChanged(before: LoggedMealItem[], after: LoggedMealItem[]): boolean {
  if (before.length !== after.length) return true
  const byId = new Map(before.map((r) => [r.id, r]))
  return after.some((r) => {
    const b = byId.get(r.id)
    return !b || b.grams !== r.grams || b.foodId !== r.foodId || !sameServing(b.serving, r.serving)
  })
}

/** How much a plate change is multiplied by to carry it over to the whole recipe. */
export function scaleFactor(recipeServings: number, servingsLogged: number): number {
  return recipeServings / servingsLogged
}

/**
 * Carry plate edits over to the saved meal, scaled up by `factor`. Returns the new
 * ingredient list (saved order, new rows appended) and `after` with rows that were
 * carried over as new items linked to them.
 */
export function savedMealFromPlate(
  saved: SavedMealRow[],
  before: LoggedMealItem[],
  after: LoggedMealItem[],
  factor: number,
): { items: SavedMealRow[]; plate: LoggedMealItem[] } {
  const afterById = new Map(after.map((r) => [r.id, r]))
  const beforeById = new Map(before.map((r) => [r.id, r]))
  const savedIds = new Set(saved.map((s) => s.id))

  // Saved items changed or removed via a plate row mapped to them.
  const delta = new Map<string, number>()
  const removed = new Set<string>()
  /** Saved items whose plate row switched between servings and grams (or to another serving). */
  const servingOf = new Map<string, Serving | undefined>()
  for (const b of before) {
    if (!b.mealItemId) continue
    const a = afterById.get(b.id)
    if (!a) removed.add(b.mealItemId)
    else {
      if (a.grams !== b.grams) delta.set(b.mealItemId, (delta.get(b.mealItemId) ?? 0) + (a.grams - b.grams) * factor)
      if (a.grams !== b.grams || !sameServing(a.serving, b.serving)) servingOf.set(b.mealItemId, a.serving)
    }
  }

  const items: SavedMealRow[] = []
  for (const s of saved) {
    if (removed.has(s.id)) continue
    const grams = round1(s.grams + (delta.get(s.id) ?? 0))
    if (grams <= 0) continue
    if (!servingOf.has(s.id)) {
      items.push(grams === s.grams ? s : { ...s, grams })
      continue
    }
    const { serving: _old, ...rest } = s
    const serving = servingOf.get(s.id)
    items.push({ ...rest, grams, ...(serving && { serving }) })
  }

  const plate = after.map((a) => {
    const b = beforeById.get(a.id)
    // New on the plate, or changed while it has no saved item to change (never carried
    // over, or removed from the saved meal since): add it. Unchanged rows add nothing.
    const changed = !b || b.grams !== a.grams
    const hasSaved = !!a.mealItemId && savedIds.has(a.mealItemId)
    if (!changed || hasSaved) return a
    const grams = round1(a.grams * factor)
    if (grams <= 0) return { ...a, mealItemId: null }
    const id = crypto.randomUUID()
    items.push({ id, foodId: a.foodId, grams, ...(a.serving && { serving: a.serving }) })
    return { ...a, mealItemId: id }
  })

  return { items, plate }
}
