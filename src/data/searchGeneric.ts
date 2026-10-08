import type { FoodDraft } from '../api/openFoodFacts'
import { matchesQuery, rankScore } from '../domain/search'
import { GENERIC_FOODS, type GenericFood } from './genericFoods'

export const GENERIC_PREFIX = 'generic:'

export function genericToDraft(g: GenericFood): FoodDraft {
  return {
    source: 'generic',
    externalId: GENERIC_PREFIX + g.id,
    name: g.name,
    brand: null,
    basis: g.basis,
    per100: { ...g.per100 },
    defaultServingG: g.servingG ?? null,
    defaultServingLabel: g.servingLabel ?? null,
  }
}

/** Basic foods matching the query by name or alias, best matches first. */
export function searchGenericFoods(query: string, limit = 8): FoodDraft[] {
  return GENERIC_FOODS.filter((g) => matchesQuery(`${g.name} ${g.aliases}`, query))
    .sort((a, b) => rankScore(a.name, query) - rankScore(b.name, query) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(genericToDraft)
}
