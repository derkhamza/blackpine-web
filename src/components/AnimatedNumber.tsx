import { useEffect, useRef, useState } from "react";

/**
 * Count-up number — animates from its previous value to the new one with an
 * ease-out curve (the satisfying Revolut "money ticker" feel). Respects
 * prefers-reduced-motion (renders the final value instantly).
 *
 *   <AnimatedNumber value={1240} format={(n) => n.toLocaleString("fr-FR")} />
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("fr-FR"),
  duration = 650,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  // Start from 0 so the value counts up on first mount (the Revolut "ticker"
  // moment); subsequent changes animate from the previous value.
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to || !Number.isFinite(to)) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    let start: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setDisplay(from + (to - from) * ease(p));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span className={`rv-num${className ? " " + className : ""}`}>{format(display)}</span>;
}
