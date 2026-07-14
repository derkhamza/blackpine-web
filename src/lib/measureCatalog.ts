// Shared measurement catalog — the single list of measurable parameters that BOTH
// "Mesures & bilan" (consultation) and "Examens & Bio" draw from, so every bilan
// type is available in both (deep-merge). Built from the existing, clinically
// reviewed BILAN_CATALOG + the common lab panel + vital signs. Catalog keys reuse
// the BILAN_CATALOG field keys (e.g. bl_glycemie) so projections stay identity.

import { BILAN_CATALOG } from "./specialtyFields";

export interface MeasureDef {
  key:     string;
  label:   string;
  unit?:   string;
  refMin?: number;
  refMax?: number;
  options?: string[];
  group:   string;      // display group for the picker
}

// Vital signs + anthropometry as first-class, trendable measures.
const VITALS_DEFS: MeasureDef[] = [
  { key: "vs_bpSys",  label: "TA systolique",       unit: "mmHg", group: "Signes vitaux" },
  { key: "vs_bpDia",  label: "TA diastolique",      unit: "mmHg", group: "Signes vitaux" },
  { key: "vs_hr",     label: "Fréquence cardiaque", unit: "bpm",  group: "Signes vitaux" },
  { key: "vs_temp",   label: "Température",          unit: "°C",   group: "Signes vitaux" },
  { key: "vs_spo2",   label: "SpO₂",                unit: "%",    group: "Signes vitaux" },
  { key: "vs_weight", label: "Poids",               unit: "kg",   group: "Anthropométrie" },
  { key: "vs_height", label: "Taille",              unit: "cm",   group: "Anthropométrie" },
];

// Common biology panel with reference ranges (moved here to be the single source;
// ExamensPage imports it from this module).
export const COMMON_LABS: Array<{ label: string; unit: string; refMin: number; refMax: number }> = [
  { label: "Hémoglobine",       unit: "g/dL",    refMin: 12,  refMax: 17 },
  { label: "Globules rouges",   unit: "×10⁶/µL", refMin: 3.8, refMax: 5.9 },
  { label: "Globules blancs",   unit: "×10³/µL", refMin: 4,   refMax: 11 },
  { label: "Plaquettes",        unit: "×10³/µL", refMin: 150, refMax: 400 },
  { label: "Glycémie",          unit: "g/L",     refMin: 0.7, refMax: 1.1 },
  { label: "Créatinine",        unit: "µmol/L",  refMin: 50,  refMax: 110 },
  { label: "Urée",              unit: "mmol/L",  refMin: 2.5, refMax: 7.5 },
  { label: "ASAT (GOT)",        unit: "UI/L",    refMin: 0,   refMax: 40 },
  { label: "ALAT (GPT)",        unit: "UI/L",    refMin: 0,   refMax: 40 },
  { label: "Cholestérol total", unit: "g/L",     refMin: 0,   refMax: 2 },
  { label: "LDL",               unit: "g/L",     refMin: 0,   refMax: 1.6 },
  { label: "HDL",               unit: "g/L",     refMin: 0.4, refMax: 1.6 },
  { label: "Triglycérides",     unit: "g/L",     refMin: 0,   refMax: 1.5 },
  { label: "TSH",               unit: "mUI/L",   refMin: 0.4, refMax: 4 },
  { label: "CRP",               unit: "mg/L",    refMin: 0,   refMax: 10 },
  { label: "Vitamine D",        unit: "ng/mL",   refMin: 30,  refMax: 100 },
  { label: "Ferritine",         unit: "ng/mL",   refMin: 15,  refMax: 300 },
  { label: "HbA1c",             unit: "%",       refMin: 0,   refMax: 5.7 },
];

// A stable, unique key from a label (accents just become underscores — the key
// only needs to be deterministic, not pretty).
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// Build once at module load: vitals + every BILAN_CATALOG field + any common lab
// not already present by label. Lab reference ranges are attached to matching
// bilan fields (and to the standalone lab entries).
export const MEASURE_CATALOG: MeasureDef[] = (() => {
  const labByLabel = new Map(COMMON_LABS.map(l => [l.label.toLowerCase(), l]));
  const out: MeasureDef[] = [...VITALS_DEFS];
  const seenLabels = new Set(out.map(d => d.label.toLowerCase()));
  for (const g of BILAN_CATALOG) {
    for (const f of g.fields) {
      const lab = labByLabel.get(f.label.toLowerCase());
      out.push({
        key: f.key, label: f.label, unit: f.unit, options: f.options,
        refMin: lab?.refMin, refMax: lab?.refMax, group: g.title,
      });
      seenLabels.add(f.label.toLowerCase());
    }
  }
  // Add common labs that no bilan field already covers (by label).
  for (const l of COMMON_LABS) {
    if (seenLabels.has(l.label.toLowerCase())) continue;
    out.push({ key: `lab_${slug(l.label)}`, label: l.label, unit: l.unit, refMin: l.refMin, refMax: l.refMax, group: "Biologie courante" });
    seenLabels.add(l.label.toLowerCase());
  }
  return out;
})();

let BY_KEY: Map<string, MeasureDef> | null = null;
let BY_LABEL: Map<string, MeasureDef> | null = null;
function indexes() {
  if (!BY_KEY) {
    BY_KEY = new Map(MEASURE_CATALOG.map(d => [d.key, d]));
    BY_LABEL = new Map();
    // First match wins so bilan keys (bl_*) take precedence over lab_* aliases.
    for (const d of MEASURE_CATALOG) { const k = d.label.toLowerCase(); if (!BY_LABEL.has(k)) BY_LABEL.set(k, d); }
  }
  return { byKey: BY_KEY!, byLabel: BY_LABEL! };
}

export function measureByKey(key: string): MeasureDef | undefined {
  return indexes().byKey.get(key);
}
export function measureByLabel(label: string): MeasureDef | undefined {
  return indexes().byLabel.get(label.trim().toLowerCase());
}

// Grouped for the pickers both surfaces share (group title → its measures).
export const MEASURE_GROUPS: { title: string; items: MeasureDef[] }[] = (() => {
  const order: string[] = [];
  const map = new Map<string, MeasureDef[]>();
  for (const d of MEASURE_CATALOG) {
    if (!map.has(d.group)) { map.set(d.group, []); order.push(d.group); }
    map.get(d.group)!.push(d);
  }
  return order.map(title => ({ title, items: map.get(title)! }));
})();
