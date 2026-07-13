import { describe, it, expect, beforeEach } from "vitest";
import {
  setApptTypeRegistry, apptTypeLabel, apptTypeColor, resolveApptTypes, apptLabelById,
  APPT_TYPE_LABELS, BUILTIN_APPT_TYPES,
} from "./cabinetTypes";

describe("appointment-type registry", () => {
  beforeEach(() => setApptTypeRegistry(null));

  it("resolves built-in labels/colours by default", () => {
    expect(apptTypeLabel("consultation")).toBe(APPT_TYPE_LABELS.consultation);
    expect(apptTypeColor("consultation")).toMatch(/^#/);
    expect(resolveApptTypes().map(t => t.id)).toEqual(BUILTIN_APPT_TYPES);
  });

  it("falls back to the raw id for an unknown type", () => {
    expect(apptTypeLabel("t_unknown")).toBe("t_unknown");
    expect(apptTypeColor("t_unknown")).toMatch(/^#/); // a default colour, never undefined
  });

  it("applies built-in overrides (rename + recolour)", () => {
    setApptTypeRegistry({ apptTypeOverrides: { consultation: { label: "Visite", color: "#123456" } } });
    expect(apptTypeLabel("consultation")).toBe("Visite");
    expect(apptTypeColor("consultation")).toBe("#123456");
  });

  it("adds custom types after the built-ins", () => {
    setApptTypeRegistry({ customApptTypes: [{ id: "teleconsult", label: "Téléconsultation", color: "#0EA5E9" }] });
    expect(apptTypeLabel("teleconsult")).toBe("Téléconsultation");
    expect(apptTypeColor("teleconsult")).toBe("#0EA5E9");
    const ids = resolveApptTypes().map(t => t.id);
    expect(ids).toContain("teleconsult");
    expect(ids.indexOf("teleconsult")).toBeGreaterThan(ids.indexOf("autre"));
  });

  it("resolves secondary labels by id, or undefined", () => {
    setApptTypeRegistry({ apptLabels: [{ id: "l_urgent", label: "Urgent", color: "#EF4444" }] });
    expect(apptLabelById("l_urgent")).toMatchObject({ label: "Urgent" });
    expect(apptLabelById("missing")).toBeUndefined();
    expect(apptLabelById(undefined)).toBeUndefined();
  });
});
