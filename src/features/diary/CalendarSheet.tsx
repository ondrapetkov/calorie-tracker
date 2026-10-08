import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Sheet } from '../../components/ui'
import { repo } from '../../db/repo'
import { addMonths, gridRange, monthGrid, monthTitle } from '../../domain/calendar'
import { localDate, parseLocalDate } from '../../domain/dates'

interface Props {
  selected: string
  onSelect: (date: string) => void
  onClose: () => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A month calendar for jumping to any day. Days that have diary entries carry a dot. */
export function CalendarSheet({ selected, onSelect, onClose }: Props) {
  const start = parseLocalDate(selected)
  const [view, setView] = useState({ year: start.getFullYear(), month: start.getMonth() })
  const today = localDate()
  const weeks = monthGrid(view.year, view.month)
  const { from, to } = gridRange(view.year, view.month)
  const marked = useLiveQuery(() => repo.datesWithEntries(from, to), [from, to])

  const go = (months: number) => setView((v) => addMonths(v.year, v.month, months))

  return (
    <Sheet title="Choose a day" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex">
            <Button variant="ghost" className="px-2" aria-label="Previous year" onClick={() => go(-12)}>«</Button>
            <Button variant="ghost" className="px-3" aria-label="Previous month" onClick={() => go(-1)}>‹</Button>
          </div>
          <h2 className="text-lg font-semibold" aria-live="polite">{monthTitle(view.year, view.month)}</h2>
          <div className="flex">
            <Button variant="ghost" className="px-3" aria-label="Next month" onClick={() => go(1)}>›</Button>
            <Button variant="ghost" className="px-2" aria-label="Next year" onClick={() => go(12)}>»</Button>
          </div>
        </div>

        <div role="grid" aria-label={monthTitle(view.year, view.month)}>
          <div role="row" className="grid grid-cols-7 text-center text-xs text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} role="columnheader" className="py-1">{d}</div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].date} role="row" className="grid grid-cols-7">
              {week.map((cell) => {
                const isSelected = cell.date === selected
                const isToday = cell.date === today
                const hasEntries = marked?.has(cell.date) ?? false
                return (
                  <button
                    key={cell.date}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${parseLocalDate(cell.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${hasEntries ? ', has entries' : ''}`}
                    onClick={() => onSelect(cell.date)}
                    className={`relative m-0.5 flex h-12 flex-col items-center justify-center rounded-lg text-base ${
                      isSelected
                        ? 'bg-accent font-semibold text-on-accent'
                        : cell.inMonth
                          ? 'text-fg active:bg-surface-2'
                          : 'text-muted/50 active:bg-surface-2'
                    } ${isToday && !isSelected ? 'ring-1 ring-inset ring-accent' : ''}`}
                  >
                    {parseLocalDate(cell.date).getDate()}
                    {hasEntries && (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1.5 h-1 w-1 rounded-full ${isSelected ? 'bg-on-accent' : 'bg-accent'}`}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">A dot marks a day with diary entries.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => onSelect(today)}>Today</Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Sheet>
  )
}
