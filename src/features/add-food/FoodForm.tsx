import { useState } from 'react'
import { Button, Field, inputCls } from '../../components/ui'
import type { FoodDraft } from '../../api/openFoodFacts'
import type { FoodInput } from '../../db/repo'
import { kcalFromMacros } from '../../domain/nutrition'
import { formatNumber, parseNumber } from '../../domain/numbers'

interface Props {
  initial?: Partial<FoodDraft>
  notice?: string
  submitLabel: string
  onSubmit: (input: FoodInput) => void | Promise<void>
  onDelete?: () => void
}

const show = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(v * 100) / 100))

export function FoodForm({ initial = {}, notice, submitLabel, onSubmit, onDelete }: Props) {
  const p = initial.per100
  const [name, setName] = useState(initial.name ?? '')
  const [brand, setBrand] = useState(initial.brand ?? '')
  const [barcode, setBarcode] = useState(initial.externalId ?? '')
  const [basis, setBasis] = useState<'g' | 'ml'>(initial.basis ?? 'g')
  const [kcal, setKcal] = useState(show(p?.kcal))
  const [protein, setProtein] = useState(show(p?.protein))
  const [carbs, setCarbs] = useState(show(p?.carbs))
  const [fat, setFat] = useState(show(p?.fat))
  const [fiber, setFiber] = useState(show(p?.fiber))
  const [sugar, setSugar] = useState(show(p?.sugar))
  const [salt, setSalt] = useState(show(p?.salt))
  const [serving, setServing] = useState(show(initial.defaultServingG))
  const [servingLabel, setServingLabel] = useState(initial.defaultServingLabel ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const num = (s: string) => parseNumber(s)
  const macrosKcal = (() => {
    const pr = num(protein), c = num(carbs), f = num(fat)
    return pr !== null && c !== null && f !== null && ![pr, c, f].some(Number.isNaN)
      ? kcalFromMacros(pr, c, f)
      : null
  })()

  const submit = async () => {
    const required = { kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat) }
    const optional = { fiber: num(fiber), sugar: num(sugar), salt: num(salt) }
    const servingG = num(serving)
    if (!name.trim()) return setError('Enter a name.')
    for (const [k, v] of Object.entries(required)) {
      if (v === null || Number.isNaN(v)) return setError(`Enter a valid number for ${k} (0 or more).`)
    }
    for (const [k, v] of Object.entries(optional)) {
      if (v !== null && Number.isNaN(v)) return setError(`${k} must be a number (or left blank).`)
    }
    if (servingG !== null && (Number.isNaN(servingG) || servingG <= 0)) {
      return setError('Serving size must be a positive number (or left blank).')
    }
    if (barcode.trim() && !/^\d{6,14}$/.test(barcode.trim())) {
      return setError('Barcode should be 6 to 14 digits (or left blank).')
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit({
        source: initial.source ?? 'custom',
        externalId: barcode.trim() || null,
        name: name.trim(),
        brand: brand.trim() || null,
        basis,
        per100: {
          kcal: required.kcal!,
          protein: required.protein!,
          carbs: required.carbs!,
          fat: required.fat!,
          fiber: optional.fiber,
          sugar: optional.sugar,
          salt: optional.salt,
        },
        defaultServingG: servingG,
        defaultServingLabel: servingG !== null ? servingLabel.trim() || null : null,
      })
    } finally {
      setBusy(false)
    }
  }

  const num2 = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </Field>
  )

  return (
    <div className="space-y-4">
      {notice && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{notice}</p>
      )}
      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Brand (optional)">
        <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} />
      </Field>
      <Field label="Barcode (optional)">
        <input className={inputCls} inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={basis === 'g' ? 'primary' : 'secondary'} onClick={() => setBasis('g')}>Per 100 g</Button>
        <Button variant={basis === 'ml' ? 'primary' : 'secondary'} onClick={() => setBasis('ml')}>Per 100 ml</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {num2('Energy (kcal)', kcal, setKcal)}
        {num2('Protein (g)', protein, setProtein)}
        {num2('Carbs (g)', carbs, setCarbs)}
        {num2('Fat (g)', fat, setFat)}
        {num2('Fiber (g)', fiber, setFiber, 'Blank = unknown')}
        {num2('Sugar (g)', sugar, setSugar, 'Blank = unknown')}
        {num2('Salt (g)', salt, setSalt, 'Blank = unknown')}
      </div>
      {macrosKcal !== null && (
        <Button className="w-full text-sm" onClick={() => setKcal(String(Math.round(macrosKcal)))}>
          Set energy from macros ({formatNumber(macrosKcal)} kcal)
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {num2(`Serving size (${basis}, optional)`, serving, setServing)}
        <Field label="Serving name">
          <input
            className={inputCls}
            placeholder="e.g. 1 slice"
            value={servingLabel}
            onChange={(e) => setServingLabel(e.target.value)}
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button variant="primary" className="w-full" disabled={busy} onClick={submit}>{submitLabel}</Button>
      {onDelete && <Button variant="danger" className="w-full" onClick={onDelete}>Delete food</Button>}
    </div>
  )
}
