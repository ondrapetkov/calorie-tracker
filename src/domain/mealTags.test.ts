import { describe, expect, it } from 'vitest'
import { addMealTag, chooseRowTags, effectiveMealTags, removeMealTag } from './mealTags'

const ing = [['chicken'], ['peppers', 'vegetables-x'], []]

describe('meal tags', () => {
  it('unites ingredient and added tags and drops removed ones', () => {
    expect(effectiveMealTags(ing, { addedTagIds: ['rice', 'chicken'], removedTagIds: ['vegetables-x'] })).toEqual([
      'chicken',
      'peppers',
      'rice',
    ])
  })

  it('treats a meal without ingredients or state as untagged', () => {
    expect(effectiveMealTags([], { addedTagIds: [], removedTagIds: [] })).toEqual([])
  })

  it('shows a Choose row only for tags no ingredient carries', () => {
    expect(chooseRowTags(['chicken', 'peppers', 'rice'], ing)).toEqual(['rice'])
  })

  it('removing a tag an ingredient carries keeps it off; removing a hand-added one just drops it', () => {
    expect(removeMealTag({ addedTagIds: [], removedTagIds: [] }, 'peppers', ing)).toEqual({
      addedTagIds: [],
      removedTagIds: ['peppers'],
    })
    expect(removeMealTag({ addedTagIds: ['rice'], removedTagIds: [] }, 'rice', ing)).toEqual({
      addedTagIds: [],
      removedTagIds: [],
    })
    expect(removeMealTag({ addedTagIds: ['chicken'], removedTagIds: [] }, 'chicken', ing)).toEqual({
      addedTagIds: [],
      removedTagIds: ['chicken'],
    })
  })

  it('adding a tag clears it from removed and does not duplicate', () => {
    expect(addMealTag({ addedTagIds: ['rice'], removedTagIds: ['peppers'] }, 'peppers')).toEqual({
      addedTagIds: ['rice', 'peppers'],
      removedTagIds: [],
    })
    expect(addMealTag({ addedTagIds: ['rice'], removedTagIds: [] }, 'rice').addedTagIds).toEqual(['rice'])
  })

  it('removing an ingredient drops tags only it brought, but a hand-added one stays and gets a Choose row back', () => {
    const state = { addedTagIds: ['chicken'], removedTagIds: [] }
    const without = [['peppers']]
    const tags = effectiveMealTags(without, state)
    expect(tags).toEqual(['peppers', 'chicken'])
    expect(chooseRowTags(tags, without)).toEqual(['chicken'])
  })
})
