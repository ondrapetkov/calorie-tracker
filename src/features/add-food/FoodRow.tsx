import type { FoodDraft } from '../../api/openFoodFacts'
import { hasCoreNutrients } from '../../api/openFoodFacts'
import type { Food } from '../../db/schema'
import { formatNumber } from '../../domain/numbers'

export function FoodRow({ item, onClick }: { item: Food | FoodDraft; onClick: () => void }) {
  const p = item.per100
  const complete = 'id' in item || hasCoreNutrients(p as FoodDraft['per100'])
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0 active:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-xs text-muted">
          {item.brand ? `${item.brand} · ` : ''}
          {complete && p.kcal !== null
            ? `${formatNumber(p.kcal)} kcal · P ${formatNumber(p.protein ?? 0, 1)} · C ${formatNumber(p.carbs ?? 0, 1)} · F ${formatNumber(p.fat ?? 0, 1)} per 100 ${item.basis}`
            : 'Nutrition data incomplete'}
        </div>
      </div>
      {!complete && <span className="rounded bg-warn-bg px-1.5 py-0.5 text-xs text-warn">fix</span>}
    </button>
  )
}
