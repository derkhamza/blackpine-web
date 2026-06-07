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
    current.setDate(rule.dayOfMonth);
    if (current < start) incrementDate(current, rule.frequency);

    while (current <= to && current <= end) {
      if (current >= new Date(fromDate)) {
        results.push({ ...rule.templateTransaction, date: current.toISOString().split("T")[0] });
      }
      incrementDate(current, rule.frequency);
    }
  }
  return results;
}

function incrementDate(date: Date, frequency: "monthly" | "quarterly" | "yearly") {
  if      (frequency === "monthly")   date.setMonth(date.getMonth() + 1);
  else if (frequency === "quarterly") date.setMonth(date.getMonth() + 3);
  else                                date.setFullYear(date.getFullYear() + 1);
}
