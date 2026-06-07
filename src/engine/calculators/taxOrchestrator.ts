import { calculateIR } from "./irCalculator";
import { calculateCM } from "./cmCalculator";
import type {
  DoctorProfile,
  FiscalYearConfig,
  TaxResult,
  Regime,
  TraceEvent,
} from "../types";

export function calculateTax(
  profile: DoctorProfile,
  resultatFiscal: number,
  chiffreAffaires: number,
  asOfDate: string,
  config: FiscalYearConfig
): TaxResult {
  const trace: string[] = [];
  const events: TraceEvent[] = [];
  const warnings: string[] = [];
  let needsHumanReview = false;

  const regime = determineRegime(chiffreAffaires, config);
  trace.push(`Régime déterminé: ${regime}`);
  events.push({
    kind: "RULE_APPLIED",
    title: `Régime fiscal : ${regime}`,
    detail: regimeExplanation(regime, chiffreAffaires, config),
  });

  if (profile.practiceType === "MIXED") {
    warnings.push("Pratique mixte (cabinet + clinique) détectée. Vérification manuelle recommandée.");
    events.push({
      kind: "WARNING",
      title: "Pratique mixte détectée",
      detail: "Vous exercez à la fois en cabinet et en clinique. La retenue à la source des cliniques doit être traitée séparément ; consultez votre comptable.",
    });
    needsHumanReview = true;
  }

  const ir = calculateIR(resultatFiscal, profile.dependentsCount, config);
  trace.push(...ir.trace);
  events.push(...ir.events);

  const cappedDependents = Math.min(
    profile.dependentsCount,
    config.familyDeductions.maxDependents
  );
  const familyDeduction = cappedDependents * config.familyDeductions.perDependentAnnual;
  trace.push(`Déduction familiale: ${cappedDependents} personne(s) × ${config.familyDeductions.perDependentAnnual} = ${familyDeduction} MAD`);

  if (familyDeduction > 0) {
    events.push({
      kind: "RULE_APPLIED",
      title: "Déduction pour charges de famille",
      formula: `${cappedDependents} × ${config.familyDeductions.perDependentAnnual}`,
      value: familyDeduction,
      detail: "Réduction directe de l'impôt, pas de la base imposable.",
    });
  }

  const irNet = Math.max(0, ir.grossIR - familyDeduction);
  trace.push(`IR net après déduction familiale: ${irNet} MAD`);

  const cm = calculateCM(chiffreAffaires, profile.activityStartDate, asOfDate, config);
  trace.push(...cm.trace);
  events.push(...cm.events);

  let taxDue: number;
  let payableRule: "IR" | "CM";

  if (irNet >= cm.cmDue) {
    taxDue = irNet;
    payableRule = "IR";
    trace.push(`IR (${irNet}) ≥ CM (${cm.cmDue}), impôt payable: IR`);
  } else {
    taxDue = cm.cmDue;
    payableRule = "CM";
    trace.push(`CM (${cm.cmDue}) > IR (${irNet}), impôt payable: CM`);
  }

  events.push({
    kind: "COMPARISON",
    title: "Comparaison IR / CM",
    detail: `Le contribuable paie le plus élevé des deux : IR net = ${irNet.toLocaleString("fr-FR")} MAD, CM = ${cm.cmDue.toLocaleString("fr-FR")} MAD. Résultat : ${payableRule}.`,
  });

  events.push({
    kind: "CONCLUSION",
    title: "Impôt à payer",
    value: taxDue,
    detail: `Calculé sur la base de ${payableRule === "IR" ? "l'impôt sur le revenu net" : "la cotisation minimale"}.`,
  });

  return {
    regime,
    resultatFiscal,
    ir,
    cm,
    familyDeduction,
    taxDue: Math.round(taxDue * 100) / 100,
    payableRule,
    trace,
    events,
    warnings,
    needsHumanReview,
  };
}

function determineRegime(chiffreAffaires: number, config: FiscalYearConfig): Regime {
  if (chiffreAffaires < config.regimeThresholds.rnsMinCa) return "RNS";
  if (chiffreAffaires <= config.regimeThresholds.rnsMaxCa) return "RNS";
  return "RNR";
}

function regimeExplanation(regime: Regime, ca: number, config: FiscalYearConfig): string {
  if (regime === "RNS") {
    return `Avec un chiffre d'affaires de ${ca.toLocaleString("fr-FR")} MAD, vous relevez du Régime du Résultat Net Simplifié (seuil supérieur : ${config.regimeThresholds.rnsMaxCa.toLocaleString("fr-FR")} MAD).`;
  }
  return `Avec un chiffre d'affaires de ${ca.toLocaleString("fr-FR")} MAD, vous relevez du Régime du Résultat Net Réel (au-delà de ${config.regimeThresholds.rnsMaxCa.toLocaleString("fr-FR")} MAD).`;
}