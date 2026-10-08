import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, Field, inputCls } from '../../components/ui'
import { Segmented } from '../../components/Segmented'
import { useToast } from '../../components/Toast'
import { repo } from '../../db/repo'
import type { WeightEntry } from '../../db/schema'
import { localDate, parseLocalDate } from '../../domain/dates'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { averageAt, averageChange, lastDays, weeklyAverages } from '../../domain/weight'
import { WeightChart } from './WeightChart'

type Range = '30' | '90' | 'all'
const RANGE_DAYS: Record<Range, number | null> = { '30': 30, '90': 90, all: null }

const dayLabel = (d: string) =>
  parseLocalDate(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function signed(v: number | null, digits = 1): string {
  if (v === null) return '—'
  const r = Math.round(v * 10 ** digits) / 10 ** digits
  if (r === 0) return '0.0 kg'
  return `${r > 0 ? '+' : '−'}${formatNumber(Math.abs(r), digits)} kg`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

export function WeightSection() {
  const loaded = useLiveQuery(() => repo.weightEntries(), [])
  const entries: WeightEntry[] = loaded ?? []
  const [range, setRange] = useState<Range>('30')
  const [date, setDate] = useState(localDate)
  const [kgText, setKgText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showToast, toastNode] = useToast()

  const today = localDate()
  const points = entries.map((e) => ({ date: e.date, kg: e.kg }))
  const latest = points[points.length - 1]
  const inRange = lastDays(points, RANGE_DAYS[range])
  const weeks = weeklyAverages(points).slice(-8).reverse()
  const avgNow = latest ? averageAt(points, latest.date) : null

  const kg = parseNumber(kgText)
  const kgOk = kg !== null && !Number.isNaN(kg) && kg >= 30 && kg <= 300
  const existing = entries.find((e) => e.date === date)

  const save = async () => {
    if (!kgOk) return setError('Enter a weight between 30 and 300 kg.')
    if (date > today) return setError('That date is in the future.')
    setError(null)
    await repo.setWeight(date, kg)
    showToast(`Saved ${formatNumber(kg, 1)} kg for ${dayLabel(date)}`)
    setKgText('')
    setDate(today)
  }

  const remove = async (e: WeightEntry) => {
    await repo.deleteWeight(e.id)
    showToast(`Deleted ${formatNumber(e.kg, 1)} kg (${dayLabel(e.date)})`, () => void repo.restoreWeight(e.id))
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold">Log weight</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputCls} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </Field>
          <Field label="Weight (kg)" hint={existing ? `Replaces ${formatNumber(existing.kg, 1)} kg` : latest ? `Last: ${formatNumber(latest.kg, 1)} kg` : undefined}>
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder={latest ? formatNumber(latest.kg, 1) : '0.0'}
              value={kgText}
              onChange={(e) => setKgText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
            />
          </Field>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button variant="primary" className="mt-3 w-full" onClick={save}>
          Save weight
        </Button>
      </Card>

      {loaded === undefined ? null : entries.length === 0 ? (
        <p className="text-sm text-muted">No weigh-ins yet. Weigh yourself at the same time each day, such as after waking up, for a clear trend.</p>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Latest" value={`${formatNumber(latest.kg, 1)} kg`} />
              <Stat label="7-day average" value={avgNow === null ? '—' : `${formatNumber(avgNow, 1)} kg`} />
              <Stat label="Avg vs 7 days ago" value={signed(averageChange(points, 7))} />
            </div>
            <div className="mt-2 text-center text-xs text-muted">
              Average vs 30 days ago: {signed(averageChange(points, 30))}
            </div>
          </Card>

          <Segmented
            label="Chart range"
            value={range}
            onChange={setRange}
            options={[
              { id: '30', label: '30 days' },
              { id: '90', label: '90 days' },
              { id: 'all', label: 'All' },
            ]}
          />
          <Card>
            <WeightChart points={inRange} allPoints={points} />
          </Card>

          {weeks.length > 0 && (
            <Card>
              <h2 className="font-semibold">Weekly averages</h2>
              <p className="text-xs text-muted">Monday to Sunday</p>
              <div className="mt-2">
                {weeks.map((w, i) => {
                  const prev = weeks[i + 1]
                  const delta = prev ? w.avg - prev.avg : null
                  return (
                    <div key={w.weekStart} className="flex items-center justify-between border-b border-line py-1.5 text-sm last:border-0">
                      <span>
                        Week of {parseLocalDate(w.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        <span className="text-muted"> · {w.count} weigh-in{w.count === 1 ? '' : 's'}</span>
                      </span>
                      <span>
                        <span className="font-medium">{formatNumber(w.avg, 1)} kg</span>
                        <span className="ml-2 text-xs text-muted">{delta === null ? '' : signed(delta)}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold">History</h2>
            <p className="text-xs text-muted">Tap a row to correct it.</p>
            <div className="mt-2">
              {[...entries].reverse().map((e) => (
                <div key={e.id} className="flex items-center border-b border-line last:border-0">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between py-2 text-left"
                    onClick={() => {
                      setDate(e.date)
                      setKgText(String(e.kg))
                      window.scrollTo({ top: 0 })
                    }}
                  >
                    <span className="text-sm">{dayLabel(e.date)}</span>
                    <span className="font-medium">{formatNumber(e.kg, 1)} kg</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete weight for ${dayLabel(e.date)}`}
                    className="px-3 py-2 text-xl text-danger"
                    onClick={() => void remove(e)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
      {toastNode}
    </div>
  )
}
