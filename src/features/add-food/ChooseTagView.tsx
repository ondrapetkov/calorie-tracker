import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/ui'
import { GENERIC_FOODS } from '../../data/genericFoods'
import { GENERIC_FOOD_TAGS } from '../../data/genericFoodTags'
import { genericToDraft } from '../../data/searchGeneric'
import { repo } from '../../db/repo'
import type { Food } from '../../db/schema'
import type { Item } from './draft'
import { FoodRow } from './FoodRow'

interface Props {
  tagId: string
  tagName: string
  onPick: (item: Item) => void
  onSearchAll: () => void
}

/** "Choose rice": the owner's rice foods (most used first), then bundled rice foods not saved yet. */
export function ChooseTagView({ tagId, tagName, onPick, onSearchAll }: Props) {
  const own = useLiveQuery(() => repo.foodsWithTag(tagId), [tagId], [] as Food[])
  const saved = useLiveQuery(() => repo.allFoods(), [], [] as Food[])
  const savedIds = new Set(saved.map((f) => f.externalId).filter(Boolean))
  const basic = GENERIC_FOODS.filter((g) => (GENERIC_FOOD_TAGS[g.id] ?? []).includes(tagId))
    .map(genericToDraft)
    .filter((d) => !d.externalId || !savedIds.has(d.externalId))
  const lower = tagName.toLowerCase()

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Your {lower} foods</h3>
        {own.length === 0 ? (
          <p className="py-2 text-sm text-muted">None of your saved foods has the {tagName} tag yet.</p>
        ) : (
          own.map((f) => <FoodRow key={f.id} item={f} onClick={() => onPick(f)} />)
        )}
      </section>
      {basic.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Other {lower} from basic foods
          </h3>
          {basic.map((d) => (
            <FoodRow key={d.externalId} item={d} onClick={() => onPick(d)} />
          ))}
        </section>
      )}
      <Button className="w-full" onClick={onSearchAll}>
        Search all foods instead
      </Button>
    </div>
  )
}
