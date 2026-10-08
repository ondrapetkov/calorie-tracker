import { Card } from '../../components/ui'
import type { Totals } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'

function Small({ label, value, digits, incomplete }: { label: string; value: number; digits: number; incomplete: boolean }) {
  return (
    <div className="text-center">
      <div className="text-sm font-medium">
        {incomplete && value === 0 ? (
          '—'
        ) : (
          <>
            {formatNumber(value, digits)} g{incomplete && '+'}
          </>
        )}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

export function DayTotals({ totals }: { totals: Totals }) {
  return (
    <Card>
      <div className="text-center">
        <span className="text-4xl font-semibold">{formatNumber(totals.kcal)}</span>
        <span className="ml-1 text-slate-500">kcal</span>
      </div>
      <div className="mt-3 grid grid-cols-3 text-center">
        <div><div className="font-semibold">{formatNumber(totals.protein, 1)} g</div><div className="text-xs text-slate-500">Protein</div></div>
        <div><div className="font-semibold">{formatNumber(totals.carbs, 1)} g</div><div className="text-xs text-slate-500">Carbs</div></div>
        <div><div className="font-semibold">{formatNumber(totals.fat, 1)} g</div><div className="text-xs text-slate-500">Fat</div></div>
      </div>
      <div className="mt-3 grid grid-cols-3 border-t border-slate-200 pt-2 dark:border-slate-800">
        <Small label="Fiber" value={totals.fiber} digits={1} incomplete={totals.incomplete.fiber} />
        <Small label="Sugar" value={totals.sugar} digits={1} incomplete={totals.incomplete.sugar} />
        <Small label="Salt" value={totals.salt} digits={2} incomplete={totals.incomplete.salt} />
      </div>
      {(totals.incomplete.fiber || totals.incomplete.sugar || totals.incomplete.salt) && (
        <p className="mt-2 text-center text-xs text-slate-500">+ means some foods had no value, so the real total is higher.</p>
      )}
    </Card>
  )
}
