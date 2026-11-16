import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Sheet } from '../../components/ui'
import { repo } from '../../db/repo'
import type { LogEntry } from '../../db/schema'
import { multiplyMacros } from '../../domain/nutrition'
import { AmountForm } from '../add-food/AmountForm'
import { EditMealEntrySheet } from './EditMealEntrySheet'
import { SaveAsMealSheet } from './SaveAsMealSheet'

interface Props {
  entry: LogEntry
  onClose: () => void
  onDeleted: (entry: LogEntry) => void
  /** The food was saved as a meal (which replaced the entry); both sheets are closed by then. */
  onSavedAsMeal: (name: string) => void
}

export function EditEntrySheet({ entry, onClose, onDeleted, onSavedAsMeal }: Props) {
  if (entry.mealId !== null) return <EditMealEntrySheet entry={entry} onClose={onClose} onDeleted={onDeleted} />
  return <EditFoodEntrySheet entry={entry} onClose={onClose} onDeleted={onDeleted} onSavedAsMeal={onSavedAsMeal} />
}

function EditFoodEntrySheet({ entry, onClose, onDeleted, onSavedAsMeal }: Props) {
  const [savingAsMeal, setSavingAsMeal] = useState(false)
  // A meal can't use a food that has been deleted since it was logged.
  const foodExists = useLiveQuery(
    async () => (entry.foodId ? (await repo.liveFoodIds([entry.foodId])).has(entry.foodId) : false),
    [entry.foodId],
    false,
  )
  const grams = entry.grams ?? 0
  // Derive per-100 values from the entry's own snapshot, so editing does not depend on the food still existing.
  const per100 = grams > 0 ? multiplyMacros(entry, 100 / grams) : multiplyMacros(entry, 1)

  return (
    <>
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
            extraActions={
              foodExists && (
                <Button className="w-full" onClick={() => setSavingAsMeal(true)}>
                  Save as meal
                </Button>
              )
            }
          />
        </div>
      </Sheet>
      {savingAsMeal && (
        <SaveAsMealSheet
          entries={[entry]}
          initialName={entry.label}
          onClose={() => setSavingAsMeal(false)}
          onSaved={(name) => {
            onClose()
            onSavedAsMeal(name)
          }}
        />
      )}
    </>
  )
}
