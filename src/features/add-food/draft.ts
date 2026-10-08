import type { FoodDraft } from '../../api/openFoodFacts'
import type { Food } from '../../db/schema'
import type { FoodInput } from '../../db/repo'

export type Item = Food | FoodDraft

export function isFood(item: Item): item is Food {
  return 'id' in item
}

/** Convert a draft whose core nutrients are known into a savable food. */
export function draftToInput(d: FoodDraft): FoodInput {
  const { kcal, protein, carbs, fat } = d.per100
  if (kcal === null || protein === null || carbs === null || fat === null) {
    throw new Error('Draft is missing core nutrients')
  }
  return {
    source: d.source,
    externalId: d.externalId,
    name: d.name,
    brand: d.brand,
    basis: d.basis,
    per100: { ...d.per100, kcal, protein, carbs, fat },
    defaultServingG: d.defaultServingG,
    defaultServingLabel: d.defaultServingLabel,
  }
}
