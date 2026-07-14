import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalPortal } from "../components/ModalPortal";
import { useModalA11y } from "./a11y";

// Promise-based replacement for window.confirm(): a themed, RTL/dark-aware,
// focus-trapped dialog. Call `await confirmDialog(message)` (or with options) from
// anywhere — a single <ConfirmHost/> mounted at the app root renders it. Falls
// back to the native confirm only if the host somehow isn't mounted.

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // destructive styling (coral) — defaults to true
}

type Opener = (opts: ConfirmOptions) => Promise<boolean>;
let opener: Opener | null = null;

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  if (!opener) {
    try { return Promise.resolve(window.confirm(o.message)); } catch { return Promise.resolve(false); }
  }
  return opener(o);
}

// Rendered only while open, so useModalA11y runs fresh on each open (focus trap +
// Escape + focus restore).
function ConfirmDialog({ opts, onResolve }: { opts: ConfirmOptions; onResolve: (v: boolean) => void }) {
  const { t } = useTranslation();
  const dialogRef = useModalA11y<HTMLDivElement>(() => onResolve(false));
  const danger = opts.danger !== false;
  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={() => onResolve(false)}>
        <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}
          style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title" style={danger ? { color: "var(--coral)" } : undefined}>
              {opts.title ?? t("common.confirmTitle", { defaultValue: "Confirmer" })}
            </h2>
            <button className="modal-close" onClick={() => onResolve(false)} aria-label={t("common.cancel")}>×</button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{opts.message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => onResolve(false)}>
              {opts.cancelLabel ?? t("common.cancel")}
            </button>
            <button className="btn" autoFocus
              style={danger ? { background: "var(--coral)", color: "#fff" } : undefined}
              onClick={() => onResolve(true)}>
              {opts.confirmLabel ?? t("common.confirm", { defaultValue: "Confirmer" })}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// Guard a data-entry modal against losing work on an accidental backdrop-click or
// Escape. Attach `dirtyRef` via an onChange handler on the modal (React onChange
// bubbles from every form control), pass `guardedClose` to useModalA11y and the
// backdrop onClick, and keep the explicit ×/Cancel buttons on the raw onClose.
export function useGuardedClose(onClose: () => void) {
  const { t } = useTranslation();
  const dirtyRef = useRef(false);
  const guardedClose = async () => {
    if (dirtyRef.current &&
        !(await confirmDialog({ message: t("common.discardConfirm", { defaultValue: "Fermer sans enregistrer ? Les modifications seront perdues." }) }))) {
      return;
    }
    onClose();
  };
  const markDirty = () => { dirtyRef.current = true; };
  return { dirtyRef, guardedClose, markDirty };
}

export function ConfirmHost() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  useEffect(() => {
    opener = (opts) => new Promise<boolean>(resolve => setState({ opts, resolve }));
    return () => { opener = null; };
  }, []);
  if (!state) return null;
  const finish = (v: boolean) => { state.resolve(v); setState(null); };
  return <ConfirmDialog opts={state.opts} onResolve={finish} />;
}
