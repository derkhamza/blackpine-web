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
  // Local calendar date, NOT UTC. `toISOString()` returns the UTC day, which is
  // "yesterday" during the first hour after local midnight (Morocco is UTC+1),
  // desyncing "today" across the waiting room / agenda / dashboards.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole-years age from an ISO birth date (YYYY-MM-DD); null when unknown/invalid.
 *  Birthday-accurate (not a 365.25-day approximation). */
export function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob + "T12:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

// ── Tension artérielle (TA) ────────────────────────────────────────────────────
// Vitals are stored in mmHg (120/80). Moroccan/French clinical convention reads
// TA in cmHg (12/8), so we display divided by 10.
export function mmHgToCmHg(mmHg: number): string {
  const v = mmHg / 10;
  // one decimal, but drop a trailing .0  → 12, 12.5, 8
  return (Math.round(v * 10) / 10).toString();
}

// Parse a cmHg input string into a stored mmHg number (12 → 120, "12.5" → 125).
export function cmHgToMmHg(s: string): number | undefined {
  const n = parseFloat(s.replace(",", "."));
  if (Number.isNaN(n)) return undefined;
  return Math.round(n * 10);
}

export function formatTaCmHg(bpSys?: number, bpDia?: number): string {
  if (bpSys == null && bpDia == null) return "—";
  const s = bpSys != null ? mmHgToCmHg(bpSys) : "—";
  const d = bpDia != null ? mmHgToCmHg(bpDia) : "—";
  return `${s}/${d} cmHg`;
}

// ── Indice de masse corporelle (IMC) & stades d'obésité ────────────────────────
export interface BmiClass {
  label: string;   // French label
  stage: string;   // short stage code shown as a chip
  color: string;   // hex
}

// WHO classification incl. obesity stages I/II/III.
export function bmiClassify(bmi: number): BmiClass {
  if (bmi < 16.5) return { label: "Dénutrition",            stage: "—",            color: "#8E44AD" };
  if (bmi < 18.5) return { label: "Insuffisance pondérale", stage: "Maigreur",     color: "#2980B9" };
  if (bmi < 25)   return { label: "Corpulence normale",      stage: "Normal",       color: "#15A876" };
  if (bmi < 30)   return { label: "Surpoids",                stage: "Surpoids",     color: "#D4962A" };
  if (bmi < 35)   return { label: "Obésité modérée",         stage: "Obésité I",    color: "#E67E22" };
  if (bmi < 40)   return { label: "Obésité sévère",          stage: "Obésité II",   color: "#E85B5B" };
  return            { label: "Obésité morbide",        stage: "Obésité III",  color: "#C0392B" };
}
