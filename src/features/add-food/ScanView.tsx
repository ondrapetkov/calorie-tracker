import { useState } from 'react'
import { lookupBarcode, type FoodDraft } from '../../api/openFoodFacts'
import { Button, inputCls } from '../../components/ui'
import { repo } from '../../db/repo'
import type { Food } from '../../db/schema'
import { decodeBarcode } from './decoder'
import { Scanner } from './Scanner'

interface Props {
  onFound: (item: Food | FoodDraft) => void
  onNotFound: (barcode: string) => void
}

export function ScanView({ onFound, onNotFound }: Props) {
  const [manual, setManual] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' } | { kind: 'busy'; code: string } | { kind: 'photo' } | { kind: 'error'; message: string }>({
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
    setStatus({
      kind: 'error',
      message: `Lookup failed (${res.message}). Check your connection, or create a custom food.`,
    })
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus({ kind: 'photo' })
    try {
      const code = await decodeBarcode(file)
      if (code) void resolve(code)
      else setStatus({ kind: 'error', message: 'No barcode found in that photo. Try a closer, sharper shot.' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manual.trim()
    if (/^\d{8,14}$/.test(code)) void resolve(code)
  }

  return (
    <div className="space-y-4">
      <Scanner onDetected={(code) => void resolve(code)} />

      {status.kind === 'busy' && <p className="text-sm text-muted">Looking up {status.code}…</p>}
      {status.kind === 'photo' && <p className="text-sm text-muted">Reading barcode from photo…</p>}
      {status.kind === 'error' && <p className="text-sm text-danger">{status.message}</p>}

      <form onSubmit={submitManual} className="flex gap-2">
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder="Or type the barcode digits"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <Button type="submit" className="whitespace-nowrap">
          Look up
        </Button>
      </form>

      <label className="block cursor-pointer rounded-lg border border-line-strong px-4 py-2.5 text-center font-medium active:bg-surface-2">
        Scan from a photo or image
        <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
      </label>
    </div>
  )
}
