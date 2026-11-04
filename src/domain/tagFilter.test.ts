import { describe, expect, it } from 'vitest'
import type { Slot } from './nutrition'
import {
  EMPTY_FILTER,
  isFilterActive,
  matchesTagFilter,
  splitMealsForSlot,
  toggleSlot,
  toggleTag,
  toggleUntagged,
} from './tagFilter'

const m = (slots: Slot[], tagIds: string[]) => ({ slots, tagIds })

describe('tag filter', () => {
  it('matches everything when empty', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(matchesTagFilter(m([], []), EMPTY_FILTER)).toBe(true)
  })

  it('matches any selected slot', () => {
    expect(matchesTagFilter(m(['lunch', 'dinner'], []), { ...EMPTY_FILTER, slots: ['lunch'] })).toBe(true)
    expect(matchesTagFilter(m(['breakfast'], []), { ...EMPTY_FILTER, slots: ['lunch', 'dinner'] })).toBe(false)
  })

  it('requires all selected ingredient tags, allowing others', () => {
    expect(
      matchesTagFilter(m([], ['chicken', 'rice', 'oil', 'garlic']), { ...EMPTY_FILTER, tagIds: ['chicken', 'rice'] }),
    ).toBe(true)
    expect(matchesTagFilter(m([], ['chicken']), { ...EMPTY_FILTER, tagIds: ['chicken', 'rice'] })).toBe(false)
  })

  it('combines slots and tags with and', () => {
    const f = { slots: ['lunch'] as Slot[], tagIds: ['chicken'], untagged: false }
    expect(matchesTagFilter(m(['lunch'], ['chicken']), f)).toBe(true)
    expect(matchesTagFilter(m(['dinner'], ['chicken']), f)).toBe(false)
  })

  it('untagged means no ingredient tags, whatever the slots', () => {
    const f = toggleUntagged(EMPTY_FILTER)
    expect(isFilterActive(f)).toBe(true)
    expect(matchesTagFilter(m(['lunch'], []), f)).toBe(true)
    expect(matchesTagFilter(m([], ['rice']), f)).toBe(false)
  })

  it('untagged is exclusive with the other chips', () => {
    const withTags = toggleSlot(toggleTag(EMPTY_FILTER, 'rice'), 'lunch')
    expect(toggleUntagged(withTags)).toEqual({ slots: [], tagIds: [], untagged: true })
    expect(toggleTag(toggleUntagged(EMPTY_FILTER), 'rice')).toEqual({ slots: [], tagIds: ['rice'], untagged: false })
    expect(toggleSlot(toggleUntagged(EMPTY_FILTER), 'lunch').untagged).toBe(false)
  })

  it('toggles chips off again', () => {
    expect(toggleTag(toggleTag(EMPTY_FILTER, 'rice'), 'rice')).toEqual(EMPTY_FILTER)
    expect(toggleSlot(toggleSlot(EMPTY_FILTER, 'lunch'), 'lunch')).toEqual(EMPTY_FILTER)
    expect(toggleUntagged(toggleUntagged(EMPTY_FILTER))).toEqual(EMPTY_FILTER)
  })

  it('splits meals for a slot: the slot first, others filling up to five without a query, everything with one', () => {
    const meals = [m(['dinner'], []), m(['lunch'], []), m([], []), m(['lunch', 'dinner'], []), m([], []), m([], []), m([], [])]
    const empty = splitMealsForSlot(meals, 'lunch', false)
    expect(empty.forSlot).toEqual([meals[1], meals[3]])
    expect(empty.others).toEqual([meals[0], meals[2], meals[4]])
    const all = splitMealsForSlot(meals, 'lunch', true)
    expect(all.forSlot).toHaveLength(2)
    expect(all.others).toHaveLength(5)
    const sixLunches = Array.from({ length: 6 }, () => m(['lunch'], []))
    const many = splitMealsForSlot([...sixLunches, m([], [])], 'lunch', false)
    expect(many.forSlot).toHaveLength(6)
    expect(many.others).toEqual([])
  })
})
