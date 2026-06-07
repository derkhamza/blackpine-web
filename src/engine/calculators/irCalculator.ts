import type { IRBracket, IRResult, FiscalYearConfig, TraceEvent } from "../types";

export function calculateIR(
  resultatFiscal: number,
  dependentsCount: number,
  config: FiscalYearConfig
): IRResult {
  const trace: string[] = [];
  const events: TraceEvent[] = [];

  if (resultatFiscal < 0) {
    trace.push(`Résultat fiscal négatif (${resultatFiscal}), IR = 0`);
    events.push({
      kind: "RULE_APPLIED",
      title: "Résultat fiscal négatif",
      detail: "Votre résultat fiscal est négatif. L'impôt sur le revenu est automatiquement mis à zéro.",
    });
    return {
      grossIR: 0,
      bracketApplied: config.irBracketsProfessional[0],
      effectiveRate: 0,
      trace,
      events,
    };
  }

  trace.push(`Résultat fiscal: ${resultatFiscal} MAD`);

  const bracket = config.irBracketsProfessional.find(
    (b) => resultatFiscal >= b.from && (b.to === null || resultatFiscal <= b.to)
  );
  if (!bracket) {
    throw new Error(`No bracket found for résultat fiscal ${resultatFiscal}`);
  }

  const rate = bracket.rate * 100;
  const rangeLabel = bracket.to === null
    ? `au-delà de ${bracket.from.toLocaleString("fr-FR")} MAD`
    : `de ${bracket.from.toLocaleString("fr-FR")} à ${bracket.to.toLocaleString("fr-FR")} MAD`;

  trace.push(`Tranche appliquée: ${rate}% (${rangeLabel})`);
  events.push({
    kind: "RULE_APPLIED",
    title: `Tranche d'imposition ${rate}%`,
    detail: `Votre résultat fiscal tombe dans la tranche ${rangeLabel}, taxée à ${rate}%.`,
  });

  const grossIR = Math.max(0, resultatFiscal * bracket.rate - bracket.deduction);
  const formula = `${resultatFiscal.toLocaleString("fr-FR")} × ${rate}% − ${bracket.deduction.toLocaleString("fr-FR")}`;
  trace.push(`IR brut = ${formula} = ${grossIR} MAD`);
  events.push({
    kind: "COMPUTATION",
    title: "Calcul de l'IR brut",
    formula,
    value: grossIR,
    detail: "Formule rapide : base d'imposition multipliée par le taux de la tranche, moins la somme à déduire propre à cette tranche.",
  });

  const effectiveRate = resultatFiscal > 0 ? grossIR / resultatFiscal : 0;

  return {
    grossIR: Math.round(grossIR * 100) / 100,
    bracketApplied: bracket,
    effectiveRate: Math.round(effectiveRate * 10000) / 10000,
    trace,
    events,
  };
}