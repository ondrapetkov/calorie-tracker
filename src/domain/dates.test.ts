import { describe, expect, it } from 'vitest'
import { addDays, dayLabel, localDate, parseLocalDate } from './dates'

describe('dates', () => {
  it('formats a local date without timezone shifts', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDate(parseLocalDate('2026-03-01'))).toBe('2026-03-01')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })

  it('labels nearby days', () => {
    expect(dayLabel('2026-10-08', '2026-10-08')).toBe('Today')
    expect(dayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday')
    expect(dayLabel('2026-10-09', '2026-10-08')).toBe('Tomorrow')
    expect(dayLabel('2026-10-01', '2026-10-08')).toMatch(/Thu/)
  })
})
