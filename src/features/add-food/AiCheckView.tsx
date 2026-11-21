import { useState } from 'react'
import { Button, Field, inputCls } from '../../components/ui'
import type { AiEstimate } from '../../domain/aiEstimate'
import { SLOTS, SLOT_LABELS, multiplyMacros, type Slot } from '../../domain/nutrition'
import { parseNumber } from '../../domain/numbers'
import { MacroPreview } from './MacroPreview'

/** What was read from the AI's answer, to check and adjust before adding it to the diary. */
export function AiCheckView({
  estimate,
  initialSlot,
  onAdd,
}: {
  estimate: AiEstimate
  initialSlot: Slot
  onAdd: (name: string, grams: number, slot: Slot) => void
}) {
  const [name, setName] = useState(estimate.name)
  const [amount, setAmount] = useState(String(estimate.grams))
  const [slot, setSlot] = useState<Slot>(initialSlot)
  const parsed = parseNumber(amount)
  const grams = parsed !== null && !Number.isNaN(parsed) && parsed > 0 ? parsed : null
  const ok = !!name.trim() && grams !== null

  return (
    <div className="space-y-4">
      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Amount (g)" hint="The AI's estimate. Change it and the values scale with it.">
        <input
          className={inputCls}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </Field>
      <MacroPreview macros={multiplyMacros(estimate.totals, (grams ?? 0) / estimate.grams)} />
      <Field label="Meal">
        <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Button variant="primary" className="w-full" disabled={!ok} onClick={() => ok && onAdd(name.trim(), grams!, slot)}>
        Add to diary
      </Button>
    </div>
  )
}
