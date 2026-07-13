import { describe, it, expect } from "vitest";
import type { PageDesign, DocumentSettings } from "./cabinetTypes";
import { resolveMargins, blockStyle, designForKind, DOC_DEFAULT_MARGINS } from "./docDesign";

describe("docDesign helpers", () => {
  it("resolveMargins falls back to defaults per side", () => {
    const dflt = { top: 10, right: 12, bottom: 10, left: 12 };
    expect(resolveMargins(undefined, dflt)).toEqual(dflt);
    expect(resolveMargins({ marginTop: 20 }, dflt)).toEqual({ top: 20, right: 12, bottom: 10, left: 12 });
  });

  it("blockStyle is empty for an un-positioned block (backward compatible)", () => {
    const d: PageDesign = { blocks: { header: {} } };
    expect(blockStyle(d, "header", DOC_DEFAULT_MARGINS.ordonnance)).toBe("");
    // A block with no design entry at all also yields no style.
    expect(blockStyle({}, "header", DOC_DEFAULT_MARGINS.ordonnance)).toBe("");
  });

  it("blockStyle honours a custom width and height without positioning", () => {
    const d: PageDesign = { blocks: { body: { w: 80, h: 40 } } };
    const s = blockStyle(d, "body", DOC_DEFAULT_MARGINS.ordonnance);
    expect(s).toContain("width:80mm;");
    expect(s).toContain("min-height:40mm;");
    expect(s).not.toContain("position:absolute");
  });

  it("blockStyle positions absolutely (minus margins) when x/y set", () => {
    const m = { top: 10, right: 10, bottom: 10, left: 10 };
    const s = blockStyle({ blocks: { header: { x: 25, y: 30 } } }, "header", m);
    expect(s).toContain("position:absolute");
    expect(s).toContain("left:15mm;"); // 25 − 10
    expect(s).toContain("top:20mm;");  // 30 − 10
  });

  it("hidden block yields display:none", () => {
    expect(blockStyle({ blocks: { footer: { show: false } } }, "footer", DOC_DEFAULT_MARGINS.facture))
      .toBe("display:none;");
  });

  it("designForKind prefers the generic map, falls back to legacy fields", () => {
    const legacy: DocumentSettings = { factureDesign: { marginTop: 5 } };
    expect(designForKind(legacy, "facture")).toEqual({ marginTop: 5 });
    const mapped: DocumentSettings = { designs: { facture: { marginTop: 9 } }, factureDesign: { marginTop: 5 } };
    expect(designForKind(mapped, "facture")).toEqual({ marginTop: 9 });
    expect(designForKind({}, "receipt")).toBeUndefined();
  });
});
