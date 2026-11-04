import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const inputCls =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-accent font-semibold text-on-accent active:bg-accent-dim disabled:bg-line-strong disabled:text-muted',
  secondary: 'border border-line-strong bg-surface text-fg active:bg-surface-2',
  danger: 'border border-danger/50 text-danger active:bg-danger/10',
  ghost: 'text-accent active:bg-surface-2',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2.5 text-base font-medium transition-colors disabled:opacity-60 ${variants[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-3 ${className}`}
    >
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const SheetActionSlot = createContext<HTMLElement | null>(null)

/**
 * Full-screen overlay with a header, used for the add-food flow and editors.
 * The left of the header shows "‹ Back" when there is a step to go back to, otherwise "Close".
 * The right holds the sheet's main action, which content places there with `SheetDone`.
 */
export function Sheet({
  title,
  onBack,
  onClose,
  children,
}: {
  title: string
  onBack?: () => void
  onClose?: () => void
  children: ReactNode
}) {
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)
  return (
    <div className="fixed inset-0 z-40 !m-0 flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="w-20">
          {onBack ? (
            <Button variant="ghost" className="whitespace-nowrap px-2 py-1.5" onClick={onBack}>
              ‹ Back
            </Button>
          ) : (
            onClose && (
              <Button variant="ghost" className="px-2 py-1.5" onClick={onClose}>
                Close
              </Button>
            )
          )}
        </div>
        <h2 className="flex-1 truncate text-center text-base font-semibold">{title}</h2>
        <div ref={setActionSlot} className="flex w-20 justify-end" />
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
        <div className="mx-auto max-w-xl">
          <SheetActionSlot.Provider value={actionSlot}>{children}</SheetActionSlot.Provider>
        </div>
      </div>
    </div>
  )
}

/** The yellow "Done" button in the top right of the enclosing Sheet's header. */
export function SheetDone({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const slot = useContext(SheetActionSlot)
  if (!slot) return null
  return createPortal(
    <Button variant="primary" className="px-3 py-1.5" disabled={disabled} onClick={onClick}>
      Done
    </Button>,
    slot,
  )
}

/** A form error that scrolls itself into view, since the form's Done button sits in the header. */
export function ErrorNote({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [message])
  return (
    <p ref={ref} role="alert" className="text-sm text-danger">
      {message}
    </p>
  )
}

/** A horizontal slider with a live value and min/max captions. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  captions,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
  captions?: [string, string, string]
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="text-lg font-semibold">{display}</span>
      </div>
      <input
        type="range"
        className="slider"
        aria-label={label}
        aria-valuetext={display}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {captions && (
        <div className="flex justify-between text-xs text-muted">
          <span>{captions[0]}</span>
          <span>{captions[1]}</span>
          <span>{captions[2]}</span>
        </div>
      )}
    </div>
  )
}
