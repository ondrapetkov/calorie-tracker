import type { Macros } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'

export function MacroPreview({ macros: m, label }: { macros: Macros; label?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      {label && <div className="mb-1 text-center text-xs text-slate-500">{label}</div>}
      <div className="text-center">
        <span className="text-3xl font-semibold">{formatNumber(m.kcal)}</span>
        <span className="ml-1 text-slate-500">kcal</span>
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-sm">
        <div><div className="font-medium">{formatNumber(m.protein, 1)} g</div><div className="text-slate-500">Protein</div></div>
        <div><div className="font-medium">{formatNumber(m.carbs, 1)} g</div><div className="text-slate-500">Carbs</div></div>
        <div><div className="font-medium">{formatNumber(m.fat, 1)} g</div><div className="text-slate-500">Fat</div></div>
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-500">
        <div>Fiber {m.fiber === null ? '—' : `${formatNumber(m.fiber, 1)} g`}</div>
        <div>Sugar {m.sugar === null ? '—' : `${formatNumber(m.sugar, 1)} g`}</div>
        <div>Salt {m.salt === null ? '—' : `${formatNumber(m.salt, 2)} g`}</div>
      </div>
    </div>
  )
}
