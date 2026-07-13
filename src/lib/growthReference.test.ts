import { describe, it, expect } from "vitest";
import { midParentalHeight, percentileBands, ageYearsAt } from "./growthReference";

describe("growth reference", () => {
  it("mid-parental height (Tanner) adds 13cm for boys, subtracts for girls", () => {
    // ( 180 + 165 ) / 2 = 172.5 → boy +6.5, girl −6.5
    expect(midParentalHeight(180, 165, "M")).toBeCloseTo(179, 0);
    expect(midParentalHeight(180, 165, "F")).toBeCloseTo(166, 0);
  });

  it("mid-parental height returns null on bad input", () => {
    expect(midParentalHeight(NaN, 165, "M")).toBeNull();
    expect(midParentalHeight(0, 0, "M")).toBeNull();
  });

  it("percentileBands returns WHO bands for a supported metric/sex", () => {
    const bands = percentileBands("height", "M");
    expect(bands).not.toBeNull();
    expect(Array.isArray(bands)).toBe(true);
    expect(bands!.length).toBeGreaterThan(0);
    // Each band is a labelled centile curve with (age, value) points.
    expect(bands![0]).toHaveProperty("centile");
    expect(bands![0].points.length).toBeGreaterThan(0);
  });

  it("ageYearsAt computes a non-negative age from a birth date", () => {
    const a = ageYearsAt("2020-01-01", "2026-01-01");
    expect(a).toBeCloseTo(6, 1);
  });
});
