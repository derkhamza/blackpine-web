import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id:      string;
  message: string;
  type:    ToastType;
}

// ── Context ───────────────────────────────────────────────────────────────────

type ToastFn = (message: string, type?: ToastType) => void;
const ToastCtx = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastCtx);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  const icons = {
    success: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    error: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    info: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 4.5v3M5 3v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
    warning: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 3v3M5 7.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  };
  return <span className={`toast-icon toast-icon-${type}`}>{icons[type]}</span>;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(ts => [...ts, { id, message, type }]);
    // Error/warning toasts linger longer — they carry something the user must read
    // and often act on; a 3.8s success flash is too short for those.
    const ttl = type === "error" ? 9000 : type === "warning" ? 7000 : 3800;
    setTimeout(() => {
      setToasts(ts => ts.filter(t => t.id !== id));
    }, ttl);
  }, []);

  // Bridge for non-React callers (e.g. the API client) to raise a toast via a
  // window event, so actionable failures aren't swallowed as a generic sync error.
  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d && typeof d.message === "string") addToast(d.message, (d.type as ToastType) || "info");
    };
    window.addEventListener("bp:toast", onToast);
    return () => window.removeEventListener("bp:toast", onToast);
  }, [addToast]);

  const remove = (id: string) =>
    setToasts(ts => ts.filter(t => t.id !== id));

  return (
    <ToastCtx.Provider value={addToast}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite" aria-label="Notifications">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`} role="alert">
              <ToastIcon type={t.type} />
              <span className="toast-msg">{t.message}</span>
              <button
                className="toast-close"
                onClick={() => remove(t.id)}
                aria-label="Fermer"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
