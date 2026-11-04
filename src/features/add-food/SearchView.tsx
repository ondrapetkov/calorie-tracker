import { useEffect, useId, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { searchProducts, type FoodDraft } from '../../api/openFoodFacts'
import { searchGenericFoods } from '../../data/searchGeneric'
import { Button, inputCls } from '../../components/ui'
import { repo, type MealDetail } from '../../db/repo'
import { matchesQuery } from '../../domain/search'
import { MEALS_WITHOUT_QUERY, splitMealsForSlot } from '../../domain/tagFilter'
import { SLOT_LABELS, type Slot } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'
import type { Food } from '../../db/schema'
import { FoodRow } from './FoodRow'

interface Props {
  onPick: (item: Food | FoodDraft) => void
  /** When set, saved meals are offered too. */
  onPickMeal?: (meal: MealDetail) => void
  /** The diary slot being added to: its meals are listed first. */
  slot?: Slot
  onScan: () => void
  onCustom: () => void
}

type Remote =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; drafts: FoodDraft[]; cached: boolean }
  | { status: 'error'; message: string }

const CZ_KEY = 'search.czechOnly'

function readCzechOnly(): boolean {
  try {
    return localStorage.getItem(CZ_KEY) === '1'
  } catch {
    return false
  }
}

export function SearchView({ onPick, onPickMeal, onScan, onCustom, slot }: Props) {
  const [query, setQuery] = useState('')
  const [czechOnly, setCzechOnly] = useState(readCzechOnly)
  const [remote, setRemote] = useState<Remote>({ status: 'idle' })
  const [retryToken, setRetryToken] = useState(0)
  const trimmed = query.trim()

  const local = useLiveQuery(
    () => (trimmed ? repo.searchFoods(trimmed) : repo.recentFoods()),
    [trimmed],
    [] as Food[],
  )

  const allMeals = useLiveQuery(() => (onPickMeal ? repo.listMeals() : Promise.resolve([])), [!!onPickMeal], [] as MealDetail[])
  const matching = trimmed ? allMeals.filter((m) => matchesQuery(m.meal.name, trimmed)) : allMeals
  const { forSlot, others } = slot
    ? splitMealsForSlot(matching, slot, !!trimmed)
    : { forSlot: [], others: trimmed ? matching : matching.slice(0, MEALS_WITHOUT_QUERY) }

  useEffect(() => {
    if (trimmed.length < 2) {
      setRemote({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setRemote({ status: 'loading' })
    // Debounce so we do not fire a request per keystroke (Open Food Facts rate-limits search).
    const timer = setTimeout(async () => {
      try {
        const res = await searchProducts(trimmed, { signal: controller.signal, czechOnly })
        setRemote(res)
      } catch {
        // Aborted by a newer query; ignore.
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, czechOnly, retryToken])

  const toggleCzech = (on: boolean) => {
    setCzechOnly(on)
    try {
      localStorage.setItem(CZ_KEY, on ? '1' : '0')
    } catch {
      /* storage unavailable; the setting just will not persist */
    }
  }

  // Foods already saved (matched by barcode or generic id) are listed under "Your foods" only.
  const savedIds = new Set(local.map((f) => f.externalId).filter(Boolean))
  const notSaved = (d: FoodDraft) => !d.externalId || !savedIds.has(d.externalId)
  const basic = trimmed ? searchGenericFoods(trimmed).filter(notSaved) : []
  const drafts = remote.status === 'ok' ? remote.drafts.filter(notSaved) : []

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className={inputCls}
          type="search"
          placeholder="Search foods (e.g. kuřecí prsa)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <Button onClick={onScan}>Scan</Button>
      </div>

      {slot && forSlot.length > 0 && (
        <Section title={`For ${SLOT_LABELS[slot].toLowerCase()}`}>
          {forSlot.map((m) => (
            <MealRow key={m.meal.id} meal={m} onClick={() => onPickMeal?.(m)} />
          ))}
        </Section>
      )}

      {others.length > 0 && (
        <Section title={forSlot.length > 0 ? 'Other meals' : 'Your meals'}>
          {others.map((m) => (
            <MealRow key={m.meal.id} meal={m} onClick={() => onPickMeal?.(m)} />
          ))}
        </Section>
      )}

      <Section title={trimmed ? 'Your foods' : 'Recent foods'}>
        {local.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            {trimmed ? 'No saved food matches.' : 'Foods you log will show up here.'}
          </p>
        ) : (
          local.map((f) => <FoodRow key={f.id} item={f} onClick={() => onPick(f)} />)
        )}
      </Section>

      {basic.length > 0 && (
        <Section title="Basic foods" note="(approximate reference values)">
          {basic.map((d) => (
            <FoodRow key={d.externalId} item={d} onClick={() => onPick(d)} />
          ))}
        </Section>
      )}

      {trimmed.length >= 2 && (
        <Section
          title="Open Food Facts"
          aside={
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={czechOnly} onChange={(e) => toggleCzech(e.target.checked)} />
              Sold in CZ only
            </label>
          }
        >
          {remote.status === 'loading' && <p className="py-2 text-sm text-muted">Searching…</p>}
          {remote.status === 'error' && (
            <div className="py-2 text-sm">
              <p className="text-danger">
                Online search failed ({remote.message}). Open Food Facts is sometimes busy. Your saved, basic and custom
                foods still work.
              </p>
              <Button className="mt-2 px-3 py-1.5 text-sm" onClick={() => setRetryToken((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}
          {remote.status === 'ok' && drafts.length === 0 && (
            <p className="py-2 text-sm text-muted">
              {remote.drafts.length === 0
                ? 'Open Food Facts has no matching products.'
                : 'Everything found is already in your saved foods.'}
            </p>
          )}
          {drafts.map((d, i) => (
            <FoodRow key={`${d.externalId}-${i}`} item={d} onClick={() => onPick(d)} />
          ))}
        </Section>
      )}

      <Button className="w-full" onClick={onCustom}>
        Create custom food
      </Button>
    </div>
  )
}

/** A boxed list with a yellow heading, so the add sheet's lists are easy to tell apart. */
function Section({ title, note, aside, children }: { title: string; note?: string; aside?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-xl border border-line bg-surface px-3 pb-1 pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-xs font-semibold uppercase tracking-wide text-accent">
          {title}
        </h3>
        {aside}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
      {children}
    </section>
  )
}

function MealRow({ meal: m, onClick }: { meal: MealDetail; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0 active:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{m.meal.name}</div>
        <div className="truncate text-xs text-muted">
          {formatNumber(m.perServing.kcal)} kcal · P {formatNumber(m.perServing.protein, 1)} · C{' '}
          {formatNumber(m.perServing.carbs, 1)} · F {formatNumber(m.perServing.fat, 1)} per serving
        </div>
      </div>
    </button>
  )
}
