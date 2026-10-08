import { addDays } from './dates'

export interface CalendarCell {
  date: string
  /** False for the days of the neighbouring months that fill out the first and last week. */
  inMonth: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export function firstOfMonth(year: number, month: number): string {
  return `${year}-${pad(month + 1)}-01`
}

/** The weeks of a month, Monday first. `month` is 0-11. */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7 // days from the Monday on or before the 1st
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const start = addDays(firstOfMonth(year, month), -lead)
  const weeks = Math.ceil((lead + daysInMonth) / 7)
  const prefix = `${year}-${pad(month + 1)}-`
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d)
      return { date, inMonth: date.startsWith(prefix) }
    }),
  )
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** First and last day of the grid shown for a month, for loading which days have entries. */
export function gridRange(year: number, month: number): { from: string; to: string } {
  const weeks = monthGrid(year, month)
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date }
}

