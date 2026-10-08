import { parseLocalDate } from './dates'

export type Sex = 'male' | 'female'
export type Goal = 'cut' | 'maintain' | 'bulk'

export const GOAL_LABELS: Record<Goal, string> = { cut: 'Cutting', maintain: 'Maintain', bulk: 'Bulking' }

/** Default daily calorie adjustment for each goal, in kcal. */
export const GOAL_OFFSETS: Record<Goal, number> = { cut: -400, maintain: 0, bulk: 300 }

export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: 'Sedentary (little or no exercise)' },
  { factor: 1.375, label: 'Light (1–3 sessions a week)' },
  { factor: 1.55, label: 'Moderate (3–5 sessions a week)' },
  { factor: 1.725, label: 'High (6–7 sessions a week)' },
  { factor: 1.9, label: 'Very high (hard training twice a day)' },
] as const

export const DEFAULT_PROTEIN_PER_KG = 2
export const DEFAULT_FAT_PER_KG = 0.9

export interface TargetInputs {
  sex: Sex
  birthDate: string
  heightCm: number
  activityFactor: number
  calorieOffset: number
  proteinPerKg: number
  fatPerKg: number
}

export interface Targets {
  ageYears: number
  /** Basal metabolic rate (Mifflin-St Jeor). */
  bmr: number
  /** Estimated maintenance energy: BMR times the activity factor. */
  tdee: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** Soft reference values; not enforced goals. */
  fiber: number
  salt: number
  warnings: string[]
}

export function ageYears(birthDate: string, today: string): number {
  const b = parseLocalDate(birthDate)
  const t = parseLocalDate(today)
  let age = t.getFullYear() - b.getFullYear()
  const hadBirthday =
    t.getMonth() > b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() >= b.getDate())
  if (!hadBirthday) age--
  return age
}

/** Mifflin-St Jeor resting energy expenditure in kcal per day. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function computeTargets(input: TargetInputs, weightKg: number, today: string): Targets {
  const age = ageYears(input.birthDate, today)
  const resting = bmr(input.sex, weightKg, input.heightCm, age)
  const tdee = resting * input.activityFactor
  const kcal = Math.round(tdee + input.calorieOffset)
  const protein = Math.round(input.proteinPerKg * weightKg)
  const fat = Math.round(input.fatPerKg * weightKg)
  const rawCarbs = (kcal - 4 * protein - 9 * fat) / 4
  const carbs = Math.max(0, Math.round(rawCarbs))

  const warnings: string[] = []
  if (rawCarbs < 0) {
    warnings.push('Protein and fat targets use more energy than the calorie target; carbs are set to 0.')
  }
  if (kcal < resting) {
    warnings.push('The calorie target is below your estimated resting energy needs. Consider a smaller deficit.')
  }
  if (age < 18) {
    warnings.push('These formulas are meant for adults.')
  }

  return {
    ageYears: age,
    bmr: Math.round(resting),
    tdee: Math.round(tdee),
    kcal,
    protein,
    fat,
    carbs,
    fiber: Math.round((kcal / 1000) * 14),
    salt: 5,
    warnings,
  }
}
