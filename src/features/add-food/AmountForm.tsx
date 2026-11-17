import { useId, useRef, useState, type ReactNode } from 'react'
import { Button, Field, inputCls } from '../../components/ui'
import { SLOTS, SLOT_LABELS, scaleMacros, type Macros, type Slot } from '../../domain/nutrition'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { formatCount, stepCount, type Serving } from '../../domain/servings'
import { MacroPreview } from './MacroPreview'

interface Props {
  per100: Macros
  unit: 'g' | 'ml'
  servingG: number | null
  servingLabel: string | null
  initialGrams?: number
  /** Which way the amount is shown first. Default: servings for a new amount of a food that has a serving size. */
  initialMode?: 'serving' | 'amount'
  initialSlot: Slot
  submitLabel: string
  /** Hide the meal-slot picker (used when building a recipe). */
  hideSlot?: boolean
  /** `serving` is the serving size the amount was entered in, or null when it was entered in g/ml. */
  onSubmit: (grams: number, slot: Slot, serving: Serving | null) => void | Promise<void>
  onDelete?: () => void
  /** More buttons, shown between the submit button and Delete. */
  extraActions?: ReactNode
}

const QUICK = [50, 100, 150, 200]

export function AmountForm(props: Props) {
  const { per100, unit, servingG, servingLabel } = props
  const startsInServings =
    servingG !== null && (props.initialMode ? props.initialMode === 'serving' : props.initialGrams === undefined)
  const [mode, setMode] = useState<'amount' | 'serving'>(startsInServings ? 'serving' : 'amount')
  const [value, setValue] = useState(() => {
    if (props.initialGrams === undefined) return startsInServings ? '1' : '100'
    return startsInServings && servingG ? formatCount(props.initialGrams / servingG) : String(props.initialGrams)
  })
  const inputId = useId()
  const initialValue = useRef(value)
  const initialMode = useRef(mode)
  const [slot, setSlot] = useState<Slot>(props.initialSlot)
  const [busy, setBusy] = useState(false)

  const parsed = parseNumber(value)
  const valid = parsed !== null && !Number.isNaN(parsed) && parsed > 0
  // Unchanged text keeps the exact amount it was opened with (a rounded count times the serving could drift).
  const untouched = props.initialGrams !== undefined && value === initialValue.current && mode === initialMode.current
  const grams = !valid ? 0 : untouched ? props.initialGrams! : mode === 'serving' ? parsed * (servingG ?? 0) : parsed
  const m = scaleMacros(per100, grams)

  const switchMode = (next: 'amount' | 'serving') => {
    if (next === mode) return
    // Carry the current amount across so toggling does not lose the number.
    if (next === 'serving' && servingG) setValue(String(Math.round((grams / servingG) * 100) / 100 || 1))
    else setValue(String(Math.round(grams * 10) / 10 || 100))
    setMode(next)
  }

  const step = (delta: 1 | -1) => setValue(formatCount(stepCount(valid ? parsed : 1, delta)))

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await props.onSubmit(grams, slot, mode === 'serving' && servingG ? { grams: servingG, label: servingLabel } : null)
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

      {/* Not a Field: a <label> wrapping the −/+ buttons would label the first button instead of the box. */}
      <div className="min-w-0">
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-muted">
          {mode === 'serving' ? `Servings${servingLabel ? ` (1 = ${servingLabel})` : ''}` : `Amount (${unit})`}
        </label>
        <div className="flex gap-2">
          {mode === 'serving' && (
            <Button aria-label="Fewer servings" className="px-4" onClick={() => step(-1)}>
              −
            </Button>
          )}
          <input
            id={inputId}
            className={inputCls}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          {mode === 'serving' && (
            <Button aria-label="More servings" className="px-4" onClick={() => step(1)}>
              +
            </Button>
          )}
        </div>
        {mode === 'serving' && servingG && (
          <span className="mt-1 block text-xs text-muted">
            {formatNumber(grams, 0)} {unit} in total
          </span>
        )}
      </div>

      {mode === 'amount' && (
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button key={q} className="px-3 py-1.5 text-sm" onClick={() => setValue(String(q))}>
              {q} {unit}
            </Button>
          ))}
        </div>
      )}

      <MacroPreview macros={m} />

      {!props.hideSlot && (
        <Field label="Meal">
          <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
            {SLOTS.map((s) => (
              <option key={s} value={s}>{SLOT_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      )}

      <Button variant="primary" className="w-full" disabled={!valid || busy} onClick={submit}>
        {props.submitLabel}
      </Button>
      {props.extraActions}
      {props.onDelete && (
        <Button variant="danger" className="w-full" onClick={props.onDelete}>
          Delete entry
        </Button>
      )}
    </div>
  )
}
