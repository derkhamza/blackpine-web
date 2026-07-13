import type { Appointment, Prescription, OrdonnanceLine } from "./cabinetTypes";

export interface LastRx {
  lines: OrdonnanceLine[];
  date:  string;   // YYYY-MM-DD of the prescription
}

/**
 * The most recent prescription a patient already received — searched across BOTH
 * standalone ordonnances AND those saved during an appointment — so a returning
 * patient can renew it in one click regardless of where the last one was written.
 *
 * Matches by patientId when available, otherwise by exact (case-insensitive) name.
 * `excludeId` / `excludeApptId` skip the record currently being created/edited.
 */
export function findLastPrescription(
  opts: { patientId?: string; patientName?: string; excludeId?: string; excludeApptId?: string },
  prescriptions: Prescription[],
  appointments: Appointment[],
): LastRx | undefined {
  const { patientId, patientName, excludeId, excludeApptId } = opts;
  const nameKey = (patientName ?? "").trim().toLowerCase();
  if (!patientId && !nameKey) return undefined;

  const matches = (pId?: string, pName?: string) =>
    patientId ? pId === patientId
              : !!nameKey && (pName ?? "").trim().toLowerCase() === nameKey;

  const cand: LastRx[] = [];
  for (const p of prescriptions) {
    if (excludeId && p.id === excludeId) continue;
    if (!p.lines?.length) continue;
    if (!matches(p.patientId, p.patientName)) continue;
    cand.push({ lines: p.lines, date: p.date || p.createdAt?.slice(0, 10) || "" });
  }
  for (const a of appointments) {
    if (excludeApptId && a.id === excludeApptId) continue;
    const ord = a.savedOrdonnance;
    if (!ord?.lines?.length) continue;
    if (!matches(a.patientId, a.patientName)) continue;
    cand.push({ lines: ord.lines, date: a.date || ord.printedAt?.slice(0, 10) || "" });
  }
  if (!cand.length) return undefined;
  cand.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  return cand[0];
}
