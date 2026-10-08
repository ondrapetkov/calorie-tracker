import { describe, expect, it } from 'vitest'
import {
  averageAt,
  averageChange,
  daysBetween,
  lastDays,
  niceTicks,
  weekStart,
  weeklyAverages,
  withTrailingAverage,
  type WeightPoint,
} from './weight'

const p = (date: string, kg: number): WeightPoint => ({ date, kg })

describe('averageAt', () => {
  const pts = [p('2026-10-01', 88), p('2026-10-03', 87), p('2026-10-08', 86)]

  it('averages the weigh-ins in the 7 days up to the date', () => {
    expect(averageAt(pts, '2026-10-03')).toBeCloseTo(87.5)
    expect(averageAt(pts, '2026-10-08')).toBeCloseTo(86.5) // 10-03 and 10-08; 10-01 is 7 days back, outside
  })

  it('is null when nothing falls in the window', () => {
    expect(averageAt(pts, '2026-09-20')).toBeNull()
    expect(averageAt([], '2026-10-08')).toBeNull()
  })
})

describe('withTrailingAverage', () => {
  it('attaches an average to every point, which equals the reading when it is alone', () => {
    const out = withTrailingAverage([p('2026-10-01', 88), p('2026-10-02', 87)])
    expect(out[0].avg).toBe(88)
    expect(out[1].avg).toBeCloseTo(87.5)
  })
})

describe('averageChange', () => {
  it('compares the latest 7-day average with the one a number of days earlier', () => {
    const pts = [p('2026-09-24', 90), p('2026-09-26', 90), p('2026-10-01', 88), p('2026-10-03', 88), p('2026-10-08', 87)]
    // latest window 10-02..10-08 -> (88 + 87) / 2 = 87.5 ; window ending 10-01 (09-25..10-01) -> (90 + 88) / 2 = 89
    expect(averageChange(pts, 7)).toBeCloseTo(-1.5)
  })

  it('is null without data in the earlier window', () => {
    expect(averageChange([p('2026-10-08', 87)], 30)).toBeNull()
    expect(averageChange([], 7)).toBeNull()
  })
})

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05') // Thursday
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // Monday itself
    expect(weekStart('2026-10-11')).toBe('2026-10-05') // Sunday belongs to the week before the next Monday
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
  })

  it('works across month and year boundaries', () => {
    expect(weekStart('2026-01-01')).toBe('2025-12-29')
  })
})

describe('weeklyAverages', () => {
  it('averages per Monday-based week, oldest first', () => {
    const out = weeklyAverages([p('2026-10-11', 86), p('2026-10-05', 88), p('2026-10-07', 87), p('2026-10-13', 85)])
    expect(out).toEqual([
      { weekStart: '2026-10-05', avg: (88 + 87 + 86) / 3, count: 3 },
      { weekStart: '2026-10-12', avg: 85, count: 1 },
    ])
  })
})

describe('daysBetween', () => {
  it('counts calendar days, including across a clock change', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-08', '2026-10-01')).toBe(-7)
  })
})

describe('niceTicks', () => {
  it('covers the range with round numbers', () => {
    expect(niceTicks(86.2, 88.7)).toEqual([86, 87, 88, 89])
    expect(niceTicks(86.45, 86.9)).toEqual([86.4, 86.6, 86.8, 87])
  })

  it('handles a flat range', () => {
    const t = niceTicks(87, 87)
    expect(t[0]).toBeLessThanOrEqual(87)
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(87)
  })
})

describe('lastDays', () => {
  const pts = [p('2026-08-01', 90), p('2026-09-15', 89), p('2026-10-08', 87)]
  it('keeps the window ending at the newest point', () => {
    expect(lastDays(pts, 30).map((x) => x.date)).toEqual(['2026-09-15', '2026-10-08'])
    expect(lastDays(pts, null)).toHaveLength(3)
    expect(lastDays([], 30)).toEqual([])
  })
})
