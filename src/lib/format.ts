const NBSP = " ";

export function formatMAD(n: number, opts?: { showCurrency?: boolean }): string {
  const showCurrency = opts?.showCurrency ?? true;
  const rounded      = Math.round(n);
  const withSep      = rounded.toLocaleString("fr-FR").replace(/\s/g, NBSP);
  return showCurrency ? `${withSep}${NBSP}MAD` : withSep;
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}
