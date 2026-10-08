import { useState } from 'react'
import { hasCoreNutrients, type FoodDraft } from '../../api/openFoodFacts'
import { Sheet } from '../../components/ui'
import { repo, type FoodInput } from '../../db/repo'
import type { Food } from '../../db/schema'
import type { Slot } from '../../domain/nutrition'
import { AmountForm } from './AmountForm'
import { draftToInput, isFood, type Item } from './draft'
import { FoodForm } from './FoodForm'
import { ScanView } from './ScanView'
import { SearchView } from './SearchView'

type View =
  | { kind: 'search' }
  | { kind: 'scan' }
  | { kind: 'amount'; item: Item }
  | { kind: 'custom'; draft?: Partial<FoodDraft>; notice?: string }

interface Props {
  date: string
  slot: Slot
  onClose: () => void
  onLogged: (message: string) => void
}

export function AddFoodFlow({ date, slot, onClose, onLogged }: Props) {
  const [stack, setStack] = useState<View[]>([{ kind: 'search' }])
  const view = stack[stack.length - 1]
  const push = (v: View) => setStack((s) => [...s, v])
  const replace = (v: View) => setStack((s) => [...s.slice(0, -1), v])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))

  const pick = (item: Item) => {
    if (isFood(item) || hasCoreNutrients(item.per100)) push({ kind: 'amount', item })
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

  const confirm = async (item: Item, grams: number, chosenSlot: Slot) => {
    let food: Food
    if (isFood(item)) {
      food = item
    } else {
      const existing = item.externalId ? await repo.findFoodByExternalId(item.externalId) : undefined
      food = existing ?? (await repo.saveFood(draftToInput(item)))
    }
    await repo.logFood({ food, grams, date, slot: chosenSlot })
    onLogged(`Added ${food.name}`)
    onClose()
  }

  const title =
    view.kind === 'search' ? 'Add food' : view.kind === 'scan' ? 'Scan barcode' : view.kind === 'custom' ? 'Custom food' : 'Amount'

  return (
    <Sheet title={title} onBack={stack.length > 1 ? back : undefined} onClose={onClose}>
      {view.kind === 'search' && (
        <SearchView onPick={pick} onScan={() => push({ kind: 'scan' })} onCustom={() => push({ kind: 'custom' })} />
      )}
      {view.kind === 'scan' && (
        <ScanView
          onFound={(item) => replace({ kind: 'amount', item })}
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
        <FoodForm initial={view.draft} notice={view.notice} submitLabel="Save and continue" onSubmit={saveCustom} />
      )}
      {view.kind === 'amount' && (
        <div className="space-y-4">
          <div>
            <div className="text-lg font-semibold">{view.item.name}</div>
            {view.item.brand && <div className="text-sm text-slate-500">{view.item.brand}</div>}
          </div>
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
            submitLabel="Add to diary"
            onSubmit={(grams, chosenSlot) => confirm(view.item, grams, chosenSlot)}
          />
        </div>
      )}
    </Sheet>
  )
}
