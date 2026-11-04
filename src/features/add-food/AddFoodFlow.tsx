import { useState } from 'react'
import { hasCoreNutrients, type FoodDraft } from '../../api/openFoodFacts'
import { Sheet } from '../../components/ui'
import { repo, type FoodInput, type MealDetail } from '../../db/repo'
import type { Food } from '../../db/schema'
import type { Slot } from '../../domain/nutrition'
import { MealServingsForm } from '../meals/MealServingsForm'
import { AmountForm } from './AmountForm'
import { draftToInput, isFood, type Item } from './draft'
import { FoodForm } from './FoodForm'
import { ScanView } from './ScanView'
import { SearchView } from './SearchView'
import { TagEditorRow } from '../tags/TagEditorRow'
import { ChooseTagView } from './ChooseTagView'
import { useVocabulary } from '../tags/useVocabulary'

type View =
  | { kind: 'search' }
  | { kind: 'scan' }
  /** `tagIds`: tags chosen for an Open Food Facts product that is saved for the first time. */
  | { kind: 'amount'; item: Item; tagIds?: string[] }
  | { kind: 'custom'; draft?: Partial<FoodDraft>; notice?: string }
  | { kind: 'meal'; detail: MealDetail }
  | { kind: 'choose'; tagId: string }

type Mode =
  /** Log to the diary. */
  | { kind: 'log'; date: string; slot: Slot; onLogged: (message: string) => void }
  /** Pick an ingredient and amount for a recipe. */
  | { kind: 'pick'; onPicked: (food: Food, grams: number) => void; chooseTagId?: string }

interface Props {
  mode: Mode
  onClose: () => void
}

/** The amount step; a product not saved yet starts with its suggested tags. */
function amountView(item: Item): View {
  return isFood(item) ? { kind: 'amount', item } : { kind: 'amount', item, tagIds: item.tagIds ?? [] }
}

export function AddFoodFlow({ mode, onClose }: Props) {
  const slot: Slot = mode.kind === 'log' ? mode.slot : 'snack'
  const vocab = useVocabulary()
  const [stack, setStack] = useState<View[]>(() => [
    mode.kind === 'pick' && mode.chooseTagId ? { kind: 'choose', tagId: mode.chooseTagId } : { kind: 'search' },
  ])
  const view = stack[stack.length - 1]
  const push = (v: View) => setStack((s) => [...s, v])
  const replace = (v: View) => setStack((s) => [...s.slice(0, -1), v])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))

  const pick = (item: Item) => {
    if (isFood(item) || hasCoreNutrients(item.per100)) push(amountView(item))
    else
      push({
        kind: 'custom',
        draft: item,
        notice: 'Open Food Facts is missing some nutrition values for this product. Fill them in from the package.',
      })
  }

  const saveCustom = async (input: FoodInput) => {
    const food = await repo.saveFood(input)
    replace({ kind: 'amount', item: food })
  }

  const confirm = async (item: Item, grams: number, chosenSlot: Slot, tagIds?: string[]) => {
    let food: Food
    if (isFood(item)) {
      food = item
    } else {
      // A product already saved keeps its own tags; only a first save uses the confirmed ones.
      const existing = item.externalId ? await repo.findFoodByExternalId(item.externalId) : undefined
      food = existing ?? (await repo.saveFood({ ...draftToInput(item), ...(tagIds && { tagIds }) }))
    }
    // Picked for a "Choose {tag}" row (directly or via search): the owner just said this food is
    // that tag, so give it the tag. That also lets the meal's Choose row be replaced by it.
    if (mode.kind === 'pick' && mode.chooseTagId) {
      food = (await repo.addTagToFood(food.id, mode.chooseTagId)) ?? food
    }
    if (mode.kind === 'log') {
      await repo.logFood({ food, grams, date: mode.date, slot: chosenSlot })
      mode.onLogged(`Added ${food.name}`)
    } else {
      mode.onPicked(food, grams)
    }
    onClose()
  }

  const confirmMeal = async (detail: MealDetail, servings: number, chosenSlot: Slot) => {
    if (mode.kind !== 'log') return
    await repo.logMeal({ mealId: detail.meal.id, servings, date: mode.date, slot: chosenSlot })
    mode.onLogged(`Added ${detail.meal.name}`)
    onClose()
  }

  const chooseName = view.kind === 'choose' ? (vocab?.byId.get(view.tagId)?.name ?? '') : ''
  const title =
    view.kind === 'search'
      ? 'Add food'
      : view.kind === 'scan'
        ? 'Scan barcode'
        : view.kind === 'custom'
          ? 'Custom food'
          : view.kind === 'meal'
            ? 'Meal'
            : view.kind === 'choose'
              ? `Choose ${chooseName.toLowerCase()}`
              : 'Amount'

  return (
    <Sheet title={title} onBack={stack.length > 1 ? back : undefined} onClose={onClose}>
      {view.kind === 'search' && (
        <SearchView
          onPick={pick}
          onPickMeal={mode.kind === 'log' ? (detail) => push({ kind: 'meal', detail }) : undefined}
          slot={mode.kind === 'log' ? mode.slot : undefined}
          onScan={() => push({ kind: 'scan' })}
          onCustom={() => push({ kind: 'custom' })}
        />
      )}
      {view.kind === 'choose' && (
        <ChooseTagView
          tagId={view.tagId}
          tagName={chooseName}
          onPick={pick}
          onSearchAll={() => push({ kind: 'search' })}
        />
      )}
      {view.kind === 'scan' && (
        <ScanView
          onFound={(item) => replace(amountView(item))}
          onNotFound={(code) =>
            replace({
              kind: 'custom',
              draft: { externalId: code },
              notice: `Barcode ${code} is not in Open Food Facts. Enter it once and the next scan will find it.`,
            })
          }
        />
      )}
      {view.kind === 'custom' && (
        <FoodForm initial={view.draft} notice={view.notice} onSubmit={saveCustom} />
      )}
      {view.kind === 'amount' && (
        <div className="space-y-4">
          <div>
            <div className="text-lg font-semibold">{view.item.name}</div>
            {view.item.brand && <div className="text-sm text-muted">{view.item.brand}</div>}
          </div>
          {!isFood(view.item) && view.item.source === 'off' && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Tags for this product</h3>
              <TagEditorRow
                tagIds={view.tagIds ?? []}
                onAdd={(id) => replace({ ...view, tagIds: [...(view.tagIds ?? []).filter((t) => t !== id), id] })}
                onRemove={(id) => replace({ ...view, tagIds: (view.tagIds ?? []).filter((t) => t !== id) })}
              />
            </div>
          )}
          <AmountForm
            per100={{
              kcal: view.item.per100.kcal ?? 0,
              protein: view.item.per100.protein ?? 0,
              carbs: view.item.per100.carbs ?? 0,
              fat: view.item.per100.fat ?? 0,
              fiber: view.item.per100.fiber,
              sugar: view.item.per100.sugar,
              salt: view.item.per100.salt,
            }}
            unit={view.item.basis}
            servingG={view.item.defaultServingG}
            servingLabel={view.item.defaultServingLabel}
            initialSlot={slot}
            hideSlot={mode.kind === 'pick'}
            submitLabel={mode.kind === 'pick' ? 'Add to meal' : 'Add to diary'}
            onSubmit={(grams, chosenSlot) => confirm(view.item, grams, chosenSlot, view.tagIds)}
          />
        </div>
      )}
      {view.kind === 'meal' && (
        <div className="space-y-4">
          <div className="text-lg font-semibold">{view.detail.meal.name}</div>
          <MealServingsForm
            perServing={view.detail.perServing}
            initialSlot={slot}
            submitLabel="Add to diary"
            onSubmit={(servings, chosenSlot) => confirmMeal(view.detail, servings, chosenSlot)}
          />
        </div>
      )}
    </Sheet>
  )
}
