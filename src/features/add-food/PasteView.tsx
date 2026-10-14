import { useState } from 'react'
import { Button, inputCls } from '../../components/ui'
import { parseNutritionText, type ParsedNutrition } from '../../domain/nutritionText'

/** Paste text from a nutrition page or a label and hand back what could be read from it. */
export function PasteView({ onParsed }: { onParsed: (parsed: ParsedNutrition) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

  const fill = (input: string) => {
    const parsed = parseNutritionText(input)
    if (!parsed) return setError('No nutrition values found. Copy the part of the page with the energy and nutrient values.')
    setError(null)
    onParsed(parsed)
  }

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      setText(clip)
      fill(clip)
    } catch {
      setError('Could not read the clipboard. Long-press the box below and choose Paste.')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Copy the product page on kaloricketabulky.cz, from the name down to the nutrients, or the nutrition table of a
        label. For a screenshot or photo, open it in Photos, long-press the text, then Select All and Copy.
      </p>
      {canReadClipboard && (
        <Button variant="primary" className="w-full" onClick={pasteFromClipboard}>
          Paste and fill in
        </Button>
      )}
      <textarea
        className={`${inputCls} h-40 resize-none text-sm`}
        placeholder="…or paste the text here"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button className="w-full" disabled={!text.trim()} onClick={() => fill(text)}>
        Fill in from this text
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
