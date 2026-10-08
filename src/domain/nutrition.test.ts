import { describe, expect, it } from 'vitest'
import { defaultSlot, kcalFromMacros, multiplyMacros, scaleMacros, sumMacros, type Macros } from './nutrition'

const oats: Macros = { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, salt: null }

describe('scaleMacros', () => {
  it('scales per-100 values to an amount', () => {
    const m = scaleMacros(oats, 50)
    expect(m.kcal).toBeCloseTo(185)
    expect(m.protein).toBeCloseTo(6.5)
    expect(m.fiber).toBeCloseTo(5)
  })

  it('keeps unknown values unknown instead of turning them into zero', () => {
    expect(scaleMacros(oats, 50).salt).toBeNull()
  })
})

describe('multiplyMacros', () => {
  it('rescales a snapshot by a ratio', () => {
    expect(multiplyMacros(scaleMacros(oats, 50), 2).kcal).toBeCloseTo(370)
  })
})

describe('sumMacros', () => {
  it('adds entries and flags nutrients that were unknown for some entries', () => {
    const a = scaleMacros(oats, 100)
    const b: Macros = { kcal: 100, protein: 1, carbs: 20, fat: 0, fiber: null, sugar: 5, salt: 0.1 }
    const t = sumMacros([a, b])
    expect(t.kcal).toBe(470)
    expect(t.fiber).toBe(10)
    expect(t.incomplete).toEqual({ fiber: true, sugar: false, salt: true })
    expect(t.salt).toBeCloseTo(0.1)
  })

  it('returns zeros for an empty day', () => {
    const t = sumMacros([])
    expect(t.kcal).toBe(0)
    expect(t.incomplete).toEqual({ fiber: false, sugar: false, salt: false })
  })
})

describe('kcalFromMacros', () => {
  it('uses 4/4/9', () => {
    expect(kcalFromMacros(10, 20, 5)).toBe(165)
  })
})

describe('defaultSlot', () => {
  it('maps hours to slots', () => {
    expect(defaultSlot(8)).toBe('breakfast')
    expect(defaultSlot(12)).toBe('lunch')
    expect(defaultSlot(16)).toBe('snack')
    expect(defaultSlot(19)).toBe('dinner')
    expect(defaultSlot(22)).toBe('snack')
  })
})
