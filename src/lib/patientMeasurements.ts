// Unified patient measurements — the read model over the canonical `measurements`
// store PLUS a backward-compatible projection of legacy values still living on
// appointments (vitals / bilan extraFields / ad-hoc measures) and exam results.
//
// A canonical row can supersede a projected legacy value via `sourceRef`, so
// promoting old data never double-counts. Series are grouped by catalog key when
// known (so a bilan "Glycémie" and a lab "Glycémie" trend together), else by label.
// Pure and fully unit-tested — the foundation the consultation tab + Examens & Bio
// both consume.

import type { Appointment, ExamResult, VitalSigns, Measurement } from "./cabinetTypes";
import { fieldMeta } from "./specialtyFields";
import { measureByLabel } from "./measureCatalog";

export type { MeasureSource } from "./cabinetTypes";

export interface MeasurementView {
  id:            string;
  date:          string;          // YYYY-MM-DD
  seriesKey:     string;          // catalog key when known, else normalised label
  catalogKey?:   string;
  label:         string;
  value:         string;
  num:           number | null;
  unit?:         string;
  refMin?:       number;
  refMax?:       number;
  bad:           boolean;
  source:        Measurement["source"];
  appointmentId?: string;
  sourceRef?:    string;          // provenance of a projected legacy value
  derived:       boolean;         // true = projected legacy value, false = canonical row
  createdAt:     string;
}

const VITALS: { key: keyof VitalSigns; label: string; unit: string; catalogKey: string }[] = [
  { key: "bpSys",  label: "TA systolique",  unit: "mmHg", catalogKey: "vs_bpSys" },
  { key: "bpDia",  label: "TA diastolique", unit: "mmHg", catalogKey: "vs_bpDia" },
  { key: "hr",     label: "FC",             unit: "bpm",  catalogKey: "vs_hr" },
  { key: "temp",   label: "T°",             unit: "°C",   catalogKey: "vs_temp" },
  { key: "spo2",   label: "SpO₂",           unit: "%",    catalogKey: "vs_spo2" },
  { key: "weight", label: "Poids",          unit: "kg",   catalogKey: "vs_weight" },
  { key: "height", label: "Taille",         unit: "cm",   catalogKey: "vs_height" },
];

/** Parse a French-or-English decimal ("12,5" / "12.5") to a number, or null. */
export function parseNum(v: string): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function outOfRange(num: number | null, refMin?: number, refMax?: number): boolean {
  if (num == null) return false;
  if (refMin != null && num < refMin) return true;
  if (refMax != null && num > refMax) return true;
  return false;
}

/** Normalise a label for series grouping when no catalog key is available. */
function norm(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

// Resolve the grouping key consistently for canonical rows AND projections, so the
// same parameter entered anywhere (bilan, lab, ad-hoc) trends as one series.
const seriesKeyFor = (catalogKey: string | undefined, label: string) =>
  catalogKey ?? measureByLabel(label)?.key ?? norm(label);

/** Project one appointment's captured measures into normalised (legacy) rows. */
export function projectAppointment(a: Appointment): MeasurementView[] {
  const out: MeasurementView[] = [];
  const createdAt = `${a.date}T${(a.startTime || "00:00")}:00.000Z`;
  const vs = a.vitalSigns;
  if (vs) {
    for (const v of VITALS) {
      const raw = vs[v.key];
      if (raw == null || raw === ("" as unknown)) continue;
      const num = typeof raw === "number" ? raw : parseNum(String(raw));
      out.push({
        id: `appt:${a.id}:vs:${v.key}`, date: a.date, seriesKey: v.catalogKey, catalogKey: v.catalogKey,
        label: v.label, value: String(raw), num, unit: v.unit, bad: false,
        source: "consultation", appointmentId: a.id, sourceRef: `appt:${a.id}:vs:${v.key}`, derived: true, createdAt,
      });
    }
  }
  const extra = a.consultationNote?.extraFields;
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val == null || String(val).trim() === "") continue;
      const meta = fieldMeta(key);
      const num = parseNum(String(val));
      out.push({
        id: `appt:${a.id}:ef:${key}`, date: a.date, seriesKey: key, catalogKey: key,
        label: meta.label, value: String(val), num, unit: meta.unit, bad: false,
        source: "consultation", appointmentId: a.id, sourceRef: `appt:${a.id}:ef:${key}`, derived: true, createdAt,
      });
    }
  }
  for (const cm of a.customMeasures ?? []) {
    if (!cm.value || String(cm.value).trim() === "") continue;
    const num = parseNum(String(cm.value));
    const ck = measureByLabel(cm.label)?.key;
    out.push({
      id: `appt:${a.id}:cm:${cm.id}`, date: a.date, seriesKey: seriesKeyFor(ck, cm.label), catalogKey: ck,
      label: cm.label, value: String(cm.value), num, unit: cm.unit, bad: false,
      source: cm.source === "external" ? "external" : "consultation", appointmentId: a.id,
      sourceRef: `appt:${a.id}:cm:${cm.id}`, derived: true, createdAt,
    });
  }
  return out;
}

/** Project one external exam result's values into normalised (legacy) rows. */
export function projectExamResult(e: ExamResult): MeasurementView[] {
  const src: Measurement["source"] = e.type === "imagerie" ? "imaging" : e.type === "biologie" ? "lab" : "external";
  return e.values
    .filter(v => v.value != null && String(v.value).trim() !== "")
    .map((v, i) => {
      const num = parseNum(String(v.value));
      const ck = measureByLabel(v.label)?.key;
      return {
        id: `exam:${e.id}:${i}`, date: e.date, seriesKey: seriesKeyFor(ck, v.label), catalogKey: ck,
        label: v.label, value: String(v.value), unit: v.unit, num,
        refMin: v.refMin, refMax: v.refMax,
        bad: v.isAbnormal ?? outOfRange(num, v.refMin, v.refMax),
        source: src, sourceRef: `exam:${e.id}:${i}`, derived: true,
        createdAt: e.createdAt ?? `${e.date}T00:00:00.000Z`,
      } as MeasurementView;
    });
}

/** A canonical measurement → view. */
function toView(m: Measurement): MeasurementView {
  const num = parseNum(m.value);
  return {
    id: m.id, date: m.date, seriesKey: seriesKeyFor(m.catalogKey, m.label), catalogKey: m.catalogKey,
    label: m.label, value: m.value, num, unit: m.unit, refMin: m.refMin, refMax: m.refMax,
    bad: m.isAbnormal ?? outOfRange(num, m.refMin, m.refMax),
    source: m.source, appointmentId: m.appointmentId, sourceRef: m.sourceRef, derived: false,
    createdAt: m.createdAt,
  };
}

/**
 * Every recorded measure for one patient, newest clinical date first. Unions the
 * canonical `measurements` store with legacy projections; a projection is dropped
 * when a canonical row supersedes it (same `sourceRef`).
 */
export function buildPatientMeasurements(
  patientId: string | undefined,
  appointments: Appointment[],
  examResults: ExamResult[],
  canonical: Measurement[] = [],
): MeasurementView[] {
  if (!patientId) return [];
  const mine = canonical.filter(m => m.patientId === patientId);
  const superseded = new Set(mine.map(m => m.sourceRef).filter(Boolean) as string[]);
  const rows: MeasurementView[] = mine.map(toView);
  for (const a of appointments) if (a.patientId === patientId)
    for (const v of projectAppointment(a)) if (!v.sourceRef || !superseded.has(v.sourceRef)) rows.push(v);
  for (const e of examResults) if (e.patientId === patientId)
    for (const v of projectExamResult(e)) if (!v.sourceRef || !superseded.has(v.sourceRef)) rows.push(v);
  return rows.sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt));
}

export interface TrendSeries {
  seriesKey: string;
  label:     string;
  unit:      string;
  count:     number;
  latest:    MeasurementView;
  points:    { date: string; num: number; bad: boolean; appointmentId?: string }[];
  yMin:      number;
  yMax:      number;
}

/**
 * One evolution series per measured parameter. Every parameter with ≥1 value
 * appears (with its latest value); a numeric series with ≥2 points also carries a
 * sparkline-ready point list.
 */
export function buildTrendSeries(views: MeasurementView[]): TrendSeries[] {
  const byKey = new Map<string, MeasurementView[]>();
  for (const v of views) {
    const arr = byKey.get(v.seriesKey);
    if (arr) arr.push(v); else byKey.set(v.seriesKey, [v]);
  }
  const series: TrendSeries[] = [];
  for (const [seriesKey, arr] of byKey) {
    const byDateDesc = [...arr].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const latest = byDateDesc[0];
    const numeric = [...arr]
      .filter(v => v.num != null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map(v => ({ date: v.date, num: v.num as number, bad: v.bad, appointmentId: v.appointmentId }));
    const nums = numeric.map(p => p.num);
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;
    const pad = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
    series.push({
      seriesKey, label: latest.label, unit: latest.unit ?? "", count: arr.length,
      latest, points: numeric, yMin: min - pad, yMax: max + pad,
    });
  }
  return series.sort((a, b) =>
    b.points.length - a.points.length ||
    b.latest.date.localeCompare(a.latest.date));
}
