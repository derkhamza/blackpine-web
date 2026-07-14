import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

// Focusable-element selector used by the modal focus trap.
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),' +
  'select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal behaviour in one hook. Attach the returned ref to the dialog
 * element (the `.modal` box, not the backdrop) and give that element
 * `role="dialog" aria-modal="true" tabIndex={-1}`. The hook then:
 *   • focuses the first focusable control (or the dialog) on open,
 *   • traps Tab / Shift+Tab inside the dialog,
 *   • closes on Escape,
 *   • restores focus to the element that was focused before it opened.
 * Listeners are scoped to the dialog node, so a nested modal traps independently.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Keep the latest onClose without re-running the effect (which would steal
  // focus back to the top on every parent re-render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prevFocus = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);

    // Focus the first control after paint (autofocus attributes still win because
    // the browser applies them first).
    const raf = requestAnimationFrame(() => {
      if (node.contains(document.activeElement)) return; // an autofocus already landed inside
      (focusables()[0] ?? node).focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) { e.preventDefault(); return; }
      const first = els[0], last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus(); }
    };

    node.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener("keydown", onKey);
      // Restore focus to the trigger so keyboard users aren't dumped at the top.
      prevFocus?.focus?.();
    };
  }, []);

  return ref;
}

/**
 * Make a non-button element behave like a button for keyboard + screen-reader
 * users: `<div {...clickable(fn)}>`. Adds role/tabIndex and fires on Enter/Space.
 * For genuinely button-like controls prefer a real <button>; this is for the many
 * existing clickable rows/cards/tiles that can't easily become one.
 */
export function clickable(onClick: () => void, label?: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick,
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
    },
  };
}
