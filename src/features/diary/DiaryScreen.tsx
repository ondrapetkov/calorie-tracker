import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { repo } from '../../db/repo'
import type { LogEntry } from '../../db/schema'
import { addDays, dayLabel, localDate } from '../../domain/dates'
import { SLOTS, SLOT_LABELS, defaultSlot, sumMacros, type Slot } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'
import { AddFoodFlow } from '../add-food/AddFoodFlow'
import { WaterCard } from '../body/WaterCard'
import { useTargets } from '../targets/useTargets'
import { DayTotals } from './DayTotals'
import { EditEntrySheet } from './EditEntrySheet'

export function DiaryScreen({ onOpenTargets }: { onOpenTargets: () => void }) {
  const [date, setDate] = useState(localDate)
  const [adding, setAdding] = useState<Slot | null>(null)
  const [editing, setEditing] = useState<LogEntry | null>(null)
  const [showToast, toastNode] = useToast({ raised: true })

  // Undefined while the first query runs, so we do not flash an empty day ("0 kcal") on every tab switch.
  const loadedEntries = useLiveQuery(() => repo.entriesForDate(date), [date])
  const { targets, loading: targetsLoading } = useTargets()
  const loading = loadedEntries === undefined || targetsLoading
  const entries = loadedEntries ?? []
  const totals = sumMacros(entries)

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="px-3" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </Button>
        <button type="button" className="text-lg font-semibold" onClick={() => setDate(localDate())}>
          {dayLabel(date)}
        </button>
        <Button variant="ghost" className="px-3" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          ›
        </Button>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-surface-2" aria-label="Loading" />
      ) : (
        <DayTotals totals={totals} targets={targets} onSetupTargets={onOpenTargets} />
      )}

      {!loading && <WaterCard date={date} onChange={showToast} />}

      {!loading && SLOTS.map((slot) => {
        const rows = entries.filter((e) => e.slot === slot)
        const kcal = rows.reduce((sum, e) => sum + e.kcal, 0)
        return (
          <Card key={slot}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{SLOT_LABELS[slot]}</h3>
              <div className="flex items-center gap-2">
                {rows.length > 0 && <span className="text-sm text-muted">{formatNumber(kcal)} kcal</span>}
                <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => setAdding(slot)}>
                  + Add
                </Button>
              </div>
            </div>
            {rows.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditing(e)}
                className="mt-2 flex w-full items-center gap-3 border-t border-line pt-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{e.label}</div>
                  <div className="text-xs text-muted">
                    {e.mealId !== null
                      ? `${formatNumber(e.servings ?? 1, 2).replace(/\.?0+$/, '')} × meal`
                      : `${formatNumber(e.grams ?? 0, 0)} ${e.unit}`}{' '}
                    · P {formatNumber(e.protein, 1)} · C {formatNumber(e.carbs, 1)} · F{' '}
                    {formatNumber(e.fat, 1)}
                  </div>
                </div>
                <div className="text-sm font-medium">{formatNumber(e.kcal)}</div>
              </button>
            ))}
          </Card>
        )
      })}

      <button
        type="button"
        aria-label="Add food"
        onClick={() => setAdding(defaultSlot(new Date().getHours()))}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-20 h-14 w-14 rounded-full bg-accent text-3xl leading-none text-on-accent shadow-lg active:bg-accent-dim"
      >
        +
      </button>

      {toastNode}

      {adding && (
        <AddFoodFlow
          mode={{ kind: 'log', date, slot: adding, onLogged: (message) => showToast(message) }}
          onClose={() => setAdding(null)}
        />
      )}
      {editing && (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onDeleted={(entry) =>
            showToast('Entry deleted', () => void repo.restoreEntry(entry.id))
          }
        />
      )}
    </div>
  )
}
