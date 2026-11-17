import { parseNumber } from './numbers'

/**
 * The serving an amount was entered with: the size of one serving (g or ml) and its name, as they
 * were at the time. The number of servings is always worked out from the grams.
 */
export interface Serving {
  grams: number
  label: string | null
}

export function servingCount(grams: number, serving: Serving): number {
  return grams / serving.grams
}

/** A serving count as typed into a box: up to two decimals, no trailing zeros. */
export function formatCount(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** One serving more or fewer. Going down stops at 1; smaller amounts are typed. */
export function stepCount(n: number, delta: 1 | -1): number {
  if (delta === 1) return n + 1
  return n - 1 >= 1 ? n - 1 : n
}

/** What an amount box shows: the serving count when in servings, otherwise the grams. */
export function amountText(grams: number, serving: Serving | null): string {
  return serving ? formatCount(servingCount(grams, serving)) : String(Math.round(grams * 10) / 10)
}

/** The grams an amount box's text stands for; null unless it is a number above 0. */
export function gramsFromText(text: string, serving: Serving | null): number | null {
  const n = parseNumber(text)
  if (n === null || Number.isNaN(n) || n <= 0) return null
  return serving ? n * serving.grams : n
}

export function sameServing(a: Serving | null | undefined, b: Serving | null | undefined): boolean {
  return (a?.grams ?? null) === (b?.grams ?? null) && (a?.label ?? null) === (b?.label ?? null)
}

/**
 * An amount box: its text, whether it is in servings, and the exact grams it stood for when it was
 * last set from grams (opened, added or switched). While the text and serving are unchanged those
 * grams are used, so a rounded count ("3.33") never turns 100 g into 99.9 g.
 */
export interface AmountState {
  text: string
  serving: Serving | null
  exact: { text: string; serving: Serving | null; grams: number } | null
}

export function amountState(grams: number, serving: Serving | null): AmountState {
  const text = amountText(grams, serving)
  return { text, serving, exact: { text, serving, grams } }
}

/** The grams the box stands for; null unless it is a number above 0. */
export function stateGrams(s: AmountState): number | null {
  if (s.exact && s.text === s.exact.text && sameServing(s.serving, s.exact.serving)) return s.exact.grams
  return gramsFromText(s.text, s.serving)
}

/** Show the same amount in servings of `next`, or in grams (null). An unreadable amount switches as it is. */
export function switchServing(s: AmountState, next: Serving | null): AmountState {
  const grams = stateGrams(s)
  return grams === null ? { ...s, serving: next } : amountState(grams, next)
}
