interface Props {
  label: string
  selected?: boolean
  /** Dashed accent outline, for "＋ Tag" style action chips. */
  dashed?: boolean
  /** Pulse briefly, for a tag that was just added automatically. */
  highlight?: boolean
  onClick?: () => void
  /** Shows a ✕ that removes the chip. */
  onRemove?: () => void
}

/** A rounded tag pill. */
export function TagChip({ label, selected, dashed, highlight, onClick, onRemove }: Props) {
  const look = selected
    ? 'border-accent bg-accent font-semibold text-on-accent'
    : dashed
      ? 'border-dashed border-accent text-accent'
      : 'border-line-strong text-fg'
  const cls = `inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-sm ${look} ${
    highlight ? 'tag-highlight' : ''
  }`
  if (onRemove)
    return (
      <span className={cls}>
        {onClick ? (
          <button type="button" onClick={onClick}>
            {label}
          </button>
        ) : (
          label
        )}
        <button type="button" aria-label={`Remove ${label}`} className="-mr-1 px-1 leading-none" onClick={onRemove}>
          ✕
        </button>
      </span>
    )
  return (
    <button type="button" aria-pressed={selected} className={`${cls} active:opacity-80`} onClick={onClick}>
      {label}
    </button>
  )
}
