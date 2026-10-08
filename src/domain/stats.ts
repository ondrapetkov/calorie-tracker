import { addDays, localDate, parseLocalDate } from './dates'

export type PeriodKind = 'week' | 'month' | 'year'

export interface Period {
  kind: PeriodKind
  /** First and last day, inclusive. */
  from: string
  to: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function monday(date: string): string {
  return addDays(date, -((parseLocalDate(date).getDay() + 6) % 7))
}

/** The week (Monday to Sunday), month or year that contains `anchor`. */
export function periodFor(kind: PeriodKind, anchor: string): Period {
  const d = parseLocalDate(anchor)
  if (kind === 'week') {
    const from = monday(anchor)
    return { kind, from, to: addDays(from, 6) }
  }
  if (kind === 'month') {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    return { kind, from: `${prefix}-01`, to: `${prefix}-${pad(last)}` }
  }
  return { kind, from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` }
}

/** The previous (delta -1) or next (delta +1) period of the same kind. */
export function shiftPeriod(p: Period, delta: number): Period {
  if (p.kind === 'week') return periodFor('week', addDays(p.from, 7 * delta))
  const d = parseLocalDate(p.from)
  if (p.kind === 'month') return periodFor('month', localDate(new Date(d.getFullYear(), d.getMonth() + delta, 1)))
  return periodFor('year', localDate(new Date(d.getFullYear() + delta, 0, 1)))
}

export function periodLabel(p: Period): string {
  const f = parseLocalDate(p.from)
  const t = parseLocalDate(p.to)
  if (p.kind === 'year') return String(f.getFullYear())
  if (p.kind === 'month') return f.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const short = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  return `${short(f, f.getFullYear() !== t.getFullYear())} – ${short(t, true)}`
}

export function containsDate(p: Period, date: string): boolean {
  return date >= p.from && date <= p.to
}

export function dayCount(p: Period): number {
  return Math.round((parseLocalDate(p.to).getTime() - parseLocalDate(p.from).getTime()) / 86_400_000) + 1
}

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface DayTotal extends Nutrients {
  date: string
}

/** Sum log entries per day. Only days that have entries appear; they are sorted by date. */
export function dailyTotals(entries: (Nutrients & { date: string })[]): DayTotal[] {
  const byDate = new Map<string, DayTotal>()
  for (const e of entries) {
    const t = byDate.get(e.date) ?? { date: e.date, kcal: 0, protein: 0, carbs: 0, fat: 0 }
    t.kcal += e.kcal
    t.protein += e.protein
    t.carbs += e.carbs
    t.fat += e.fat
    byDate.set(e.date, t)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface Summary {
  /** Days with at least one entry. */
  loggedDays: number
  totalDays: number
  /** Averages are per logged day: a day you did not log is unknown, not zero. */
  avg: Nutrients
  totalKcal: number
  /** Share of macro calories from protein, carbs and fat, in percent (sums to 100), or null without data. */
  split: { protein: number; carbs: number; fat: number } | null
}

export function summarize(days: DayTotal[], period: Period): Summary {
  const n = days.length
  const total = days.reduce(
    (t, d) => ({ kcal: t.kcal + d.kcal, protein: t.protein + d.protein, carbs: t.carbs + d.carbs, fat: t.fat + d.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const avg = n === 0 ? { kcal: 0, protein: 0, carbs: 0, fat: 0 } : {
    kcal: total.kcal / n,
    protein: total.protein / n,
    carbs: total.carbs / n,
    fat: total.fat / n,
  }
  const macroKcal = 4 * avg.protein + 4 * avg.carbs + 9 * avg.fat
  const split =
    n === 0 || macroKcal === 0
      ? null
      : {
          protein: (100 * 4 * avg.protein) / macroKcal,
          carbs: (100 * 4 * avg.carbs) / macroKcal,
          fat: (100 * 9 * avg.fat) / macroKcal,
        }
  return { loggedDays: n, totalDays: dayCount(period), avg, totalKcal: total.kcal, split }
}

export interface Bucket {
  key: string
  /** Short axis label. */
  label: string
  /** Long label for the readout. */
  title: string
  from: string
  to: string
  /** Calories: the day's total (week, month) or the average per logged day (year). Null when nothing was logged. */
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  loggedDays: number
}

/** The bars of the chart: one per day for a week or month, one per month for a year. */
export function buckets(period: Period, days: DayTotal[]): Bucket[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  if (period.kind !== 'year') {
    return Array.from({ length: dayCount(period) }, (_, i) => {
      const date = addDays(period.from, i)
      const d = byDate.get(date)
      const dt = parseLocalDate(date)
      return {
        key: date,
        label: period.kind === 'week' ? dt.toLocaleDateString('en-GB', { weekday: 'short' }) : String(dt.getDate()),
        title: dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        from: date,
        to: date,
        kcal: d ? d.kcal : null,
        protein: d ? d.protein : null,
        carbs: d ? d.carbs : null,
        fat: d ? d.fat : null,
        loggedDays: d ? 1 : 0,
      }
    })
  }
  const year = parseLocalDate(period.from).getFullYear()
  return Array.from({ length: 12 }, (_, m) => {
    const month = periodFor('month', `${year}-${pad(m + 1)}-01`)
    const inMonth = days.filter((d) => d.date >= month.from && d.date <= month.to)
    const n = inMonth.length
    const mean = (pick: (d: DayTotal) => number) => (n === 0 ? null : inMonth.reduce((s, d) => s + pick(d), 0) / n)
    const dt = new Date(year, m, 1)
    return {
      key: month.from,
      label: dt.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 1),
      title: dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      from: month.from,
      to: month.to,
      kcal: mean((d) => d.kcal),
      protein: mean((d) => d.protein),
      carbs: mean((d) => d.carbs),
      fat: mean((d) => d.fat),
      loggedDays: n,
    }
  })
}
