import type { Transaction, ResultatFiscalBreakdown, TraceEvent } from "../types";

export function calculateResultatFiscal(
  transactions: Transaction[]
): ResultatFiscalBreakdown {
  const trace: string[] = [];
  const events: TraceEvent[] = [];
  let totalRecettes = 0;
  let totalCharges = 0;
  let totalChargesDeductibles = 0;

  for (const tx of transactions) {
    if (tx.amount < 0) throw new Error(`Transaction ${tx.id} has negative amount, not allowed`);

    if (tx.type === "RECETTE") {
      totalRecettes += tx.amount;
      continue;
    }
    totalCharges += tx.amount;
    const status = tx.deductibilityStatus ?? "FULLY_DEDUCTIBLE";
    const ratio = tx.professionalUseRatio ?? 1;

    if (status === "NOT_DEDUCTIBLE") continue;
    if (status === "NEEDS_REVIEW") {
      trace.push(`Charge ${tx.id} (${tx.category}) marquée pour révision`);
      continue;
    }
    totalChargesDeductibles += tx.amount * ratio;
  }

  const totalReintegrations = totalCharges - totalChargesDeductibles;
  const resultatComptable = totalRecettes - totalCharges;
  const resultatFiscal = resultatComptable + totalReintegrations;

  trace.push(`Total recettes: ${totalRecettes} MAD`);
  trace.push(`Total charges: ${totalCharges} MAD`);
  trace.push(`Charges déductibles: ${totalChargesDeductibles} MAD`);
  trace.push(`Réintégrations: ${totalReintegrations} MAD`);
  trace.push(`Résultat comptable: ${resultatComptable} MAD`);
  trace.push(`Résultat fiscal: ${resultatFiscal} MAD`);

  events.push({ kind: "INPUT", title: "Total des recettes", value: totalRecettes });
  events.push({ kind: "INPUT", title: "Total des charges engagées", value: totalCharges });
  events.push({
    kind: "COMPUTATION",
    title: "Charges effectivement déductibles",
    value: totalChargesDeductibles,
    detail: "Somme des charges après application des taux de déductibilité (100% pour la plupart, 60% pour le carburant mixte, etc.).",
  });
  if (totalReintegrations > 0) {
    events.push({
      kind: "RULE_APPLIED",
      title: "Réintégrations fiscales",
      value: totalReintegrations,
      detail: "Part des charges non déductibles (usage personnel, catégories exclues). Ajoutée au résultat fiscal.",
    });
  }
  events.push({
    kind: "COMPUTATION",
    title: "Résultat fiscal",
    value: resultatFiscal,
    formula: `${totalRecettes.toLocaleString("fr-FR")} − ${totalChargesDeductibles.toLocaleString("fr-FR")}`,
    detail: "Base qui servira de point de départ pour le calcul de l'IR.",
  });

  return {
    totalRecettes: round2(totalRecettes),
    totalCharges: round2(totalCharges),
    totalChargesDeductibles: round2(totalChargesDeductibles),
    totalReintegrations: round2(totalReintegrations),
    resultatComptable: round2(resultatComptable),
    resultatFiscal: round2(resultatFiscal),
    trace,
    events,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}