import { useState } from 'react'
import { Button, Field, inputCls } from '../../components/ui'
import { SLOTS, SLOT_LABELS, scaleMacros, type Macros, type Slot } from '../../domain/nutrition'
import { formatNumber, parseNumber } from '../../domain/numbers'

interface Props {
  per100: Macros
  unit: 'g' | 'ml'
  servingG: number | null
  servingLabel: string | null
  initialGrams?: number
  initialSlot: Slot
  submitLabel: string
  onSubmit: (grams: number, slot: Slot) => void | Promise<void>
  onDelete?: () => void
}

const QUICK = [50, 100, 150, 200]

export function AmountForm(props: Props) {
  const { per100, unit, servingG, servingLabel } = props
  const startsInServings = props.initialGrams === undefined && servingG !== null
  const [mode, setMode] = useState<'amount' | 'serving'>(startsInServings ? 'serving' : 'amount')
  const [value, setValue] = useState(
    startsInServings ? '1' : String(props.initialGrams ?? 100),
  )
  const [slot, setSlot] = useState<Slot>(props.initialSlot)
  const [busy, setBusy] = useState(false)

  const parsed = parseNumber(value)
  const valid = parsed !== null && !Number.isNaN(parsed) && parsed > 0
  const grams = valid ? (mode === 'serving' ? parsed * (servingG ?? 0) : parsed) : 0
  const m = scaleMacros(per100, grams)

  const switchMode = (next: 'amount' | 'serving') => {
    if (next === mode) return
    // Carry the current amount across so toggling does not lose the number.
    if (next === 'serving' && servingG) setValue(String(Math.round((grams / servingG) * 100) / 100 || 1))
    else setValue(String(Math.round(grams * 10) / 10 || 100))
    setMode(next)
  }

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await props.onSubmit(grams, slot)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {servingG !== null && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'serving' ? 'primary' : 'secondary'} onClick={() => switchMode('serving')}>
            Servings
          </Button>
          <Button variant={mode === 'amount' ? 'primary' : 'secondary'} onClick={() => switchMode('amount')}>
            {unit === 'ml' ? 'Millilitres' : 'Grams'}
          </Button>
        </div>
      )}

      <Field
        label={mode === 'serving' ? `Servings${servingLabel ? ` (1 = ${servingLabel})` : ''}` : `Amount (${unit})`}
        hint={mode === 'serving' && servingG ? `${formatNumber(grams, 0)} ${unit} in total` : undefined}
      >
        <input
          className={inputCls}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </Field>

      {mode === 'amount' && (
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button key={q} className="px-3 py-1.5 text-sm" onClick={() => setValue(String(q))}>
              {q} {unit}
            </Button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <span className="text-3xl font-semibold">{formatNumber(m.kcal)}</span>
          <span className="ml-1 text-slate-500">kcal</span>
        </div>
        <div className="mt-2 grid grid-cols-3 text-center text-sm">
          <div><div className="font-medium">{formatNumber(m.protein, 1)} g</div><div className="text-slate-500">Protein</div></div>
          <div><div className="font-medium">{formatNumber(m.carbs, 1)} g</div><div className="text-slate-500">Carbs</div></div>
          <div><div className="font-medium">{formatNumber(m.fat, 1)} g</div><div className="text-slate-500">Fat</div></div>
        </div>
        <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-500">
          <div>Fiber {m.fiber === null ? '—' : `${formatNumber(m.fiber, 1)} g`}</div>
          <div>Sugar {m.sugar === null ? '—' : `${formatNumber(m.sugar, 1)} g`}</div>
          <div>Salt {m.salt === null ? '—' : `${formatNumber(m.salt, 2)} g`}</div>
        </div>
      </div>

      <Field label="Meal">
        <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
          {SLOTS.map((s) => (
            <option key={s} value={s}>{SLOT_LABELS[s]}</option>
          ))}
        </select>
      </Field>

      <Button variant="primary" className="w-full" disabled={!valid || busy} onClick={submit}>
        {props.submitLabel}
      </Button>
      {props.onDelete && (
        <Button variant="danger" className="w-full" onClick={props.onDelete}>
          Delete entry
        </Button>
      )}
    </div>
  )
}
