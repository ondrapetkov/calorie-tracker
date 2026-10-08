import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card } from '../../components/ui'
import { repo } from '../../db/repo'
import type { LogEntry } from '../../db/schema'
import { addDays, dayLabel, localDate } from '../../domain/dates'
import { SLOTS, SLOT_LABELS, defaultSlot, sumMacros, type Slot } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'
import { AddFoodFlow } from '../add-food/AddFoodFlow'
import { useTargets } from '../targets/useTargets'
import { DayTotals } from './DayTotals'
import { EditEntrySheet } from './EditEntrySheet'

interface Toast {
  message: string
  undo?: () => void
}

export function DiaryScreen({ onOpenTargets }: { onOpenTargets: () => void }) {
  const [date, setDate] = useState(localDate)
  const [adding, setAdding] = useState<Slot | null>(null)
  const [editing, setEditing] = useState<LogEntry | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  // Undefined while the first query runs, so we do not flash an empty day ("0 kcal") on every tab switch.
  const loadedEntries = useLiveQuery(() => repo.entriesForDate(date), [date])
  const { targets, loading: targetsLoading } = useTargets()
  const loading = loadedEntries === undefined || targetsLoading
  const entries = loadedEntries ?? []
  const totals = sumMacros(entries)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-40 pt-[calc(env(safe-area-inset-top)+1rem)]">
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
        <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" aria-label="Loading" />
      ) : (
        <DayTotals totals={totals} targets={targets} onSetupTargets={onOpenTargets} />
      )}

      {!loading && SLOTS.map((slot) => {
        const rows = entries.filter((e) => e.slot === slot)
        const kcal = rows.reduce((sum, e) => sum + e.kcal, 0)
        return (
          <Card key={slot}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{SLOT_LABELS[slot]}</h3>
              <div className="flex items-center gap-2">
                {rows.length > 0 && <span className="text-sm text-slate-500">{formatNumber(kcal)} kcal</span>}
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
                className="mt-2 flex w-full items-center gap-3 border-t border-slate-100 pt-2 text-left dark:border-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{e.label}</div>
                  <div className="text-xs text-slate-500">
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
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-20 h-14 w-14 rounded-full bg-emerald-600 text-3xl leading-none text-white shadow-lg active:bg-emerald-700"
      >
        +
      </button>

      {toast && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+8rem)] z-30 mx-auto flex max-w-xl items-center justify-between rounded-lg bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className="font-semibold text-emerald-300"
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {adding && (
        <AddFoodFlow
          mode={{ kind: 'log', date, slot: adding, onLogged: (message) => setToast({ message }) }}
          onClose={() => setAdding(null)}
        />
      )}
      {editing && (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onDeleted={(entry) =>
            setToast({ message: 'Entry deleted', undo: () => void repo.restoreEntry(entry.id) })
          }
        />
      )}
    </div>
  )
}
