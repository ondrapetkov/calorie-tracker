import { useCallback, useEffect, useState, type ReactNode } from 'react'

interface ToastState {
  message: string
  undo?: () => void
}

/**
 * A short message with an optional Undo, shown above the tab bar for a few seconds.
 * Returns `show` and the element to render once in the screen.
 */
export function useToast(options: { raised?: boolean } = {}): [(message: string, undo?: () => void) => void, ReactNode] {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const show = useCallback((message: string, undo?: () => void) => setToast({ message, undo }), [])

  const node = toast ? (
    <div
      className={`fixed inset-x-4 z-30 mx-auto flex max-w-xl items-center justify-between rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm text-fg shadow-lg ${
        options.raised ? 'bottom-[calc(env(safe-area-inset-bottom)+8rem)]' : 'bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]'
      }`}
      role="status"
    >
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          className="font-semibold text-accent"
          onClick={() => {
            toast.undo?.()
            setToast(null)
          }}
        >
          Undo
        </button>
      )}
    </div>
  ) : null

  return [show, node]
}
