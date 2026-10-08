export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Slot = (typeof SLOTS)[number]

export type FoodSource = 'off' | 'usda' | 'generic' | 'custom'

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

/**
 * Nutrition values. Used both per 100 g/ml (on a food) and as the amount a log
 * entry contributed (the snapshot). Fiber, sugar and salt are null when unknown,
 * which is different from zero.
 */
export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugar: number | null
  salt: number | null
}

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  salt: number
  /** True when at least one entry had no value, so the total is a lower bound. */
  incomplete: { fiber: boolean; sugar: boolean; salt: boolean }
}

const scaleOpt = (v: number | null, factor: number) => (v === null ? null : v * factor)

/** Macros for `amount` grams (or ml) of a food whose values are given per 100. */
export function scaleMacros(per100: Macros, amount: number): Macros {
  return multiplyMacros(per100, amount / 100)
}

/** Multiply every value by `factor`. Used to rescale an existing snapshot. */
export function multiplyMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: scaleOpt(m.fiber, factor),
    sugar: scaleOpt(m.sugar, factor),
    salt: scaleOpt(m.salt, factor),
  }
}

export function sumMacros(items: Macros[]): Totals {
  const t: Totals = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    salt: 0,
    incomplete: { fiber: false, sugar: false, salt: false },
  }
  for (const m of items) {
    t.kcal += m.kcal
    t.protein += m.protein
    t.carbs += m.carbs
    t.fat += m.fat
    for (const k of ['fiber', 'sugar', 'salt'] as const) {
      const v = m[k]
      if (v === null) t.incomplete[k] = true
      else t[k] += v
    }
  }
  return t
}

/** Energy implied by the macros using 4/4/9 kcal per gram. */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return 4 * protein + 4 * carbs + 9 * fat
}

/** Pick a sensible meal slot for the time of day. */
export function defaultSlot(hour: number): Slot {
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 17) return 'snack'
  if (hour < 21) return 'dinner'
  return 'snack'
}
