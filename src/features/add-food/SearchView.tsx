import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { searchProducts, type FoodDraft } from '../../api/openFoodFacts'
import { searchGenericFoods } from '../../data/searchGeneric'
import { Button, inputCls } from '../../components/ui'
import { repo, type MealDetail } from '../../db/repo'
import { matchesQuery } from '../../domain/search'
import { formatNumber } from '../../domain/numbers'
import type { Food } from '../../db/schema'
import { FoodRow } from './FoodRow'

interface Props {
  onPick: (item: Food | FoodDraft) => void
  /** When set, saved meals are offered too. */
  onPickMeal?: (meal: MealDetail) => void
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

export function SearchView({ onPick, onPickMeal, onScan, onCustom }: Props) {
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
  const meals = trimmed
    ? allMeals.filter((m) => matchesQuery(m.meal.name, trimmed))
    : allMeals.slice(0, 5)

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

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {trimmed ? 'Your foods' : 'Recent'}
        </h3>
        {local.length === 0 ? (
          <p className="py-2 text-sm text-slate-500">
            {trimmed ? 'No saved food matches.' : 'Foods you log will show up here.'}
          </p>
        ) : (
          local.map((f) => <FoodRow key={f.id} item={f} onClick={() => onPick(f)} />)
        )}
      </section>

      {meals.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Your meals</h3>
          {meals.map((m) => (
            <button
              key={m.meal.id}
              type="button"
              onClick={() => onPickMeal?.(m)}
              className="flex w-full items-center gap-3 border-b border-slate-200 py-2.5 text-left last:border-0 active:bg-slate-100 dark:border-slate-800 dark:active:bg-slate-900"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.meal.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {formatNumber(m.perServing.kcal)} kcal · P {formatNumber(m.perServing.protein, 1)} · C{' '}
                  {formatNumber(m.perServing.carbs, 1)} · F {formatNumber(m.perServing.fat, 1)} per serving
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {basic.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Basic foods <span className="font-normal normal-case">(approximate reference values)</span>
          </h3>
          {basic.map((d) => (
            <FoodRow key={d.externalId} item={d} onClick={() => onPick(d)} />
          ))}
        </section>
      )}

      {trimmed.length >= 2 && (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Food Facts</h3>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={czechOnly} onChange={(e) => toggleCzech(e.target.checked)} />
              Sold in CZ only
            </label>
          </div>
          {remote.status === 'loading' && <p className="py-2 text-sm text-slate-500">Searching…</p>}
          {remote.status === 'error' && (
            <div className="py-2 text-sm">
              <p className="text-red-600 dark:text-red-400">
                Online search failed ({remote.message}). Open Food Facts is sometimes busy. Your saved, basic and custom
                foods still work.
              </p>
              <Button className="mt-2 px-3 py-1.5 text-sm" onClick={() => setRetryToken((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}
          {remote.status === 'ok' && drafts.length === 0 && (
            <p className="py-2 text-sm text-slate-500">
              {remote.drafts.length === 0
                ? 'Open Food Facts has no matching products.'
                : 'Everything found is already in your saved foods.'}
            </p>
          )}
          {drafts.map((d, i) => (
            <FoodRow key={`${d.externalId}-${i}`} item={d} onClick={() => onPick(d)} />
          ))}
        </section>
      )}

      <Button className="w-full" onClick={onCustom}>
        Create custom food
      </Button>
    </div>
  )
}
