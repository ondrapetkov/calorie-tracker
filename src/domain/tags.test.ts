import { describe, expect, it } from 'vitest'
import { BUILTIN_TAGS } from '../data/builtinTags'
import { CUSTOM_GROUP_ICON, buildVocabulary, findGroupByName, findTagByName, liveTagIds, nameKey, searchTags } from './tags'

const v0 = buildVocabulary([], [])

describe('tag vocabulary', () => {
  it('has the agreed built-in list', () => {
    expect(v0.groups.map((g) => g.id)).toEqual([
      'meat',
      'fish',
      'dairy',
      'plant-protein',
      'supplements',
      'grains',
      'vegetables',
      'fruit',
      'nuts-seeds',
      'extras',
    ])
    expect(v0.byId.size).toBe(76)
    expect(v0.byId.get('fast-food')).toEqual({ id: 'fast-food', name: 'Fast food', groupId: 'extras', builtin: true, icon: '🍔' })
    expect(new Set(BUILTIN_TAGS.map((t) => t.id)).size).toBe(76)
  })

  it('puts custom tags after built-in ones in their group, sorted by name, and custom groups after built-in groups by sortOrder', () => {
    const v = buildVocabulary(
      [
        { id: 'u1', name: 'Kimchi', groupId: 'g2', deletedAt: null },
        { id: 'u2', name: 'Halloumi', groupId: 'dairy', deletedAt: null },
      ],
      [
        { id: 'g2', name: 'Fermented', sortOrder: 2, deletedAt: null },
        { id: 'g1', name: 'Asian', sortOrder: 1, deletedAt: null },
      ],
    )
    expect(v.groups.map((g) => g.id).slice(-2)).toEqual(['g1', 'g2'])
    expect(v.groups.find((g) => g.id === 'dairy')!.tags.at(-1)!.name).toBe('Halloumi')
    expect(v.groups.find((g) => g.id === 'g2')!.tags.map((t) => t.id)).toEqual(['u1'])
  })

  it('leaves out deleted tags and groups, and moves tags of a missing or deleted group to Extras', () => {
    const v = buildVocabulary(
      [
        { id: 'u1', name: 'Kimchi', groupId: 'gone', deletedAt: null },
        { id: 'u2', name: 'Old', groupId: 'dairy', deletedAt: 5 },
      ],
      [{ id: 'gone', name: 'Gone', sortOrder: 1, deletedAt: 9 }],
    )
    expect(v.groups.some((g) => g.id === 'gone')).toBe(false)
    expect(v.byId.get('u1')!.groupId).toBe('extras')
    expect(v.groups.find((g) => g.id === 'extras')!.tags.some((t) => t.id === 'u1')).toBe(true)
    expect(v.byId.has('u2')).toBe(false)
  })

  it('compares names ignoring case, diacritics and spaces', () => {
    const v = buildVocabulary([{ id: 'u1', name: 'Kimchi', groupId: 'extras', deletedAt: null }], [])
    expect(findTagByName(v, '  kimchi ')?.id).toBe('u1')
    expect(findTagByName(v, 'CHICKEN')?.id).toBe('chicken')
    expect(findTagByName(v, 'kimchi', 'u1')).toBeUndefined()
    expect(nameKey(' Kuře  s rýží ')).toBe(nameKey('kure s ryzi'))
    expect(findGroupByName(v, 'meat')?.id).toBe('meat')
  })

  it('searches across all groups by word prefix, best match first', () => {
    expect(searchTags(v0, 'ri').map((t) => t.id)[0]).toBe('rice')
    expect(searchTags(v0, 'fish').map((t) => t.id)).toContain('white-fish')
    expect(searchTags(v0, '')).toEqual([])
  })

  it('keeps only live tag ids, in vocabulary order, without duplicates', () => {
    expect(liveTagIds(v0, ['rice', 'gone', 'chicken', 'rice'])).toEqual(['chicken', 'rice'])
    expect(liveTagIds(v0, undefined)).toEqual([])
  })
})

describe('tag icons', () => {
  it('gives every built-in group and tag an icon', () => {
    for (const g of v0.groups) {
      expect(g.icon, g.id).toBeTruthy()
      for (const t of g.tags) expect(t.icon, t.id).toBeTruthy()
    }
  })

  it.each([
    ['chicken', '🍗'],
    ['rice', '🍚'],
    ['peppers', '🫑'],
    ['fast-food', '🍔'],
    ['cheese', '🧀'],
  ])('%s has its own emoji %s', (id, icon) => expect(v0.byId.get(id)!.icon).toBe(icon))

  it.each([
    ['quark', '🥚'],
    ['salmon', '🐟'],
    ['tofu', '🫘'],
    ['quinoa', '🌾'],
    ['beetroot', '🥦'],
    ['protein-powder', '💪'],
  ])('%s without an exact emoji uses its group icon %s', (id, icon) => expect(v0.byId.get(id)!.icon).toBe(icon))

  it('custom tags take their group icon, custom groups a generic one', () => {
    const v = buildVocabulary(
      [
        { id: 'u1', name: 'Halloumi', groupId: 'dairy', deletedAt: null },
        { id: 'u2', name: 'Kimchi', groupId: 'g1', deletedAt: null },
        { id: 'u3', name: 'Orphan', groupId: 'gone', deletedAt: null },
      ],
      [{ id: 'g1', name: 'Fermented', sortOrder: 1, deletedAt: null }],
    )
    expect(v.byId.get('u1')!.icon).toBe('🥚')
    expect(v.groups.find((g) => g.id === 'g1')!.icon).toBe(CUSTOM_GROUP_ICON)
    expect(v.byId.get('u2')!.icon).toBe(CUSTOM_GROUP_ICON)
    expect(v.byId.get('u3')!.icon).toBe('🧂')
  })
})
