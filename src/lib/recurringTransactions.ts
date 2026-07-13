import type { Transaction } from "../engine";

export interface RecurringRule {
  id: string;
  templateTransaction: Omit<Transaction, "id" | "date">;
  frequency: "monthly" | "quarterly" | "yearly";
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  label: string;
  active: boolean;
}

export function generateRecurringTransactions(
  rules: RecurringRule[],
  fromDate: string,
  toDate: string,
): Omit<Transaction, "id">[] {
  const results: Omit<Transaction, "id">[] = [];
  const to = new Date(toDate);

  for (const rule of rules) {
    if (!rule.active) continue;
    const start = new Date(rule.startDate);
    const end   = rule.endDate ? new Date(rule.endDate) : to;

    const current = new Date(start);
    setClampedDay(current, rule.dayOfMonth);
    if (current < start) incrementDate(current, rule.frequency, rule.dayOfMonth);

    while (current <= to && current <= end) {
      if (current >= new Date(fromDate)) {
        results.push({ ...rule.templateTransaction, date: current.toISOString().split("T")[0] });
      }
      incrementDate(current, rule.frequency, rule.dayOfMonth);
    }
  }
  return results;
}

// Set the day, clamped to the month's real length: day 31 in a 30-day month
// becomes the 30th (never spills into the next month).
function setClampedDay(date: Date, dayOfMonth: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(dayOfMonth, lastDay));
}

function incrementDate(date: Date, frequency: "monthly" | "quarterly" | "yearly", dayOfMonth: number) {
  // Move to day 1 first so setMonth can't overflow (e.g. Jan 31 → "Feb 31" → Mar 3,
  // which would silently skip February and re-anchor every later occurrence).
  date.setDate(1);
  if      (frequency === "monthly")   date.setMonth(date.getMonth() + 1);
  else if (frequency === "quarterly") date.setMonth(date.getMonth() + 3);
  else                                date.setFullYear(date.getFullYear() + 1);
  setClampedDay(date, dayOfMonth);
}
