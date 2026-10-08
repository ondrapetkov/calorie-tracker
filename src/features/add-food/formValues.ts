import type { FoodDraft } from '../../api/openFoodFacts'

/** The custom-food form as typed text, so a half-filled form is representable. */
export interface FormValues {
  name: string
  brand: string
  barcode: string
  basis: 'g' | 'ml'
  kcal: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  sugar: string
  salt: string
  serving: string
  servingLabel: string
}

const show = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(v * 100) / 100))

export function toFormValues(initial: Partial<FoodDraft> = {}): FormValues {
  const p = initial.per100
  return {
    name: initial.name ?? '',
    brand: initial.brand ?? '',
    barcode: initial.externalId ?? '',
    basis: initial.basis ?? 'g',
    kcal: show(p?.kcal),
    protein: show(p?.protein),
    carbs: show(p?.carbs),
    fat: show(p?.fat),
    fiber: show(p?.fiber),
    sugar: show(p?.sugar),
    salt: show(p?.salt),
    serving: show(initial.defaultServingG),
    servingLabel: initial.defaultServingLabel ?? '',
  }
}

const FIELD_NAMES: Record<keyof FormValues, string> = {
  name: 'name',
  brand: 'brand',
  barcode: 'barcode',
  basis: 'unit',
  kcal: 'energy',
  protein: 'protein',
  carbs: 'carbs',
  fat: 'fat',
  fiber: 'fiber',
  sugar: 'sugar',
  salt: 'salt',
  serving: 'serving size',
  servingLabel: 'serving name',
}

/**
 * Fill a form from a scanned product. The barcode is always set (the scan is deliberate), but every
 * other field is only filled when it is still empty, so nothing you typed is overwritten. The
 * unit (per 100 g or ml) is taken from the product only while no nutrition values are entered yet.
 * Returns the new values and which fields were filled.
 */
export function fillEmptyFields(current: FormValues, scanned: Partial<FoodDraft>): { values: FormValues; filled: (keyof FormValues)[] } {
  const incoming = toFormValues(scanned)
  const values = { ...current }
  const filled: (keyof FormValues)[] = []

  if (incoming.barcode && incoming.barcode !== current.barcode) {
    values.barcode = incoming.barcode
    filled.push('barcode')
  }

  const noNutrition = !current.kcal && !current.protein && !current.carbs && !current.fat
  if (noNutrition && scanned.basis && scanned.basis !== current.basis) {
    values.basis = scanned.basis
    filled.push('basis')
  }

  const textFields: (keyof FormValues)[] = ['name', 'brand', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt', 'serving', 'servingLabel']
  for (const key of textFields) {
    if (!current[key] && incoming[key]) {
      ;(values as Record<string, string>)[key] = incoming[key] as string
      filled.push(key)
    }
  }
  return { values, filled }
}

export function describeFilled(filled: (keyof FormValues)[]): string {
  const names = filled.filter((k) => k !== 'barcode' && k !== 'basis').map((k) => FIELD_NAMES[k])
  if (names.length === 0) return ''
  if (names.length <= 4) return names.join(', ')
  return `${names.slice(0, 4).join(', ')} and ${names.length - 4} more`
}
