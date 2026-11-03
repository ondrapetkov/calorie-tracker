import { useState } from 'react'
import { SLOTS, SLOT_LABELS } from '../../domain/nutrition'
import {
  EMPTY_FILTER,
  isFilterActive,
  toggleSlot,
  toggleTag,
  toggleUntagged,
  type TagFilter,
} from '../../domain/tagFilter'
import type { Vocabulary } from '../../domain/tags'
import { TagChip } from './TagChip'
import { TagPicker } from './TagPicker'

interface Props {
  vocab: Vocabulary
  filter: TagFilter
  onChange: (f: TagFilter) => void
  /** Show the meal-type row (Meals tab only). */
  showSlots: boolean
  resultCount: number
  noun: [singular: string, plural: string]
}

/** Chip filters: meal types, selected ingredient tags, "＋ Ingredient" and "Untagged", with a result count. */
export function TagFilterBar({ vocab, filter, onChange, showSlots, resultCount, noun }: Props) {
  const [picking, setPicking] = useState(false)
  return (
    <div className="space-y-2">
      {showSlots && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Meal type">
          {SLOTS.map((s) => (
            <TagChip
              key={s}
              label={SLOT_LABELS[s]}
              selected={filter.slots.includes(s)}
              onClick={() => onChange(toggleSlot(filter, s))}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ingredient tags">
        {filter.tagIds.map((id) => {
          const t = vocab.byId.get(id)
          return t ? (
            <TagChip key={id} label={t.name} icon={t.icon} selected onRemove={() => onChange(toggleTag(filter, id))} />
          ) : null
        })}
        <TagChip label="＋ Ingredient" dashed onClick={() => setPicking(true)} />
        <TagChip label="Untagged" selected={filter.untagged} onClick={() => onChange(toggleUntagged(filter))} />
      </div>
      {isFilterActive(filter) && (
        <p className="text-sm text-muted">
          {resultCount} {resultCount === 1 ? noun[0] : noun[1]} ·{' '}
          <button type="button" className="text-accent" onClick={() => onChange(EMPTY_FILTER)}>
            Clear filters
          </button>
        </p>
      )}
      {picking && (
        <TagPicker
          title="Filter by ingredient"
          selected={filter.tagIds}
          onToggle={(id) => onChange(toggleTag(filter, id))}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
