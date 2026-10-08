import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../../db/repo'
import type { Profile } from '../../db/schema'
import { localDate } from '../../domain/dates'
import { computeTargets, type Targets } from '../../domain/targets'

export interface TargetsState {
  loading: boolean
  profile: Profile | undefined
  weightKg: number | undefined
  /** Null until a profile and a weight exist. */
  targets: Targets | null
}

export function useTargets(): TargetsState {
  const data = useLiveQuery(async () => ({ profile: await repo.getProfile(), weight: await repo.latestWeight() }), [])
  if (!data) return { loading: true, profile: undefined, weightKg: undefined, targets: null }
  const { profile, weight } = data
  const targets = profile && weight ? computeTargets(profile, weight.kg, localDate()) : null
  return { loading: false, profile, weightKg: weight?.kg, targets }
}
