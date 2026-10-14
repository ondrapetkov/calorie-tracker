import { normalizeText } from './numbers'

export type NutrientKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'salt'

/** What could be read from a pasted block of text. Values are per 100 g (or ml); missing ones are absent. */
export interface ParsedNutrition {
  name: string | null
  brand: string | null
  basis: 'g' | 'ml'
  values: Partial<Record<NutrientKey, number>>
}

/** Matches "17", "2,1", "0.06" and numbers with thousands spaces such as "1 030". */
const NUM = String.raw`\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`

const toNumber = (s: string) => Number(s.replace(/[   ]/g, '').replace(',', '.'))

/** Label words (without diacritics, lower case) in Czech, Slovak and English. */
const LABELS: [key: NutrientKey | 'sodium', words: string[]][] = [
  ['protein', ['bilkoviny', 'bielkoviny', 'protein', 'proteins']],
  ['carbs', ['sacharidy', 'carbohydrate', 'carbohydrates', 'carbs']],
  ['sugar', ['cukry', 'cukr', 'sugars', 'sugar']],
  ['fat', ['tuky', 'tuk', 'fat', 'total fat']],
  ['fiber', ['vlaknina', 'fibre', 'fiber']],
  ['salt', ['sul', 'sol', 'salt']],
  ['sodium', ['sodik', 'sodium']],
]

/** Lines on a kaloricketabulky.cz page that come after the product name and brand. */
const KT_MARKERS = ['zadej mnozstvi', 'zapsat do jidelnicku']

/**
 * Read nutrition values from text copied from a nutrition page (such as kaloricketabulky.cz) or a
 * food label, e.g. via Live Text from a photo. Understands a label and its value on one line
 * ("Tuky 12 g") or on the next line ("Tuky" / "12 g"), decimal commas, kJ when kcal is missing,
 * and sodium when salt is missing. A "-" means unknown. The first column is taken, which on labels
 * is the value per 100 g. Returns null when no energy or macros are found.
 */
export function parseNutritionText(text: string): ParsedNutrition | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[  \t]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const norm = lines.map((l) => normalizeText(l))
  const values: Partial<Record<NutrientKey | 'sodium', number>> = {}

  for (let i = 0; i < lines.length; i++) {
    // "Recommended daily intake: 118 g" belongs to the line above, not to a nutrient.
    if (norm[i].startsWith('doporuceny')) continue
    const line = norm[i].replace(/^[-•*·]\s*/, '').replace(/^(z toho|of which)\s*/, '')
    for (const [key, words] of LABELS) {
      if (values[key] !== undefined) continue
      const word = words.find((w) => line === w || new RegExp(`^${w}(?![a-z])`).test(line))
      if (!word) continue
      const rest = line.slice(word.length)
      let amount = readAmount(rest)
      if (amount === undefined && !/\d/.test(rest) && i + 1 < lines.length) {
        amount = readAmount(norm[i + 1], true)
      }
      if (amount !== undefined && amount !== null) values[key] = amount
      break
    }
  }

  const kcal = text.match(new RegExp(`(${NUM})\\s*kcal`, 'i'))
  const kj = text.match(new RegExp(`(${NUM})\\s*kj`, 'i'))
  const out: Partial<Record<NutrientKey, number>> = {}
  if (kcal) out.kcal = toNumber(kcal[1])
  else if (kj) out.kcal = Math.round(toNumber(kj[1]) / 4.184)
  for (const key of ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt'] as const) {
    if (values[key] !== undefined) out[key] = values[key]
  }
  if (out.salt === undefined && values.sodium !== undefined) out.salt = Math.round(values.sodium * 2.5 * 100) / 100

  if (out.kcal === undefined && out.protein === undefined && out.carbs === undefined && out.fat === undefined) return null

  // On kaloricketabulky.cz the product name comes first, then (sometimes) the brand.
  let name: string | null = null
  let brand: string | null = null
  const marker = norm.findIndex((l) => KT_MARKERS.some((m) => l.startsWith(m)))
  if (marker > 0) {
    name = lines[0]
    if (marker > 1) brand = lines[1]
  }

  const mentionsMl = /100 ?ml/i.test(text)
  const mentionsG = /100 ?g\b/i.test(text)
  return { name, brand, basis: mentionsMl && !mentionsG ? 'ml' : 'g', values: out }
}

/**
 * The amount at the start of `s` in grams: "17 g", "2,1", "850 mg" (as 0.85). Returns null for
 * "-" (unknown) and undefined when there is no amount. `whole` requires the line to be only that.
 */
function readAmount(s: string, whole = false): number | null | undefined {
  const t = s.replace(/^[\s:]+/, '')
  if (/^[-–—]$/.test(t) || (!whole && /^[-–—](\s|$)/.test(t))) return null
  const m = t.match(new RegExp(`^(${NUM})\\s*(mg|g)?(?![a-z])`))
  if (!m || (whole && m[0].length !== t.length)) return undefined
  const n = toNumber(m[1])
  return m[2] === 'mg' ? n / 1000 : n
}
