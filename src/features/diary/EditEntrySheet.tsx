import { Sheet } from '../../components/ui'
import { repo } from '../../db/repo'
import type { LogEntry } from '../../db/schema'
import { multiplyMacros } from '../../domain/nutrition'
import { AmountForm } from '../add-food/AmountForm'
import { MealServingsForm } from '../meals/MealServingsForm'

interface Props {
  entry: LogEntry
  onClose: () => void
  onDeleted: (entry: LogEntry) => void
}

export function EditEntrySheet({ entry, onClose, onDeleted }: Props) {
  if (entry.mealId !== null) return <EditMealEntry entry={entry} onClose={onClose} onDeleted={onDeleted} />
  const grams = entry.grams ?? 0
  // Derive per-100 values from the entry's own snapshot, so editing does not depend on the food still existing.
  const per100 = grams > 0 ? multiplyMacros(entry, 100 / grams) : multiplyMacros(entry, 1)

  return (
    <Sheet title="Edit entry" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-lg font-semibold">{entry.label}</div>
        <AmountForm
          per100={per100}
          unit={entry.unit}
          servingG={null}
          servingLabel={null}
          initialGrams={grams}
          initialSlot={entry.slot}
          submitLabel="Save"
          onSubmit={async (g, slot) => {
            await repo.updateEntry(entry.id, { grams: g, slot })
            onClose()
          }}
          onDelete={async () => {
            await repo.deleteEntry(entry.id)
            onDeleted(entry)
            onClose()
          }}
        />
      </div>
    </Sheet>
  )
}

function EditMealEntry({ entry, onClose, onDeleted }: Props) {
  const servings = entry.servings && entry.servings > 0 ? entry.servings : 1
  return (
    <Sheet title="Edit entry" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-lg font-semibold">{entry.label}</div>
        <MealServingsForm
          perServing={multiplyMacros(entry, 1 / servings)}
          initialServings={servings}
          initialSlot={entry.slot}
          submitLabel="Save"
          onSubmit={async (s, slot) => {
            await repo.updateMealEntry(entry.id, { servings: s, slot })
            onClose()
          }}
          onDelete={async () => {
            await repo.deleteEntry(entry.id)
            onDeleted(entry)
            onClose()
          }}
        />
      </div>
    </Sheet>
  )
}
