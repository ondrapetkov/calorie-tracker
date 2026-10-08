import type { ButtonHTMLAttributes, ReactNode } from 'react'

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
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

/** Full-screen overlay with a header, used for the add-food flow and editors. */
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
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="w-20">
          {onBack && (
            <Button variant="ghost" className="whitespace-nowrap px-2 py-1.5" onClick={onBack}>
              ‹ Back
            </Button>
          )}
        </div>
        <h2 className="flex-1 truncate text-center text-base font-semibold">{title}</h2>
        <div className="w-20 text-right">
          {onClose && (
            <Button variant="ghost" className="px-2 py-1.5" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
        <div className="mx-auto max-w-xl">{children}</div>
      </div>
    </div>
  )
}
