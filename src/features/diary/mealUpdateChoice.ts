/**
 * The "Don't ask again for this meal today" answer of the update-saved-meal popup.
 * Kept on this device only (not synced), and forgotten when the day changes.
 */
export type MealUpdateChoice = 'entry' | 'meal'

const KEY = 'meal-update-choices'

interface Stored {
  savedOn: string
  choices: Record<string, MealUpdateChoice>
}

function read(store: Pick<Storage, 'getItem'>, today: string): Record<string, MealUpdateChoice> {
  try {
    const v = JSON.parse(store.getItem(KEY) ?? 'null') as Stored | null
    if (!v || typeof v !== 'object' || v.savedOn !== today || typeof v.choices !== 'object' || !v.choices) return {}
    return v.choices
  } catch {
    return {}
  }
}

export function rememberedChoice(
  store: Pick<Storage, 'getItem'>,
  mealId: string,
  date: string,
  today: string,
): MealUpdateChoice | null {
  const c = read(store, today)[`${mealId}|${date}`]
  return c === 'entry' || c === 'meal' ? c : null
}

export function rememberChoice(
  store: Pick<Storage, 'getItem' | 'setItem'>,
  mealId: string,
  date: string,
  today: string,
  choice: MealUpdateChoice,
): void {
  const choices = { ...read(store, today), [`${mealId}|${date}`]: choice }
  store.setItem(KEY, JSON.stringify({ savedOn: today, choices } satisfies Stored))
}
