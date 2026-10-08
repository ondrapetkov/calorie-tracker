import { describe, expect, it } from 'vitest'
import { hasCoreNutrients, parseNutriments, productToDraft } from './openFoodFacts'

describe('parseNutriments', () => {
  it('reads per-100 values and accepts numeric strings', () => {
    const p = parseNutriments({
      'energy-kcal_100g': 360,
      proteins_100g: '13',
      carbohydrates_100g: 70.2,
      fat_100g: 2,
      fiber_100g: 3,
    })
    expect(p).toMatchObject({ kcal: 360, protein: 13, carbs: 70.2, fat: 2, fiber: 3, sugar: null, salt: null })
  })

  it('falls back to kJ when kcal is missing', () => {
    expect(parseNutriments({ 'energy-kj_100g': 1506 }).kcal).toBeCloseTo(359.9, 0)
  })

  it('ignores junk values', () => {
    expect(parseNutriments({ proteins_100g: 'n/a', fat_100g: NaN }).protein).toBeNull()
  })
})

describe('productToDraft', () => {
  it('prefers the Czech name, takes the first brand and detects liquids', () => {
    const d = productToDraft({
      code: '123',
      product_name: 'Milk',
      product_name_cs: 'Mléko',
      brands: 'Madeta, Other',
      quantity: '1 l',
      serving_quantity: '250',
      serving_size: '250 ml',
      nutriments: { 'energy-kcal_100g': 47 },
    })
    expect(d).toMatchObject({
      externalId: '123',
      name: 'Mléko',
      brand: 'Madeta',
      basis: 'ml',
      defaultServingG: 250,
      defaultServingLabel: '250 ml',
    })
  })

  it('skips products without a name', () => {
    expect(productToDraft({ code: '1', nutriments: {} })).toBeNull()
  })

  it('does not treat gram quantities as liquids', () => {
    expect(productToDraft({ code: '1', product_name: 'Pasta', quantity: '500 g' })?.basis).toBe('g')
  })
})

describe('hasCoreNutrients', () => {
  it('requires kcal, protein, carbs and fat', () => {
    const base = { kcal: 1, protein: 1, carbs: 1, fat: 1, fiber: null, sugar: null, salt: null }
    expect(hasCoreNutrients(base)).toBe(true)
    expect(hasCoreNutrients({ ...base, fat: null })).toBe(false)
  })
})
