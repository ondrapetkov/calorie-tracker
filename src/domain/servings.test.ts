import { describe, expect, it } from 'vitest'
import { amountText, formatCount, gramsFromText, servingCount, stepCount, type Serving } from './servings'

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
