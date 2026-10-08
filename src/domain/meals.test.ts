import { describe, expect, it } from 'vitest'
import { mealPerServing, mealTotal, mealWeight } from './meals'
import type { Macros } from './nutrition'

const chicken: Macros = { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, salt: 0.12 }
const rice: Macros = { kcal: 365, protein: 7.1, carbs: 80, fat: 0.7, fiber: 1.3, sugar: 0.1, salt: null }
const oil: Macros = { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: null, sugar: null, salt: null }

describe('meals', () => {
  const items = [
    { per100: chicken, grams: 300 },
    { per100: rice, grams: 200 },
    { per100: oil, grams: 10 },
  ]

  it('adds up ingredients scaled by their weight', () => {
    const t = mealTotal(items)
    expect(t.kcal).toBeCloseTo(360 + 730 + 88.4)
    expect(t.protein).toBeCloseTo(67.5 + 14.2)
    expect(t.fat).toBeCloseTo(7.8 + 1.4 + 10)
  })

  it('divides by the number of servings', () => {
    const per = mealPerServing(items, 4)
    expect(per.kcal).toBeCloseTo((360 + 730 + 88.4) / 4)
    expect(per.carbs).toBeCloseTo(40)
  })

  it('reports the known part of fiber and salt, and null when nothing is known', () => {
    const t = mealTotal(items)
    expect(t.fiber).toBeCloseTo(2.6)
    expect(t.salt).toBeCloseTo(0.36)
    expect(mealTotal([{ per100: oil, grams: 10 }]).fiber).toBeNull()
  })

  it('weighs the ingredients', () => {
    expect(mealWeight(items)).toBe(510)
  })
})
