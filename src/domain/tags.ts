import { BUILTIN_GROUPS, BUILTIN_TAGS, FALLBACK_GROUP_ID } from '../data/builtinTags'
import { normalizeText } from './numbers'
import { matchesQuery, rankScore } from './search'

export interface TagInfo {
  id: string
  name: string
  groupId: string
  builtin: boolean
  /** Emoji; the group's icon for tags without one of their own. */
  icon: string
}

export interface GroupInfo {
  id: string
  name: string
  builtin: boolean
  icon: string
  tags: TagInfo[]
}

/** Icon of groups the owner creates (and so of their tags). */
export const CUSTOM_GROUP_ICON = '🏷️'

/** Built-in and custom tags merged: groups in display order, and every live tag by id. */
export interface Vocabulary {
  groups: GroupInfo[]
  byId: Map<string, TagInfo>
}

/** Minimal shapes of the synced rows, so this file has no Dexie import. */
export interface CustomTagRow {
  id: string
  name: string
  groupId: string
  deletedAt: number | null
}

export interface CustomGroupRow {
  id: string
  name: string
  sortOrder: number
  deletedAt: number | null
}

/** Comparison key for names: case, diacritics and extra spaces ignored. */
export function nameKey(name: string): string {
  return normalizeText(name).trim().replace(/\s+/g, ' ')
}

export function buildVocabulary(tags: CustomTagRow[], groups: CustomGroupRow[]): Vocabulary {
  const customGroups = groups
    .filter((g) => g.deletedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  const result: GroupInfo[] = [
    ...BUILTIN_GROUPS.map((g) => ({ id: g.id, name: g.name, builtin: true, icon: g.icon, tags: [] as TagInfo[] })),
    ...customGroups.map((g) => ({ id: g.id, name: g.name, builtin: false, icon: CUSTOM_GROUP_ICON, tags: [] as TagInfo[] })),
  ]
  const groupById = new Map(result.map((g) => [g.id, g]))
  for (const t of BUILTIN_TAGS) groupById.get(t.groupId)!.tags.push({ ...t, builtin: true })

  const customTags = tags.filter((t) => t.deletedAt === null).sort((a, b) => a.name.localeCompare(b.name))
  for (const t of customTags) {
    const group = groupById.get(t.groupId) ?? groupById.get(FALLBACK_GROUP_ID)!
    group.tags.push({ id: t.id, name: t.name, groupId: group.id, builtin: false, icon: group.icon })
  }

  const byId = new Map<string, TagInfo>()
  for (const g of result) for (const t of g.tags) byId.set(t.id, t)
  return { groups: result, byId }
}

export function findTagByName(v: Vocabulary, name: string, exceptId?: string): TagInfo | undefined {
  const key = nameKey(name)
  for (const t of v.byId.values()) if (t.id !== exceptId && nameKey(t.name) === key) return t
  return undefined
}

export function findGroupByName(v: Vocabulary, name: string, exceptId?: string): GroupInfo | undefined {
  const key = nameKey(name)
  return v.groups.find((g) => g.id !== exceptId && nameKey(g.name) === key)
}

/** Tags whose name matches every word of the query, best match first. */
export function searchTags(v: Vocabulary, query: string): TagInfo[] {
  if (!query.trim()) return []
  return [...v.byId.values()]
    .filter((t) => matchesQuery(t.name, query))
    .sort((a, b) => rankScore(a.name, query) - rankScore(b.name, query))
}

/** The ids that are live tags, unique, in vocabulary order. Unknown and deleted ids are dropped. */
export function liveTagIds(v: Vocabulary, ids: readonly string[] | undefined): string[] {
  if (!ids || ids.length === 0) return []
  const wanted = new Set(ids)
  const out: string[] = []
  for (const g of v.groups) for (const t of g.tags) if (wanted.has(t.id)) out.push(t.id)
  return out
}
