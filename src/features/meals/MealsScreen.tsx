import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Sheet } from '../../components/ui'
import { repo, type MealDetail } from '../../db/repo'
import { localDate } from '../../domain/dates'
import { defaultSlot } from '../../domain/nutrition'
import { formatNumber } from '../../domain/numbers'
import { MealEditor } from './MealEditor'
import { MealServingsForm } from './MealServingsForm'

export function MealsScreen() {
  const loadedMeals = useLiveQuery(() => repo.listMeals(), [])
  const meals: MealDetail[] = loadedMeals ?? []
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const [editing, setEditing] = useState<MealDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Always read the current version so the sheet reflects edits made while it is open.
  const viewed = meals.find((m) => m.meal.id === viewing) ?? null

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meals</h1>
        <Button onClick={() => setCreating(true)}>New meal</Button>
      </div>
      {message && <p className="text-sm text-accent">{message}</p>}

      {loadedMeals === undefined ? null : meals.length === 0 ? (
        <p className="text-sm text-muted">
          No meals yet. A meal is a recipe you eat often, for example chicken with rice. Build it once from ingredients
          and log it in one tap.
        </p>
      ) : (
        <div>
          {meals.map((m) => (
            <button
              key={m.meal.id}
              type="button"
              onClick={() => setViewing(m.meal.id)}
              className="flex w-full items-center gap-3 border-b border-line py-3 text-left active:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.meal.name}</div>
                <div className="truncate text-xs text-muted">
                  {m.items.length} ingredient{m.items.length === 1 ? '' : 's'} · {m.meal.servings}{' '}
                  {m.meal.servings === 1 ? 'serving' : 'servings'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatNumber(m.perServing.kcal)} kcal</div>
                <div className="text-xs text-muted">per serving</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <MealEditor
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setMessage('Meal saved.')
          }}
        />
      )}
      {editing && (
        <MealEditor
          detail={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setMessage('Meal updated.')
          }}
        />
      )}
      {viewed && !editing && (
        <Sheet title={viewed.meal.name} onClose={() => setViewing(null)}>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Ingredients</h3>
              {viewed.items.map((i) => (
                <div key={i.id} className="flex justify-between border-b border-line py-1.5 text-sm">
                  <span className="truncate pr-2">{i.food?.name ?? '(deleted food)'}</span>
                  <span className="text-muted">
                    {formatNumber(i.grams)} {i.food?.basis ?? 'g'}
                  </span>
                </div>
              ))}
              {viewed.meal.note && <p className="mt-2 text-sm text-muted">{viewed.meal.note}</p>}
            </div>
            <p className="text-sm text-muted">
              Makes {viewed.meal.servings} {viewed.meal.servings === 1 ? 'serving' : 'servings'} · {formatNumber(viewed.perServing.kcal)}{' '}
              kcal each · {formatNumber(viewed.total.kcal)} kcal in total
            </p>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Log to today</h3>
              <MealServingsForm
                perServing={viewed.perServing}
                initialSlot={defaultSlot(new Date().getHours())}
                submitLabel="Add to diary"
                onSubmit={async (servings, slot) => {
                  await repo.logMeal({ mealId: viewed.meal.id, servings, date: localDate(), slot })
                  setViewing(null)
                  setMessage(`Added ${viewed.meal.name} to today.`)
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setEditing(viewed)}>Edit</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await repo.deleteMeal(viewed.meal.id)
                  setViewing(null)
                  setMessage('Meal deleted. Past diary entries keep their values.')
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
