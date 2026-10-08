import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-900'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white active:bg-emerald-700 disabled:bg-slate-400',
  secondary:
    'border border-slate-300 bg-white active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800',
  danger: 'border border-red-300 text-red-600 active:bg-red-50 dark:border-red-900 dark:text-red-400 dark:active:bg-red-950',
  ghost: 'text-emerald-700 active:bg-emerald-50 dark:text-emerald-400 dark:active:bg-slate-800',
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
      className={`rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
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
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center gap-2 border-b border-slate-200 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] dark:border-slate-800">
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
