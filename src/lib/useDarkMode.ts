import { useCallback, useEffect, useState } from "react";

const KEY = "bp.darkMode";

function applyTheme(dark: boolean) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) === "1"; }
    catch { return false; }
  });

  useEffect(() => {
    applyTheme(dark);
    try { localStorage.setItem(KEY, dark ? "1" : "0"); }
    catch {}
  }, [dark]);

  const toggle = useCallback(() => setDark(d => !d), []);

  return { dark, toggle };
}

/** Call once at app root to apply saved preference before first render */
export function initDarkMode() {
  try {
    applyTheme(localStorage.getItem(KEY) === "1");
  } catch {}
}
