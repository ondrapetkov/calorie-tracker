import { multiplyMacros, scaleMacros, sumMacros, type Macros } from './nutrition'

export interface MealIngredient {
  per100: Macros
  grams: number
}

function toMacros(t: ReturnType<typeof sumMacros>): Macros {
  // A meal is only "unknown" for fiber/sugar/salt when no ingredient has a value at all;
  // otherwise the known part is reported (a lower bound, like the day totals).
  return {
    kcal: t.kcal,
    protein: t.protein,
    carbs: t.carbs,
    fat: t.fat,
    fiber: t.incomplete.fiber && t.fiber === 0 ? null : t.fiber,
    sugar: t.incomplete.sugar && t.sugar === 0 ? null : t.sugar,
    salt: t.incomplete.salt && t.salt === 0 ? null : t.salt,
  }
}

/** Total macros for the whole recipe. */
export function mealTotal(ingredients: MealIngredient[]): Macros {
  return toMacros(sumMacros(ingredients.map((i) => scaleMacros(i.per100, i.grams))))
}

/** Macros for one portion of a recipe that makes `servings` portions. */
export function mealPerServing(ingredients: MealIngredient[], servings: number): Macros {
  return multiplyMacros(mealTotal(ingredients), 1 / servings)
}

/** Total weight of the ingredients in grams (millilitres count as grams). */
export function mealWeight(ingredients: MealIngredient[]): number {
  return ingredients.reduce((sum, i) => sum + i.grams, 0)
}
