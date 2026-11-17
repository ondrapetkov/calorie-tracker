import { useId, useState, type ReactNode } from 'react'
import { Button, Field, inputCls } from '../../components/ui'
import { SLOTS, SLOT_LABELS, scaleMacros, type Macros, type Slot } from '../../domain/nutrition'
import { formatNumber, parseNumber } from '../../domain/numbers'
import {
  amountState,
  formatCount,
  stateGrams,
  stepCount,
  switchServing,
  type AmountState,
  type Serving,
} from '../../domain/servings'
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
  const size: Serving | null = servingG !== null ? { grams: servingG, label: servingLabel } : null
  const startsInServings =
    size !== null && (props.initialMode ? props.initialMode === 'serving' : props.initialGrams === undefined)
  // The serving lives in the state, so the amount stays right even if the food's serving size changes meanwhile.
  const [amount, setAmount] = useState<AmountState>(() => {
    const serving = startsInServings ? size : null
    if (props.initialGrams === undefined) return { text: serving ? '1' : '100', serving, exact: null }
    return amountState(props.initialGrams, serving)
  })
  const mode = amount.serving ? 'serving' : 'amount'
  const value = amount.text
  const setValue = (text: string) => setAmount((a) => ({ ...a, text }))
  const inputId = useId()
  const [slot, setSlot] = useState<Slot>(props.initialSlot)
  const [busy, setBusy] = useState(false)

  const exactGrams = stateGrams(amount)
  const valid = exactGrams !== null
  const grams = exactGrams ?? 0
  const m = scaleMacros(per100, grams)

  // Carries the exact amount across, so looking at it the other way never changes it.
  const switchMode = (next: 'amount' | 'serving') => {
    if (next !== mode) setAmount((a) => switchServing(a, next === 'serving' ? size : null))
  }

  const step = (delta: 1 | -1) => {
    const n = parseNumber(value)
    setValue(formatCount(stepCount(n !== null && !Number.isNaN(n) && n > 0 ? n : 1, delta)))
  }

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await props.onSubmit(grams, slot, amount.serving)
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
        {mode === 'serving' && (
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
