// Unified patient measurements (deep-merge Stage 1 — read model only).
//
// Today a patient's measured values live in three separate places:
//   • Appointment.vitalSigns              (TA, FC, T°, SpO₂, poids, taille)
//   • consultationNote.extraFields        (structured bilan values, keyed by BILAN_CATALOG)
//   • Appointment.customMeasures          (ad-hoc measures typed at the desk)
//   • examResults[].values                (external lab / imaging results)
//
// This module PROJECTS all of them into one normalised, patient-level list and
// derives per-parameter evolution (trend) series — without copying, migrating or
// mutating any of the underlying records. It is pure and fully unit-tested, and is
// the foundation the later stages (a real `measurements` store, two-way editing)
// build on.

import type { Appointment, ExamResult, VitalSigns } from "./cabinetTypes";
import { fieldMeta } from "./specialtyFields";

export type MeasureSource = "consultation" | "lab" | "imaging" | "external";

export interface MeasurementView {
  /** Stable per-row id (source-derived), so the UI has a React key. */
  id:            string;
  date:          string;          // YYYY-MM-DD — clinical date
  /** Grouping key for the evolution series (catalog key when known, else the label). */
  seriesKey:     string;
  label:         string;
  value:         string;          // raw entered value ("12.5", "Négatif", "++")
  num:           number | null;   // parsed numeric value, or null for qualitative
  unit?:         string;
  refMin?:       number;
  refMax?:       number;
  bad:           boolean;         // out-of-range / flagged abnormal
  source:        MeasureSource;
  appointmentId?: string;
  createdAt:     string;          // for "most recently recorded" ordering
}

// Vitals carried on the appointment → normalised rows. TA is split into two
// series so systolic/diastolic each trend on their own.
const VITALS: { key: keyof VitalSigns; label: string; unit: string }[] = [
  { key: "bpSys",  label: "TA systolique",  unit: "mmHg" },
  { key: "bpDia",  label: "TA diastolique", unit: "mmHg" },
  { key: "hr",     label: "FC",             unit: "bpm"  },
  { key: "temp",   label: "T°",             unit: "°C"   },
  { key: "spo2",   label: "SpO₂",           unit: "%"    },
  { key: "weight", label: "Poids",          unit: "kg"   },
  { key: "height", label: "Taille",         unit: "cm"   },
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

/** Normalise a label for series grouping (so a bilan glycémie and a lab glycémie merge). */
function norm(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Project one appointment's captured measures into normalised rows. */
export function projectAppointment(a: Appointment): MeasurementView[] {
  const out: MeasurementView[] = [];
  // Appointments have no createdAt; date + start time gives a stable intra-day order.
  const createdAt = `${a.date}T${(a.startTime || "00:00")}:00.000Z`;
  const vs = a.vitalSigns;
  if (vs) {
    for (const v of VITALS) {
      const raw = vs[v.key];
      if (raw == null || raw === ("" as unknown)) continue;
      const num = typeof raw === "number" ? raw : parseNum(String(raw));
      out.push({
        id: `appt:${a.id}:vs:${v.key}`, date: a.date, seriesKey: norm(v.label),
        label: v.label, value: String(raw), num, unit: v.unit, bad: false,
        source: "consultation", appointmentId: a.id, createdAt,
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
        id: `appt:${a.id}:ef:${key}`, date: a.date, seriesKey: key,
        label: meta.label, value: String(val), num, unit: meta.unit, bad: false,
        source: "consultation", appointmentId: a.id, createdAt,
      });
    }
  }
  for (const cm of a.customMeasures ?? []) {
    if (!cm.value || String(cm.value).trim() === "") continue;
    const num = parseNum(String(cm.value));
    out.push({
      id: `appt:${a.id}:cm:${cm.id}`, date: a.date, seriesKey: norm(cm.label),
      label: cm.label, value: String(cm.value), num, unit: cm.unit, bad: false,
      source: cm.source === "external" ? "external" : "consultation", appointmentId: a.id, createdAt,
    });
  }
  return out;
}

/** Project one external exam result's values into normalised rows. */
export function projectExamResult(e: ExamResult): MeasurementView[] {
  const src: MeasureSource = e.type === "imagerie" ? "imaging" : e.type === "biologie" ? "lab" : "external";
  return e.values
    .filter(v => v.value != null && String(v.value).trim() !== "")
    .map((v, i) => {
      const num = parseNum(String(v.value));
      return {
        id: `exam:${e.id}:${i}`, date: e.date, seriesKey: norm(v.label),
        label: v.label, value: String(v.value), unit: v.unit, num,
        refMin: v.refMin, refMax: v.refMax,
        bad: v.isAbnormal ?? outOfRange(num, v.refMin, v.refMax),
        source: src, appointmentId: undefined, createdAt: e.createdAt ?? `${e.date}T00:00:00.000Z`,
      } as MeasurementView;
    });
}

/**
 * Every recorded measure for one patient, newest clinical date first. Draws from
 * the patient's appointments and exam results — the single read model both the
 * consultation "Mesures & bilan" tab and the trend view consume.
 */
export function buildPatientMeasurements(
  patientId: string | undefined,
  appointments: Appointment[],
  examResults: ExamResult[],
): MeasurementView[] {
  const rows: MeasurementView[] = [];
  if (patientId) {
    for (const a of appointments) if (a.patientId === patientId) rows.push(...projectAppointment(a));
    for (const e of examResults)  if (e.patientId === patientId) rows.push(...projectExamResult(e));
  }
  return rows.sort((x, y) => y.date.localeCompare(x.date) || y.createdAt.localeCompare(x.createdAt));
}

export interface TrendSeries {
  seriesKey: string;
  label:     string;
  unit:      string;
  count:     number;
  latest:    MeasurementView;          // most recent value (any type)
  points:    { date: string; num: number; bad: boolean; appointmentId?: string }[];  // numeric history, chronological
  yMin:      number;
  yMax:      number;
}

/**
 * One evolution series per measured parameter for a patient. Every parameter that
 * has at least one recorded value appears (with its latest value); a numeric series
 * with ≥2 points also carries a sparkline-ready point list.
 */
export function buildTrendSeries(views: MeasurementView[]): TrendSeries[] {
  const byKey = new Map<string, MeasurementView[]>();
  for (const v of views) {
    const arr = byKey.get(v.seriesKey);
    if (arr) arr.push(v); else byKey.set(v.seriesKey, [v]);
  }
  const series: TrendSeries[] = [];
  for (const [seriesKey, arr] of byKey) {
    // Newest first for `latest`; chronological for the sparkline.
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
  // Parameters with the most history first, then most recently recorded.
  return series.sort((a, b) =>
    b.points.length - a.points.length ||
    b.latest.date.localeCompare(a.latest.date));
}
