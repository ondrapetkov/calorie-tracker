/**
 * A meal's ingredient tags follow its ingredients (spec §3.6.1):
 *
 *   meal tags = (tags of all current ingredient foods ∪ tags added by hand) − tags removed by hand
 *
 * Only the hand-made parts are stored on the meal. Callers pass live tag ids only.
 */

export interface MealTagState {
  addedTagIds: string[]
  removedTagIds: string[]
}

/** Unique, in first-seen order: ingredient tags first, then hand-added ones. */
export function effectiveMealTags(ingredientTags: string[][], state: MealTagState): string[] {
  const removed = new Set(state.removedTagIds)
  const out = new Set<string>()
  for (const tags of ingredientTags) for (const t of tags) if (!removed.has(t)) out.add(t)
  for (const t of state.addedTagIds) if (!removed.has(t)) out.add(t)
  return [...out]
}

/** Meal tags that no current ingredient carries: these get a "Choose {tag}" row. */
export function chooseRowTags(mealTags: string[], ingredientTags: string[][]): string[] {
  const carried = new Set(ingredientTags.flat())
  return mealTags.filter((t) => !carried.has(t))
}

export function addMealTag(state: MealTagState, tagId: string): MealTagState {
  return {
    addedTagIds: state.addedTagIds.includes(tagId) ? state.addedTagIds : [...state.addedTagIds, tagId],
    removedTagIds: state.removedTagIds.filter((t) => t !== tagId),
  }
}

/** A tag an ingredient carries is remembered as removed, so it stays off; a hand-added one is simply dropped. */
export function removeMealTag(state: MealTagState, tagId: string, ingredientTags: string[][]): MealTagState {
  const carried = ingredientTags.some((tags) => tags.includes(tagId))
  return {
    addedTagIds: state.addedTagIds.filter((t) => t !== tagId),
    removedTagIds:
      carried && !state.removedTagIds.includes(tagId) ? [...state.removedTagIds, tagId] : state.removedTagIds,
  }
}
