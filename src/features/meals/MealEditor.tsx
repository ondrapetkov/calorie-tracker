import { useState } from 'react'
import { Button, Field, Sheet, inputCls } from '../../components/ui'
import { repo, type MealDetail } from '../../db/repo'
import type { Food } from '../../db/schema'
import { mealPerServing, mealTotal } from '../../domain/meals'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { scaleMacros } from '../../domain/nutrition'
import { AddFoodFlow } from '../add-food/AddFoodFlow'
import { MacroPreview } from '../add-food/MacroPreview'

interface Row {
  key: string
  /** Set for ingredients that already exist in the database. */
  id?: string
  food: Food
  grams: string
}

interface Props {
  /** Present when editing an existing meal. */
  detail?: MealDetail
  onClose: () => void
  onSaved: () => void
}

let nextKey = 0
const newKey = () => `row-${nextKey++}`

export function MealEditor({ detail, onClose, onSaved }: Props) {
  const [name, setName] = useState(detail?.meal.name ?? '')
  const [servings, setServings] = useState(String(detail?.meal.servings ?? 1))
  const [note, setNote] = useState(detail?.meal.note ?? '')
  const [rows, setRows] = useState<Row[]>(
    () =>
      detail?.items.flatMap((i) =>
        i.food ? [{ key: newKey(), id: i.id, food: i.food, grams: String(i.grams) }] : [],
      ) ?? [],
  )
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const servingsN = parseNumber(servings)
  const servingsOk = servingsN !== null && !Number.isNaN(servingsN) && servingsN > 0
  const parsedRows = rows.map((r) => ({ ...r, gramsN: parseNumber(r.grams) }))
  const rowsOk =
    parsedRows.length > 0 && parsedRows.every((r) => r.gramsN !== null && !Number.isNaN(r.gramsN) && r.gramsN > 0)

  const ingredients = parsedRows.map((r) => ({
    per100: r.food.per100,
    grams: r.gramsN !== null && !Number.isNaN(r.gramsN) ? r.gramsN : 0,
  }))
  const total = mealTotal(ingredients)
  const perServing = mealPerServing(ingredients, servingsOk ? servingsN : 1)

  const save = async () => {
    if (!name.trim()) return setError('Give the meal a name.')
    if (!servingsOk) return setError('Servings must be a positive number.')
    if (!rowsOk) return setError('Add at least one ingredient, each with an amount above 0.')
    setError(null)
    setBusy(true)
    try {
      await repo.saveMeal(
        {
          name: name.trim(),
          servings: servingsN,
          note: note.trim() || null,
          items: parsedRows.map((r) => ({ id: r.id, foodId: r.food.id, grams: r.gramsN! })),
        },
        detail?.meal.id,
      )
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet title={detail ? 'Edit meal' : 'New meal'} onClose={onClose}>
        <div className="space-y-4">
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kuře s rýží" />
          </Field>
          <Field label="Servings this recipe makes" hint="Total weight is split into this many equal portions.">
            <input className={inputCls} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
          </Field>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Ingredients</h3>
            {rows.length === 0 && <p className="py-2 text-sm text-muted">No ingredients yet.</p>}
            {parsedRows.map((r) => {
              const kcal = r.gramsN !== null && !Number.isNaN(r.gramsN) ? scaleMacros(r.food.per100, r.gramsN).kcal : 0
              return (
                <div key={r.key} className="flex items-center gap-2 border-b border-line py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.food.name}</div>
                    <div className="text-xs text-muted">{formatNumber(kcal)} kcal</div>
                  </div>
                  <input
                    aria-label={`Amount of ${r.food.name}`}
                    className={`${inputCls} !w-24 text-right`}
                    inputMode="decimal"
                    value={r.grams}
                    onChange={(e) =>
                      setRows((all) => all.map((x) => (x.key === r.key ? { ...x, grams: e.target.value } : x)))
                    }
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="w-6 text-sm text-muted">{r.food.basis}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.food.name}`}
                    className="px-2 text-xl text-danger"
                    onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                  >
                    ×
                  </button>
                </div>
              )
            })}
            <Button className="mt-3 w-full" onClick={() => setAdding(true)}>
              + Add ingredient
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <MacroPreview macros={perServing} label={`Per serving (recipe total ${formatNumber(total.kcal)} kcal)`} />
            </div>
          )}

          <Field label="Note (optional)">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button variant="primary" className="w-full" disabled={busy} onClick={save}>
            Save meal
          </Button>
        </div>
      </Sheet>

      {adding && (
        <AddFoodFlow
          mode={{
            kind: 'pick',
            onPicked: (food, grams) =>
              setRows((all) => [...all, { key: newKey(), food, grams: String(Math.round(grams * 10) / 10) }]),
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
