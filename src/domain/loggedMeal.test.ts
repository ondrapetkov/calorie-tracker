import { describe, expect, it } from 'vitest'
import {
  plateChanged,
  plateFromMeal,
  plateMacros,
  savedMealFromPlate,
  scaleFactor,
  type LoggedMealItem,
  type SavedMealRow,
} from './loggedMeal'
import { mealTotal } from './meals'
import type { Macros } from './nutrition'

const rice: Macros = { kcal: 365, protein: 7.1, carbs: 80, fat: 0.7, fiber: 1.3, sugar: 0.1, salt: null }
const chicken: Macros = { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, salt: 0.12 }
const oil: Macros = { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: null, sugar: null, salt: null }

const recipe = [
  { mealItemId: 'mi-rice', foodId: 'f-rice', name: 'Rice', basis: 'g' as const, per100: rice, grams: 600 },
  { mealItemId: 'mi-chicken', foodId: 'f-chicken', name: 'Chicken', basis: 'g' as const, per100: chicken, grams: 400 },
]

const saved: SavedMealRow[] = [
  { id: 'mi-rice', foodId: 'f-rice', grams: 600 },
  { id: 'mi-chicken', foodId: 'f-chicken', grams: 400 },
]

function row(overrides: Partial<LoggedMealItem>): LoggedMealItem {
  return {
    id: crypto.randomUUID(),
    mealItemId: null,
    foodId: 'f-x',
    name: 'X',
    basis: 'g',
    per100: chicken,
    grams: 100,
    ...overrides,
  }
}

const withGrams = (plate: LoggedMealItem[], id: string, grams: number) =>
  plate.map((r) => (r.mealItemId === id ? { ...r, grams } : r))

describe('plateFromMeal', () => {
  it('scales the recipe to the servings logged', () => {
    const plate = plateFromMeal(recipe, 4, 1)
    expect(plate.map((r) => r.grams)).toEqual([150, 100])
    expect(plateFromMeal(recipe, 4, 4).map((r) => r.grams)).toEqual([600, 400])
  })

  it('gives each row a unique id and keeps the saved-meal item id', () => {
    const plate = plateFromMeal(recipe, 4, 1)
    expect(new Set(plate.map((r) => r.id)).size).toBe(2)
    expect(plate.map((r) => r.mealItemId)).toEqual(['mi-rice', 'mi-chicken'])
    expect(plate[0]).toMatchObject({ foodId: 'f-rice', name: 'Rice', basis: 'g', per100: rice })
  })
})

describe('plateMacros', () => {
  it('equals the meal total of the same rows', () => {
    const plate = plateFromMeal(recipe, 4, 1)
    expect(plateMacros(plate)).toEqual(mealTotal(plate))
  })

  it('keeps fiber null when no row has fiber', () => {
    expect(plateMacros([row({ per100: oil, grams: 10 })]).fiber).toBeNull()
  })
})

describe('plateChanged', () => {
  const before = plateFromMeal(recipe, 4, 1)

  it('is false for an identical copy', () => {
    expect(plateChanged(before, before.map((r) => ({ ...r })))).toBe(false)
  })

  it('is true when an amount changes, a row is removed or a row is added', () => {
    expect(plateChanged(before, withGrams(before, 'mi-rice', 200))).toBe(true)
    expect(plateChanged(before, before.slice(1))).toBe(true)
    expect(plateChanged(before, [...before, row({})])).toBe(true)
  })
})

describe('scaleFactor', () => {
  it('is recipe servings over servings logged', () => {
    expect(scaleFactor(4, 1)).toBe(4)
    expect(scaleFactor(4, 2)).toBe(2)
    expect(scaleFactor(4, 4)).toBe(1)
  })
})

describe('savedMealFromPlate', () => {
  const before = plateFromMeal(recipe, 4, 1)

  it('scales a plate change up to the whole recipe (owner example)', () => {
    const { items } = savedMealFromPlate(saved, before, withGrams(before, 'mi-rice', 200), 4)
    expect(items).toEqual([
      { id: 'mi-rice', foodId: 'f-rice', grams: 800 },
      { id: 'mi-chicken', foodId: 'f-chicken', grams: 400 },
    ])
  })

  it('rounds a fractional-servings change to 0.1 g', () => {
    const b = plateFromMeal(recipe, 4, 1.5)
    const riceBefore = b[0].grams
    const { items } = savedMealFromPlate(saved, b, withGrams(b, 'mi-rice', riceBefore + 10), scaleFactor(4, 1.5))
    expect(items[0].grams).toBe(626.7)
  })

  it('removes the saved item of a row removed from the plate', () => {
    const { items } = savedMealFromPlate(saved, before, before.slice(1), 4)
    expect(items).toEqual([{ id: 'mi-chicken', foodId: 'f-chicken', grams: 400 }])
  })

  it('appends a new plate row scaled up and links it to the new saved item', () => {
    const added = row({ foodId: 'f-oil', per100: oil, grams: 30 })
    const { items, plate } = savedMealFromPlate(saved, before, [...before, added], 4)
    expect(items).toHaveLength(3)
    expect(items[2]).toMatchObject({ foodId: 'f-oil', grams: 120 })
    expect(items[2].id).not.toBe(added.id)
    expect(plate[2].mealItemId).toBe(items[2].id)
    expect(plate[2].id).toBe(added.id)
  })

  it('adds back a changed row whose saved item is gone, at its scaled amount', () => {
    const { items } = savedMealFromPlate(saved.slice(1), before, withGrams(before, 'mi-rice', 160), 4)
    expect(items).toHaveLength(2)
    expect(items[1]).toMatchObject({ foodId: 'f-rice', grams: 640 })
  })

  it('removes an item whose scaled amount reaches zero or below', () => {
    const smallSaved = [{ id: 'mi-rice', foodId: 'f-rice', grams: 100 }, saved[1]]
    const { items } = savedMealFromPlate(smallSaved, before, withGrams(before, 'mi-rice', 100), 4)
    expect(items).toEqual([{ id: 'mi-chicken', foodId: 'f-chicken', grams: 400 }])
  })

  it('adds nothing for an unchanged plate-only row kept from an earlier "just this entry" edit', () => {
    const extra = row({ foodId: 'f-oil', per100: oil, grams: 30 })
    const b = [...before, extra]
    const { items } = savedMealFromPlate(saved, b, withGrams(b, 'mi-rice', 200), 4)
    expect(items.map((i) => i.foodId)).toEqual(['f-rice', 'f-chicken'])
  })

  it('leaves out an unchanged row whose saved item is gone', () => {
    const { items } = savedMealFromPlate(saved.slice(1), before, before, 4)
    expect(items).toEqual([{ id: 'mi-chicken', foodId: 'f-chicken', grams: 400 }])
  })
})
