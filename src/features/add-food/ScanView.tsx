import { useState } from 'react'
import { lookupBarcode, type FoodDraft } from '../../api/openFoodFacts'
import { Button, inputCls } from '../../components/ui'
import { repo } from '../../db/repo'
import type { Food } from '../../db/schema'
import { Scanner } from './Scanner'

interface Props {
  onFound: (item: Food | FoodDraft) => void
  onNotFound: (barcode: string) => void
}

export function ScanView({ onFound, onNotFound }: Props) {
  const [manual, setManual] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' } | { kind: 'busy'; code: string } | { kind: 'error'; message: string }>({
    kind: 'idle',
  })

  const resolve = async (code: string) => {
    setStatus({ kind: 'busy', code })
    // Saved foods win over the network: instant and works offline.
    const saved = await repo.findFoodByExternalId(code)
    if (saved) return onFound(saved)
    const res = await lookupBarcode(code)
    if (res.status === 'found') return onFound(res.draft)
    if (res.status === 'not-found') return onNotFound(code)
    setStatus({ kind: 'error', message: res.message })
  }

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manual.trim()
    if (/^\d{8,14}$/.test(code)) void resolve(code)
  }

  return (
    <div className="space-y-4">
      <Scanner onDetected={(code) => void resolve(code)} />

      {status.kind === 'busy' && <p className="text-sm text-slate-500">Looking up {status.code}…</p>}
      {status.kind === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Lookup failed ({status.message}). Check your connection, or create a custom food.
        </p>
      )}

      <form onSubmit={submitManual} className="flex gap-2">
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder="Or type the barcode digits"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <Button type="submit">Look up</Button>
      </form>
    </div>
  )
}
