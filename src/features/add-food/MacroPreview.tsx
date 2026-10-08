import type { Macros } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'

export function MacroPreview({ macros: m, label }: { macros: Macros; label?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      {label && <div className="mb-1 text-center text-xs text-muted">{label}</div>}
      <div className="text-center">
        <span className="text-3xl font-semibold">{formatNumber(m.kcal)}</span>
        <span className="ml-1 text-muted">kcal</span>
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-sm">
        <div><div className="font-medium">{formatNumber(m.protein, 1)} g</div><div className="text-muted">Protein</div></div>
        <div><div className="font-medium">{formatNumber(m.carbs, 1)} g</div><div className="text-muted">Carbs</div></div>
        <div><div className="font-medium">{formatNumber(m.fat, 1)} g</div><div className="text-muted">Fat</div></div>
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-xs text-muted">
        <div>Fiber {m.fiber === null ? '—' : `${formatNumber(m.fiber, 1)} g`}</div>
        <div>Sugar {m.sugar === null ? '—' : `${formatNumber(m.sugar, 1)} g`}</div>
        <div>Salt {m.salt === null ? '—' : `${formatNumber(m.salt, 2)} g`}</div>
      </div>
    </div>
  )
}
