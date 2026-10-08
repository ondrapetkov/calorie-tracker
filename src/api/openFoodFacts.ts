import type { FoodSource, Macros } from '../domain/nutrition'

/** A product as found online, not yet saved. Core nutrients may be missing. */
export interface FoodDraft {
  source: FoodSource
  externalId: string | null
  name: string
  brand: string | null
  basis: 'g' | 'ml'
  per100: {
    [K in keyof Macros]: number | null
  }
  defaultServingG: number | null
  defaultServingLabel: string | null
}

type Nutriments = Record<string, unknown>

function num(n: Nutriments, key: string): number | null {
  const v = n[key]
  const x = typeof v === 'string' ? Number(v) : v
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/** Normalise Open Food Facts nutriments to per-100 values; kJ is the fallback for kcal. */
export function parseNutriments(n: Nutriments): FoodDraft['per100'] {
  const kcal = num(n, 'energy-kcal_100g')
  const kj = num(n, 'energy-kj_100g') ?? num(n, 'energy_100g')
  return {
    kcal: kcal ?? (kj !== null ? kj / 4.184 : null),
    protein: num(n, 'proteins_100g'),
    carbs: num(n, 'carbohydrates_100g'),
    fat: num(n, 'fat_100g'),
    fiber: num(n, 'fiber_100g'),
    sugar: num(n, 'sugars_100g'),
    salt: num(n, 'salt_100g'),
  }
}

/** True when the four core values needed to log the food are all known. */
export function hasCoreNutrients(p: FoodDraft['per100']): boolean {
  return p.kcal !== null && p.protein !== null && p.carbs !== null && p.fat !== null
}

const LIQUID_QUANTITY = /\d\s*(ml|cl|dl|l)\b/i

interface RawProduct {
  code?: unknown
  product_name?: unknown
  product_name_cs?: unknown
  brands?: unknown
  quantity?: unknown
  serving_size?: unknown
  serving_quantity?: unknown
  nutriments?: unknown
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

export function productToDraft(p: RawProduct): FoodDraft | null {
  const name = str(p.product_name_cs) ?? str(p.product_name)
  const code = str(p.code)
  if (!name) return null
  const servingQty = typeof p.serving_quantity === 'string' ? Number(p.serving_quantity) : p.serving_quantity
  const nutriments =
    p.nutriments && typeof p.nutriments === 'object' ? (p.nutriments as Nutriments) : {}
  return {
    source: 'off',
    externalId: code,
    name,
    brand: str(p.brands)?.split(',')[0].trim() ?? null,
    basis: LIQUID_QUANTITY.test(str(p.quantity) ?? '') ? 'ml' : 'g',
    per100: parseNutriments(nutriments),
    defaultServingG: typeof servingQty === 'number' && servingQty > 0 ? servingQty : null,
    defaultServingLabel: str(p.serving_size),
  }
}

const FIELDS =
  'code,product_name,product_name_cs,brands,quantity,serving_size,serving_quantity,nutriments'

export type LookupResult =
  | { status: 'found'; draft: FoodDraft }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<LookupResult> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      { signal },
    )
    if (res.status === 404) return { status: 'not-found' }
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` }
    const body = await res.json()
    if (body.status !== 1 || !body.product) return { status: 'not-found' }
    const draft = productToDraft({ ...body.product, code: body.product.code ?? barcode })
    return draft ? { status: 'found', draft } : { status: 'not-found' }
  } catch (e) {
    // A TypeError from fetch usually means a network failure or a CORS block.
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

export type SearchResult =
  | { status: 'ok'; drafts: FoodDraft[]; cached: boolean }
  | { status: 'error'; message: string }

const RETRY_DELAYS_MS = [700, 1800]
const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX = 50
const cache = new Map<string, { at: number; drafts: FoodDraft[] }>()

export function clearSearchCache() {
  cache.clear()
}

/** Open Food Facts answers 429/5xx when busy; those are worth retrying, others are not. */
const isTransient = (status: number) => status === 429 || status >= 500

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/**
 * Text search. Identical queries are answered from a short-lived cache so the same
 * input shows the same results, and busy-server responses are retried with backoff
 * before an error is reported.
 */
export async function searchProducts(
  query: string,
  options: { signal?: AbortSignal; czechOnly?: boolean } = {},
): Promise<SearchResult> {
  const key = `${options.czechOnly ? 'cz' : 'all'}|${query.trim().toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { status: 'ok', drafts: hit.drafts, cached: true }

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    sort_by: 'unique_scans_n',
    lc: 'cs',
    cc: 'cz',
    fields: FIELDS,
  })
  if (options.czechOnly) {
    params.set('tagtype_0', 'countries')
    params.set('tag_contains_0', 'contains')
    params.set('tag_0', 'czech-republic')
  }
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params}`

  let lastError = 'unknown error'
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, { signal: options.signal })
      if (res.ok) {
        const body = await res.json()
        const products: RawProduct[] = Array.isArray(body.products) ? body.products : []
        const drafts = products.map(productToDraft).filter((d): d is FoodDraft => d !== null)
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
        cache.set(key, { at: Date.now(), drafts })
        return { status: 'ok', drafts, cached: false }
      }
      lastError = res.status === 503 || res.status === 429 ? `HTTP ${res.status}, server busy` : `HTTP ${res.status}`
      if (!isTransient(res.status)) break
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      lastError = e instanceof Error ? e.message : String(e)
    }
    const delay = RETRY_DELAYS_MS[attempt]
    if (delay === undefined) break
    await sleep(delay, options.signal)
  }
  return { status: 'error', message: lastError }
}
