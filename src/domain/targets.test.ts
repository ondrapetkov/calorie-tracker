import { describe, expect, it } from 'vitest'
import { GOAL_OFFSETS, ageYears, bmr, computeTargets, type TargetInputs } from './targets'

const me: TargetInputs = {
  sex: 'male',
  birthDate: '2004-03-15',
  heightCm: 181,
  activityFactor: 1.55,
  calorieOffset: GOAL_OFFSETS.cut,
  proteinPerKg: 2,
  fatPerKg: 0.9,
}

describe('ageYears', () => {
  it('counts completed years', () => {
    expect(ageYears('2004-03-15', '2026-10-08')).toBe(22)
    expect(ageYears('2004-10-08', '2026-10-08')).toBe(22)
    expect(ageYears('2004-10-09', '2026-10-08')).toBe(21)
    expect(ageYears('2004-12-31', '2026-01-01')).toBe(21)
  })
})

describe('bmr', () => {
  it('matches Mifflin-St Jeor for a male and a female', () => {
    expect(bmr('male', 87, 181, 22)).toBeCloseTo(1896.25)
    expect(bmr('female', 60, 165, 30)).toBeCloseTo(10 * 60 + 6.25 * 165 - 150 - 161)
  })
})

describe('computeTargets', () => {
  it('reproduces the worked example from the design (87 kg, 181 cm, 22 y, cutting)', () => {
    const t = computeTargets(me, 87, '2026-10-08')
    expect(t.bmr).toBe(1896)
    expect(t.tdee).toBe(2939)
    expect(t.kcal).toBe(2539)
    expect(t.protein).toBe(174)
    expect(t.fat).toBe(78)
    expect(t.carbs).toBe(285)
    expect(t.warnings).toEqual([])
  })

  it('maintenance has no offset', () => {
    const t = computeTargets({ ...me, calorieOffset: 0 }, 87, '2026-10-08')
    expect(t.kcal).toBe(2939)
    expect(t.carbs).toBe(Math.round((2939 - 4 * 174 - 9 * 78) / 4))
  })

  it('macro calories add up to the calorie target within rounding', () => {
    const t = computeTargets(me, 87, '2026-10-08')
    expect(Math.abs(4 * t.protein + 4 * t.carbs + 9 * t.fat - t.kcal)).toBeLessThan(12)
  })

  it('gives reference values for fiber and salt', () => {
    const t = computeTargets(me, 87, '2026-10-08')
    expect(t.fiber).toBe(36)
    expect(t.salt).toBe(5)
  })

  it('warns when the target is below resting needs', () => {
    const t = computeTargets({ ...me, calorieOffset: -1500 }, 87, '2026-10-08')
    expect(t.warnings.join(' ')).toMatch(/below your estimated resting/)
  })

  it('floors carbs at zero and warns when protein and fat exceed the calories', () => {
    const t = computeTargets({ ...me, proteinPerKg: 4, fatPerKg: 2 }, 87, '2026-10-08')
    expect(t.carbs).toBe(0)
    expect(t.warnings.join(' ')).toMatch(/carbs are set to 0/)
  })
})
