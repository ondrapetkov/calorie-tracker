import { useState } from 'react'
import { Button, Field, inputCls } from '../../components/ui'
import { SLOTS, SLOT_LABELS, multiplyMacros, type Macros, type Slot } from '../../domain/nutrition'
import { parseNumber } from '../../domain/numbers'
import { MacroPreview } from '../add-food/MacroPreview'

interface Props {
  /** Macros for exactly one serving. */
  perServing: Macros
  initialServings?: number
  initialSlot: Slot
  submitLabel: string
  onSubmit: (servings: number, slot: Slot) => void | Promise<void>
  onDelete?: () => void
}

const QUICK = [0.5, 1, 1.5, 2]

/** Choose how many portions of a meal were eaten, and in which slot. */
export function MealServingsForm({ perServing, initialServings = 1, initialSlot, submitLabel, onSubmit, onDelete }: Props) {
  const [value, setValue] = useState(String(initialServings))
  const [slot, setSlot] = useState<Slot>(initialSlot)
  const [busy, setBusy] = useState(false)
  const parsed = parseNumber(value)
  const valid = parsed !== null && !Number.isNaN(parsed) && parsed > 0

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSubmit(parsed, slot)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Servings eaten">
        <input
          className={inputCls}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Button key={q} className="px-3 py-1.5 text-sm" onClick={() => setValue(String(q))}>
            {q}
          </Button>
        ))}
      </div>
      <MacroPreview macros={multiplyMacros(perServing, valid ? parsed : 0)} />
      <Field label="Meal">
        <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
          {SLOTS.map((s) => (
            <option key={s} value={s}>{SLOT_LABELS[s]}</option>
          ))}
        </select>
      </Field>
      <Button variant="primary" className="w-full" disabled={!valid || busy} onClick={submit}>
        {submitLabel}
      </Button>
      {onDelete && (
        <Button variant="danger" className="w-full" onClick={onDelete}>
          Delete entry
        </Button>
      )}
    </div>
  )
}
