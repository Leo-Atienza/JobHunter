'use client';

import { createContext, useCallback, useContext, useReducer, useRef } from 'react';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  action?: { label: string; href?: string; onClick?: () => void };
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string };

interface ToastState {
  toasts: (Toast & { leaving?: boolean })[];
}

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [...state.toasts, action.toast].slice(-5) };
    case 'DISMISS':
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, leaving: true } : t
        ),
      };
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

type ToastFn = (toast: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<ToastFn>(() => {});

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const toast: ToastFn = useCallback((t) => {
    const id = `toast-${++toastCounter}`;
    dispatch({ type: 'ADD', toast: { ...t, id } });

    const duration = t.duration ?? 3500;
    const timer = setTimeout(() => {
      dispatch({ type: 'DISMISS', id });
      setTimeout(() => dispatch({ type: 'REMOVE', id }), 300);
      timersRef.current.delete(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    dispatch({ type: 'DISMISS', id });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), 300);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2"
      >
        {state.toasts.map((t) => (
          <div
            key={t.id}
            style={{
              animation: t.leaving
                ? 'slide-out-right 0.3s ease-in forwards'
                : 'slide-in-right 0.25s ease-out',
            }}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
              t.type === 'error'
                ? 'border-red-200 bg-red-50/95 text-red-800'
                : t.type === 'info'
                  ? 'border-primary-200 bg-primary-50/95 text-primary-800'
                  : 'border-slate-200 bg-white/95 text-slate-800'
            }`}
          >
            {/* Icon */}
            {t.type === 'success' && (
              <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {t.type === 'error' && (
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {t.type === 'info' && (
              <svg className="h-4 w-4 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}

            <span className="text-sm font-medium">{t.message}</span>

            {t.action && (
              t.action.href ? (
                <a
                  href={t.action.href}
                  className="shrink-0 rounded-lg bg-primary-950 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-800"
                >
                  {t.action.label}
                </a>
              ) : (
                <button
                  onClick={t.action.onClick}
                  className="shrink-0 rounded-lg bg-primary-950 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-800"
                >
                  {t.action.label}
                </button>
              )
            )}

            <button
              onClick={() => handleDismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600"
              aria-label="Dismiss"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
