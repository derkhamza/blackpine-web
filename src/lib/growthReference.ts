// Growth-reference helpers for the pediatric growth curve (Suivi & analyses).
//
// The percentile *band* curves (3/10/25/50/75/90/97) are the official WHO growth
// references (Child Growth Standards 0–5 y + WHO 2007 reference 5–19 y), embedded
// as exact LMS tables in growthReferenceData.ts — NOT invented. A percentile p is
// M·(1 + L·S·Z_p)^(1/L) (Z_p from the standard normal), the WHO/Cole LMS method.
// `percentileBands()` returns null only for a metric/sex with no table (e.g.
// weight above 10 y, which WHO does not define), in which case the chart draws
// the child's own measurements (and mid-parental target) without bands.

import { WHO_GROWTH_REFERENCE } from "./growthReferenceData";

export type GrowthMetric = "height" | "weight" | "bmi" | "headCirc";
export type GrowthSex = "M" | "F";

// The seven reference centiles drawn by convention on GFA / carnet-de-santé curves.
export const REFERENCE_CENTILES = [3, 10, 25, 50, 75, 90, 97] as const;

// Z-scores for those centiles (standard-normal quantiles).
export const CENTILE_Z: Record<number, number> = {
  3: -1.8808, 10: -1.2816, 25: -0.6745, 50: 0, 75: 0.6745, 90: 1.2816, 97: 1.8808,
};

export interface LmsRow { age: number; L: number; M: number; S: number } // age in years

// Official WHO LMS tables (auto-generated from WHO's own data — see
// growthReferenceData.ts), keyed `${metric}:${sex}`.
export const GROWTH_REFERENCE: Partial<Record<`${GrowthMetric}:${GrowthSex}`, LmsRow[]>> = WHO_GROWTH_REFERENCE;

export interface CentileCurve { centile: number; points: { age: number; value: number }[] }

// Returns the reference percentile curves for a metric+sex, or null when no
// verified dataset is embedded. Never fabricates values.
export function percentileBands(metric: GrowthMetric, sex: GrowthSex): CentileCurve[] | null {
  const rows = GROWTH_REFERENCE[`${metric}:${sex}`];
  if (!rows || rows.length === 0) return null;
  const valueAt = (row: LmsRow, z: number) =>
    row.L === 0 ? row.M * Math.exp(row.S * z) : row.M * Math.pow(1 + row.L * row.S * z, 1 / row.L);
  return REFERENCE_CENTILES.map((c) => ({
    centile: c,
    points: rows.map((row) => ({ age: row.age, value: valueAt(row, CENTILE_Z[c]) })),
  }));
}

export function hasReferenceBands(metric: GrowthMetric, sex: GrowthSex): boolean {
  const rows = GROWTH_REFERENCE[`${metric}:${sex}`];
  return !!rows && rows.length > 0;
}

// Mid-parental (target) adult height — the standard Tanner formula. This is a
// documented clinical calculation, not reference data:
//   boy:  (father + mother + 13) / 2  cm
//   girl: (father + mother − 13) / 2  cm
export function midParentalHeight(fatherCm: number, motherCm: number, sex: GrowthSex): number | null {
  if (!isFinite(fatherCm) || !isFinite(motherCm) || fatherCm <= 0 || motherCm <= 0) return null;
  const adj = sex === "M" ? 13 : -13;
  return Math.round((fatherCm + motherCm + adj) / 2 * 10) / 10;
}

// Age in (fractional) years between a birth date and a measurement date.
export function ageYearsAt(dateOfBirth: string, atIso: string): number | null {
  const dob = new Date(dateOfBirth + (dateOfBirth.length <= 10 ? "T00:00:00" : ""));
  const at = new Date(atIso + (atIso.length <= 10 ? "T00:00:00" : ""));
  if (Number.isNaN(dob.getTime()) || Number.isNaN(at.getTime())) return null;
  const yrs = (at.getTime() - dob.getTime()) / (365.25 * 86_400_000);
  return yrs >= 0 && yrs <= 25 ? Math.round(yrs * 100) / 100 : null;
}
