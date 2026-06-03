import type { Transaction } from "blackpine-engine";

export interface MonthlyData {
  label: string;
  month: number;
  recettes: number;
  charges: number;
  net: number;
}

const MONTH_LABELS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export function getMonthlyData(transactions: Transaction[], year: number): MonthlyData[] {
  const months: MonthlyData[] = MONTH_LABELS.map((label, i) => ({
    label, month: i + 1, recettes: 0, charges: 0, net: 0,
  }));

  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (d.getFullYear() !== year) continue;
    const i = d.getMonth();
    if (tx.type === "RECETTE") months[i].recettes += tx.amount;
    else                       months[i].charges  += tx.amount;
  }
  for (const m of months) m.net = m.recettes - m.charges;
  return months;
}

export function getActiveMonths(data: MonthlyData[]): MonthlyData[] {
  return data.filter((m) => m.recettes > 0 || m.charges > 0);
}
