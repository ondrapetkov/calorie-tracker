import { useId } from 'react'
import { Button } from '../../components/ui'

/** Asked after adding an AI estimate: keep it a one-off, or also store it as a food? */
export function SaveEstimateDialog({ name, onAnswer }: { name: string; onAnswer: (saveAsFood: boolean) => void }) {
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
          Save "{name}" as a food?
        </h3>
        <p className="mt-1 text-sm text-muted">
          A food shows up in Foods and Recent foods, with this portion as its serving size. Either way the entry goes
          into your diary.
        </p>
        <Button variant="primary" className="mt-4 w-full" onClick={() => onAnswer(false)}>
          Just this entry
        </Button>
        <Button className="mt-2 w-full" onClick={() => onAnswer(true)}>
          Save as a food too
        </Button>
      </div>
    </div>
  )
}
