import { useState } from 'react'
import { ErrorNote, Field, Sheet, SheetDone, inputCls } from '../../components/ui'
import { repo } from '../../db/repo'
import type { LogEntry } from '../../db/schema'
import { formatNumber } from '../../domain/numbers'

interface Props {
  /** Logged foods of one day and slot. */
  entries: LogEntry[]
  initialName: string
  onClose: () => void
  /** Called once the meal is saved and has replaced the entries. */
  onSaved: (name: string) => void
}

/** Name a saved meal made from logged foods; on Done it replaces them in the diary. */
export function SaveAsMealSheet({ entries, initialName, onClose, onSaved }: Props) {
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const kcal = entries.reduce((sum, e) => sum + e.kcal, 0)

  const save = async () => {
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await repo.saveEntriesAsMeal({ entryIds: entries.map((e) => e.id), name: trimmed })
      onSaved(trimmed)
    } catch {
      setError("Couldn't save the meal.")
      setBusy(false)
    }
  }

  return (
    <Sheet title="Save as meal" onClose={onClose}>
      <SheetDone onClick={() => void save()} disabled={!trimmed || busy} />
      <div className="space-y-4">
        <Field label="Name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            autoFocus
          />
        </Field>
        <div className="rounded-xl border border-line bg-surface px-3 py-1">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate">{e.label}</div>
                <div className="text-xs text-muted">
                  {formatNumber(e.grams ?? 0, 0)} {e.unit}
                </div>
              </div>
              <div className="text-sm font-medium">{formatNumber(e.kcal)}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">1 serving</span>
          <span className="font-medium">{formatNumber(kcal)} kcal</span>
        </div>
        <p className="text-sm text-muted">These entries will be replaced by the meal in your diary.</p>
        {error && <ErrorNote message={error} />}
      </div>
    </Sheet>
  )
}
