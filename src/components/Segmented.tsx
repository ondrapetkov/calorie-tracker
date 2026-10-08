interface Props<T extends string> {
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
  label: string
}

/** A row of mutually exclusive choices, used for sections and ranges. */
export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="grid gap-1 rounded-xl border border-line bg-surface p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-2 py-2 text-sm font-medium ${
            value === o.id ? 'bg-accent text-on-accent' : 'text-muted active:bg-surface-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
