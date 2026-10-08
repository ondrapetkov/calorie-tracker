import { Button, Card } from '../../components/ui'
import type { Totals } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'
import type { Targets } from '../../domain/targets'

function Bar({ value, target, over = 1.1 }: { value: number; target: number; over?: number }) {
  const ratio = target > 0 ? value / target : 0
  const color = ratio > over ? 'bg-danger' : 'bg-accent'
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(target)}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  )
}

function Macro({ label, value, target }: { label: string; value: number; target: number | null }) {
  return (
    <div>
      <div className="text-center">
        <span className="font-semibold">{formatNumber(value, 1)}</span>
        {target !== null && <span className="text-sm text-muted"> / {formatNumber(target)} g</span>}
        {target === null && <span className="text-sm"> g</span>}
      </div>
      {target !== null && <Bar value={value} target={target} />}
      <div className="mt-0.5 text-center text-xs text-muted">{label}</div>
    </div>
  )
}

function Small({
  label,
  value,
  digits,
  incomplete,
  hint,
}: {
  label: string
  value: number
  digits: number
  incomplete: boolean
  hint?: string
}) {
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
      <div className="text-xs text-muted">
        {label}
        {hint && <span> · {hint}</span>}
      </div>
    </div>
  )
}

interface Props {
  totals: Totals
  /** Null when the profile or weight is not set up yet. */
  targets: Targets | null
  onSetupTargets: () => void
}

export function DayTotals({ totals, targets, onSetupTargets }: Props) {
  const left = targets ? targets.kcal - totals.kcal : null
  return (
    <Card>
      <div className="text-center">
        <span className="text-4xl font-semibold">{formatNumber(totals.kcal)}</span>
        <span className="ml-1 text-muted">{targets ? `/ ${formatNumber(targets.kcal)} kcal` : 'kcal'}</span>
      </div>
      {targets && left !== null && (
        <>
          <Bar value={totals.kcal} target={targets.kcal} over={1} />
          <div className="mt-1 text-center text-xs text-muted">
            {left >= 0 ? `${formatNumber(left)} kcal left` : `${formatNumber(-left)} kcal over`}
          </div>
        </>
      )}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Macro label="Protein" value={totals.protein} target={targets?.protein ?? null} />
        <Macro label="Carbs" value={totals.carbs} target={targets?.carbs ?? null} />
        <Macro label="Fat" value={totals.fat} target={targets?.fat ?? null} />
      </div>
      <div className="mt-3 grid grid-cols-3 border-t border-line pt-2">
        <Small label="Fiber" value={totals.fiber} digits={1} incomplete={totals.incomplete.fiber} hint={targets ? `aim ${targets.fiber}` : undefined} />
        <Small label="Sugar" value={totals.sugar} digits={1} incomplete={totals.incomplete.sugar} />
        <Small label="Salt" value={totals.salt} digits={2} incomplete={totals.incomplete.salt} hint={targets ? `max ${targets.salt}` : undefined} />
      </div>
      {(totals.incomplete.fiber || totals.incomplete.sugar || totals.incomplete.salt) && (
        <p className="mt-2 text-center text-xs text-muted">+ means some foods had no value, so the real total is higher.</p>
      )}
      {!targets && (
        <div className="mt-3 border-t border-line pt-3 text-center">
          <p className="mb-2 text-sm text-muted">Set up your daily targets to see progress here.</p>
          <Button onClick={onSetupTargets}>Set up targets</Button>
        </div>
      )}
    </Card>
  )
}
