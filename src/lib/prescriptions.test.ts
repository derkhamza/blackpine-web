import { describe, it, expect } from "vitest";
import { findLastPrescription } from "./prescriptions";
import type { Appointment, Prescription } from "./cabinetTypes";

const line = (drug: string) => ({ drug, dosage: "", frequency: "1/j", duration: "7 jours", notes: "" });

function rx(over: Partial<Prescription>): Prescription {
  return {
    id: "r", patientName: "Ali Ben", date: "2026-01-01", lines: [line("A")],
    source: "standalone", createdAt: "2026-01-01T09:00:00Z", ...over,
  } as Prescription;
}
function appt(over: Partial<Appointment>): Appointment {
  return {
    id: "a", patientName: "Ali Ben", date: "2026-01-01", startTime: "09:00", endTime: "09:15",
    type: "consultation", status: "completed", ...over,
  } as Appointment;
}

describe("findLastPrescription", () => {
  it("returns undefined with no identity", () => {
    expect(findLastPrescription({}, [], [])).toBeUndefined();
  });

  it("returns undefined when the patient has no prescription", () => {
    expect(findLastPrescription({ patientId: "p1" }, [rx({ patientId: "p2" })], [])).toBeUndefined();
  });

  it("matches by patientId across standalone + appointment sources, most recent first", () => {
    const prescriptions = [rx({ id: "old", patientId: "p1", date: "2026-01-01", lines: [line("OLD")] })];
    const appointments = [
      appt({ id: "a1", patientId: "p1", date: "2026-03-01", savedOrdonnance: { lines: [line("NEW")], printedAt: "2026-03-01T10:00:00Z" } }),
    ];
    const last = findLastPrescription({ patientId: "p1" }, prescriptions, appointments);
    expect(last?.date).toBe("2026-03-01");
    expect(last?.lines[0].drug).toBe("NEW");
  });

  it("falls back to case-insensitive name match when no patientId", () => {
    const prescriptions = [rx({ id: "r1", patientId: undefined, patientName: "Fatima Z", date: "2026-02-02", lines: [line("MET")] })];
    const last = findLastPrescription({ patientName: "  fatima z " }, prescriptions, []);
    expect(last?.lines[0].drug).toBe("MET");
  });

  it("excludes the record being edited", () => {
    const prescriptions = [rx({ id: "self", patientId: "p1", lines: [line("SELF")] })];
    expect(findLastPrescription({ patientId: "p1", excludeId: "self" }, prescriptions, [])).toBeUndefined();
  });

  it("excludes the current appointment", () => {
    const appointments = [appt({ id: "cur", patientId: "p1", savedOrdonnance: { lines: [line("X")], printedAt: "2026-01-01T09:00:00Z" } })];
    expect(findLastPrescription({ patientId: "p1", excludeApptId: "cur" }, [], appointments)).toBeUndefined();
  });

  it("ignores empty-line prescriptions", () => {
    const prescriptions = [rx({ id: "empty", patientId: "p1", lines: [] })];
    expect(findLastPrescription({ patientId: "p1" }, prescriptions, [])).toBeUndefined();
  });
});
