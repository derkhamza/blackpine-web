import type { Appointment, BillingLine } from "./cabinetTypes";

// ── Bill line math (per-act discount + global reduction) ─────────────────────
// A line can carry an optional discount: a percentage of the line, or a fixed
// MAD amount. The global (whole-bill) reduction is applied AFTER the per-line
// discounts. Every helper is clamped so a discount never drives a line or the
// bill below zero.

export function lineGross(l: BillingLine): number {
  return (l.qty || 0) * (l.unitPrice || 0);
}
export function lineDiscount(l: BillingLine): number {
  if (!l.remise || l.remise <= 0) return 0;
  const gross = lineGross(l);
  const raw = l.remiseType === "pct" ? gross * Math.min(l.remise, 100) / 100 : l.remise;
  return Math.min(Math.max(0, raw), gross);
}
export function lineNet(l: BillingLine): number {
  return Math.max(0, lineGross(l) - lineDiscount(l));
}
/** Sum of line gross amounts (before any discount). */
export function billSubtotal(items: BillingLine[]): number {
  return (items ?? []).reduce((s, l) => s + lineGross(l), 0);
}
/** Total of the per-line discounts. */
export function billLineDiscounts(items: BillingLine[]): number {
  return (items ?? []).reduce((s, l) => s + lineDiscount(l), 0);
}
/** Net payable: lines after their own discounts, then the global reduction. */
export function billNet(items: BillingLine[], globalReduction = 0): number {
  const afterLines = (items ?? []).reduce((s, l) => s + lineNet(l), 0);
  return Math.max(0, afterLines - Math.max(0, globalReduction || 0));
}

export type PaymentStatus = "unbilled" | "paid" | "partial" | "deferred";

export interface PaymentSummary {
  due:     number;          // total billed (MAD)
  paid:    number;          // cumulative collected (MAD)
  balance: number;          // outstanding (MAD), never negative
  status:  PaymentStatus;
}

// Single source of truth for an appointment's payment state. Legacy billed
// appointments have no paidAmount and are treated as paid in full.
export function paymentSummary(appt: Pick<Appointment, "billedAt" | "billedAmount" | "paidAmount">): PaymentSummary {
  const due  = appt.billedAmount ?? 0;
  if (!appt.billedAt) return { due, paid: 0, balance: 0, status: "unbilled" };
  const paid = appt.paidAmount ?? due;          // legacy → fully paid
  const balance = Math.max(0, due - paid);
  const status: PaymentStatus =
    balance <= 0 ? "paid" : paid <= 0 ? "deferred" : "partial";
  return { due, paid, balance, status };
}

// Total outstanding across a set of appointments (e.g. one patient's debt).
export function outstandingTotal(appts: Appointment[]): number {
  return appts.reduce((s, a) => s + paymentSummary(a).balance, 0);
}
