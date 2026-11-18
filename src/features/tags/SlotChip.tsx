/**
 * Time of day (a meal type) looks unlike ingredient tags: square-cornered yellow badges instead
 * of round pills. Text is uppercased by CSS, so accessible names stay "Lunch".
 */

/** A meal-type filter or picker chip; filled yellow when selected. */
export function SlotChip({ label, selected, onClick }: { label: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`whitespace-nowrap rounded-md border-[1.5px] border-accent px-2.5 py-1 active:opacity-80 ${
        selected ? 'bg-accent text-on-accent' : 'text-accent'
      }`}
    >
      {/* On a span: the global `button { font: inherit }` rule beats size and weight utilities on the button. */}
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
    </button>
  )
}

/** A small solid badge naming a meal's time of day, for lists. */
export function SlotBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-accent px-1.5 text-[10px] font-bold uppercase leading-4 tracking-wide text-on-accent">
      {label}
    </span>
  )
}
