import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Cross-repo type drift guard (task #8) ────────────────────────────────────
// cabinetTypes is duplicated between this repo and the mobile app (separate git
// repos). If a field is added to a sync-critical record on one side but not the
// other, a snapshot round-trip can silently drop it — data loss. Until the types
// live in one shared package, this test compares the two files (when the sibling
// mobile repo is checked out next to this one) and fails on NEW divergence beyond
// the documented baseline below. On CI/Vercel the mobile file isn't present, so
// the check skips cleanly.
//
// The web app has already grown well beyond the mobile copy; BASELINE_DRIFT
// records that known state. Reconcile it (ideally by extracting a shared package)
// and shrink the baseline over time — but this guard's job is to stop the gap
// GROWING silently: any field divergence not listed here fails the test.

const WEB_TYPES = resolve(process.cwd(), "src/lib/cabinetTypes.ts");
const MOBILE_TYPES = resolve(process.cwd(), "../blackpine-app/lib/cabinetTypes.ts");

const SYNC_CRITICAL = [
  "Appointment", "Patient", "ConsultationNote", "VitalSigns",
  "BillingLine", "PaymentRecord", "CustomMeasure", "PatientTimelineEvent",
];

// Known, tolerated divergences as of 2026-07-13 (web-only / mobile-only fields).
const BASELINE_DRIFT: Record<string, { web: string[]; mobile: string[] }> = {
  Appointment: {
    web: ["labelId", "preparedItems", "preparedReduction", "savedOrdonnance", "checkedInAt",
      "calledInAt", "inConsultationAt", "savedCertificates", "invoiceNumber", "invoiceIssuedAt",
      "consultationDuration", "extraBilans", "bilanSource", "customMeasures", "billTxnId"],
    mobile: [],
  },
  Patient: { web: ["arabicName", "mutuelle", "city"], mobile: ["examResults"] },
  ConsultationNote: { web: ["extraFields"], mobile: [] },
  BillingLine: { web: ["remise", "remiseType"], mobile: [] },
};

/** Top-level field names of each `export interface` in a TS source string. */
function parseInterfaces(src: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const re = /export\s+interface\s+(\w+)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = re.lastIndex - 1; // index of the '{'
    let depth = 0, end = -1;
    for (let k = open; k < src.length; k++) {
      if (src[k] === "{") depth++;
      else if (src[k] === "}" && --depth === 0) { end = k; break; }
    }
    if (end === -1) continue;
    const fields = new Set<string>();
    let d = 0;
    for (const line of src.slice(open + 1, end).split("\n")) {
      if (d === 0) {
        const f = line.trim().match(/^(\w+)\??\s*:/);
        if (f) fields.add(f[1]);
      }
      for (const ch of line) { if (ch === "{") d++; else if (ch === "}") d = Math.max(0, d - 1); }
    }
    out.set(m[1], fields);
    re.lastIndex = end;
  }
  return out;
}

describe("cabinetTypes drift (web vs mobile)", () => {
  const runOrSkip = existsSync(MOBILE_TYPES) ? it : it.skip;

  runOrSkip("no NEW field divergence on sync-critical records (beyond baseline)", () => {
    const web = parseInterfaces(readFileSync(WEB_TYPES, "utf8"));
    const mobile = parseInterfaces(readFileSync(MOBILE_TYPES, "utf8"));
    const violations: string[] = [];
    for (const name of SYNC_CRITICAL) {
      const w = web.get(name);
      const mo = mobile.get(name);
      if (!w || !mo) continue;
      const base = BASELINE_DRIFT[name] ?? { web: [], mobile: [] };
      const newWeb = [...w].filter(f => !mo.has(f) && !base.web.includes(f));
      const newMobile = [...mo].filter(f => !w.has(f) && !base.mobile.includes(f));
      if (newWeb.length || newMobile.length) {
        violations.push(`${name}: new web-only [${newWeb.join(", ")}] · new mobile-only [${newMobile.join(", ")}]`);
      }
    }
    expect(violations, `NEW cabinetTypes drift — align web & mobile (or update BASELINE_DRIFT):\n${violations.join("\n")}`).toEqual([]);
  });
});
