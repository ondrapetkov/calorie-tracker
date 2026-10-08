import { useMemo, useRef, useState } from 'react'
import { addDays, parseLocalDate } from '../../domain/dates'
import { formatNumber } from '../../domain/numbers'
import { daysBetween, niceTicks, withTrailingAverage, type WeightPoint } from '../../domain/weight'

interface Props {
  /** Weigh-ins in the range, oldest first. */
  points: WeightPoint[]
  /** Every weigh-in, so the 7-day average is right at the left edge of a shorter range. */
  allPoints: WeightPoint[]
}

const W = 360
const H = 210
const M = { top: 14, right: 16, bottom: 26, left: 40 }

const shortDate = (d: string) => parseLocalDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const longDate = (d: string) =>
  parseLocalDate(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Weigh-ins as dots with their 7-day average as a line. One axis, hairline grid, a crosshair that
 * snaps to the nearest weigh-in, and a readout that is always filled (latest point by default).
 * Identity never relies on colour alone: dots vs line, plus the legend and the readout.
 */
export function WeightChart({ points, allPoints }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selected, setSelected] = useState<number | null>(null)

  const model = useMemo(() => {
    if (points.length === 0) return null
    const withAvg = withTrailingAverage(allPoints)
    const avgByDate = new Map(withAvg.map((p) => [p.date, p.avg]))
    const data = points.map((p) => ({ ...p, avg: avgByDate.get(p.date) ?? p.kg }))
    const first = data[0].date
    const last = data[data.length - 1].date
    const span = Math.max(1, daysBetween(first, last))
    const values = data.flatMap((d) => [d.kg, d.avg])
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = Math.max(0.3, (hi - lo) * 0.1)
    const ticks = niceTicks(lo - pad, hi + pad)
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const x = (date: string) =>
      data.length === 1 ? (M.left + (W - M.right)) / 2 : M.left + (daysBetween(first, date) / span) * (W - M.left - M.right)
    const y = (kg: number) => M.top + (1 - (kg - yMin) / (yMax - yMin)) * (H - M.top - M.bottom)
    return { data, first, last, ticks, x, y }
  }, [points, allPoints])

  if (!model) {
    return <p className="py-6 text-center text-sm text-muted">No weigh-ins in this range yet.</p>
  }

  const { data, ticks, x, y, first, last } = model
  const active = selected === null ? data.length - 1 : Math.min(selected, data.length - 1)
  const current = data[active]

  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(x(data[i].date) - px) < Math.abs(x(data[best].date) - px)) best = i
    }
    setSelected(best)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSelected(Math.max(0, active - 1))
    else if (e.key === 'ArrowRight') setSelected(Math.min(data.length - 1, active + 1))
    else return
    e.preventDefault()
  }

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.date).toFixed(1)},${y(d.avg).toFixed(1)}`).join(' ')
  const tickDates = data.length > 1 ? [first, addDays(first, Math.round(daysBetween(first, last) / 2)), last] : [first]

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--color-muted)" /></svg>Weigh-ins
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="10"><line x1="0" y1="5" x2="16" y2="5" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" /></svg>
          7-day average
        </span>
      </div>

      <div className="mb-2 min-h-[2.75rem]" aria-live="polite">
        <div className="text-xs text-muted">{longDate(current.date)}</div>
        <div className="flex flex-wrap items-baseline gap-x-4">
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="var(--color-muted)" /></svg>
            <span className="text-lg font-semibold">{formatNumber(current.kg, 1)} kg</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <svg width="16" height="10" aria-hidden="true"><line x1="0" y1="5" x2="16" y2="5" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" /></svg>
            <span className="font-medium">{formatNumber(current.avg, 1)} kg</span>
            <span className="text-muted">average</span>
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        role="img"
        tabIndex={0}
        aria-label={`Weight chart, ${data.length} weigh-ins from ${shortDate(first)} to ${shortDate(last)}. Use the left and right arrow keys to move between weigh-ins.`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onKeyDown={onKeyDown}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--color-muted)">
              {formatNumber(t, t % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}
        {tickDates.map((d, i) => (
          <text
            key={d}
            x={x(d)}
            y={H - 8}
            fontSize="10"
            fill="var(--color-muted)"
            textAnchor={tickDates.length === 1 ? 'middle' : i === 0 ? 'start' : i === tickDates.length - 1 ? 'end' : 'middle'}
          >
            {shortDate(d)}
          </text>
        ))}

        <line x1={x(current.date)} x2={x(current.date)} y1={M.top} y2={H - M.bottom} stroke="var(--color-line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {data.length > 1 && (
          <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}

        {data.map((d, i) => (
          <circle
            key={d.date}
            cx={x(d.date)}
            cy={y(d.kg)}
            r={i === active ? 5 : 4}
            fill="var(--color-muted)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}
        <circle cx={x(current.date)} cy={y(current.avg)} r="4.5" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
      </svg>
    </div>
  )
}
