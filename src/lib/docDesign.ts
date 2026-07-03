import type { PageDesign, PaperSize } from "./cabinetTypes";

// ── Shared helpers to apply a PageDesign inside the print HTML ────────────────
//
// Coordinates in a PageDesign are measured in mm from the PAGE edge (what the
// doctor measures on their pre-printed paper). The print body's origin sits at
// (marginLeft, marginTop), so absolute positions subtract the margins.

export interface PageMargins { top: number; right: number; bottom: number; left: number; }

export const ORDONNANCE_DEFAULT_MARGINS: PageMargins = { top: 13, right: 15, bottom: 13, left: 15 };
export const FACTURE_DEFAULT_MARGINS:    PageMargins = { top: 16, right: 18, bottom: 16, left: 18 };

// Block keys per document (labels live in the designer component's i18n).
export const ORDONNANCE_BLOCKS = ["header", "date", "patient", "body", "signature", "footer"] as const;
export const FACTURE_BLOCKS    = ["header", "invoice", "parties", "items", "signature", "footer"] as const;

export function resolveMargins(d: PageDesign | undefined, dflt: PageMargins): PageMargins {
  return {
    top:    d?.marginTop    ?? dflt.top,
    right:  d?.marginRight  ?? dflt.right,
    bottom: d?.marginBottom ?? dflt.bottom,
    left:   d?.marginLeft   ?? dflt.left,
  };
}

// Paper sizes the designer offers (portrait, mm). `css` is the CSS @page size.
export const PAGE_SIZES: Record<PaperSize, { w: number; h: number; css: string }> = {
  A4:     { w: 210, h: 297, css: "A4 portrait" },
  A5:     { w: 148, h: 210, css: "A5 portrait" },
  Letter: { w: 216, h: 279, css: "216mm 279mm" },
};

/** Resolve the effective paper size for a design, falling back to the doc default. */
export function resolvePageSize(d: PageDesign | undefined, dflt: PaperSize) {
  return PAGE_SIZES[d?.pageSize ?? dflt];
}

export function pageRule(size: string, m: PageMargins): string {
  return `@page { size: ${size}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }`;
}

/**
 * Full-page background image (a scanned letterhead the doctor uploads), printed
 * only when they opt in — most use pre-printed paper and just want it for
 * alignment in the designer. Sits behind everything, ignoring page margins.
 */
export function backgroundHtml(d: PageDesign | undefined): string {
  if (!d?.background || !d.printBackground) return "";
  return `<img src="${d.background}" alt="" style="position:fixed;top:0;left:0;width:100%;height:100%;object-fit:fill;z-index:-1;"/>`;
}

/** True when the doctor hid this block. */
export function blockHidden(d: PageDesign | undefined, key: string): boolean {
  return d?.blocks?.[key]?.show === false;
}

/**
 * Inline style for a block: empty for natural flow, absolute mm positioning
 * when the doctor placed it. Requires `body { position: relative; }`.
 */
export function blockStyle(d: PageDesign | undefined, key: string, m: PageMargins): string {
  const b = d?.blocks?.[key];
  if (!b) return "";
  if (b.show === false) return "display:none;";
  if (b.x == null && b.y == null) return "";
  const left = (b.x ?? m.left) - m.left;
  const top  = (b.y ?? m.top)  - m.top;
  return `position:absolute;left:${left}mm;top:${top}mm;right:auto;margin:0;`;
}

/** Absolutely-positioned logo image, or empty string when none is set. */
export function logoHtml(d: PageDesign | undefined, m: PageMargins): string {
  if (!d?.logo) return "";
  const left = (d.logoX ?? m.left) - m.left;
  const top  = (d.logoY ?? m.top)  - m.top;
  const w    = d.logoW ?? 30;
  return `<img src="${d.logo}" alt="" style="position:absolute;left:${left}mm;top:${top}mm;width:${w}mm;height:auto;"/>`;
}
