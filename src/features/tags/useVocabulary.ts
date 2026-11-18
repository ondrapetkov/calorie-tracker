import { useLiveQuery } from 'dexie-react-hooks'
import { repo } from '../../db/repo'
import type { Vocabulary } from '../../domain/tags'

/** The live tag vocabulary; undefined while the first query runs. */
export function useVocabulary(): Vocabulary | undefined {
  return useLiveQuery(() => repo.vocabulary(), [])
}

/** Tag names and emoji for ids, skipping ids that are not live tags. */
export function tagLabels(vocab: Vocabulary | undefined, ids: readonly string[]): { name: string; icon: string }[] {
  if (!vocab) return []
  return ids.flatMap((id) => {
    const t = vocab.byId.get(id)
    return t ? [{ name: t.name, icon: t.icon }] : []
  })
}
