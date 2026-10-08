import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { searchProducts, type FoodDraft } from '../../api/openFoodFacts'
import { Button, inputCls } from '../../components/ui'
import { repo } from '../../db/repo'
import type { Food } from '../../db/schema'
import { FoodRow } from './FoodRow'

interface Props {
  onPick: (item: Food | FoodDraft) => void
  onScan: () => void
  onCustom: () => void
}

type Remote =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; drafts: FoodDraft[] }
  | { status: 'error'; message: string }

const CZ_KEY = 'search.czechOnly'

function readCzechOnly(): boolean {
  try {
    return localStorage.getItem(CZ_KEY) === '1'
  } catch {
    return false
  }
}

export function SearchView({ onPick, onScan, onCustom }: Props) {
  const [query, setQuery] = useState('')
  const [czechOnly, setCzechOnly] = useState(readCzechOnly)
  const [remote, setRemote] = useState<Remote>({ status: 'idle' })
  const trimmed = query.trim()

  const local = useLiveQuery(
    () => (trimmed ? repo.searchFoods(trimmed) : repo.recentFoods()),
    [trimmed],
    [] as Food[],
  )

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
        setRemote(res.status === 'ok' ? { status: 'ok', drafts: res.drafts } : res)
      } catch {
        // Aborted by a newer query; ignore.
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, czechOnly])

  const toggleCzech = (on: boolean) => {
    setCzechOnly(on)
    try {
      localStorage.setItem(CZ_KEY, on ? '1' : '0')
    } catch {
      /* storage unavailable; the setting just will not persist */
    }
  }

  const savedIds = new Set(local.map((f) => f.externalId).filter(Boolean))
  const drafts = remote.status === 'ok' ? remote.drafts.filter((d) => !d.externalId || !savedIds.has(d.externalId)) : []

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
            <p className="py-2 text-sm text-red-600 dark:text-red-400">
              Online search failed ({remote.message}). Your saved foods and custom foods still work offline.
            </p>
          )}
          {remote.status === 'ok' && drafts.length === 0 && (
            <p className="py-2 text-sm text-slate-500">No new products found.</p>
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
