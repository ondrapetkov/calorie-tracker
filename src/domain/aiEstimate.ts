import { multiplyMacros, type Macros } from './nutrition'
import { parseNutritionText } from './nutritionText'

/** Copied by "Copy prompt" and added after the owner's own question to any AI chat. */
export const AI_PROMPT = `Estimate the nutrition of the food I described, for the whole portion I ate. If something is unclear, make a sensible assumption and say it in one sentence instead of asking me.

End your answer with exactly this block, filled in. Single numbers only, no ranges, no extra text inside the block:

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

/** Markdown an AI may wrap the block in ("**Name:** …", "- Fat: …"). */
const plain = (line: string) => line.replace(/[*_`]/g, '').replace(/^\s*[-•]\s*/, '').trim()

/**
 * Read the block at the end of an AI's answer (see AI_PROMPT). Only the lines from the last
 * "Name:" on are read, because the prose before it often mentions rough calories too.
 */
export function readAiAnswer(text: string): AiRead {
  const lines = text.split(/\r?\n/).map(plain)
  let start = lines.length - 1
  while (start >= 0 && !/^name\s*:/i.test(lines[start])) start--
  if (start === -1) return { ok: false, missing: ['Name'] }
  const block = lines.slice(start)

  const name = block[0].replace(/^name\s*:\s*/i, '').trim()
  const weightLine = block.find((l) => /^weight\s*:/i.test(l))
  const weightMatch = weightLine?.match(/^weight\s*:\s*(\d+(?:[.,]\d+)?)\s*(g|ml)?\b/i)
  const grams = weightMatch ? Number(weightMatch[1].replace(',', '.')) : null
  const values = parseNutritionText(block.join('\n'))?.values ?? {}

  const missing = [
    ...(name ? [] : ['Name']),
    ...(grams && grams > 0 ? [] : ['Weight']),
    ...(values.kcal === undefined ? ['Energy'] : []),
    ...(values.protein === undefined ? ['Protein'] : []),
    ...(values.carbs === undefined ? ['Carbohydrates'] : []),
    ...(values.fat === undefined ? ['Fat'] : []),
  ]
  if (missing.length > 0) return { ok: false, missing }

  return {
    ok: true,
    estimate: {
      name,
      grams: grams!,
      totals: {
        kcal: values.kcal!,
        protein: values.protein!,
        carbs: values.carbs!,
        sugar: values.sugar ?? null,
        fat: values.fat!,
        fiber: values.fiber ?? null,
        salt: values.salt ?? null,
      },
    },
  }
}

/** Values per 100 g from totals for `grams`. */
export function per100FromTotals(totals: Macros, grams: number): Macros {
  return multiplyMacros(totals, 100 / grams)
}
