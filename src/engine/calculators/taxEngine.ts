import { calculateResultatFiscal } from "./resultatFiscalCalculator";
import { calculateTax } from "./taxOrchestrator";
import { loadFiscalYearConfig } from "../config/configLoader";
import type {
  DoctorProfile,
  Transaction,
  TaxResult,
  ResultatFiscalBreakdown,
  TraceEvent,
} from "../types";

export interface FullTaxComputation {
  fiscalYear: number;
  configVersion: string;
  breakdown: ResultatFiscalBreakdown;
  tax: TaxResult;
  events: TraceEvent[];
  computedAt: string;
}

export function computeTaxFromTransactions(
  profile: DoctorProfile,
  transactions: Transaction[],
  fiscalYear: number,
  asOfDate: string
): FullTaxComputation {
  const config = loadFiscalYearConfig(fiscalYear);
  const breakdown = calculateResultatFiscal(transactions);
  const chiffreAffaires = breakdown.totalRecettes;
  const tax = calculateTax(profile, breakdown.resultatFiscal, chiffreAffaires, asOfDate, config);

  const fullTrace = [
    `=== Calcul du résultat fiscal ===`,
    ...breakdown.trace,
    `=== Calcul de l'impôt ===`,
    ...tax.trace,
  ];

  // Unified event stream with section markers
  const fullEvents: TraceEvent[] = [
    { kind: "SECTION", title: "Votre activité" },
    ...breakdown.events,
    { kind: "SECTION", title: "Calcul de l'impôt" },
    ...tax.events,
  ];

  return {
    fiscalYear,
    configVersion: config.version,
    breakdown,
    tax: { ...tax, trace: fullTrace },
    events: fullEvents,
    computedAt: new Date().toISOString(),
  };
}