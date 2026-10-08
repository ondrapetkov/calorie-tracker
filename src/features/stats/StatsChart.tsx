import { useMemo, useRef, useState } from 'react'
import { formatNumber } from '../../domain/numbers'
import { niceTicks } from '../../domain/weight'
import type { Bucket, PeriodKind } from '../../domain/stats'

interface Props {
  kind: PeriodKind
  buckets: Bucket[]
  /** Daily calorie target, drawn as a reference line; null when no targets are set up. */
  target: number | null
}

const W = 360
const H = 200
const M = { top: 12, right: 8, bottom: 24, left: 42 }
const MAX_BAR = 24

/** Rounded top, square bottom (4px radius), anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Calories per day (week, month) or average calories per logged day (year) as bars, with the daily
 * target as a hairline. One axis from zero. A bar can be picked by touch or the arrow keys; the
 * readout above the plot always shows a bar and carries the exact numbers.
 */
export function StatsChart({ kind, buckets, target }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [picked, setPicked] = useState<string | null>(null)

  const model = useMemo(() => {
    const values = buckets.flatMap((b) => (b.kcal === null ? [] : [b.kcal]))
    const top = Math.max(...values, target ?? 0, 1)
    const ticks = niceTicks(0, top * 1.05, 4)
    const yMax = ticks[ticks.length - 1]
    const plotW = W - M.left - M.right
    const plotH = H - M.top - M.bottom
    const step = plotW / buckets.length
    const barW = Math.min(MAX_BAR, step * 0.7)
    const x = (i: number) => M.left + step * i + (step - barW) / 2
    const y = (v: number) => M.top + plotH - (v / yMax) * plotH
    return { ticks, yMax, step, barW, x, y, plotH }
  }, [buckets, target])

  const lastWithData = [...buckets].reverse().find((b) => b.kcal !== null)
  const active = buckets.find((b) => b.key === picked) ?? lastWithData ?? buckets[buckets.length - 1]
  const activeIndex = buckets.findIndex((b) => b.key === active.key)

  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((clientX - rect.left) / rect.width) * W
    const i = Math.min(buckets.length - 1, Math.max(0, Math.floor((px - M.left) / model.step)))
    setPicked(buckets[i].key)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = e.key === 'ArrowLeft' ? activeIndex - 1 : e.key === 'ArrowRight' ? activeIndex + 1 : null
    if (next === null) return
    setPicked(buckets[Math.min(buckets.length - 1, Math.max(0, next))].key)
    e.preventDefault()
  }

  const labelEvery = kind === 'month' ? 5 : 1
  const diff = active.kcal !== null && target !== null ? active.kcal - target : null

  return (
    <div>
      <div className="mb-2 min-h-[3.5rem]" aria-live="polite">
        <div className="text-xs text-muted">{active.title}</div>
        {active.kcal === null ? (
          <div className="text-sm text-muted">Nothing logged</div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-semibold">
                {formatNumber(active.kcal)} kcal{kind === 'year' ? ' / day' : ''}
              </span>
              {kind === 'year' && <span className="text-xs text-muted">average over {active.loggedDays} logged day{active.loggedDays === 1 ? '' : 's'}</span>}
              {diff !== null && (
                <span className="text-sm text-muted">
                  {diff === 0 ? 'on target' : `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs(diff))} vs target`}
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              Protein {formatNumber(active.protein ?? 0, 0)} g · Carbs {formatNumber(active.carbs ?? 0, 0)} g · Fat{' '}
              {formatNumber(active.fat ?? 0, 0)} g
            </div>
          </>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        role="img"
        tabIndex={0}
        aria-label={`Calories chart with ${buckets.filter((b) => b.kcal !== null).length} of ${buckets.length} ${kind === 'year' ? 'months' : 'days'} logged. Use the left and right arrow keys to move between bars.`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => e.buttons === 1 && pick(e.clientX)}
        onKeyDown={onKeyDown}
      >
        {model.ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={model.y(t)} y2={model.y(t)} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={M.left - 6} y={model.y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--color-muted)">
              {formatNumber(t)}
            </text>
          </g>
        ))}

        {buckets.map((b, i) => {
          const isActive = b.key === active.key
          const barX = model.x(i)
          return (
            <g key={b.key}>
              {b.kcal !== null && b.kcal > 0 && (
                <path
                  d={barPath(barX, model.y(b.kcal), model.barW, model.y(0) - model.y(b.kcal))}
                  fill="var(--color-accent)"
                  opacity={isActive ? 1 : 0.55}
                />
              )}
              {isActive && (
                <rect x={M.left + model.step * i} y={M.top} width={model.step} height={model.plotH} fill="var(--color-fg)" opacity="0.06" />
              )}
              {(i % labelEvery === 0 || i === buckets.length - 1) && !(kind === 'month' && i === buckets.length - 2 && labelEvery > 1 && (i % labelEvery !== 0)) && (
                <text x={barX + model.barW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={isActive ? 'var(--color-fg)' : 'var(--color-muted)'}>
                  {b.label}
                </text>
              )}
            </g>
          )
        })}

        {target !== null && (
          <g>
            <line x1={M.left} x2={W - M.right} y1={model.y(target)} y2={model.y(target)} stroke="var(--color-fg)" strokeWidth="1" strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
            <text x={W - M.right} y={model.y(target) - 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
              target {formatNumber(target)}
            </text>
          </g>
        )}
      </svg>
      <p className="mt-1 text-xs text-muted">
        {kind === 'year' ? 'Average calories per logged day, by month.' : 'Calories per day.'} Tap a bar for details.
      </p>
    </div>
  )
}
