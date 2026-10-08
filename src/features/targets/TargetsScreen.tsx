import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, Field, inputCls } from '../../components/ui'
import { DEFAULT_WATER_PRESETS, repo } from '../../db/repo'
import type { Profile } from '../../db/schema'
import { localDate } from '../../domain/dates'
import { formatNumber, parseNumber, parseSignedNumber } from '../../domain/numbers'
import {
  ACTIVITY_LEVELS,
  DEFAULT_FAT_PER_KG,
  DEFAULT_PROTEIN_PER_KG,
  GOAL_LABELS,
  GOAL_OFFSETS,
  computeTargets,
  type Goal,
  type Sex,
} from '../../domain/targets'

const valid = (n: number | null): n is number => n !== null && !Number.isNaN(n)

export function TargetsScreen() {
  const data = useLiveQuery(async () => ({ profile: await repo.getProfile(), weight: await repo.latestWeight() }), [])
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-xl font-semibold">Targets</h1>
      {!data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <TargetsForm profile={data.profile} weightKg={data.weight?.kg} />
      )}
    </div>
  )
}

function TargetsForm({ profile, weightKg }: { profile: Profile | undefined; weightKg: number | undefined }) {
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male')
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '')
  const [height, setHeight] = useState(profile ? String(profile.heightCm) : '')
  const [weight, setWeight] = useState(weightKg !== undefined ? String(weightKg) : '')
  const [activity, setActivity] = useState(profile?.activityFactor ?? 1.55)
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'cut')
  const [offset, setOffset] = useState(String(profile?.calorieOffset ?? GOAL_OFFSETS.cut))
  const [proteinPerKg, setProteinPerKg] = useState(String(profile?.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG))
  const [fatPerKg, setFatPerKg] = useState(String(profile?.fatPerKg ?? DEFAULT_FAT_PER_KG))
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const today = localDate()
  const h = parseNumber(height)
  const w = parseNumber(weight)
  const o = parseSignedNumber(offset)
  const p = parseNumber(proteinPerKg)
  const f = parseNumber(fatPerKg)
  const birthOk = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && birthDate < today
  const ready =
    birthOk && valid(h) && h >= 100 && h <= 250 && valid(w) && w >= 30 && w <= 300 && valid(o) && valid(p) && p > 0 && valid(f) && f > 0

  const targets = ready
    ? computeTargets(
        { sex, birthDate, heightCm: h, activityFactor: activity, calorieOffset: o, proteinPerKg: p, fatPerKg: f },
        w,
        today,
      )
    : null

  const chooseGoal = (g: Goal) => {
    setGoal(g)
    setOffset(String(GOAL_OFFSETS[g]))
    setSaved(false)
  }
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setSaved(false)
  }

  const save = async () => {
    if (!targets || !valid(h) || !valid(w) || !valid(o) || !valid(p) || !valid(f)) return
    setBusy(true)
    try {
      await repo.saveProfile({
        sex,
        birthDate,
        heightCm: h,
        activityFactor: activity,
        goal,
        calorieOffset: o,
        proteinPerKg: p,
        fatPerKg: f,
        waterGoalMl: profile?.waterGoalMl ?? 2500,
        waterPresets: profile?.waterPresets ?? DEFAULT_WATER_PRESETS,
      })
      await repo.setWeight(today, w)
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Daily targets are estimated from your body and goal. They are a starting point, not medical advice: adjust them
        based on how your weight actually changes.
      </p>

      {targets ? (
        <Card>
          <div className="text-center">
            <span className="text-4xl font-semibold">{formatNumber(targets.kcal)}</span>
            <span className="ml-1 text-slate-500">kcal / day</span>
          </div>
          <div className="mt-3 grid grid-cols-3 text-center">
            <div><div className="font-semibold">{targets.protein} g</div><div className="text-xs text-slate-500">Protein</div></div>
            <div><div className="font-semibold">{targets.carbs} g</div><div className="text-xs text-slate-500">Carbs</div></div>
            <div><div className="font-semibold">{targets.fat} g</div><div className="text-xs text-slate-500">Fat</div></div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Resting energy {formatNumber(targets.bmr)} kcal · maintenance about {formatNumber(targets.tdee)} kcal ·
            adjustment {valid(o) && o > 0 ? '+' : ''}
            {valid(o) ? o : 0} kcal · fiber about {targets.fiber} g · salt up to {targets.salt} g
          </p>
          {targets.warnings.map((msg) => (
            <p key={msg} className="mt-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {msg}
            </p>
          ))}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-slate-500">Fill in the fields below to see your targets.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant={sex === 'male' ? 'primary' : 'secondary'} onClick={() => touch(setSex)('male')}>Male</Button>
        <Button variant={sex === 'female' ? 'primary' : 'secondary'} onClick={() => touch(setSex)('female')}>Female</Button>
      </div>

      <Field label="Date of birth">
        <input className={inputCls} type="date" value={birthDate} max={today} onChange={(e) => touch(setBirthDate)(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)">
          <input className={inputCls} inputMode="decimal" value={height} onChange={(e) => touch(setHeight)(e.target.value)} />
        </Field>
        <Field label="Weight now (kg)" hint="Saved as today's weight">
          <input className={inputCls} inputMode="decimal" value={weight} onChange={(e) => touch(setWeight)(e.target.value)} />
        </Field>
      </div>

      <Field label="Activity level">
        <select className={inputCls} value={activity} onChange={(e) => touch(setActivity)(Number(e.target.value))}>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a.factor} value={a.factor}>{a.label}</option>
          ))}
        </select>
      </Field>

      <div>
        <div className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-400">Goal</div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
            <Button key={g} variant={goal === g ? 'primary' : 'secondary'} className="px-2" onClick={() => chooseGoal(g)}>
              {GOAL_LABELS[g]}
            </Button>
          ))}
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <summary className="cursor-pointer text-sm font-medium">Fine-tune</summary>
        <div className="mt-3 space-y-3">
          <Field label="Calorie adjustment (kcal per day)" hint="Negative to lose weight, positive to gain. Picking a goal sets a default.">
            <input className={inputCls} inputMode="text" value={offset} onChange={(e) => touch(setOffset)(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protein (g per kg)">
              <input className={inputCls} inputMode="decimal" value={proteinPerKg} onChange={(e) => touch(setProteinPerKg)(e.target.value)} />
            </Field>
            <Field label="Fat (g per kg)">
              <input className={inputCls} inputMode="decimal" value={fatPerKg} onChange={(e) => touch(setFatPerKg)(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-slate-500">Carbs are whatever calories remain after protein and fat.</p>
        </div>
      </details>

      <Button variant="primary" className="w-full" disabled={!ready || busy} onClick={save}>
        Save targets
      </Button>
      {saved && <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>}
    </div>
  )
}
