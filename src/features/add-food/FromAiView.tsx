import { useId, useState } from 'react'
import { Button, ErrorNote, inputCls } from '../../components/ui'
import { AI_PROMPT, readAiAnswer, type AiEstimate } from '../../domain/aiEstimate'

/** Step 1 copies the prompt for any AI chat; step 2 reads the AI's answer back. */
export function FromAiView({ onRead }: { onRead: (estimate: AiEstimate) => void }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const answerId = useId()
  const canReadClipboard = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  const read = (input: string) => {
    const r = readAiAnswer(input)
    if (!r.ok) {
      return setError(
        `Couldn't find ${r.missing.join(', ')} in the answer. Copy the AI's whole answer, including the block at the end.`,
      )
    }
    setError(null)
    onRead(r.estimate)
  }

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      setText(clip)
      read(clip)
    } catch {
      setError('Could not read the clipboard. Long-press the box below and choose Paste.')
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-line bg-surface p-3">
        <p className="text-sm">
          <span className="mr-2 inline-block h-5 w-5 rounded-full bg-surface-2 text-center text-xs leading-5">1</span>
          Ask any AI about what you ate, and add this prompt to your message.
        </p>
        <Button variant={copy === 'copied' ? 'secondary' : 'primary'} className="w-full" onClick={() => void copyPrompt()}>
          {copy === 'copied' ? '✓ Prompt copied' : 'Copy prompt'}
        </Button>
        {copy === 'failed' && (
          <div className="space-y-1">
            <p className="text-sm text-muted">Couldn't copy it automatically. Copy it from here:</p>
            <textarea
              readOnly
              aria-label="The prompt"
              className={`${inputCls} h-40 resize-none text-xs`}
              value={AI_PROMPT}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-3">
        <p className="text-sm">
          <span className="mr-2 inline-block h-5 w-5 rounded-full bg-surface-2 text-center text-xs leading-5">2</span>
          Copy the AI's whole answer, then:
        </p>
        {canReadClipboard && (
          <Button variant="primary" className="w-full" onClick={() => void pasteFromClipboard()}>
            Paste the answer
          </Button>
        )}
        <label htmlFor={answerId} className="block text-sm text-muted">
          {canReadClipboard ? '…or paste it here' : 'Paste it here'}
        </label>
        <textarea
          id={answerId}
          aria-label="The AI's answer"
          className={`${inputCls} h-40 resize-none text-sm`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button className="w-full" disabled={!text.trim()} onClick={() => read(text)}>
          Read this answer
        </Button>
        {error && <ErrorNote message={error} />}
      </section>
    </div>
  )
}
