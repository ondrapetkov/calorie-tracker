import { mealTotal } from './meals'
import type { Macros } from './nutrition'

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
}

/** A saved meal's ingredient, as far as plate edits are concerned. */
export interface SavedMealRow {
  id: string
  foodId: string
  grams: number
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** The plate for `servingsLogged` portions of a recipe that makes `recipeServings`. */
export function plateFromMeal(
  items: { mealItemId: string; foodId: string; name: string; basis: 'g' | 'ml'; per100: Macros; grams: number }[],
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
  }))
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
    return !b || b.grams !== r.grams || b.foodId !== r.foodId
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
  for (const b of before) {
    if (!b.mealItemId) continue
    const a = afterById.get(b.id)
    if (!a) removed.add(b.mealItemId)
    else if (a.grams !== b.grams) delta.set(b.mealItemId, (delta.get(b.mealItemId) ?? 0) + (a.grams - b.grams) * factor)
  }

  const items: SavedMealRow[] = []
  for (const s of saved) {
    if (removed.has(s.id)) continue
    const grams = round1(s.grams + (delta.get(s.id) ?? 0))
    if (grams <= 0) continue
    items.push(grams === s.grams ? s : { ...s, grams })
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
    items.push({ id, foodId: a.foodId, grams })
    return { ...a, mealItemId: id }
  })

  return { items, plate }
}
