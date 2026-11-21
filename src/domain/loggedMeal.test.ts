import { describe, expect, it } from 'vitest'
import {
  canSaveSlotAsMeal,
  plateChanged,
  plateFromFoodEntries,
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

describe('plate from food entries', () => {
  const ids = () => {
    let n = 0
    return () => `id-${++n}`
  }
  const m = (kcal: number): Macros => ({ kcal, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null, salt: null })

  it('builds a plate from food entries using their own snapshot', () => {
    const plate = plateFromFoodEntries(
      [
        { ...m(180), foodId: 'f-chicken', grams: 150, unit: 'g', label: 'Chicken' },
        { ...m(84), foodId: 'f-milk', grams: 200, unit: 'ml', label: 'Milk' },
      ],
      ids(),
    )
    expect(plate.map((r) => [r.id, r.mealItemId, r.foodId, r.name, r.basis, r.grams])).toEqual([
      ['id-1', 'id-1', 'f-chicken', 'Chicken', 'g', 150],
      ['id-2', 'id-2', 'f-milk', 'Milk', 'ml', 200],
    ])
    expect(plate[0].per100.kcal).toBeCloseTo(120)
    expect(plate[1].per100.kcal).toBeCloseTo(42)
    expect(plateMacros(plate).kcal).toBeCloseTo(264)
  })

  it("uses the entry's macros as per-100 for a zero amount", () => {
    const [row] = plateFromFoodEntries([{ ...m(50), foodId: 'f', grams: 0, unit: 'g', label: 'X' }], ids())
    expect(row.per100.kcal).toBe(50)
  })

  it('offers saving a slot only for two or more live foods and no meals', () => {
    const live = new Set(['a', 'b'])
    const food = (id: string) => ({ foodId: id, mealId: null })
    expect(canSaveSlotAsMeal([food('a')], live)).toBe(false)
    expect(canSaveSlotAsMeal([food('a'), food('b')], live)).toBe(true)
    expect(canSaveSlotAsMeal([food('a'), { foodId: null, mealId: 'meal' }], live)).toBe(false)
    expect(canSaveSlotAsMeal([food('a'), food('gone')], live)).toBe(false)
    // A one-off with no food behind it (an AI estimate) is left out, not a blocker.
    const oneOff = { foodId: null, mealId: null }
    expect(canSaveSlotAsMeal([food('a'), food('b'), oneOff], live)).toBe(true)
    expect(canSaveSlotAsMeal([food('a'), oneOff], live)).toBe(false)
  })
})

describe('servings on plates', () => {
  const slice = { grams: 25, label: '1 slice' }
  const bread = { kcal: 250, protein: 8, carbs: 48, fat: 3, fiber: null, sugar: null, salt: null }
  const row = (over: Partial<LoggedMealItem> = {}): LoggedMealItem => ({
    id: 'r1', mealItemId: 'mi-bread', foodId: 'f-bread', name: 'Bread', basis: 'g', per100: bread, grams: 100, serving: slice, ...over,
  })

  it('copies a recipe row\'s serving onto the plate, scaled', () => {
    const [r] = plateFromMeal([{ mealItemId: 'mi-bread', foodId: 'f-bread', name: 'Bread', basis: 'g', per100: bread, grams: 100, serving: slice }], 2, 1)
    expect(r.grams).toBe(50)
    expect(r.serving).toEqual(slice)
  })

  it('copies an entry\'s serving when building a plate from food entries', () => {
    const [r] = plateFromFoodEntries([{ ...bread, foodId: 'f', grams: 100, unit: 'g', label: 'Bread', serving: slice }], () => 'x')
    expect(r.serving).toEqual(slice)
  })

  it('sees a change of serving alone as a change', () => {
    expect(plateChanged([row()], [row({ serving: undefined })])).toBe(true)
    expect(plateChanged([row()], [row({ serving: { ...slice } })])).toBe(false)
  })

  it('carries a row\'s serving over to the saved meal', () => {
    const saved: SavedMealRow[] = [{ id: 'mi-bread', foodId: 'f-bread', grams: 100 }]
    const before = [row({ serving: undefined })]
    const after = [row(), row({ id: 'r2', mealItemId: null, foodId: 'f-new', grams: 50 })]
    const { items } = savedMealFromPlate(saved, before, after, 1)
    expect(items[0]).toMatchObject({ id: 'mi-bread', grams: 100, serving: slice })
    expect(items[1]).toMatchObject({ foodId: 'f-new', grams: 50, serving: slice })
  })
})
