import type { Slot } from './nutrition'

/**
 * Chip filters on the Meals and Foods tabs (spec §3.5): selected slots match any, selected
 * ingredient tags must all be present, the two combine with "and". "Untagged" is exclusive.
 */
export interface TagFilter {
  slots: Slot[]
  tagIds: string[]
  untagged: boolean
}

export const EMPTY_FILTER: TagFilter = { slots: [], tagIds: [], untagged: false }

/** How many meals the diary's add sheet shows when nothing is typed. */
export const MEALS_WITHOUT_QUERY = 5

export function isFilterActive(f: TagFilter): boolean {
  return f.untagged || f.slots.length > 0 || f.tagIds.length > 0
}

export function matchesTagFilter(item: { slots: Slot[]; tagIds: string[] }, f: TagFilter): boolean {
  if (f.untagged) return item.tagIds.length === 0
  if (f.slots.length > 0 && !f.slots.some((s) => item.slots.includes(s))) return false
  return f.tagIds.every((t) => item.tagIds.includes(t))
}

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value]

export function toggleSlot(f: TagFilter, slot: Slot): TagFilter {
  return { ...f, slots: toggle(f.slots, slot), untagged: false }
}

export function toggleTag(f: TagFilter, tagId: string): TagFilter {
  return { ...f, tagIds: toggle(f.tagIds, tagId), untagged: false }
}

export function toggleUntagged(f: TagFilter): TagFilter {
  return f.untagged ? EMPTY_FILTER : { slots: [], tagIds: [], untagged: true }
}

/**
 * Meals for the diary's add sheet under `slot`. Without a query: all of the slot's meals, then other
 * meals until there are five in total. With a query: every meal, the slot's first. Order is otherwise kept.
 */
export function orderMealsForSlot<T extends { slots: Slot[] }>(meals: T[], slot: Slot, hasQuery: boolean): T[] {
  const inSlot = meals.filter((m) => m.slots.includes(slot))
  const others = meals.filter((m) => !m.slots.includes(slot))
  if (hasQuery) return [...inSlot, ...others]
  return [...inSlot, ...others.slice(0, Math.max(0, MEALS_WITHOUT_QUERY - inSlot.length))]
}
