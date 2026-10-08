import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card } from '../../components/ui'
import { Segmented } from '../../components/Segmented'
import { repo } from '../../db/repo'
import type { LogEntry } from '../../db/schema'
import { localDate } from '../../domain/dates'
import { formatNumber } from '../../domain/numbers'
import {
  buckets as makeBuckets,
  containsDate,
  dailyTotals,
  periodFor,
  periodLabel,
  shiftPeriod,
  summarize,
  type PeriodKind,
} from '../../domain/stats'
import { useTargets } from '../targets/useTargets'
import { StatsChart } from './StatsChart'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function StatsPanel() {
  const [kind, setKind] = useState<PeriodKind>('week')
  const [period, setPeriod] = useState(() => periodFor('week', localDate()))
  const { targets } = useTargets()

  const rows = useLiveQuery(() => repo.entriesInRange(period.from, period.to), [period.from, period.to])
  const entries: LogEntry[] = rows ?? []
  const days = dailyTotals(entries)
  const summary = summarize(days, period)
  const bars = makeBuckets(period, days)
  const target = targets?.kcal ?? null
  const today = localDate()
  const isCurrent = containsDate(period, today)

  const changeKind = (k: PeriodKind) => {
    setKind(k)
    setPeriod(periodFor(k, containsDate(period, today) ? today : period.from))
  }

  const diff = target !== null && summary.loggedDays > 0 ? summary.avg.kcal - target : null

  return (
    <div className="space-y-4">
      <Segmented label="Period" value={kind} options={KINDS} onChange={changeKind} />

      <div className="flex items-center justify-between">
        <Button variant="ghost" className="px-3" aria-label={`Previous ${kind}`} onClick={() => setPeriod(shiftPeriod(period, -1))}>
          ‹
        </Button>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 text-base font-semibold active:bg-surface-2"
          onClick={() => setPeriod(periodFor(kind, today))}
          aria-label={`${periodLabel(period)}, show the current ${kind}`}
        >
          {periodLabel(period)}
        </button>
        <Button
          variant="ghost"
          className="px-3"
          aria-label={`Next ${kind}`}
          disabled={isCurrent}
          onClick={() => setPeriod(shiftPeriod(period, 1))}
        >
          ›
        </Button>
      </div>

      {rows === undefined ? (
        <div className="h-48 animate-pulse rounded-xl bg-surface-2" aria-label="Loading" />
      ) : summary.loggedDays === 0 ? (
        <Card>
          <p className="text-center text-sm text-muted">
            Nothing logged in this {kind}. Days you log in the diary show up here.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="text-center">
              <span className="text-4xl font-semibold">{formatNumber(summary.avg.kcal)}</span>
              <span className="ml-1 text-muted">kcal / day</span>
              <div className="text-xs text-muted">average over the days you logged</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Days logged" value={`${summary.loggedDays} of ${summary.totalDays}`} />
              <Stat label="Total" value={`${formatNumber(summary.totalKcal)} kcal`} />
              <Stat
                label="vs target"
                value={diff === null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${formatNumber(Math.abs(diff))}`}
                sub={diff === null ? 'no target set' : `kcal / day (${formatNumber(target!)})`}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
              <Stat
                label="Protein / day"
                value={`${formatNumber(summary.avg.protein)} g`}
                sub={summary.split ? `${formatNumber(summary.split.protein)}% of macro kcal` : undefined}
              />
              <Stat
                label="Carbs / day"
                value={`${formatNumber(summary.avg.carbs)} g`}
                sub={summary.split ? `${formatNumber(summary.split.carbs)}%` : undefined}
              />
              <Stat
                label="Fat / day"
                value={`${formatNumber(summary.avg.fat)} g`}
                sub={summary.split ? `${formatNumber(summary.split.fat)}%` : undefined}
              />
            </div>
            {targets && (
              <p className="mt-2 text-center text-xs text-muted">
                Targets: {targets.protein} g protein · {targets.carbs} g carbs · {targets.fat} g fat
              </p>
            )}
          </Card>

          <Card>
            <StatsChart key={`${kind}-${period.from}`} kind={kind} buckets={bars} target={target} />
          </Card>

          <Card>
            <h2 className="font-semibold">{kind === 'year' ? 'By month' : 'By day'}</h2>
            <div className="mt-2">
              {[...bars]
                .filter((b) => b.kcal !== null)
                .reverse()
                .map((b) => (
                  <div key={b.key} className="flex items-center justify-between border-b border-line py-1.5 text-sm last:border-0">
                    <span>
                      {b.title}
                      {kind === 'year' && <span className="text-muted"> · {b.loggedDays} days</span>}
                    </span>
                    <span>
                      <span className="font-medium">{formatNumber(b.kcal ?? 0)} kcal</span>
                      <span className="ml-2 text-xs text-muted">
                        P {formatNumber(b.protein ?? 0)} · C {formatNumber(b.carbs ?? 0)} · F {formatNumber(b.fat ?? 0)}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          <p className="text-xs text-muted">
            Averages count only days with entries, so a day you did not log does not drag them down. Comparisons use your
            current calorie target.
          </p>
        </>
      )}
    </div>
  )
}
