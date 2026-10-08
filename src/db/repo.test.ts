import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from './schema'
import { createRepo, type FoodInput } from './repo'
import { sumMacros } from '../domain/nutrition'

const oats: FoodInput = {
  source: 'custom',
  externalId: null,
  name: 'Ovesné vločky',
  brand: null,
  basis: 'g',
  per100: { kcal: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, salt: null },
  defaultServingG: null,
  defaultServingLabel: null,
}

let db: AppDB
let repo: ReturnType<typeof createRepo>

beforeEach(async () => {
  db = new AppDB(`test-${Math.random()}`)
  repo = createRepo(db)
})

describe('foods', () => {
  it('searches by name without diacritics and by every word', async () => {
    await repo.saveFood(oats)
    await repo.saveFood({ ...oats, name: 'Mléko', brand: 'Madeta', externalId: '1' })
    expect((await repo.searchFoods('ovesne')).map((f) => f.name)).toEqual(['Ovesné vločky'])
    expect((await repo.searchFoods('mleko madeta')).length).toBe(1)
    expect((await repo.searchFoods('mleko banana')).length).toBe(0)
  })

  it('finds a food by barcode and ignores deleted ones', async () => {
    const f = await repo.saveFood({ ...oats, externalId: '8076800195057' })
    expect((await repo.findFoodByExternalId('8076800195057'))?.id).toBe(f.id)
    await repo.deleteFood(f.id)
    expect(await repo.findFoodByExternalId('8076800195057')).toBeUndefined()
  })

  it('marks rows dirty on every write', async () => {
    const f = await repo.saveFood(oats)
    await db.foods.update(f.id, { dirty: 0 })
    await repo.updateFood(f.id, { ...oats, name: 'Oats' })
    expect((await db.foods.get(f.id))?.dirty).toBe(1)
  })
})

describe('log entries', () => {
  it('snapshots macros, labels the entry and records food usage', async () => {
    const food = await repo.saveFood({ ...oats, brand: 'Emco' })
    const entry = await repo.logFood({ food, grams: 50, date: '2026-10-08', slot: 'breakfast' })
    expect(entry.kcal).toBeCloseTo(185)
    expect(entry.label).toBe('Ovesné vločky · Emco')
    const stored = await db.foods.get(food.id)
    expect(stored?.useCount).toBe(1)
    expect(stored?.lastUsedAt).not.toBeNull()
    expect((await repo.recentFoods()).map((f) => f.id)).toEqual([food.id])
  })

  it('returns only live entries for a date, in logging order', async () => {
    const food = await repo.saveFood(oats)
    const a = await repo.logFood({ food, grams: 50, date: '2026-10-08', slot: 'breakfast' })
    const b = await repo.logFood({ food, grams: 80, date: '2026-10-08', slot: 'lunch' })
    await repo.logFood({ food, grams: 10, date: '2026-10-09', slot: 'lunch' })
    await repo.deleteEntry(a.id)
    expect((await repo.entriesForDate('2026-10-08')).map((e) => e.id)).toEqual([b.id])
    await repo.restoreEntry(a.id)
    expect((await repo.entriesForDate('2026-10-08')).length).toBe(2)
  })

  it('rescales the snapshot when the amount changes, even if the food changed or is gone', async () => {
    const food = await repo.saveFood(oats)
    const entry = await repo.logFood({ food, grams: 50, date: '2026-10-08', slot: 'breakfast' })
    await repo.updateFood(food.id, { ...oats, per100: { ...oats.per100, kcal: 999 } })
    await repo.deleteFood(food.id)
    await repo.updateEntry(entry.id, { grams: 100, slot: 'snack' })
    const [updated] = await repo.entriesForDate('2026-10-08')
    expect(updated.kcal).toBeCloseTo(370)
    expect(updated.slot).toBe('snack')
    expect(updated.grams).toBe(100)
    expect(sumMacros([updated]).kcal).toBeCloseTo(370)
  })

  it('exports every table including soft-deleted rows', async () => {
    const food = await repo.saveFood(oats)
    await repo.deleteFood(food.id)
    const dump = await repo.exportAll()
    expect(dump.tables.foods.length).toBe(1)
    expect(dump.tables.foods[0].deletedAt).not.toBeNull()
  })
})
