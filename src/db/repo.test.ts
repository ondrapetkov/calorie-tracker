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

describe('meals', () => {
  async function setup() {
    const chicken = await repo.saveFood({
      ...oats,
      name: 'Kuřecí prsa',
      per100: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, salt: 0.12 },
    })
    const rice = await repo.saveFood({
      ...oats,
      name: 'Rýže',
      per100: { kcal: 365, protein: 7.1, carbs: 80, fat: 0.7, fiber: 1.3, sugar: 0.1, salt: null },
    })
    const mealId = await repo.saveMeal({
      name: 'Kuře s rýží',
      servings: 2,
      note: null,
      items: [
        { foodId: chicken.id, grams: 300 },
        { foodId: rice.id, grams: 200 },
      ],
    })
    return { chicken, rice, mealId }
  }

  it('saves a meal and computes totals and per-serving values', async () => {
    const { mealId } = await setup()
    const d = (await repo.getMeal(mealId))!
    expect(d.items.map((i) => i.food?.name)).toEqual(['Kuřecí prsa', 'Rýže'])
    expect(d.total.kcal).toBeCloseTo(360 + 730)
    expect(d.perServing.kcal).toBeCloseTo((360 + 730) / 2)
  })

  it('keeps ingredient identity on edit, removes dropped ones and adds new ones', async () => {
    const { chicken, rice, mealId } = await setup()
    const before = (await repo.getMeal(mealId))!
    const chickenRow = before.items[0]
    await repo.saveMeal(
      {
        name: 'Kuře s rýží',
        servings: 3,
        note: 'Meal prep',
        items: [
          { id: chickenRow.id, foodId: chicken.id, grams: 450 },
          { foodId: rice.id, grams: 50 },
        ],
      },
      mealId,
    )
    const after = (await repo.getMeal(mealId))!
    expect(after.meal.servings).toBe(3)
    expect(after.meal.note).toBe('Meal prep')
    expect(after.items.length).toBe(2)
    expect(after.items[0].id).toBe(chickenRow.id)
    expect(after.items[0].grams).toBe(450)
    // the rice row was removed (soft-deleted), not duplicated
    expect(await db.mealItems.where('mealId').equals(mealId).count()).toBe(3)
    expect(after.items.some((i) => i.id === before.items[1].id)).toBe(false)
  })

  it('logs a meal as one entry with a snapshot and rescales it when servings change', async () => {
    const { mealId } = await setup()
    const entry = await repo.logMeal({ mealId, servings: 1, date: '2026-10-08', slot: 'dinner' })
    expect(entry.mealId).toBe(mealId)
    expect(entry.foodId).toBeNull()
    expect(entry.label).toBe('Kuře s rýží')
    expect(entry.kcal).toBeCloseTo(545)
    await repo.updateMealEntry(entry.id, { servings: 2, slot: 'lunch' })
    const [updated] = await repo.entriesForDate('2026-10-08')
    expect(updated.kcal).toBeCloseTo(1090)
    expect(updated.slot).toBe('lunch')
    expect(updated.servings).toBe(2)
  })

  it('keeps logged entries when the meal is deleted, and hides the meal', async () => {
    const { mealId } = await setup()
    await repo.logMeal({ mealId, servings: 1, date: '2026-10-08', slot: 'dinner' })
    await repo.deleteMeal(mealId)
    expect(await repo.getMeal(mealId)).toBeUndefined()
    expect((await repo.listMeals()).length).toBe(0)
    expect((await repo.entriesForDate('2026-10-08')).length).toBe(1)
  })

  it('lists the most recently logged meal first', async () => {
    const { chicken, mealId } = await setup()
    const other = await repo.saveMeal({ name: 'Omeleta', servings: 1, note: null, items: [{ foodId: chicken.id, grams: 100 }] })
    expect((await repo.listMeals())[0].meal.name).toBe('Kuře s rýží') // alphabetical when never logged
    await repo.logMeal({ mealId: other, servings: 1, date: '2026-10-08', slot: 'lunch' })
    expect((await repo.listMeals())[0].meal.id).toBe(other)
    expect(mealId).not.toBe(other)
  })
})

describe('profile and weight', () => {
  const profile = {
    sex: 'male' as const,
    birthDate: '2004-03-15',
    heightCm: 181,
    activityFactor: 1.55,
    goal: 'cut' as const,
    calorieOffset: -400,
    proteinPerKg: 2,
    fatPerKg: 0.9,
    waterGoalMl: 2500,
    waterPresets: [{ label: 'Shaker', ml: 250 }],
  }

  it('keeps a single profile row and updates it in place', async () => {
    expect(await repo.getProfile()).toBeUndefined()
    await repo.saveProfile(profile)
    await repo.saveProfile({ ...profile, heightCm: 182 })
    expect((await repo.getProfile())?.heightCm).toBe(182)
    expect(await db.profile.count()).toBe(1)
  })

  it('records one weight per day and finds the latest', async () => {
    await repo.setWeight('2026-10-07', 87.4)
    await repo.setWeight('2026-10-08', 87)
    await repo.setWeight('2026-10-08', 86.8)
    expect(await db.weightEntries.count()).toBe(2)
    expect((await repo.latestWeight())?.kg).toBe(86.8)
    expect((await repo.latestWeight())?.date).toBe('2026-10-08')
  })
})

describe('weight history', () => {
  it('lists live weigh-ins oldest first and supports delete and restore', async () => {
    await repo.setWeight('2026-10-08', 86.8)
    await repo.setWeight('2026-10-06', 87.4)
    await repo.setWeight('2026-10-07', 87.1)
    expect((await repo.weightEntries()).map((w) => w.date)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08'])
    const middle = (await repo.weightEntries())[1]
    await repo.deleteWeight(middle.id)
    expect((await repo.weightEntries()).map((w) => w.date)).toEqual(['2026-10-06', '2026-10-08'])
    await repo.restoreWeight(middle.id)
    expect((await repo.weightEntries()).length).toBe(3)
  })

  it('lets a deleted day be logged again without resurrecting the old entry', async () => {
    await repo.setWeight('2026-10-08', 87)
    await repo.deleteWeight((await repo.weightEntries())[0].id)
    await repo.setWeight('2026-10-08', 86.5)
    const live = await repo.weightEntries()
    expect(live.length).toBe(1)
    expect(live[0].kg).toBe(86.5)
  })
})

describe('water', () => {
  it('adds entries, totals per day and ignores deleted ones', async () => {
    await repo.addWater('2026-10-08', 250)
    const big = await repo.addWater('2026-10-08', 900)
    await repo.addWater('2026-10-07', 1100)
    expect((await repo.waterEntriesForDate('2026-10-08')).map((w) => w.ml)).toEqual([250, 900])
    expect(await repo.waterTotals(['2026-10-06', '2026-10-07', '2026-10-08'])).toEqual({
      '2026-10-06': 0,
      '2026-10-07': 1100,
      '2026-10-08': 1150,
    })
    await repo.deleteWater(big.id)
    expect((await repo.waterTotals(['2026-10-08']))['2026-10-08']).toBe(250)
    await repo.restoreWater(big.id)
    expect((await repo.waterTotals(['2026-10-08']))['2026-10-08']).toBe(1150)
  })

  it('uses defaults until a profile exists, then stores settings on the profile', async () => {
    const defaults = await repo.getWaterSettings()
    expect(defaults.goalMl).toBe(2500)
    expect(defaults.presets.map((p) => p.ml)).toEqual([250, 900, 1100])
    expect(await repo.saveWaterSettings({ goalMl: 3000, presets: [{ label: 'Cup', ml: 300 }] })).toBe(false)
    await repo.saveProfile({
      sex: 'male',
      birthDate: '2004-03-15',
      heightCm: 181,
      activityFactor: 1.55,
      goal: 'cut',
      calorieOffset: -400,
      proteinPerKg: 2,
      fatPerKg: 0.9,
      waterGoalMl: 2500,
      waterPresets: defaults.presets,
    })
    expect(await repo.saveWaterSettings({ goalMl: 3000, presets: [{ label: 'Cup', ml: 300 }] })).toBe(true)
    expect(await repo.getWaterSettings()).toEqual({ goalMl: 3000, presets: [{ label: 'Cup', ml: 300 }] })
  })
})
