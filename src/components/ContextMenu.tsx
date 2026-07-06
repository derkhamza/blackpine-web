import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// ── A right-click context menu whose items are supplied by each caller, so every
// part of the app can offer actions tailored to what was clicked. ──────────────

export interface CtxItem {
  label:     string;
  icon?:     ReactNode;      // small leading glyph (emoji or SVG)
  onClick?:  () => void;     // omitted for a header/disabled row
  danger?:   boolean;        // red styling (delete etc.)
  disabled?: boolean;
  divider?:  boolean;        // render a separator ABOVE this item
  header?:   boolean;        // non-clickable section label
}

interface MenuState { x: number; y: number; items: CtxItem[]; }

/**
 * usage:
 *   const ctx = useContextMenu();
 *   <div onContextMenu={e => ctx.open(e, [{ label: "Open", onClick }])} />
 *   {ctx.menu}
 */
export function useContextMenu() {
  const [state, setState] = useState<MenuState | null>(null);

  const open = useCallback((e: { preventDefault(): void; stopPropagation(): void; clientX: number; clientY: number }, items: CtxItem[]) => {
    const usable = items.filter(Boolean);
    if (usable.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, items: usable });
  }, []);

  const close = useCallback(() => setState(null), []);

  const menu = state
    ? <ContextMenu x={state.x} y={state.y} items={state.items} onClose={close} />
    : null;

  return { open, close, menu, isOpen: !!state };
}

function ContextMenu({ x, y, items, onClose }: MenuState & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Keep the menu inside the viewport (flip near the right/bottom edge).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    let nx = x, ny = y;
    if (x + width + pad > window.innerWidth)  nx = Math.max(pad, window.innerWidth - width - pad);
    if (y + height + pad > window.innerHeight) ny = Math.max(pad, window.innerHeight - height - pad);
    setPos({ x: nx, y: ny });
  }, [x, y]);

  // Dismiss on outside click, Escape, scroll, resize, or another context menu.
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey  = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("contextmenu", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("contextmenu", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="ctx-menu" style={{ top: pos.y, left: pos.x }} role="menu">
      {items.map((it, i) => {
        if (it.header) {
          return <div key={i} className="ctx-menu-header">{it.label}</div>;
        }
        return (
          <div key={i}>
            {it.divider && <div className="ctx-menu-sep" />}
            <button
              type="button"
              role="menuitem"
              className={`ctx-menu-item${it.danger ? " danger" : ""}`}
              disabled={it.disabled}
              onClick={() => { if (!it.disabled) { it.onClick?.(); onClose(); } }}
            >
              {it.icon != null && <span className="ctx-menu-icon">{it.icon}</span>}
              <span className="ctx-menu-label">{it.label}</span>
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
