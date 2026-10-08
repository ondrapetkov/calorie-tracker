import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Sheet, inputCls } from '../../components/ui'
import { repo } from '../../db/repo'
import type { Food } from '../../db/schema'
import { FoodForm } from '../add-food/FoodForm'
import { FoodRow } from '../add-food/FoodRow'

export function FoodsScreen() {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const trimmed = query.trim()
  const loadedFoods = useLiveQuery(() => (trimmed ? repo.searchFoods(trimmed) : repo.allFoods()), [trimmed])
  const foods: Food[] = loadedFoods ?? []

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-xl font-semibold">Foods</h1>
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
      {loadedFoods === undefined ? null : foods.length === 0 ? (
        <p className="text-sm text-muted">
          {trimmed ? 'No saved food matches.' : 'No saved foods yet. Foods are saved when you log them or create them here.'}
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
