import { describe, expect, it } from 'vitest'
import {
  amountState,
  amountText,
  formatCount,
  gramsFromText,
  servingCount,
  stateGrams,
  stepCount,
  switchServing,
  type Serving,
} from './servings'

const slice: Serving = { grams: 25, label: '1 slice' }

describe('servings', () => {
  it('counts servings from grams', () => {
    expect(servingCount(100, slice)).toBe(4)
  })

  it('formats counts with up to two decimals', () => {
    expect(formatCount(4)).toBe('4')
    expect(formatCount(1.5)).toBe('1.5')
    expect(formatCount(1 / 3)).toBe('0.33')
    expect(formatCount(2.499)).toBe('2.5')
  })

  it('steps by one serving and never below one going down', () => {
    expect(stepCount(4, 1)).toBe(5)
    expect(stepCount(1.5, 1)).toBe(2.5)
    expect(stepCount(2.5, -1)).toBe(1.5)
    expect(stepCount(1, -1)).toBe(1)
    expect(stepCount(0.5, -1)).toBe(0.5)
  })

  it('shows an amount as a count or as grams', () => {
    expect(amountText(100, slice)).toBe('4')
    expect(amountText(33.33, null)).toBe('33.3')
  })

  it('reads typed text back as grams', () => {
    expect(gramsFromText('6', slice)).toBe(150)
    expect(gramsFromText('1,5', slice)).toBe(37.5)
    expect(gramsFromText('150', null)).toBe(150)
    expect(gramsFromText('0', slice)).toBeNull()
    expect(gramsFromText('x', null)).toBeNull()
  })
})

describe('amount state', () => {
  const thirty: Serving = { grams: 30, label: '1 piece' }

  it('keeps the exact grams while the text is untouched', () => {
    const s = amountState(100, thirty)
    expect(s.text).toBe('3.33')
    expect(stateGrams(s)).toBe(100)
    expect(stateGrams({ ...s, text: '4' })).toBe(120)
    expect(stateGrams({ ...s, text: '' })).toBeNull()
  })

  it('switches between servings and grams without changing the amount', () => {
    const toGrams = switchServing(amountState(100, thirty), null)
    expect(toGrams.text).toBe('100')
    expect(stateGrams(toGrams)).toBe(100)
    const toServings = switchServing(amountState(100, null), thirty)
    expect(toServings.text).toBe('3.33')
    expect(stateGrams(toServings)).toBe(100)
    const roundTrip = switchServing(switchServing(amountState(100, null), thirty), null)
    expect(stateGrams(roundTrip)).toBe(100)
    expect(stateGrams(switchServing(roundTrip, thirty))).toBe(100)
  })

  it('switches an unreadable amount as it is', () => {
    const s = switchServing({ ...amountState(100, null), text: 'x' }, thirty)
    expect(s.text).toBe('x')
    expect(s.serving).toEqual(thirty)
    expect(stateGrams(s)).toBeNull()
  })

  it('keeps the exact grams of a new amount entered in servings', () => {
    expect(stateGrams(amountState(9.99, thirty))).toBe(9.99)
  })
})
