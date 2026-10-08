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
      className="flex w-full items-center gap-3 border-b border-slate-200 py-2.5 text-left last:border-0 active:bg-slate-100 dark:border-slate-800 dark:active:bg-slate-900"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.name}</div>
        <div className="truncate text-xs text-slate-500">
          {item.brand ? `${item.brand} · ` : ''}
          {complete && p.kcal !== null
            ? `${formatNumber(p.kcal)} kcal · P ${formatNumber(p.protein ?? 0, 1)} · C ${formatNumber(p.carbs ?? 0, 1)} · F ${formatNumber(p.fat ?? 0, 1)} per 100 ${item.basis}`
            : 'Nutrition data incomplete'}
        </div>
      </div>
      {!complete && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">fix</span>}
    </button>
  )
}
