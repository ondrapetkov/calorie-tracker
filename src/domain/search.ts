import { normalizeText } from './numbers'

function commonPrefixLength(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/**
 * Does a query word match a word in the text? Besides a plain prefix match this
 * tolerates Czech word endings ("prsa" / "prsou", "paprika" / "papriky") by
 * accepting words that share almost their whole stem.
 */
export function wordMatches(queryWord: string, textWord: string): boolean {
  if (textWord.startsWith(queryWord)) return true
  const shorter = Math.min(queryWord.length, textWord.length)
  if (shorter < 4) return false
  return commonPrefixLength(queryWord, textWord) >= Math.max(3, shorter - 1)
}

/** True when every word of the query matches some word of the text (diacritics and case ignored). */
export function matchesQuery(text: string, query: string): boolean {
  const queryWords = normalizeText(query).split(/\s+/).filter(Boolean)
  if (queryWords.length === 0) return false
  const textWords = normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean)
  return queryWords.every((q) => textWords.some((t) => wordMatches(q, t)))
}

/** Lower is better: names starting with the query come first, then shorter names. */
export function rankScore(name: string, query: string): number {
  const n = normalizeText(name)
  const q = normalizeText(query).trim()
  return (n.startsWith(q) ? 0 : 1000) + n.length
}
