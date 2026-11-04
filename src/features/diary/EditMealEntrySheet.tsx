import { useEffect, useState } from 'react'
import { Button, ErrorNote, Field, Sheet, SheetDone, inputCls } from '../../components/ui'
import { repo, type MealEntryPlate } from '../../db/repo'
import type { Food, LogEntry } from '../../db/schema'
import { localDate } from '../../domain/dates'
import { plateChanged, plateMacros, type LoggedMealItem } from '../../domain/loggedMeal'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { SLOTS, SLOT_LABELS, scaleMacros, type Slot } from '../../domain/nutrition'
import { AddFoodFlow } from '../add-food/AddFoodFlow'
import { MacroPreview } from '../add-food/MacroPreview'
import { rememberChoice, rememberedChoice, type MealUpdateChoice } from './mealUpdateChoice'
import { UpdateSavedMealDialog } from './UpdateSavedMealDialog'

interface Props {
  entry: LogEntry
  onClose: () => void
  onDeleted: (entry: LogEntry) => void
}

interface Row {
  item: LoggedMealItem
  /** What the amount field shows when the sheet opens; unchanged text keeps the exact stored amount. */
  initial: string
  grams: string
}

const shown = (g: number) => String(Math.round(g * 10) / 10)
const valid = (n: number | null): n is number => n !== null && !Number.isNaN(n) && n > 0

function storedChoice(mealId: string, date: string): MealUpdateChoice | null {
  try {
    return rememberedChoice(localStorage, mealId, date, localDate())
  } catch {
    return null
  }
}

function storeChoice(mealId: string, date: string, choice: MealUpdateChoice) {
  try {
    rememberChoice(localStorage, mealId, date, localDate(), choice)
  } catch {
    // Storage blocked: the popup simply asks again next time.
  }
}

/** Edit what is on the plate of a logged meal, and optionally carry the change over to the saved meal. */
export function EditMealEntrySheet({ entry, onClose, onDeleted }: Props) {
  /** undefined while loading; null when the plate can't be shown (old entry, saved meal deleted). */
  const [loaded, setLoaded] = useState<MealEntryPlate | null | undefined>(undefined)
  const [rows, setRows] = useState<Row[]>([])
  const [slot, setSlot] = useState<Slot>(entry.slot)
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState<LoggedMealItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    void repo.mealEntryPlate(entry.id).then((p) => {
      if (!live) return
      setLoaded(p)
      setRows(p ? p.plate.map((item) => ({ item, initial: shown(item.grams), grams: shown(item.grams) })) : [])
    })
    return () => {
      live = false
    }
  }, [entry.id])

  const parsed = rows.map((r) => ({ ...r, n: r.grams === r.initial ? r.item.grams : parseNumber(r.grams) }))
  const plate: LoggedMealItem[] = parsed.map((r) => ({ ...r.item, grams: valid(r.n) ? r.n : 0 }))
  const servings = entry.servings && entry.servings > 0 ? entry.servings : 1

  const save = async (after: LoggedMealItem[] | undefined, updateSavedMeal: boolean) => {
    setBusy(true)
    try {
      await repo.updateMealEntry(entry.id, { slot, plate: after, updateSavedMeal })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const done = async () => {
    if (busy) return
    if (!loaded) return save(undefined, false)
    if (parsed.length === 0 || !parsed.every((r) => valid(r.n))) {
      return setError('Add at least one ingredient, each with an amount above 0.')
    }
    setError(null)
    if (!plateChanged(loaded.plate, plate)) return save(undefined, false)
    if (!loaded.savedMealExists || !entry.mealId) return save(plate, false)
    const remembered = storedChoice(entry.mealId, entry.date)
    if (remembered) return save(plate, remembered === 'meal')
    setAsking(plate)
  }

  const answer = (choice: MealUpdateChoice, remember: boolean) => {
    const after = asking
    setAsking(null)
    if (!after) return
    if (remember && entry.mealId) storeChoice(entry.mealId, entry.date, choice)
    void save(after, choice === 'meal')
  }

  const addIngredient = (food: Food, grams: number) => {
    const item: LoggedMealItem = {
      id: crypto.randomUUID(),
      mealItemId: null,
      foodId: food.id,
      name: food.name,
      basis: food.basis,
      per100: food.per100,
      grams,
    }
    setRows((all) => [...all, { item, initial: shown(grams), grams: shown(grams) }])
  }

  const remove = async () => {
    await repo.deleteEntry(entry.id)
    onDeleted(entry)
    onClose()
  }

  const recipeServings = loaded?.recipeServings ?? entry.recipeServings
  const loggedAs =
    recipeServings !== undefined
      ? `Logged as ${shown(servings)} of ${shown(recipeServings)} servings`
      : `Logged as ${shown(servings)} × meal`

  return (
    <>
      <Sheet title="Edit entry" onClose={onClose}>
        {loaded !== undefined && (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold">{entry.label}</div>
              <div className="text-sm text-muted">
                {loggedAs}
                {entry.plateEdited && ' · changed from the saved meal'}
              </div>
              {loaded?.differsFromStored && (
                <p className="mt-2 text-sm text-muted">
                  The saved meal has changed since this was logged. Saving with ingredient changes uses the
                  ingredients shown.
                </p>
              )}
            </div>

            {loaded ? (
              <>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">On your plate</h3>
                  {rows.length === 0 && <p className="py-2 text-sm text-muted">No ingredients.</p>}
                  {parsed.map((r) => (
                    <div key={r.item.id} className="flex items-center gap-2 border-b border-line py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{r.item.name}</div>
                        <div className="text-xs text-muted">
                          {formatNumber(valid(r.n) ? scaleMacros(r.item.per100, r.n).kcal : 0)} kcal
                        </div>
                      </div>
                      <input
                        aria-label={`Amount of ${r.item.name}`}
                        className={`${inputCls} !w-24 text-right`}
                        inputMode="decimal"
                        value={r.grams}
                        onChange={(e) =>
                          setRows((all) =>
                            all.map((x) => (x.item.id === r.item.id ? { ...x, grams: e.target.value } : x)),
                          )
                        }
                        onFocus={(e) => e.target.select()}
                      />
                      <span className="w-6 text-sm text-muted">{r.item.basis}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${r.item.name}`}
                        className="px-2 text-xl text-danger"
                        onClick={() => setRows((all) => all.filter((x) => x.item.id !== r.item.id))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Button className="mt-3 w-full" onClick={() => setAdding(true)}>
                    + Add ingredient
                  </Button>
                </div>
                <MacroPreview macros={plateMacros(plate)} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  The saved meal has been deleted, so the ingredients of this entry can't be shown.
                </p>
                <MacroPreview macros={entry} />
              </>
            )}

            <Field label="Meal">
              <select className={inputCls} value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="danger" className="w-full" onClick={remove}>
              Delete entry
            </Button>

            <SheetDone disabled={busy} onClick={done} />
            {error && <ErrorNote message={error} />}
          </div>
        )}
      </Sheet>

      {adding && <AddFoodFlow mode={{ kind: 'pick', onPicked: addIngredient }} onClose={() => setAdding(false)} />}
      {asking && <UpdateSavedMealDialog mealName={entry.label} onAnswer={answer} />}
    </>
  )
}
