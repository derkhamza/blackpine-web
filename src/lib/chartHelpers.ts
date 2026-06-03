import type { Transaction } from "blackpine-engine";
import { getCategoryById } from "blackpine-engine";

// ── Category breakdown ────────────────────────────────────────────────────────

export interface CategorySlice {
  id:         string;
  label:      string;
  amount:     number;
  percentage: number;
  color:      string;
}

const SLICE_COLORS = [
  "#1890C5", "#15A876", "#D4962A", "#9B72D0",
  "#E85B5B", "#0A4E7E", "#2ECC71", "#E67E22",
];

export function getCategoryBreakdown(
  transactions: Transaction[],
  topN = 6,
): CategorySlice[] {
  const charges = transactions.filter((t) => t.type === "CHARGE");
  const totals  = new Map<string, number>();
  for (const tx of charges) totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, v]) => s + v, 0);
  if (grandTotal === 0) return [];

  return sorted.slice(0, topN).map(([id, amount], i) => ({
    id,
    label: getCategoryById(2026, id)?.labelFr ?? id,
    amount,
    percentage: Math.round((amount / grandTotal) * 100),
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
}

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
