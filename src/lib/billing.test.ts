import { describe, it, expect } from "vitest";
import type { BillingLine, Appointment } from "./cabinetTypes";
import {
  lineGross, lineDiscount, lineNet, billSubtotal, billLineDiscounts,
  billNet, paymentSummary, outstandingTotal,
} from "./billing";

const line = (p: Partial<BillingLine>): BillingLine =>
  ({ label: "Acte", qty: 1, unitPrice: 0, ...p });

describe("bill line math", () => {
  it("gross = qty × unitPrice", () => {
    expect(lineGross(line({ qty: 3, unitPrice: 100 }))).toBe(300);
  });

  it("fixed (MAD) discount is subtracted, clamped to gross", () => {
    expect(lineDiscount(line({ qty: 1, unitPrice: 200, remise: 50, remiseType: "mad" }))).toBe(50);
    // A discount larger than the line never drives it negative.
    expect(lineDiscount(line({ qty: 1, unitPrice: 200, remise: 500, remiseType: "mad" }))).toBe(200);
    expect(lineNet(line({ qty: 1, unitPrice: 200, remise: 500, remiseType: "mad" }))).toBe(0);
  });

  it("percentage discount, capped at 100%", () => {
    expect(lineDiscount(line({ qty: 2, unitPrice: 100, remise: 10, remiseType: "pct" }))).toBe(20);
    expect(lineDiscount(line({ qty: 1, unitPrice: 100, remise: 150, remiseType: "pct" }))).toBe(100);
  });

  it("no remise → no discount", () => {
    expect(lineDiscount(line({ qty: 1, unitPrice: 100 }))).toBe(0);
    expect(lineNet(line({ qty: 1, unitPrice: 100 }))).toBe(100);
  });
});

describe("bill totals", () => {
  const items: BillingLine[] = [
    line({ unitPrice: 300 }),                                       // 300
    line({ unitPrice: 150, remise: 50, remiseType: "mad" }),        // 100
    line({ qty: 2, unitPrice: 100, remise: 10, remiseType: "pct" }),// 180
  ];
  it("subtotal is gross of all lines", () => {
    expect(billSubtotal(items)).toBe(300 + 150 + 200);
  });
  it("line discounts sum", () => {
    expect(billLineDiscounts(items)).toBe(50 + 20);
  });
  it("net applies line discounts then the global reduction, clamped ≥ 0", () => {
    expect(billNet(items)).toBe(300 + 100 + 180);
    expect(billNet(items, 80)).toBe(300 + 100 + 180 - 80);
    expect(billNet(items, 100000)).toBe(0);
  });
  it("handles empty / nullish input", () => {
    expect(billSubtotal([])).toBe(0);
    expect(billNet(undefined as unknown as BillingLine[])).toBe(0);
  });
});

describe("payment summary", () => {
  const appt = (p: Partial<Appointment>): Appointment => ({
    id: "a", patientName: "x", date: "2026-01-01", startTime: "09:00", endTime: "09:30",
    type: "consultation", status: "completed", ...p,
  } as Appointment);

  it("unbilled appointment", () => {
    expect(paymentSummary(appt({}))).toMatchObject({ status: "unbilled", balance: 0 });
  });
  it("legacy billed with no paidAmount counts as paid in full", () => {
    expect(paymentSummary(appt({ billedAt: "t", billedAmount: 300 }))).toMatchObject({ status: "paid", balance: 0 });
  });
  it("partial and deferred", () => {
    expect(paymentSummary(appt({ billedAt: "t", billedAmount: 300, paidAmount: 100 }))).toMatchObject({ status: "partial", balance: 200 });
    expect(paymentSummary(appt({ billedAt: "t", billedAmount: 300, paidAmount: 0 }))).toMatchObject({ status: "deferred", balance: 300 });
  });
  it("outstandingTotal sums balances", () => {
    const list = [
      appt({ billedAt: "t", billedAmount: 300, paidAmount: 100 }), // 200
      appt({ billedAt: "t", billedAmount: 200, paidAmount: 0 }),   // 200
      appt({}),                                                    // 0
    ];
    expect(outstandingTotal(list)).toBe(400);
  });
});
