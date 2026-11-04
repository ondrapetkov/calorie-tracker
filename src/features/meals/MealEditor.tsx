import { useEffect, useRef, useState } from 'react'
import { Button, ErrorNote, Field, Sheet, SheetDone, inputCls } from '../../components/ui'
import { repo, type MealDetail } from '../../db/repo'
import type { Food } from '../../db/schema'
import { mealPerServing, mealTotal } from '../../domain/meals'
import { formatNumber, parseNumber } from '../../domain/numbers'
import { SLOTS, SLOT_LABELS, scaleMacros, type Slot } from '../../domain/nutrition'
import { addMealTag, chooseRowTags, effectiveMealTags, removeMealTag, type MealTagState } from '../../domain/mealTags'
import { liveTagIds } from '../../domain/tags'
import { TagChip } from '../tags/TagChip'
import { TagEditorRow } from '../tags/TagEditorRow'
import { useVocabulary } from '../tags/useVocabulary'
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
  const [slots, setSlots] = useState<Slot[]>(detail?.slots ?? [])
  const [tagState, setTagState] = useState<MealTagState>({
    addedTagIds: detail?.meal.addedTagIds ?? [],
    removedTagIds: detail?.meal.removedTagIds ?? [],
  })
  const [highlightIds, setHighlightIds] = useState<string[]>([])
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(highlightTimer.current), [])
  const vocab = useVocabulary()
  /** Set while adding an ingredient; a tag id when it comes from a "Choose {tag}" row. */
  const [adding, setAdding] = useState<false | { chooseTagId?: string }>(false)
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
  const ingredientTags = vocab ? rows.map((r) => liveTagIds(vocab, r.food.tagIds)) : []
  const shownTags = vocab ? liveTagIds(vocab, effectiveMealTags(ingredientTags, tagState)) : []
  const chooseTags = vocab ? liveTagIds(vocab, chooseRowTags(shownTags, ingredientTags)) : []

  const addIngredient = (food: Food, grams: number) => {
    if (vocab) {
      const before = new Set(shownTags)
      const after = effectiveMealTags([...ingredientTags, liveTagIds(vocab, food.tagIds)], tagState)
      const fresh = after.filter((t) => !before.has(t))
      if (fresh.length > 0) {
        setHighlightIds(fresh)
        clearTimeout(highlightTimer.current)
        highlightTimer.current = setTimeout(() => setHighlightIds([]), 1500)
      }
    }
    setRows((all) => [...all, { key: newKey(), food, grams: String(Math.round(grams * 10) / 10) }])
  }

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
          slots,
          addedTagIds: tagState.addedTagIds,
          removedTagIds: tagState.removedTagIds,
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
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Meal type</h3>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Meal type">
              {SLOTS.map((s) => (
                <TagChip
                  key={s}
                  label={SLOT_LABELS[s]}
                  selected={slots.includes(s)}
                  onClick={() => setSlots((all) => (all.includes(s) ? all.filter((x) => x !== s) : [...all, s]))}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ingredient tags</h3>
            <TagEditorRow
              tagIds={shownTags}
              highlightIds={highlightIds}
              onAdd={(id) => setTagState((st) => addMealTag(st, id))}
              onRemove={(id) => setTagState((st) => removeMealTag(st, id, ingredientTags))}
            />
          </div>

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
            {chooseTags.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAdding({ chooseTagId: id })}
                className="mt-2 flex w-full items-center rounded-lg border border-dashed border-accent px-3 py-2.5 text-left text-accent active:bg-surface-2"
              >
                <span className="flex-1">Choose {vocab?.byId.get(id)?.name.toLowerCase()}</span>
                <span className="text-xl leading-none" aria-hidden="true">
                  ＋
                </span>
              </button>
            ))}
            <Button className="mt-3 w-full" onClick={() => setAdding({})}>
              {chooseTags.length > 0 ? '+ Add other ingredient' : '+ Add ingredient'}
            </Button>
          </div>

          <Field label="Servings this recipe makes" hint="Total weight is split into this many equal portions.">
            <input className={inputCls} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
          </Field>

          {rows.length > 0 && (
            <div className="space-y-2">
              <MacroPreview macros={perServing} label={`Per serving (recipe total ${formatNumber(total.kcal)} kcal)`} />
            </div>
          )}

          <Field label="Note (optional)">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <SheetDone disabled={busy} onClick={save} />
          {error && <ErrorNote message={error} />}
        </div>
      </Sheet>

      {adding && (
        <AddFoodFlow
          mode={{ kind: 'pick', onPicked: addIngredient, chooseTagId: adding.chooseTagId }}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
