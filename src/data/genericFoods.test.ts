import { describe, expect, it } from 'vitest'
import { GENERIC_FOODS } from './genericFoods'
import { searchGenericFoods } from './searchGeneric'
import { GENERIC_FOOD_TAGS } from './genericFoodTags'
import { BUILTIN_TAGS } from './builtinTags'

describe('generic foods data', () => {
  it('has unique ids', () => {
    const ids = GENERIC_FOODS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(GENERIC_FOODS.map((g) => [g.id, g] as const))('%s is internally consistent', (_id, g) => {
    const { kcal, protein, carbs, fat, fiber, sugar, salt } = g.per100
    // Catches typos: stated energy should be close to the 4/4/9 estimate (nuts, honey and
    // low-energy vegetables deviate more, hence the generous tolerance).
    const estimate = 4 * protein + 4 * carbs + 9 * fat
    expect(Math.abs(kcal - estimate)).toBeLessThanOrEqual(Math.max(0.15 * kcal, 10))
    expect(protein + carbs + fat).toBeLessThanOrEqual(100)
    if (fiber !== null) expect(fiber).toBeLessThanOrEqual(carbs + 0.5)
    if (sugar !== null) expect(sugar).toBeLessThanOrEqual(carbs + 0.5)
    if (salt !== null) expect(salt).toBeGreaterThanOrEqual(0)
    for (const v of [kcal, protein, carbs, fat]) expect(v).toBeGreaterThanOrEqual(0)
    if (g.servingG !== undefined) expect(g.servingG).toBeGreaterThan(0)
  })
})

describe('searchGenericFoods', () => {
  it('finds the foods that Open Food Facts handles poorly', () => {
    expect(searchGenericFoods('kuřecí prsa')[0].name).toMatch(/Kuřecí prsa/)
    expect(searchGenericFoods('paprika červená')[0].name).toBe('Paprika červená, syrová')
  })

  it('matches colloquial and English names via aliases', () => {
    expect(searchGenericFoods('chicken breast').length).toBeGreaterThan(0)
    expect(searchGenericFoods('tvaroh').length).toBeGreaterThanOrEqual(2)
  })

  it('returns drafts tagged as generic with a stable id', () => {
    const d = searchGenericFoods('banán')[0]
    expect(d.source).toBe('generic')
    expect(d.externalId).toBe('generic:banana')
    expect(d.defaultServingG).toBe(120)
  })

  it('returns nothing for unrelated queries', () => {
    expect(searchGenericFoods('xyzzy')).toEqual([])
  })
})

describe('generic food tags', () => {
  // No tag in the agreed built-in list fits these; the owner can add custom tags for them.
  const UNTAGGED = new Set(['eggplant', 'celeriac', 'radish', 'pear', 'watermelon'])

  it('tags every other bundled food with known built-in tags', () => {
    const known = new Set(BUILTIN_TAGS.map((t) => t.id))
    for (const g of GENERIC_FOODS) {
      const tags = GENERIC_FOOD_TAGS[g.id] ?? []
      if (UNTAGGED.has(g.id)) expect(tags, g.id).toEqual([])
      else expect(tags.length, g.id).toBeGreaterThan(0)
      for (const t of tags) expect(known.has(t), `${g.id}: ${t}`).toBe(true)
    }
    for (const id of Object.keys(GENERIC_FOOD_TAGS)) expect(GENERIC_FOODS.some((g) => g.id === id), id).toBe(true)
  })

  it.each([
    ['chicken-breast-raw', 'chicken'],
    ['chicken-thigh-raw', 'chicken'],
    ['rice-white-cooked', 'rice'],
    ['cod-raw', 'white-fish'],
    ['tuna-canned-water', 'tuna'],
    ['egg-white', 'eggs'],
    ['quark-skim', 'quark'],
    ['greek-yogurt-0', 'yogurt'],
    ['pepper-red', 'peppers'],
    ['olive-oil', 'oil'],
    ['sugar', 'honey-sugar'],
    ['strawberries', 'berries'],
  ])('%s is tagged %s', (id, tag) => expect(GENERIC_FOOD_TAGS[id]).toContain(tag))

  it('carries the tags onto the draft', () => {
    expect(searchGenericFoods('kureci prsa')[0].tagIds).toEqual(['chicken'])
  })
})
