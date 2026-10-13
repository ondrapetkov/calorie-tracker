import { describe, expect, it } from 'vitest'
import { GOAL_OFFSETS, ageYears, bmr, computeTargets, type TargetInputs } from './targets'

const me: TargetInputs = {
  sex: 'male',
  birthDate: '1996-05-20',
  heightCm: 180,
  activityFactor: 1.55,
  calorieOffset: GOAL_OFFSETS.cut,
  proteinPerKg: 2,
  fatPerKg: 0.9,
}

describe('ageYears', () => {
  it('counts completed years', () => {
    expect(ageYears('1996-05-20', '2026-10-08')).toBe(30)
    expect(ageYears('1996-10-08', '2026-10-08')).toBe(30)
    expect(ageYears('1996-10-09', '2026-10-08')).toBe(29)
    expect(ageYears('1999-12-31', '2026-01-01')).toBe(26)
  })
})

describe('bmr', () => {
  it('matches Mifflin-St Jeor for a male and a female', () => {
    expect(bmr('male', 80, 180, 30)).toBeCloseTo(1780)
    expect(bmr('female', 60, 165, 30)).toBeCloseTo(10 * 60 + 6.25 * 165 - 150 - 161)
  })
})

describe('computeTargets', () => {
  it('reproduces the worked example from the design (80 kg, 180 cm, 30 y, cutting)', () => {
    const t = computeTargets(me, 80, '2026-10-08')
    expect(t.bmr).toBe(1780)
    expect(t.tdee).toBe(2759)
    expect(t.kcal).toBe(2359)
    expect(t.protein).toBe(160)
    expect(t.fat).toBe(72)
    expect(t.carbs).toBe(268)
    expect(t.warnings).toEqual([])
  })

  it('maintenance has no offset', () => {
    const t = computeTargets({ ...me, calorieOffset: 0 }, 80, '2026-10-08')
    expect(t.kcal).toBe(2759)
    expect(t.carbs).toBe(Math.round((2759 - 4 * 160 - 9 * 72) / 4))
  })

  it('macro calories add up to the calorie target within rounding', () => {
    const t = computeTargets(me, 80, '2026-10-08')
    expect(Math.abs(4 * t.protein + 4 * t.carbs + 9 * t.fat - t.kcal)).toBeLessThan(12)
  })

  it('gives reference values for fiber and salt', () => {
    const t = computeTargets(me, 80, '2026-10-08')
    expect(t.fiber).toBe(33)
    expect(t.salt).toBe(5)
  })

  it('warns when the target is below resting needs', () => {
    const t = computeTargets({ ...me, calorieOffset: -1500 }, 80, '2026-10-08')
    expect(t.warnings.join(' ')).toMatch(/below your estimated resting/)
  })

  it('floors carbs at zero and warns when protein and fat exceed the calories', () => {
    const t = computeTargets({ ...me, proteinPerKg: 4, fatPerKg: 2 }, 80, '2026-10-08')
    expect(t.carbs).toBe(0)
    expect(t.warnings.join(' ')).toMatch(/carbs are set to 0/)
  })
})
