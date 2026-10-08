import { addDays, parseLocalDate } from './dates'

export interface WeightPoint {
  date: string
  kg: number
}

export interface WeightPointWithAverage extends WeightPoint {
  /** Mean of the weigh-ins in the 7 days up to and including this date. */
  avg: number
}

/** Mean of the weigh-ins dated within `window` days up to and including `date`, or null if none. */
export function averageAt(points: WeightPoint[], date: string, window = 7): number | null {
  const from = addDays(date, -(window - 1))
  const inWindow = points.filter((p) => p.date >= from && p.date <= date)
  if (inWindow.length === 0) return null
  return inWindow.reduce((sum, p) => sum + p.kg, 0) / inWindow.length
}

/** Each weigh-in with its trailing 7-day average. Input must be sorted by date ascending. */
export function withTrailingAverage(points: WeightPoint[], window = 7): WeightPointWithAverage[] {
  return points.map((p) => ({ ...p, avg: averageAt(points, p.date, window) ?? p.kg }))
}

/**
 * Change in the 7-day average between the latest weigh-in and `days` earlier, in kg.
 * Null when there is nothing to compare against in that earlier window.
 */
export function averageChange(points: WeightPoint[], days: number): number | null {
  if (points.length === 0) return null
  const latest = points[points.length - 1].date
  const now = averageAt(points, latest)
  const before = averageAt(points, addDays(latest, -days))
  return now === null || before === null ? null : now - before
}

/** The Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const d = parseLocalDate(date)
  const sinceMonday = (d.getDay() + 6) % 7
  return addDays(date, -sinceMonday)
}

export interface WeekSummary {
  weekStart: string
  avg: number
  count: number
}

/** Average weight per Monday-to-Sunday week, oldest first. */
export function weeklyAverages(points: WeightPoint[]): WeekSummary[] {
  const byWeek = new Map<string, number[]>()
  for (const p of points) {
    const key = weekStart(p.date)
    byWeek.set(key, [...(byWeek.get(key) ?? []), p.kg])
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, kgs]) => ({ weekStart: start, avg: kgs.reduce((s, v) => s + v, 0) / kgs.length, count: kgs.length }))
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ms = parseLocalDate(b).getTime() - parseLocalDate(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Round, evenly spaced axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  const span = max - min > 0 ? max - min : 1
  const raw = span / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw)
  const first = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = first; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

/** Keep only points within the last `days` days of the newest point (all points when null). */
export function lastDays(points: WeightPoint[], days: number | null): WeightPoint[] {
  if (days === null || points.length === 0) return points
  const from = addDays(points[points.length - 1].date, -(days - 1))
  return points.filter((p) => p.date >= from)
}

