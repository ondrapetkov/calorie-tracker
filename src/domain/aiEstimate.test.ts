import { describe, expect, it } from 'vitest'
import { AI_PROMPT, per100FromTotals, readAiAnswer } from './aiEstimate'

const ANSWER = `Assuming a large kebab in a tortilla with chicken, cabbage, onion and garlic sauce,
roughly 800–900 kcal in total.

Name: Kebab v tortille
Weight: 450 g
Energy: 890 kcal
Protein: 48 g
Carbohydrates: 82 g
Sugars: 6 g
Fat: 39 g
Fibre: 5 g
Salt: 4.2 g`

describe('reading an AI answer', () => {
  it('reads the block at the end, not numbers in the prose before it', () => {
    const r = readAiAnswer(ANSWER)
    expect(r).toEqual({
      ok: true,
      estimate: {
        name: 'Kebab v tortille',
        grams: 450,
        totals: { kcal: 890, protein: 48, carbs: 82, sugar: 6, fat: 39, fiber: 5, salt: 4.2 },
      },
    })
  })

  it('understands decimal commas and milligrams', () => {
    const r = readAiAnswer(ANSWER.replace('Fat: 39 g', 'Fat: 39,5 g').replace('Salt: 4.2 g', 'Salt: 850 mg'))
    expect(r.ok && r.estimate.totals.fat).toBe(39.5)
    expect(r.ok && r.estimate.totals.salt).toBe(0.85)
  })

  it('names what is missing', () => {
    expect(readAiAnswer(ANSWER.replace('Weight: 450 g\n', ''))).toEqual({ ok: false, missing: ['Weight'] })
    expect(readAiAnswer('Energy: 500 kcal\nProtein: 20 g')).toEqual({ ok: false, missing: ['Name'] })
  })

  it('treats sugars, fibre and salt as optional', () => {
    const r = readAiAnswer(ANSWER.replace(/Sugars.*\n/, '').replace(/Fibre.*\n/, '').replace(/\nSalt.*$/, ''))
    expect(r.ok && r.estimate.totals).toMatchObject({ sugar: null, fiber: null, salt: null, kcal: 890 })
  })

  it('reads a block written in bold markdown', () => {
    const r = readAiAnswer(ANSWER.replace(/^(\w+):/gm, '**$1:**'))
    expect(r.ok && r.estimate.name).toBe('Kebab v tortille')
    expect(r.ok && r.estimate.totals.protein).toBe(48)
  })

  it('works out values per 100 g', () => {
    const r = readAiAnswer(ANSWER)
    expect(r.ok && per100FromTotals(r.estimate.totals, 450).kcal).toBeCloseTo(197.8, 1)
  })

  it('reads thousands separators and kilograms', () => {
    const r = readAiAnswer(ANSWER.replace('Weight: 450 g', 'Weight: 1,100 g').replace('Energy: 890 kcal', 'Energy: 1,250 kcal'))
    expect(r.ok && [r.estimate.grams, r.estimate.totals.kcal]).toEqual([1100, 1250])
    const spaced = readAiAnswer(ANSWER.replace('Weight: 450 g', 'Weight: 1 100 g').replace('Energy: 890 kcal', 'Energy: 1 250 kcal'))
    expect(spaced.ok && [spaced.estimate.grams, spaced.estimate.totals.kcal]).toEqual([1100, 1250])
    const kg = readAiAnswer(ANSWER.replace('Weight: 450 g', 'Weight: 1.2 kg').replace('Energy: 890 kcal', 'Energy: 2100 kcal'))
    expect(kg.ok && kg.estimate.grams).toBe(1200)
  })

  it('refuses a weight that cannot hold that much energy', () => {
    expect(readAiAnswer(ANSWER.replace('Weight: 450 g', 'Weight: 1 g'))).toEqual({ ok: false, missing: ['Weight'] })
  })

  it('reads each value only from its own line', () => {
    const r = readAiAnswer(
      ANSWER.replace('Name: Kebab v tortille', 'Name: 500 kcal bowl').replace('Energy: 890 kcal', 'Energy: 3725 kJ') +
        '\n\nThe garlic sauce alone adds about 150 kcal.\nFibre content is low.\n3',
    )
    expect(r.ok && r.estimate.name).toBe('500 kcal bowl')
    expect(r.ok && r.estimate.totals.kcal).toBe(890)
    expect(r.ok && r.estimate.totals.fiber).toBe(5)
  })

  it('accepts approximate values and Czech labels', () => {
    const approx = readAiAnswer(ANSWER.replace('Protein: 48 g', 'Protein: ~48 g').replace('Fat: 39 g', 'Fat: approx. 39 g'))
    expect(approx.ok && [approx.estimate.totals.protein, approx.estimate.totals.fat]).toEqual([48, 39])
    const cz = readAiAnswer(
      ANSWER.replace('Name:', 'Název:').replace('Weight:', 'Hmotnost:').replace('Energy:', 'Energie:').replace('Protein:', 'Bílkoviny:'),
    )
    expect(cz.ok && [cz.estimate.name, cz.estimate.grams, cz.estimate.totals.kcal, cz.estimate.totals.protein]).toEqual([
      'Kebab v tortille',
      450,
      890,
      48,
    ])
  })

  it('asks for the block in the prompt', () => {
    expect(AI_PROMPT).toContain('Name:')
    expect(AI_PROMPT).toContain('Salt:')
  })
})
