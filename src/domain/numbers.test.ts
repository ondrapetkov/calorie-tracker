import { describe, expect, it } from 'vitest'
import { normalizeText, parseNumber, parseSignedNumber } from './numbers'

describe('parseNumber', () => {
  it('parses dots and decimal commas', () => {
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber(' 7 ')).toBe(7)
    expect(parseNumber('.5')).toBe(0.5)
  })

  it('returns null for blank and NaN for junk', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('-3')).toBeNaN()
    expect(parseNumber('1.2.3')).toBeNaN()
  })
})

describe('normalizeText', () => {
  it('removes diacritics and case', () => {
    expect(normalizeText('Kuřecí Prsa')).toBe('kureci prsa')
  })
})

describe('parseSignedNumber', () => {
  it('accepts signs and decimal commas', () => {
    expect(parseSignedNumber('-400')).toBe(-400)
    expect(parseSignedNumber('+300')).toBe(300)
    expect(parseSignedNumber('-12,5')).toBe(-12.5)
    expect(parseSignedNumber('0')).toBe(0)
  })

  it('returns null for blank and NaN for junk', () => {
    expect(parseSignedNumber('')).toBeNull()
    expect(parseSignedNumber('-')).toBeNaN()
    expect(parseSignedNumber('--3')).toBeNaN()
    expect(parseSignedNumber('x')).toBeNaN()
  })
})
