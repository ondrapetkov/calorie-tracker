/**
 * Parse a user-typed number. Accepts a decimal comma (common on Czech keyboards).
 * Returns null for blank input and NaN for something that is not a number.
 */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (s === '') return null
  return /^\d*\.?\d+$|^\d+\.$/.test(s) ? Number(s) : NaN
}

export function formatNumber(v: number, digits = 0): string {
  return v.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Strip diacritics and lowercase, so "kuřecí" matches "kureci". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
