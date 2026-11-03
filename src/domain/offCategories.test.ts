import { describe, expect, it } from 'vitest'
import { BUILTIN_TAGS } from '../data/builtinTags'
import { OFF_CATEGORY_TAGS, suggestTagsFromCategories } from './offCategories'

describe('tags from Open Food Facts categories', () => {
  it.each([
    [['en:plant-based-foods', 'en:cereals-and-their-products', 'en:rices', 'en:basmati-rices'], ['rice']],
    [['en:meats', 'en:poultries', 'en:chickens', 'en:chicken-breasts'], ['chicken']],
    [['en:dairies', 'en:fermented-milk-products', 'en:yogurts', 'en:greek-style-yogurts'], ['yogurt']],
    [['en:dairies', 'en:skyrs'], ['skyr']],
    [['en:pastas'], ['pasta']],
    [['en:pizzas'], ['fast-food']],
    [['en:something-unknown'], []],
    [[], []],
  ])('%j -> %j', (cats, tags) => expect(suggestTagsFromCategories(cats)).toEqual(tags))

  it('maps only to built-in tags', () => {
    const known = new Set(BUILTIN_TAGS.map((t) => t.id))
    for (const [cat, tag] of Object.entries(OFF_CATEGORY_TAGS)) expect(known.has(tag), cat).toBe(true)
  })
})
