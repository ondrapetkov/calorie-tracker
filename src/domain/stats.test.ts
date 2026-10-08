import { describe, expect, it } from 'vitest'
import { buckets, dailyTotals, dayCount, periodFor, periodLabel, shiftPeriod, summarize } from './stats'

const e = (date: string, kcal: number, protein = 0, carbs = 0, fat = 0) => ({ date, kcal, protein, carbs, fat })

describe('periods', () => {
  it('finds the Monday to Sunday week, the month and the year around a date', () => {
    expect(periodFor('week', '2026-10-08')).toEqual({ kind: 'week', from: '2026-10-05', to: '2026-10-11' })
    expect(periodFor('week', '2026-10-11')).toEqual({ kind: 'week', from: '2026-10-05', to: '2026-10-11' })
    expect(periodFor('month', '2026-02-10')).toEqual({ kind: 'month', from: '2026-02-01', to: '2026-02-28' })
    expect(periodFor('month', '2028-02-10').to).toBe('2028-02-29')
    expect(periodFor('year', '2026-10-08')).toEqual({ kind: 'year', from: '2026-01-01', to: '2026-12-31' })
  })

  it('moves to the previous and next period, across month and year boundaries', () => {
    const week = periodFor('week', '2026-10-08')
    expect(shiftPeriod(week, -1)).toEqual({ kind: 'week', from: '2026-09-28', to: '2026-10-04' })
    expect(shiftPeriod(periodFor('week', '2026-12-30'), 1).from).toBe('2027-01-04')
    expect(shiftPeriod(periodFor('month', '2026-01-15'), -1)).toEqual({ kind: 'month', from: '2025-12-01', to: '2025-12-31' })
    expect(shiftPeriod(periodFor('month', '2026-12-15'), 1).from).toBe('2027-01-01')
    expect(shiftPeriod(periodFor('year', '2026-06-01'), -1).from).toBe('2025-01-01')
  })

  it('counts days and writes labels', () => {
    expect(dayCount(periodFor('week', '2026-10-08'))).toBe(7)
    expect(dayCount(periodFor('month', '2026-02-01'))).toBe(28)
    expect(dayCount(periodFor('year', '2028-01-01'))).toBe(366)
    expect(periodLabel(periodFor('month', '2026-10-08'))).toBe('October 2026')
    expect(periodLabel(periodFor('year', '2026-10-08'))).toBe('2026')
    expect(periodLabel(periodFor('week', '2026-10-08'))).toBe('5 Oct – 11 Oct 2026')
    expect(periodLabel(periodFor('week', '2026-12-30'))).toBe('28 Dec 2026 – 3 Jan 2027')
  })
})

describe('dailyTotals', () => {
  it('sums entries per day and sorts by date', () => {
    const days = dailyTotals([e('2026-10-08', 500, 30, 50, 10), e('2026-10-07', 700), e('2026-10-08', 250, 10, 20, 5)])
    expect(days).toEqual([
      { date: '2026-10-07', kcal: 700, protein: 0, carbs: 0, fat: 0 },
      { date: '2026-10-08', kcal: 750, protein: 40, carbs: 70, fat: 15 },
    ])
  })
})

describe('summarize', () => {
  const week = periodFor('week', '2026-10-08')

  it('averages over the days that were logged, not over every day of the period', () => {
    const days = dailyTotals([e('2026-10-05', 2000, 150, 200, 60), e('2026-10-07', 3000, 190, 330, 80)])
    const s = summarize(days, week)
    expect(s.loggedDays).toBe(2)
    expect(s.totalDays).toBe(7)
    expect(s.avg.kcal).toBe(2500)
    expect(s.avg.protein).toBe(170)
    expect(s.totalKcal).toBe(5000)
  })

  it('splits macro calories into percentages that add up to 100', () => {
    const s = summarize(dailyTotals([e('2026-10-05', 2000, 150, 200, 60)]), week)
    // 600 + 800 + 540 = 1940 macro kcal
    expect(s.split!.protein).toBeCloseTo((600 / 1940) * 100)
    expect(s.split!.carbs).toBeCloseTo((800 / 1940) * 100)
    expect(s.split!.fat + s.split!.carbs + s.split!.protein).toBeCloseTo(100)
  })

  it('handles a period with nothing logged', () => {
    const s = summarize([], week)
    expect(s).toMatchObject({ loggedDays: 0, totalDays: 7, totalKcal: 0, split: null })
    expect(s.avg.kcal).toBe(0)
  })
})

describe('buckets', () => {
  it('gives one bar per day for a week, leaving unlogged days empty', () => {
    const week = periodFor('week', '2026-10-08')
    const b = buckets(week, dailyTotals([e('2026-10-06', 1800, 100, 200, 50)]))
    expect(b).toHaveLength(7)
    expect(b.map((x) => x.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(b[1]).toMatchObject({ from: '2026-10-06', kcal: 1800, loggedDays: 1 })
    expect(b[0].kcal).toBeNull()
  })

  it('gives one bar per day of the month, labelled with the day number', () => {
    const b = buckets(periodFor('month', '2026-02-10'), [])
    expect(b).toHaveLength(28)
    expect(b[0].label).toBe('1')
    expect(b[27].label).toBe('28')
  })

  it('gives twelve bars for a year, each the average per logged day of its month', () => {
    const days = dailyTotals([e('2026-03-02', 2000), e('2026-03-20', 3000), e('2026-10-08', 2400), e('2025-03-02', 9999)])
    const b = buckets(periodFor('year', '2026-06-01'), days.filter((d) => d.date.startsWith('2026')))
    expect(b).toHaveLength(12)
    expect(b[2]).toMatchObject({ key: '2026-03-01', kcal: 2500, loggedDays: 2 })
    expect(b[9]).toMatchObject({ kcal: 2400, loggedDays: 1 })
    expect(b[0].kcal).toBeNull()
    expect(b.map((x) => x.label).join('')).toBe('JFMAMJJASOND')
  })
})
