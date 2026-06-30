import type { Appointment } from "./cabinetTypes";

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
