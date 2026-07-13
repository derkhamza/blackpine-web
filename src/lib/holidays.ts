// Moroccan public holidays for the agenda.
//
// Fixed Gregorian dates are exact. Religious (Islamic) holidays are derived from
// the Umm al-Qura calendar via Intl and can shift ±1 day versus the official
// moon-sighting announcement — they are a scheduling aid, not an authority, and
// are labelled so the doctor knows to confirm. Results are cached per year.

export interface Holiday {
  date:      string;   // YYYY-MM-DD
  name:      string;   // French label (the app's docs/UI are French-first)
  religious: boolean;  // Islamic (approximate) vs civil (exact)
}

interface FixedDef { md: string; name: string; }
// Civil public holidays, fixed on the Gregorian calendar.
const FIXED: FixedDef[] = [
  { md: "01-01", name: "Jour de l'An" },
  { md: "01-11", name: "Manifeste de l'Indépendance" },
  { md: "01-14", name: "Nouvel An Amazigh" },
  { md: "05-01", name: "Fête du Travail" },
  { md: "07-30", name: "Fête du Trône" },
  { md: "08-14", name: "Oued Ed-Dahab" },
  { md: "08-20", name: "Révolution du Roi et du Peuple" },
  { md: "08-21", name: "Fête de la Jeunesse" },
  { md: "11-06", name: "Marche Verte" },
  { md: "11-18", name: "Fête de l'Indépendance" },
];

// Islamic holidays as (Hijri month, Hijri day, French name, days observed).
interface HijriDef { month: number; day: number; name: string; span: number; }
const HIJRI: HijriDef[] = [
  { month: 1,  day: 1,  name: "Nouvel An Hégirien", span: 1 },
  { month: 3,  day: 12, name: "Aïd al-Mawlid",      span: 2 },
  { month: 10, day: 1,  name: "Aïd al-Fitr",        span: 2 },
  { month: 12, day: 10, name: "Aïd al-Adha",        span: 2 },
];

// Lazily resolve an Umm al-Qura → (y,m,d) reader; null if unavailable in this
// runtime (very old engines) — then only the fixed civil holidays are returned.
let hijriReader: ((d: Date) => { m: number; d: number }) | null | undefined;
function getHijriReader(): ((d: Date) => { m: number; d: number }) | null {
  if (hijriReader !== undefined) return hijriReader;
  try {
    const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC",
    });
    // Confirm it really switched calendars (a 2024 Gregorian date is a 1445/1446 AH year).
    const probe = fmt.formatToParts(new Date(Date.UTC(2024, 0, 1)));
    const yr = Number(probe.find(p => p.type === "year")?.value);
    if (!Number.isFinite(yr) || yr < 1400 || yr > 1600) { hijriReader = null; return null; }
    hijriReader = (d: Date) => {
      const parts = fmt.formatToParts(d);
      const num = (t: string) => Number(parts.find(p => p.type === t)?.value);
      return { m: num("month"), d: num("day") };
    };
  } catch {
    hijriReader = null;
  }
  return hijriReader;
}

const isoUTC     = (d: Date) => d.toISOString().slice(0, 10);
const addDaysUTC = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

const yearCache = new Map<number, Holiday[]>();

/** All Moroccan public holidays that fall within the given Gregorian year. */
export function holidaysForYear(year: number): Holiday[] {
  const hit = yearCache.get(year);
  if (hit) return hit;

  const out: Holiday[] = [];
  for (const f of FIXED) out.push({ date: `${year}-${f.md}`, name: f.name, religious: false });

  const hijri = getHijriReader();
  if (hijri) {
    // Walk each day of the Gregorian year and record days matching a target Hijri
    // anchor. A Gregorian year spans slightly more than one Hijri year, so an
    // anchor (e.g. 1 Muharram) can legitimately occur twice — record every hit,
    // no first-match dedup.
    let cur = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    while (cur <= end) {
      const h = hijri(cur);
      for (const def of HIJRI) {
        if (h.m === def.month && h.d === def.day) {
          for (let i = 0; i < def.span; i++) {
            const dd = addDaysUTC(cur, i);
            if (dd.getUTCFullYear() === year) {
              out.push({
                date: isoUTC(dd),
                name: def.span > 1 ? `${def.name} (${i + 1}/${def.span})` : def.name,
                religious: true,
              });
            }
          }
        }
      }
      cur = addDaysUTC(cur, 1);
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  yearCache.set(year, out);
  return out;
}

/** The public holiday on a given ISO date, if any. */
export function holidayOn(iso: string): Holiday | undefined {
  const y = Number(iso.slice(0, 4));
  if (!Number.isFinite(y)) return undefined;
  return holidaysForYear(y).find(h => h.date === iso);
}

/** Build a lookup for a set of years (e.g. the years visible in a month/week). */
export function holidayMap(years: Iterable<number>): Map<string, Holiday> {
  const m = new Map<string, Holiday>();
  for (const y of years) for (const h of holidaysForYear(y)) m.set(h.date, h);
  return m;
}
