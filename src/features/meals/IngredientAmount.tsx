import { inputCls } from '../../components/ui'
import { formatCount, stepCount, switchServing, type AmountState, type Serving } from '../../domain/servings'
import { parseNumber } from '../../domain/numbers'

interface Props {
  name: string
  basis: 'g' | 'ml'
  /** The box: a serving count when it has a serving, otherwise g/ml. */
  amount: AmountState
  /** The serving size the row can switch to: its own, or else its food's. Null: grams only. */
  servingSize: Serving | null
  onChange: (amount: AmountState) => void
}

const stepCls = 'h-11 w-9 shrink-0 rounded-lg bg-surface-2 text-lg leading-none active:bg-line'

/**
 * The amount box of an ingredient row (a meal's or a logged plate's). In servings it gets −/+
 * buttons and a narrower box; the unit switches between servings and g/ml when a serving size is known.
 */
export function IngredientAmount({ name, basis, amount, servingSize, onChange }: Props) {
  const { text, serving } = amount
  const step = (delta: 1 | -1) => {
    const n = parseNumber(text)
    onChange({ ...amount, text: formatCount(stepCount(n !== null && !Number.isNaN(n) && n > 0 ? n : 1, delta)) })
  }

  // Keeps the exact amount, so switching back and forth never changes it.
  const switchUnit = () => onChange(switchServing(amount, serving ? null : servingSize))

  return (
    <>
      {serving && (
        <button type="button" aria-label={`Fewer ${name}`} className={stepCls} onClick={() => step(-1)}>
          −
        </button>
      )}
      <input
        aria-label={`Amount of ${name}`}
        className={`${inputCls} ${serving ? '!w-16 !px-2' : '!w-24'} text-right`}
        inputMode="decimal"
        value={text}
        onChange={(e) => onChange({ ...amount, text: e.target.value })}
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
