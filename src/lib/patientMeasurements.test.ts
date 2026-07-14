import { describe, it, expect } from "vitest";
import type { Appointment, ExamResult, Measurement } from "./cabinetTypes";
import {
  parseNum, projectAppointment, projectExamResult,
  buildPatientMeasurements, buildTrendSeries,
} from "./patientMeasurements";

const meas = (over: Partial<Measurement>): Measurement => ({
  id: "m1", patientId: "p1", patientName: "Doe John",
  date: "2026-03-01", label: "Glycémie", value: "1.0", source: "lab",
  createdAt: "2026-03-01T10:00:00.000Z",
  ...over,
} as Measurement);

const appt = (over: Partial<Appointment>): Appointment => ({
  id: "a1", patientId: "p1", patientName: "Doe John",
  date: "2026-01-10", startTime: "09:00", endTime: "09:20",
  type: "consultation", status: "done", createdAt: "2026-01-10T09:00:00.000Z",
  ...over,
} as Appointment);

const exam = (over: Partial<ExamResult>): ExamResult => ({
  id: "e1", patientId: "p1", patientName: "Doe John",
  type: "biologie", date: "2026-02-01", title: "Bilan",
  values: [], createdAt: "2026-02-01T10:00:00.000Z",
  ...over,
} as ExamResult);

describe("parseNum", () => {
  it("parses int, French and English decimals", () => {
    expect(parseNum("12")).toBe(12);
    expect(parseNum("12,5")).toBe(12.5);
    expect(parseNum("12.5")).toBe(12.5);
  });
  it("returns null for qualitative values", () => {
    expect(parseNum("Négatif")).toBeNull();
    expect(parseNum("")).toBeNull();
  });
});

describe("projectAppointment", () => {
  it("splits blood pressure into systolic + diastolic and reads vitals", () => {
    const rows = projectAppointment(appt({ vitalSigns: { bpSys: 120, bpDia: 80, weight: 70 } as any }));
    const labels = rows.map(r => r.label).sort();
    expect(labels).toContain("TA systolique");
    expect(labels).toContain("TA diastolique");
    expect(labels).toContain("Poids");
    const w = rows.find(r => r.label === "Poids")!;
    expect(w.num).toBe(70);
    expect(w.unit).toBe("kg");
    expect(w.source).toBe("consultation");
    expect(w.appointmentId).toBe("a1");
  });
  it("skips empty vitals / extra fields", () => {
    const rows = projectAppointment(appt({
      vitalSigns: { weight: 70 } as any,
      consultationNote: { extraFields: { bl_glycemie: "1.05", bl_hba1c: "" } } as any,
    }));
    // weight + glycémie only (empty hba1c dropped)
    expect(rows.filter(r => r.value.trim() !== "").length).toBe(2);
    expect(rows.some(r => r.value === "1.05")).toBe(true);
  });
  it("projects ad-hoc custom measures", () => {
    const rows = projectAppointment(appt({
      customMeasures: [{ id: "c1", label: "Tour de taille", value: "92", unit: "cm", source: "office" }] as any,
    }));
    const m = rows.find(r => r.label === "Tour de taille")!;
    expect(m.num).toBe(92);
    expect(m.unit).toBe("cm");
  });
});

describe("projectExamResult", () => {
  it("flags out-of-range values and carries units", () => {
    const rows = projectExamResult(exam({
      values: [
        { label: "Glycémie", value: "1.40", unit: "g/L", refMin: 0.7, refMax: 1.1 },
        { label: "Créatinine", value: "9", unit: "mg/L" },
      ] as any,
    }));
    const g = rows.find(r => r.label === "Glycémie")!;
    expect(g.bad).toBe(true);            // 1.40 > refMax 1.1
    expect(g.source).toBe("lab");
    const c = rows.find(r => r.label === "Créatinine")!;
    expect(c.bad).toBe(false);
  });
});

describe("buildPatientMeasurements", () => {
  it("unions appointments + exams for the patient only, newest first", () => {
    const rows = buildPatientMeasurements(
      "p1",
      [appt({ id: "a1", date: "2026-01-10", vitalSigns: { weight: 70 } as any }),
       appt({ id: "a2", patientId: "pX", date: "2026-03-01", vitalSigns: { weight: 99 } as any })],
      [exam({ id: "e1", date: "2026-02-01", values: [{ label: "Glycémie", value: "1.0", unit: "g/L" }] as any })],
    );
    // patient pX excluded
    expect(rows.some(r => r.value === "99")).toBe(false);
    // newest date first → exam (Feb) before appointment (Jan)
    expect(rows[0].date >= rows[rows.length - 1].date).toBe(true);
  });
});

describe("buildTrendSeries", () => {
  it("groups a parameter across consultation + lab and builds a chronological numeric series", () => {
    const views = buildPatientMeasurements(
      "p1",
      [appt({ id: "a1", date: "2026-01-10", consultationNote: { extraFields: {} } as any,
              customMeasures: [{ id: "c1", label: "Glycémie", value: "0,95", unit: "g/L", source: "office" }] as any })],
      [exam({ id: "e1", date: "2026-02-01", values: [{ label: "Glycémie", value: "1.30", unit: "g/L" }] as any })],
    );
    const series = buildTrendSeries(views);
    const gly = series.find(s => s.label.toLowerCase() === "glycémie")!;
    expect(gly).toBeTruthy();
    expect(gly.count).toBe(2);
    expect(gly.points.map(p => p.num)).toEqual([0.95, 1.30]);   // chronological
    expect(gly.latest.value).toBe("1.30");                       // most recent
    expect(gly.yMax).toBeGreaterThan(1.30);
  });
  it("keeps qualitative-only parameters (latest value, no numeric points)", () => {
    const views = buildPatientMeasurements(
      "p1", [], [exam({ values: [{ label: "Antigène", value: "Négatif" }] as any })]);
    const s = buildTrendSeries(views);
    expect(s.length).toBe(1);
    expect(s[0].points.length).toBe(0);
    expect(s[0].latest.value).toBe("Négatif");
  });
});

describe("canonical measurements + supersede", () => {
  it("includes canonical rows and merges them into series with projections", () => {
    const views = buildPatientMeasurements(
      "p1",
      [appt({ id: "a1", date: "2026-01-10", customMeasures: [{ id: "c1", label: "Glycémie", value: "0.9", unit: "g/L", source: "office" }] as any })],
      [],
      [meas({ id: "m1", date: "2026-03-01", label: "Glycémie", value: "1.3", unit: "g/L" })],
    );
    const gly = buildTrendSeries(views).find(s => s.label.toLowerCase() === "glycémie")!;
    expect(gly.count).toBe(2);                    // canonical + projected consultation value
    expect(gly.points.map(p => p.num)).toEqual([0.9, 1.3]);
  });

  it("supersedes a projected legacy value when a canonical row carries its sourceRef", () => {
    const views = buildPatientMeasurements(
      "p1",
      [],
      [exam({ id: "e1", date: "2026-02-01", values: [{ label: "Glycémie", value: "1.0", unit: "g/L" }] as any })],
      // A canonical row promoted from that exam value (corrected to 1.20).
      [meas({ id: "m1", date: "2026-02-01", label: "Glycémie", value: "1.20", unit: "g/L", sourceRef: "exam:e1:0" })],
    );
    const gly = buildTrendSeries(views).find(s => s.label.toLowerCase() === "glycémie")!;
    expect(gly.count).toBe(1);                    // projection dropped, canonical kept
    expect(gly.latest.value).toBe("1.20");
    expect(gly.latest.derived).toBe(false);
  });

  it("returns nothing for a patient with no data", () => {
    expect(buildPatientMeasurements("pX", [], [], [meas({ patientId: "p1" })])).toEqual([]);
  });
});
