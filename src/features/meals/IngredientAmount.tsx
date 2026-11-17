import { inputCls } from '../../components/ui'
import { amountText, formatCount, gramsFromText, stepCount, type Serving } from '../../domain/servings'
import { parseNumber } from '../../domain/numbers'

interface Props {
  name: string
  basis: 'g' | 'ml'
  /** What the box shows: a serving count when `serving` is set, otherwise g/ml. */
  text: string
  serving: Serving | null
  /** The serving size the row can switch to: its own, or else its food's. Null: grams only. */
  servingSize: Serving | null
  onChange: (text: string, serving: Serving | null) => void
}

const stepCls = 'h-9 w-8 shrink-0 rounded-lg bg-surface-2 text-lg leading-none active:bg-line'

/**
 * The amount box of an ingredient row (a meal's or a logged plate's). In servings it gets −/+
 * buttons and a narrower box; the unit switches between servings and g/ml when a serving size is known.
 */
export function IngredientAmount({ name, basis, text, serving, servingSize, onChange }: Props) {
  const step = (delta: 1 | -1) => {
    const n = parseNumber(text)
    onChange(formatCount(stepCount(n !== null && !Number.isNaN(n) && n > 0 ? n : 1, delta)), serving)
  }

  const switchUnit = () => {
    const next = serving ? null : servingSize
    const grams = gramsFromText(text, serving)
    // An unreadable amount switches over as it is, for the owner to fix.
    onChange(grams === null ? text : amountText(grams, next), next)
  }

  return (
    <>
      {serving && (
        <button type="button" aria-label={`Fewer ${name}`} className={stepCls} onClick={() => step(-1)}>
          −
        </button>
      )}
      <input
        aria-label={`Amount of ${name}`}
        className={`${inputCls} ${serving ? '!w-14' : '!w-24'} text-right`}
        inputMode="decimal"
        value={text}
        onChange={(e) => onChange(e.target.value, serving)}
        onFocus={(e) => e.target.select()}
      />
      {serving && (
        <button type="button" aria-label={`More ${name}`} className={stepCls} onClick={() => step(1)}>
          +
        </button>
      )}
      {servingSize ? (
        <button
          type="button"
          aria-label={serving ? `Switch ${name} to grams` : `Switch ${name} to servings`}
          className="w-9 shrink-0 text-left text-sm text-accent underline decoration-dotted underline-offset-2"
          onClick={switchUnit}
        >
          {serving ? 'serv.' : basis}
        </button>
      ) : (
        <span className="w-9 shrink-0 text-sm text-muted">{basis}</span>
      )}
    </>
  )
}
