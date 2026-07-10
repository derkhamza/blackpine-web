// CKD-EPI 2021 (race-free) estimated glomerular filtration rate.
//
// eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^(−1.200) × 0.9938^Age × (1.012 if female)
//   Scr in mg/dL · κ = 0.7 (F) / 0.9 (M) · α = −0.241 (F) / −0.302 (M)
//
// Returns mL/min/1.73m², rounded, or null when inputs are missing/invalid
// (e.g. unknown sex — the formula is sex-specific).

export type Sex = "male" | "female";

export function ckdEpi2021(creatMgDl: number, ageYears: number, sex: Sex): number | null {
  if (!isFinite(creatMgDl) || creatMgDl <= 0) return null;
  if (!isFinite(ageYears) || ageYears <= 0 || ageYears > 120) return null;
  const female = sex === "female";
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  const ratio = creatMgDl / k;
  const egfr =
    142 *
    Math.pow(Math.min(ratio, 1), a) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, ageYears) *
    (female ? 1.012 : 1);
  if (!isFinite(egfr) || egfr <= 0) return null;
  return Math.round(egfr);
}

// Convenience: serum creatinine as entered in the app (mg/L — the Moroccan lab
// unit) rather than mg/dL. Accepts a raw string with a comma or dot decimal.
export function ckdEpiFromMgL(creatMgL: string | number, ageYears: number, sex: Sex): number | null {
  const mgL = typeof creatMgL === "number" ? creatMgL : parseFloat(String(creatMgL).replace(",", "."));
  if (!isFinite(mgL)) return null;
  return ckdEpi2021(mgL / 10, ageYears, sex); // mg/L → mg/dL
}
