import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Sheet, inputCls } from '../../components/ui'
import { repo } from '../../db/repo'
import type { Food } from '../../db/schema'
import { FoodForm } from '../add-food/FoodForm'
import { FoodRow } from '../add-food/FoodRow'
import { EMPTY_FILTER, isFilterActive, matchesTagFilter, type TagFilter } from '../../domain/tagFilter'
import { liveTagIds } from '../../domain/tags'
import { TagFilterBar } from '../tags/TagFilterBar'
import { useVocabulary } from '../tags/useVocabulary'

export function FoodsPanel() {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const trimmed = query.trim()
  const loadedFoods = useLiveQuery(() => (trimmed ? repo.searchFoods(trimmed) : repo.allFoods()), [trimmed])
  const [filter, setFilter] = useState<TagFilter>(EMPTY_FILTER)
  const vocab = useVocabulary()
  const foods: Food[] = (loadedFoods ?? []).filter(
    (f) => !vocab || matchesTagFilter({ slots: [], tagIds: liveTagIds(vocab, f.tagIds) }, filter),
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className={inputCls}
          type="search"
          placeholder="Filter saved foods"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button onClick={() => setCreating(true)}>New</Button>
      </div>
      {vocab && (loadedFoods?.length ?? 0) > 0 && (
        <TagFilterBar
          vocab={vocab}
          filter={filter}
          onChange={setFilter}
          showSlots={false}
          resultCount={foods.length}
          noun={['food', 'foods']}
        />
      )}
      {loadedFoods === undefined ? null : foods.length === 0 ? (
        <p className="text-sm text-muted">
          {isFilterActive(filter)
            ? 'No foods match these filters.'
            : trimmed
              ? 'No saved food matches.'
              : 'No saved foods yet. Foods are saved when you log them or create them here.'}
        </p>
      ) : (
        <div>
          {foods.map((f) => (
            <FoodRow key={f.id} item={f} onClick={() => setEditing(f)} />
          ))}
        </div>
      )}

      {creating && (
        <Sheet title="New food" onClose={() => setCreating(false)}>
          <FoodForm
            submitLabel="Save"
            onSubmit={async (input) => {
              await repo.saveFood(input)
              setCreating(false)
            }}
          />
        </Sheet>
      )}
      {editing && (
        <Sheet title="Edit food" onClose={() => setEditing(null)}>
          <p className="mb-4 text-sm text-muted">
            Past diary entries keep the values they were logged with; changes apply to future entries.
          </p>
          <FoodForm
            initial={editing}
            submitLabel="Save"
            onSubmit={async (input) => {
              await repo.updateFood(editing.id, input)
              setEditing(null)
            }}
            onDelete={async () => {
              await repo.deleteFood(editing.id)
              setEditing(null)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
