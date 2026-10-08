export interface Nutrition {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  salt: number | null
}

export interface Product {
  barcode: string
  name: string
  brand: string | null
  servingSize: string | null
  per100: Nutrition
}

type Nutriments = Record<string, number | string | undefined>

function num(n: Nutriments, key: string): number | null {
  const v = n[key]
  const x = typeof v === 'string' ? Number(v) : v
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/** Normalise Open Food Facts nutriments to per-100 g values; kJ is the fallback for kcal. */
export function parseNutriments(n: Nutriments): Nutrition {
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

export type LookupResult =
  | { status: 'found'; product: Product; ms: number }
  | { status: 'not-found'; ms: number }
  | { status: 'error'; message: string; ms: number }

export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  const fields = 'code,product_name,product_name_cs,brands,serving_size,nutriments'
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
    )
    if (res.status === 404) return { status: 'not-found', ms: elapsed() }
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}`, ms: elapsed() }
    const body = await res.json()
    if (body.status !== 1 || !body.product) return { status: 'not-found', ms: elapsed() }
    const p = body.product
    return {
      status: 'found',
      ms: elapsed(),
      product: {
        barcode,
        name: p.product_name_cs || p.product_name || '(unnamed product)',
        brand: p.brands || null,
        servingSize: p.serving_size || null,
        per100: parseNutriments(p.nutriments ?? {}),
      },
    }
  } catch (e) {
    // A TypeError from fetch here usually means a network failure or a CORS block.
    return { status: 'error', message: e instanceof Error ? e.message : String(e), ms: elapsed() }
  }
}
