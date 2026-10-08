import { useState } from 'react'
import { Button, Field, Sheet, inputCls } from '../../components/ui'
import type { FoodDraft } from '../../api/openFoodFacts'
import type { FoodInput } from '../../db/repo'
import type { FoodSource } from '../../domain/nutrition'
import { kcalFromMacros } from '../../domain/nutrition'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { describeFilled, fillEmptyFields, toFormValues, type FormValues } from './formValues'
import { isFood } from './draft'
import { ScanView } from './ScanView'

interface Props {
  initial?: Partial<FoodDraft>
  notice?: string
  submitLabel: string
  onSubmit: (input: FoodInput) => void | Promise<void>
  onDelete?: () => void
}

export function FoodForm({ initial = {}, notice, submitLabel, onSubmit, onDelete }: Props) {
  const [v, setV] = useState<FormValues>(() => toFormValues(initial))
  const [source, setSource] = useState<FoodSource>(initial.source ?? 'custom')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)

  const set = <K extends keyof FormValues>(key: K) => (value: FormValues[K]) => setV((prev) => ({ ...prev, [key]: value }))

  const num = (s: string) => parseNumber(s)
  const macrosKcal = (() => {
    const pr = num(v.protein), c = num(v.carbs), f = num(v.fat)
    return pr !== null && c !== null && f !== null && ![pr, c, f].some(Number.isNaN)
      ? kcalFromMacros(pr, c, f)
      : null
  })()

  /** A barcode was scanned (or looked up). Fill what is blank and say what happened. */
  const applyScan = (scanned: Partial<FoodDraft>, savedAs?: string) => {
    const { values, filled } = fillEmptyFields(v, scanned)
    setV(values)
    if (scanned.source === 'off' && source === 'custom') setSource('off')
    const what = describeFilled(filled)
    const parts: string[] = []
    if (savedAs) parts.push(`You already have "${savedAs}" saved with this barcode; saving this will add a second entry.`)
    else if (what) parts.push(`Filled in from Open Food Facts: ${what}. Check the values and set your own portion size.`)
    else if (scanned.name) parts.push('Found the product, but every field you could fill is already filled.')
    else parts.push('Barcode saved in the form. This product is not in Open Food Facts, so enter its values yourself.')
    setScanNote(parts.join(' '))
    setScanning(false)
  }

  const submit = async () => {
    const required = { kcal: num(v.kcal), protein: num(v.protein), carbs: num(v.carbs), fat: num(v.fat) }
    const optional = { fiber: num(v.fiber), sugar: num(v.sugar), salt: num(v.salt) }
    const servingG = num(v.serving)
    if (!v.name.trim()) return setError('Enter a name.')
    for (const [k, value] of Object.entries(required)) {
      if (value === null || Number.isNaN(value)) return setError(`Enter a valid number for ${k} (0 or more).`)
    }
    for (const [k, value] of Object.entries(optional)) {
      if (value !== null && Number.isNaN(value)) return setError(`${k} must be a number (or left blank).`)
    }
    if (servingG !== null && (Number.isNaN(servingG) || servingG <= 0)) {
      return setError('Serving size must be a positive number (or left blank).')
    }
    if (v.barcode.trim() && !/^\d{6,14}$/.test(v.barcode.trim())) {
      return setError('Barcode should be 6 to 14 digits (or left blank).')
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit({
        source,
        externalId: v.barcode.trim() || null,
        name: v.name.trim(),
        brand: v.brand.trim() || null,
        basis: v.basis,
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
        defaultServingLabel: servingG !== null ? v.servingLabel.trim() || null : null,
      })
    } finally {
      setBusy(false)
    }
  }

  const numberField = (label: string, key: keyof FormValues, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} inputMode="decimal" value={v[key]} onChange={(e) => set(key)(e.target.value as never)} />
    </Field>
  )

  return (
    <div className="space-y-4">
      {notice && <p className="rounded-lg bg-warn-bg p-3 text-sm text-warn">{notice}</p>}
      <Field label="Name">
        <input className={inputCls} value={v.name} onChange={(e) => set('name')(e.target.value)} />
      </Field>
      <Field label="Brand (optional)">
        <input className={inputCls} value={v.brand} onChange={(e) => set('brand')(e.target.value)} />
      </Field>

      <div>
        <Field label="Barcode (optional)">
          <div className="flex gap-2">
            <input
              className={inputCls}
              inputMode="numeric"
              value={v.barcode}
              onChange={(e) => set('barcode')(e.target.value)}
            />
            <Button className="whitespace-nowrap" onClick={() => setScanning(true)}>
              Scan
            </Button>
          </div>
        </Field>
        <p className="mt-1 text-xs text-muted">
          Scanning looks the product up and fills in the blank fields, including its portion size. Your own entries are
          never overwritten.
        </p>
        {scanNote && <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm">{scanNote}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={v.basis === 'g' ? 'primary' : 'secondary'} onClick={() => set('basis')('g')}>Per 100 g</Button>
        <Button variant={v.basis === 'ml' ? 'primary' : 'secondary'} onClick={() => set('basis')('ml')}>Per 100 ml</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {numberField('Energy (kcal)', 'kcal')}
        {numberField('Protein (g)', 'protein')}
        {numberField('Carbs (g)', 'carbs')}
        {numberField('Fat (g)', 'fat')}
        {numberField('Fiber (g)', 'fiber', 'Blank = unknown')}
        {numberField('Sugar (g)', 'sugar', 'Blank = unknown')}
        {numberField('Salt (g)', 'salt', 'Blank = unknown')}
      </div>
      {macrosKcal !== null && (
        <Button className="w-full text-sm" onClick={() => set('kcal')(String(Math.round(macrosKcal)))}>
          Set energy from macros ({formatNumber(macrosKcal)} kcal)
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {numberField(`Serving size (${v.basis}, optional)`, 'serving')}
        <Field label="Serving name">
          <input
            className={inputCls}
            placeholder="e.g. 1 slice"
            value={v.servingLabel}
            onChange={(e) => set('servingLabel')(e.target.value)}
          />
        </Field>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button variant="primary" className="w-full" disabled={busy} onClick={submit}>{submitLabel}</Button>
      {onDelete && <Button variant="danger" className="w-full" onClick={onDelete}>Delete food</Button>}

      {scanning && (
        <Sheet title="Scan barcode" onClose={() => setScanning(false)}>
          <ScanView
            onFound={(item) => (isFood(item) && !onDelete ? applyScan(item, item.name) : applyScan(item))}
            onNotFound={(code) => applyScan({ externalId: code })}
          />
        </Sheet>
      )}
    </div>
  )
}
