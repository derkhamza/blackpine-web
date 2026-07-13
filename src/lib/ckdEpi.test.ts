import { describe, it, expect } from "vitest";
import { ckdEpi2021, ckdEpiFromMgL } from "./ckdEpi";

describe("CKD-EPI 2021 eGFR", () => {
  // Reference values from the published race-free CKD-EPI 2021 equation.
  it("computes a plausible eGFR for a healthy adult male", () => {
    // 40y male, Scr 0.9 mg/dL → ~103 mL/min/1.73m²
    const v = ckdEpi2021(0.9, 40, "male");
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(95);
    expect(v!).toBeLessThan(112);
  });

  it("female correction lowers the estimate vs a male with same inputs", () => {
    const m = ckdEpi2021(0.9, 50, "male")!;
    const f = ckdEpi2021(0.9, 50, "female")!;
    expect(f).toBeLessThan(m);
  });

  it("rejects invalid inputs", () => {
    expect(ckdEpi2021(0, 40, "male")).toBeNull();
    expect(ckdEpi2021(-1, 40, "male")).toBeNull();
    expect(ckdEpi2021(0.9, 0, "male")).toBeNull();
    expect(ckdEpi2021(0.9, 200, "male")).toBeNull();
    expect(ckdEpi2021(NaN, 40, "male")).toBeNull();
  });

  it("mg/L convenience wrapper converts to mg/dL (÷10)", () => {
    // 9 mg/L == 0.9 mg/dL → same result as the mg/dL function.
    expect(ckdEpiFromMgL(9, 40, "male")).toBe(ckdEpi2021(0.9, 40, "male"));
    // Accepts a comma-decimal string as typed in the app.
    expect(ckdEpiFromMgL("9,0", 40, "male")).toBe(ckdEpi2021(0.9, 40, "male"));
    expect(ckdEpiFromMgL("", 40, "male")).toBeNull();
  });
});
