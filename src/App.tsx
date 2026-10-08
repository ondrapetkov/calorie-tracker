import { useCallback, useState } from 'react'
import { Scanner } from './Scanner'
import { decodeBarcode } from './decoder'
import { lookupBarcode, type LookupResult, type Nutrition } from './off'

const fmt = (v: number | null, digits = 1) => (v === null ? '—' : v.toFixed(digits))

function NutritionTable({ n }: { n: Nutrition }) {
  return (
    <table>
      <tbody>
        <tr><td>Energy</td><td>{fmt(n.kcal, 0)} kcal</td></tr>
        <tr><td>Protein</td><td>{fmt(n.protein)} g</td></tr>
        <tr><td>Carbs</td><td>{fmt(n.carbs)} g</td></tr>
        <tr><td>Fat</td><td>{fmt(n.fat)} g</td></tr>
        <tr><td>Fiber</td><td>{fmt(n.fiber)} g</td></tr>
        <tr><td>Sugar</td><td>{fmt(n.sugar)} g</td></tr>
        <tr><td>Salt</td><td>{fmt(n.salt, 2)} g</td></tr>
      </tbody>
    </table>
  )
}

export default function App() {
  const [barcode, setBarcode] = useState<string | null>(null)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [manual, setManual] = useState('')
  const [photoMsg, setPhotoMsg] = useState<string | null>(null)

  const lookup = useCallback(async (code: string) => {
    setBarcode(code)
    setResult(null)
    setLoading(true)
    setResult(await lookupBarcode(code))
    setLoading(false)
  }, [])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manual.trim()
    if (/^\d{8,14}$/.test(code)) void lookup(code)
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoMsg('Decoding…')
    const code = await decodeBarcode(file)
    if (code) {
      setPhotoMsg(null)
      void lookup(code)
    } else {
      setPhotoMsg('No barcode found in that photo.')
    }
  }

  return (
    <main>
      <h1>Scanner spike</h1>
      <p className="muted">Milestone 1: can this phone scan real products and look them up?</p>

      <section>
        <h2>Scan</h2>
        <Scanner onDetected={lookup} />
      </section>

      <section>
        <h2>Fallbacks</h2>
        <form onSubmit={submitManual} className="row">
          <input
            inputMode="numeric"
            pattern="\d*"
            placeholder="Type barcode digits"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button type="submit">Look up</button>
        </form>
        <label className="file">
          Or decode from a photo
          <input type="file" accept="image/*" onChange={onPhoto} />
        </label>
        {photoMsg && <p className="muted">{photoMsg}</p>}
      </section>

      {barcode && (
        <section>
          <h2>Result</h2>
          <p>
            Barcode <code>{barcode}</code>
          </p>
          {loading && <p className="muted">Looking up…</p>}
          {result?.status === 'found' && (
            <>
              <p>
                <strong>{result.product.name}</strong>
                {result.product.brand && <> · {result.product.brand}</>}
              </p>
              <p className="muted">
                Per 100 g{result.product.servingSize && <> · serving {result.product.servingSize}</>}
                {' · '}looked up in {result.ms} ms
              </p>
              <NutritionTable n={result.product.per100} />
            </>
          )}
          {result?.status === 'not-found' && (
            <p>Not in Open Food Facts ({result.ms} ms). This would become a custom food.</p>
          )}
          {result?.status === 'error' && (
            <p className="error">
              Lookup failed after {result.ms} ms: {result.message}. If this says "Load failed" or
              "Failed to fetch", it may be a network or CORS problem.
            </p>
          )}
        </section>
      )}
    </main>
  )
}
