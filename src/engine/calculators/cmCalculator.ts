import type { CMResult, FiscalYearConfig, TraceEvent } from "../types";

export function calculateCM(
  chiffreAffaires: number,
  activityStartDate: string,
  asOfDate: string,
  config: FiscalYearConfig
): CMResult {
  const trace: string[] = [];
  const events: TraceEvent[] = [];

  const start = new Date(activityStartDate);
  const asOf = new Date(asOfDate);

  if (isNaN(start.getTime())) throw new Error(`Invalid activityStartDate: ${activityStartDate}`);
  if (isNaN(asOf.getTime())) throw new Error(`Invalid asOfDate: ${asOfDate}`);

  const monthsSinceStart =
    (asOf.getFullYear() - start.getFullYear()) * 12 +
    (asOf.getMonth() - start.getMonth());

  trace.push(`Date de début d'activité: ${activityStartDate}, ${monthsSinceStart} mois écoulés`);

  if (monthsSinceStart < config.cotisationMinimale.exemptionMonths) {
    trace.push(`Exemption CM applicable (moins de ${config.cotisationMinimale.exemptionMonths} mois d'activité)`);
    events.push({
      kind: "RULE_APPLIED",
      title: "Exemption de cotisation minimale",
      detail: `Vous exercez depuis ${monthsSinceStart} mois. La cotisation minimale s'applique à partir de ${config.cotisationMinimale.exemptionMonths} mois d'activité.`,
    });
    return {
      cmDue: 0,
      exempted: true,
      monthsSinceActivityStart: monthsSinceStart,
      trace,
      events,
    };
  }

  trace.push(`Plus de ${config.cotisationMinimale.exemptionMonths} mois d'activité, CM applicable`);

  const rawCM = chiffreAffaires * config.cotisationMinimale.rateMedical;
  const rate = config.cotisationMinimale.rateMedical * 100;
  trace.push(`CM brute = ${chiffreAffaires} × ${config.cotisationMinimale.rateMedical} = ${rawCM} MAD`);

  events.push({
    kind: "COMPUTATION",
    title: "Calcul de la cotisation minimale",
    formula: `${chiffreAffaires.toLocaleString("fr-FR")} × ${rate}%`,
    value: rawCM,
    detail: `Les médecins paient ${rate}% de leur chiffre d'affaires au titre de la cotisation minimale.`,
  });

  const cmDue = Math.max(rawCM, config.cotisationMinimale.floorMad);
  if (cmDue === config.cotisationMinimale.floorMad && rawCM < cmDue) {
    trace.push(`Plancher de ${config.cotisationMinimale.floorMad} MAD appliqué`);
    events.push({
      kind: "RULE_APPLIED",
      title: "Plancher de cotisation appliqué",
      detail: `La CM calculée (${rawCM.toLocaleString("fr-FR")} MAD) est inférieure au plancher légal de ${config.cotisationMinimale.floorMad.toLocaleString("fr-FR")} MAD. C'est le plancher qui s'applique.`,
    });
  }

  trace.push(`CM due: ${cmDue} MAD`);

  return {
    cmDue: Math.round(cmDue * 100) / 100,
    exempted: false,
    monthsSinceActivityStart: monthsSinceStart,
    trace,
    events,
  };
}