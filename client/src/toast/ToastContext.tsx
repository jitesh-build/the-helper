import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const LOOK: Record<ToastKind, { icon: string; border: string; ms: number }> = {
  success: { icon: '✅', border: 'border-l-coc-good', ms: 3500 },
  error: { icon: '⛔', border: 'border-l-coc-danger', ms: 7000 },
  info: { icon: 'ℹ️', border: 'border-l-sky-400', ms: 4000 },
  warning: { icon: '⚠️', border: 'border-l-amber-400', ms: 6000 },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((list) => list.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      // the same message is not stacked twice; at most 4 are shown at once
      setItems((list) =>
        list.some((x) => x.kind === kind && x.message === message) ? list : [...list.slice(-3), { id, kind, message }],
      );
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), LOOK[kind].ms),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach((t) => window.clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      warning: (m) => push('warning', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`toast-in pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl border-2 border-l-8 border-coc-woodDark bg-coc-wood px-3 py-2 text-white shadow-xl ${LOOK[t.kind].border}`}
          >
            <span aria-hidden>{LOOK[t.kind].icon}</span>
            <p className="min-w-0 flex-1 break-words text-sm">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="px-1 text-sm opacity-70 hover:opacity-100"
              onClick={() => dismiss(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}