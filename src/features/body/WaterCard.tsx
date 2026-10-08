import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, inputCls } from '../../components/ui'
import { DEFAULT_WATER_GOAL_ML, DEFAULT_WATER_PRESETS, repo, type WaterSettings } from '../../db/repo'
import type { WaterEntry } from '../../db/schema'
import { formatNumber, parseNumber } from '../../domain/numbers'

interface Props {
  date: string
  /** Show the entry list and custom amount; the compact form is for the diary. */
  full?: boolean
  /** Called after a change so the screen can show an Undo toast. */
  onChange: (message: string, undo: () => void) => void
}

const DEFAULTS: WaterSettings = { goalMl: DEFAULT_WATER_GOAL_ML, presets: DEFAULT_WATER_PRESETS }

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export function WaterCard({ date, full = false, onChange }: Props) {
  const entries = useLiveQuery(() => repo.waterEntriesForDate(date), [date])
  const settings = useLiveQuery(() => repo.getWaterSettings(), []) ?? DEFAULTS
  const [custom, setCustom] = useState('')

  const list: WaterEntry[] = entries ?? []
  const total = list.reduce((sum, e) => sum + e.ml, 0)
  const ratio = settings.goalMl > 0 ? total / settings.goalMl : 0

  const add = async (ml: number) => {
    const entry = await repo.addWater(date, ml)
    onChange(`Added ${formatNumber(ml)} ml of water`, () => void repo.deleteWater(entry.id))
  }
  const remove = async (e: WaterEntry) => {
    await repo.deleteWater(e.id)
    onChange(`Removed ${formatNumber(e.ml)} ml`, () => void repo.restoreWater(e.id))
  }

  const customMl = parseNumber(custom)
  const customOk = customMl !== null && !Number.isNaN(customMl) && customMl > 0 && customMl <= 5000

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Water</h2>
        <div className="text-sm">
          <span className="text-lg font-semibold">{entries === undefined ? '—' : formatNumber(total)}</span>
          <span className="text-muted"> / {formatNumber(settings.goalMl)} ml</span>
        </div>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Water today"
        aria-valuenow={total}
        aria-valuemax={settings.goalMl}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <div className="mt-1 text-xs text-muted">
        {total >= settings.goalMl ? 'Goal reached' : `${formatNumber(settings.goalMl - total)} ml to go`}
      </div>

      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(settings.presets.length, 3) || 1}, 1fr)` }}>
        {settings.presets.map((p) => (
          <Button key={`${p.label}-${p.ml}`} className="px-1 py-2 text-sm leading-tight" onClick={() => void add(p.ml)}>
            <div className="font-semibold">+{formatNumber(p.ml)} ml</div>
            <div className="text-xs font-normal text-muted">{p.label}</div>
          </Button>
        ))}
      </div>

      {full && (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!customOk) return
              void add(customMl)
              setCustom('')
            }}
          >
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="Other amount (ml)"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <Button type="submit" disabled={!customOk}>
              Add
            </Button>
          </form>

          {list.length > 0 && (
            <div className="mt-3">
              {list.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-line py-1.5 text-sm last:border-0">
                  <span className="text-muted">{timeOf(e.loggedAt)}</span>
                  <span className="flex items-center">
                    <span className="font-medium">{formatNumber(e.ml)} ml</span>
                    <button
                      type="button"
                      aria-label={`Remove ${e.ml} ml at ${timeOf(e.loggedAt)}`}
                      className="px-3 text-xl text-danger"
                      onClick={() => void remove(e)}
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
