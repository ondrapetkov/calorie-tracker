import { describe, expect, it } from 'vitest'
import { addMonths, gridRange, monthGrid, monthTitle } from './calendar'

describe('monthGrid', () => {
  it('starts each week on Monday and pads with neighbouring days', () => {
    // October 2026 begins on a Thursday
    const weeks = monthGrid(2026, 9)
    expect(weeks[0].map((c) => c.date)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
    expect(weeks[0].map((c) => c.inMonth)).toEqual([false, false, false, true, true, true, true])
    expect(weeks[weeks.length - 1][6].date).toBe('2026-11-01')
    expect(weeks).toHaveLength(5)
  })

  it('has exactly four rows when February starts on a Monday', () => {
    // February 2027 starts on a Monday and has 28 days
    const weeks = monthGrid(2027, 1)
    expect(weeks).toHaveLength(4)
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true)
  })

  it('needs six rows when a 31-day month starts late in the week', () => {
    // May 2027 starts on a Saturday
    expect(monthGrid(2027, 4)).toHaveLength(6)
  })

  it('every cell is the day after the previous one, including across a clock change', () => {
    const flat = monthGrid(2026, 2).flat() // March 2026 contains the spring clock change
    for (let i = 1; i < flat.length; i++) {
      const prev = new Date(flat[i - 1].date + 'T12:00:00')
      const cur = new Date(flat[i].date + 'T12:00:00')
      expect((cur.getTime() - prev.getTime()) / 86_400_000).toBe(1)
    }
  })

  it('reports the visible range', () => {
    expect(gridRange(2026, 9)).toEqual({ from: '2026-09-28', to: '2026-11-01' })
  })
})

describe('addMonths', () => {
  it('wraps across years in both directions', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
    expect(addMonths(2026, 5, 18)).toEqual({ year: 2027, month: 11 })
    expect(addMonths(2026, 5, -30)).toEqual({ year: 2023, month: 11 })
  })

  it('has a readable title', () => {
    expect(monthTitle(2026, 9)).toBe('October 2026')
  })
})
