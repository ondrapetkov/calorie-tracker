import { useState } from 'react'
import { TagChip } from './TagChip'
import { TagPicker } from './TagPicker'
import { useVocabulary } from './useVocabulary'

interface Props {
  tagIds: string[]
  onAdd: (tagId: string) => void
  onRemove: (tagId: string) => void
  /** Tags to pulse briefly (just added automatically). */
  highlightIds?: string[]
  /** Title of the picker sheet. */
  pickerTitle?: string
}

/** Selected tags as removable chips, plus a dashed "＋ Tag" chip that opens the picker. */
export function TagEditorRow({ tagIds, onAdd, onRemove, highlightIds = [], pickerTitle = 'Ingredient tags' }: Props) {
  const vocab = useVocabulary()
  const [picking, setPicking] = useState(false)
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {tagIds.map((id) => {
          const t = vocab?.byId.get(id)
          if (!t) return null
          return (
            <TagChip key={id} label={t.name} selected highlight={highlightIds.includes(id)} onRemove={() => onRemove(id)} />
          )
        })}
        <TagChip label="＋ Tag" dashed onClick={() => setPicking(true)} />
      </div>
      {picking && (
        <TagPicker
          title={pickerTitle}
          selected={tagIds}
          onToggle={(id) => (tagIds.includes(id) ? onRemove(id) : onAdd(id))}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
