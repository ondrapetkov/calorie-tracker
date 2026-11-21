import { multiplyMacros, type Macros } from './nutrition'
import { normalizeText } from './numbers'

/** Copied by "Copy prompt" and added after the owner's own question to any AI chat. */
export const AI_PROMPT = `Estimate the nutrition of the food I described, for the whole portion I ate. If something is unclear, make a sensible assumption and say it in one sentence instead of asking me.

End your answer with exactly this block, filled in. Single plain numbers only (no ranges, no thousands separators), no extra text inside the block:

Name: [short name of the dish]
Weight: [g] g
Energy: [kcal] kcal
Protein: [g] g
Carbohydrates: [g] g
Sugars: [g] g
Fat: [g] g
Fibre: [g] g
Salt: [g] g`

/** What an AI estimated for a whole portion: its name, weight and nutrition totals for that weight. */
export interface AiEstimate {
  name: string
  grams: number
  totals: Macros
}

export type AiRead = { ok: true; estimate: AiEstimate } | { ok: false; missing: string[] }

/** Markdown and list wrappers an AI may put around the block ("**Name:** …", "- Fat: …", "| Fat: … |"). */
const plain = (line: string) =>
  line
    .replace(/[*_`|]/g, '')
    .replace(/^\s*(?:[-•>#]+|\d+[.)])\s*/, '')
    .trim()

type Field = 'name' | 'weight' | 'energy' | 'protein' | 'carbs' | 'sugar' | 'fat' | 'fiber' | 'salt'

/** Block labels (lower case, without diacritics) in English and Czech, as an AI may translate them. */
const LABELS: Record<string, Field> = {
  name: 'name', nazev: 'name',
  weight: 'weight', hmotnost: 'weight', vaha: 'weight',
  energy: 'energy', energie: 'energy', calories: 'energy', kalorie: 'energy',
  protein: 'protein', proteins: 'protein', bilkoviny: 'protein',
  carbohydrates: 'carbs', carbs: 'carbs', sacharidy: 'carbs',
  sugars: 'sugar', sugar: 'sugar', 'of which sugars': 'sugar', cukry: 'sugar', 'z toho cukry': 'sugar',
  fat: 'fat', fats: 'fat', tuky: 'fat', tuk: 'fat',
  fibre: 'fiber', fiber: 'fiber', vlaknina: 'fiber',
  salt: 'salt', sul: 'salt',
}

/** A block line as [field, value text], or null when it isn't one. */
function labelled(line: string): [Field, string] | null {
  const m = line.match(/^([^:]{2,30}):\s*(.*)$/)
  const field = m && LABELS[normalizeText(m[1]).trim()]
  return field ? [field, m![2].trim()] : null
}

/**
 * A number with its unit: "1,250 kcal" and "1 100 g" are thousands, "39,5 g" a decimal comma,
 * "~48 g" or "approx. 48 g" fine. Null for an unknown value ("<0.1 g", "-") or no number.
 */
function amount(text: string): { n: number; unit: string } | null {
  const t = text.replace(/^(?:~|≈|approx\.?|about|around|ca\.?|cca\.?|circa|asi|přibližně)\s*/i, '')
  const m = t.match(/^([1-9]\d{0,2}(?:[ ,\u00a0\u202f]\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(kcal|kj|kg|mg|g|ml)?(?![a-z])/i)
  if (!m) return null
  const thousands = /[ ,\u00a0\u202f]\d{3}(?:\.|$)/.test(m[1]) && /^[1-9]/.test(m[1])
  const n = thousands ? Number(m[1].replace(/[ ,\u00a0\u202f]/g, '')) : Number(m[1].replace(',', '.'))
  return { n, unit: (m[2] ?? '').toLowerCase() }
}

/** Grams for a nutrient value ("850 mg" is 0.85). */
function grams(a: { n: number; unit: string } | null): number | null {
  if (!a) return null
  return a.unit === 'mg' ? a.n / 1000 : a.n
}

/** More than this many kcal per gram can't be food (pure fat is 9): the weight was misread. */
const MAX_KCAL_PER_GRAM = 9.5

/**
 * Read the block at the end of an AI's answer (see AI_PROMPT). It starts at the last "Name:" line
 * (the prose before it often mentions rough calories too) and ends at the first line that isn't
 * one of its labels; each value is read from its own line only.
 */
export function readAiAnswer(text: string): AiRead {
  const lines = text.split(/\r?\n/).map(plain)
  let start = lines.length - 1
  while (start >= 0 && labelled(lines[start])?.[0] !== 'name') start--
  if (start === -1) return { ok: false, missing: ['Name'] }

  const fields: Partial<Record<Field, string>> = { name: labelled(lines[start])![1] }
  for (const line of lines.slice(start + 1)) {
    if (!line) continue
    const l = labelled(line)
    if (!l || l[0] === 'name') break
    if (fields[l[0]] === undefined) fields[l[0]] = l[1]
  }

  const name = fields.name ?? ''
  const w = amount(fields.weight ?? '')
  const weight = !w || !['', 'g', 'ml', 'kg'].includes(w.unit) ? null : w.unit === 'kg' ? w.n * 1000 : w.n
  const e = amount(fields.energy ?? '')
  const kcal = !e || !['', 'kcal', 'kj'].includes(e.unit) ? null : e.unit === 'kj' ? Math.round(e.n / 4.184) : e.n
  const protein = grams(amount(fields.protein ?? ''))
  const carbs = grams(amount(fields.carbs ?? ''))
  const fat = grams(amount(fields.fat ?? ''))
  const weightOk = weight !== null && weight > 0 && (kcal === null || kcal / weight <= MAX_KCAL_PER_GRAM)

  const missing = [
    ...(name ? [] : ['Name']),
    ...(weightOk ? [] : ['Weight']),
    ...(kcal === null ? ['Energy'] : []),
    ...(protein === null ? ['Protein'] : []),
    ...(carbs === null ? ['Carbohydrates'] : []),
    ...(fat === null ? ['Fat'] : []),
  ]
  if (missing.length > 0) return { ok: false, missing }

  return {
    ok: true,
    estimate: {
      name,
      grams: weight!,
      totals: {
        kcal: kcal!,
        protein: protein!,
        carbs: carbs!,
        sugar: grams(amount(fields.sugar ?? '')),
        fat: fat!,
        fiber: grams(amount(fields.fiber ?? '')),
        salt: grams(amount(fields.salt ?? '')),
      },
    },
  }
}

/** Values per 100 g from totals for `grams`. */
export function per100FromTotals(totals: Macros, grams: number): Macros {
  return multiplyMacros(totals, 100 / grams)
}
