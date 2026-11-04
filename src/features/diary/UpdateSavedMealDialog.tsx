import { useId, useState } from 'react'
import { Button } from '../../components/ui'
import type { MealUpdateChoice } from './mealUpdateChoice'

/** Asked after a logged meal's plate was edited: change only this entry, or the saved meal too? */
export function UpdateSavedMealDialog({
  mealName,
  onAnswer,
}: {
  mealName: string
  onAnswer: (choice: MealUpdateChoice, remember: boolean) => void
}) {
  const [remember, setRemember] = useState(false)
  const titleId = useId()
  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-end bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto w-full max-w-xl rounded-t-2xl bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5"
      >
        <h3 id={titleId} className="text-lg font-semibold">
          Also update the saved meal?
        </h3>
        <p className="mt-1 text-sm text-muted">
          "{mealName}" in the Meals tab stays as it is unless you choose to update it. Past days never change.
        </p>
        <Button variant="primary" className="mt-4 w-full" onClick={() => onAnswer('entry', remember)}>
          Just this entry
        </Button>
        <Button className="mt-2 w-full" onClick={() => onAnswer('meal', remember)}>
          Update saved meal too
        </Button>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Don't ask again for this meal today
        </label>
      </div>
    </div>
  )
}
