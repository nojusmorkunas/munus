import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"

export interface ToastOptions {
  message: string
  variant?: "default" | "error"
  /** A single follow-up button, usually Undo. */
  action?: { label: string; onClick: () => void }
  /** Runs when the toast goes away without its action being used. */
  onClose?: () => void
  duration?: number
}

interface ToastEntry extends ToastOptions {
  id: number
}

const MAX_TOASTS = 3

const ToastContext = createContext<(options: ToastOptions) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  // Entries and timers live in refs so callbacks run exactly once, outside
  // React's state updaters (which StrictMode may call twice).
  const entries = useRef(new Map<number, ToastEntry>())
  const timers = useRef(new Map<number, number>())
  const nextId = useRef(1)

  const dismiss = useCallback((id: number, viaAction: boolean) => {
    const entry = entries.current.get(id)
    if (!entry) return
    entries.current.delete(id)
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (viaAction) entry.action?.onClick()
    else entry.onClose?.()
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      while (entries.current.size >= MAX_TOASTS) {
        dismiss(entries.current.keys().next().value as number, false)
      }
      const id = nextId.current++
      const entry = { ...options, id }
      entries.current.set(id, entry)
      setToasts((prev) => [...prev, entry])
      const duration = options.duration ?? (options.action ? 8000 : 4000)
      timers.current.set(id, window.setTimeout(() => dismiss(id, false), duration))
    },
    [dismiss]
  )

  useEffect(() => {
    // Toasts can hold a delayed action (such as a delete waiting out its Undo
    // window). Send those before the page goes away.
    const flush = () => {
      for (const id of [...entries.current.keys()]) dismiss(id, false)
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={`pointer-events-auto w-full max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              t.variant === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background"
            }`}
          >
            <p className="flex-1 min-w-0">{t.message}</p>
            {t.action && (
              <button
                onClick={() => dismiss(t.id, true)}
                className="shrink-0 font-semibold underline-offset-4 hover:underline min-h-[32px] px-1"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id, false)}
              className="shrink-0 opacity-70 hover:opacity-100 min-h-[32px] min-w-[24px] flex items-center justify-center"
            >
              <X size={14} />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
