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
