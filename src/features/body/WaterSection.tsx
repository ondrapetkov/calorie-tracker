import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, Field, inputCls } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { DEFAULT_WATER_GOAL_ML, DEFAULT_WATER_PRESETS, repo, type WaterSettings } from '../../db/repo'
import { addDays, dayLabel, localDate, parseLocalDate } from '../../domain/dates'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { WaterCard } from './WaterCard'

const DEFAULTS: WaterSettings = { goalMl: DEFAULT_WATER_GOAL_ML, presets: DEFAULT_WATER_PRESETS }
const BAR_AREA = 96

function History({ endDate, goalMl, onPick }: { endDate: string; goalMl: number; onPick: (date: string) => void }) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(endDate, i - 6))
  const totals = useLiveQuery(() => repo.waterTotals(dates), [endDate])
  if (!totals) return <div className="h-32" />
  const max = Math.max(goalMl, ...dates.map((d) => totals[d] ?? 0)) * 1.1
  const goalY = (goalMl / max) * BAR_AREA

  return (
    <div>
      <div className="relative flex items-end justify-between gap-2" style={{ height: BAR_AREA + 18 }}>
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-line-strong"
          style={{ bottom: goalY + 18 }}
          aria-hidden="true"
        >
          <span className="absolute -top-4 right-0 text-[10px] text-muted">goal</span>
        </div>
        {dates.map((d) => {
          const ml = totals[d] ?? 0
          const h = Math.max(ml > 0 ? 3 : 0, (ml / max) * BAR_AREA)
          const selected = d === endDate
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-label={`${dayLabel(d)}: ${formatNumber(ml)} ml`}
              title={`${dayLabel(d)}: ${formatNumber(ml)} ml`}
              className="flex h-full flex-1 flex-col items-center justify-end"
            >
              <span className="mb-0.5 text-[10px] text-muted">{ml > 0 ? (ml / 1000).toFixed(1) : ''}</span>
              <span
                className={`block w-6 max-w-full rounded-t-[4px] ${selected ? 'bg-accent' : 'bg-muted/60'}`}
                style={{ height: h }}
              />
              <span className={`mt-1 text-[10px] ${selected ? 'font-semibold text-fg' : 'text-muted'}`}>
                {parseLocalDate(d).toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Litres per day. Tap a bar to open that day.</p>
    </div>
  )
}

function SettingsForm({ settings, onSaved }: { settings: WaterSettings; onSaved: (message: string) => void }) {
  const [goal, setGoal] = useState(String(settings.goalMl))
  const [presets, setPresets] = useState(settings.presets.map((p) => ({ label: p.label, ml: String(p.ml) })))
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const goalMl = parseNumber(goal)
    if (goalMl === null || Number.isNaN(goalMl) || goalMl < 250 || goalMl > 10000) {
      return setError('Daily goal should be between 250 and 10,000 ml.')
    }
    const parsed = presets.map((p) => ({ label: p.label.trim(), ml: parseNumber(p.ml) }))
    if (parsed.some((p) => !p.label || p.ml === null || Number.isNaN(p.ml) || p.ml <= 0 || p.ml > 5000)) {
      return setError('Each button needs a name and an amount between 1 and 5,000 ml.')
    }
    setError(null)
    const ok = await repo.saveWaterSettings({
      goalMl,
      presets: parsed.map((p) => ({ label: p.label, ml: p.ml as number })),
    })
    onSaved(ok ? 'Water settings saved.' : 'Set up your targets first; water settings are stored with your profile.')
  }

  return (
    <div className="mt-3 space-y-3">
      <Field label="Daily goal (ml)">
        <input className={inputCls} inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </Field>
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted">Quick-add buttons</div>
        {presets.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              aria-label={`Button ${i + 1} name`}
              className={inputCls}
              value={p.label}
              onChange={(e) => setPresets((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <input
              aria-label={`Button ${i + 1} amount in ml`}
              className={`${inputCls} !w-28`}
              inputMode="numeric"
              value={p.ml}
              onChange={(e) => setPresets((all) => all.map((x, j) => (j === i ? { ...x, ml: e.target.value } : x)))}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button className="w-full" onClick={save}>
        Save water settings
      </Button>
    </div>
  )
}

export function WaterSection() {
  const [date, setDate] = useState(localDate)
  const [showToast, toastNode] = useToast()
  const [note, setNote] = useState<string | null>(null)
  const settings = useLiveQuery(() => repo.getWaterSettings(), [])
  const today = localDate()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="px-3" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </Button>
        <button type="button" className="text-lg font-semibold" onClick={() => setDate(today)}>
          {dayLabel(date)}
        </button>
        <Button
          variant="ghost"
          className="px-3"
          disabled={date >= today}
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
        >
          ›
        </Button>
      </div>

      <WaterCard date={date} full onChange={showToast} />

      <Card>
        <h2 className="mb-2 font-semibold">Last 7 days</h2>
        <History endDate={date} goalMl={(settings ?? DEFAULTS).goalMl} onPick={setDate} />
      </Card>

      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium">Water settings</summary>
        {settings && <SettingsForm key={JSON.stringify(settings)} settings={settings} onSaved={setNote} />}
        {note && <p className="mt-2 text-sm text-accent">{note}</p>}
      </details>
      {toastNode}
    </div>
  )
}
