// Standalone French print of the fiscal / accounting report.
//
// The on-screen report follows the UI language (fr/en/ar), but every PRINTED
// document in Blackpine must be in French (patients, pharmacies, the accountant
// and the tax administration all expect French). Instead of window.print()-ing
// the live, UI-language DOM, we build a self-contained French A4 document and
// print it through the shared iframe harness — exactly like every other printer.
import { printHtmlDocument } from "./printDoc";
import type { CabinetDoctorProfile } from "./cabinetTypes";

export interface FiscalReportOptions {
  doctorProfile: CabinetDoctorProfile;
  fiscalYear:    number;
  totals:        { rec: number; chg: number; net: number };
  breakdown:     { totalRecettes: number; totalChargesDeductibles: number; totalReintegrations: number; resultatFiscal: number };
  tax:           { grossIR: number; familyDeduction: number; irNet: number; cmDue: number; taxDue: number; regime: string; payableRule: string };
  monthly:       { month: number; recettes: number; charges: number; net: number }[];
  categories:    { id: string; label: string; color: string; percentage: number; amount: number }[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mad = (n: number, currency = true) => {
  const v = n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${v} MAD` : v;
};

const FR_MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("fr-FR", { month: "long" }));

export function printFiscalReport(opts: FiscalReportOptions): void {
  const { doctorProfile: doc, fiscalYear, totals, breakdown, tax, monthly, categories } = opts;

  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const chargeRate = totals.rec > 0 ? ((totals.chg / totals.rec) * 100).toFixed(1) : "0";

  const monthlyRows = monthly.map(m => {
    const active = m.recettes > 0 || m.charges > 0;
    const sign = m.net >= 0 ? "+" : "";
    return `<tr${active ? "" : ' class="inactive"'}>
      <td>${esc(FR_MONTHS[m.month - 1])}</td>
      <td class="num green">${active ? mad(m.recettes, false) : "—"}</td>
      <td class="num coral">${active ? mad(m.charges, false) : "—"}</td>
      <td class="num ${m.net >= 0 ? "green" : "coral"}">${active ? sign + mad(m.net, false) : "—"}</td>
    </tr>`;
  }).join("");

  const catRows = categories.length === 0
    ? `<div class="empty">Aucune charge enregistrée pour ${fiscalYear}.</div>`
    : categories.map(c => `<div class="cat-row">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span class="cat-label">${esc(c.label)}</span>
        <span class="cat-bar-wrap"><span class="cat-bar" style="width:${c.percentage}%;background:${c.color}CC"></span></span>
        <span class="cat-pct">${c.percentage}%</span>
        <span class="cat-amt">${mad(c.amount, false)}</span>
      </div>`).join("")
      + `<div class="cat-total"><span>Total des charges</span><strong>${mad(totals.chg)}</strong></div>`;

  const quarters = [0, 1, 2, 3].map(q => {
    const qm = monthly.slice(q * 3, q * 3 + 3);
    const qRec = qm.reduce((s, m) => s + m.recettes, 0);
    const qChg = qm.reduce((s, m) => s + m.charges, 0);
    const qNet = qRec - qChg;
    return `<div class="quarter">
      <div class="q-label">T${q + 1}</div>
      <div class="green">${mad(qRec, false)}</div>
      <div class="coral">− ${mad(qChg, false)}</div>
      <div class="q-net" style="color:${qNet >= 0 ? "#2E9E7B" : "#E85B5B"}">${qNet >= 0 ? "+" : ""}${mad(qNet, false)}</div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Rapport fiscal ${fiscalYear} — ${esc(doc.fullName || "Cabinet")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #122B42; padding: 28px 32px; font-size: 11pt; }
    .green { color: #2E9E7B; } .coral { color: #E85B5B; } .navy { color: #0A4E7E; }
    .num { text-align: right; white-space: nowrap; }
    /* Letterhead */
    .lh { text-align: center; border-bottom: 2px solid #0A4E7E; padding-bottom: 14px; margin-bottom: 20px; }
    .lh-name { font-size: 18pt; font-weight: 800; color: #0A4E7E; }
    .lh-sub  { font-size: 10.5pt; color: #0A4E7E; font-weight: 600; margin-top: 2px; }
    .lh-meta { font-size: 9pt; color: #555; margin-top: 5px; line-height: 1.5; }
    .lh-meta span { margin: 0 6px; }
    .lh-title { font-size: 13pt; font-weight: 800; margin-top: 12px; letter-spacing: .5px; }
    .lh-date  { font-size: 9pt; color: #777; margin-top: 3px; }
    /* KPI row */
    .kpis { display: flex; gap: 10px; margin-bottom: 20px; }
    .kpi { flex: 1; border: 1px solid #E2E8EF; border-radius: 8px; padding: 10px 12px; }
    .kpi-lbl { font-size: 8pt; text-transform: uppercase; letter-spacing: .4px; color: #888; font-weight: 700; }
    .kpi-val { font-size: 15pt; font-weight: 800; margin-top: 3px; }
    .kpi-sub { font-size: 8pt; color: #999; margin-top: 2px; }
    /* Fiscal breakdown */
    .fiscal { border: 1px solid #E2E8EF; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; background: #FaFcFe; }
    .fiscal-title { font-size: 10pt; font-weight: 800; color: #0A4E7E; margin-bottom: 10px; }
    .frow { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10pt; border-bottom: 1px dashed #E7EDF3; }
    .frow.subtotal { border-top: 1px solid #cbd8e4; border-bottom: none; margin-top: 4px; padding-top: 8px; font-weight: 700; }
    .frow.total { border-bottom: none; margin-top: 6px; padding-top: 8px; border-top: 2px solid #0A4E7E; font-weight: 800; font-size: 12pt; }
    /* Two columns */
    .cols { display: flex; gap: 20px; }
    .col { flex: 1; }
    .sec-title { font-size: 10pt; font-weight: 800; color: #0A4E7E; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .3px; color: #888; padding: 5px 6px; border-bottom: 1.5px solid #E2E8EF; }
    td { padding: 4px 6px; font-size: 9.5pt; border-bottom: 1px solid #F0F4F8; }
    tfoot td { font-weight: 800; border-top: 1.5px solid #0A4E7E; border-bottom: none; }
    tr.inactive td { color: #bbb; }
    .cat-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 9.5pt; }
    .cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .cat-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cat-bar-wrap { width: 70px; height: 6px; background: #EEF3F8; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
    .cat-bar { display: block; height: 100%; }
    .cat-pct { width: 34px; text-align: right; color: #888; font-size: 8.5pt; }
    .cat-amt { width: 64px; text-align: right; font-weight: 600; }
    .cat-total { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 6px; border-top: 1.5px solid #0A4E7E; font-weight: 800; }
    .quarters { display: flex; gap: 8px; margin-top: 8px; }
    .quarter { flex: 1; border: 1px solid #E2E8EF; border-radius: 6px; padding: 7px 4px; text-align: center; font-size: 8.5pt; }
    .q-label { font-weight: 800; color: #0A4E7E; margin-bottom: 3px; }
    .q-net { font-weight: 700; margin-top: 2px; }
    .empty { color: #999; font-size: 10pt; padding: 12px 0; text-align: center; }
    @media print { body { padding: 14mm 12mm; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <div class="lh">
    <div class="lh-name">${esc(doc.fullName || "Médecin")}</div>
    ${doc.specialtyLabel ? `<div class="lh-sub">${esc(doc.specialtyLabel)}</div>` : ""}
    <div class="lh-meta">
      ${doc.address ? `<span>${esc(doc.address)}</span>` : ""}
      ${doc.inpe ? `<span>INPE : ${esc(doc.inpe)}</span>` : ""}
    </div>
    <div class="lh-title">Rapport fiscal — Exercice ${fiscalYear}</div>
    <div class="lh-date">Établi le ${today}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-lbl">Recettes brutes</div><div class="kpi-val green">${mad(totals.rec)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Total charges</div><div class="kpi-val coral">${mad(totals.chg)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Résultat net</div><div class="kpi-val" style="color:${totals.net >= 0 ? "#2E9E7B" : "#E85B5B"}">${totals.net >= 0 ? "+" : ""}${mad(totals.net)}</div><div class="kpi-sub">Taux de charges ${chargeRate}%</div></div>
    <div class="kpi"><div class="kpi-lbl">Impôt dû</div><div class="kpi-val navy">${mad(tax.taxDue)}</div><div class="kpi-sub">${esc(tax.regime)}</div></div>
  </div>

  <div class="fiscal">
    <div class="fiscal-title">Détail fiscal ${fiscalYear}</div>
    <div class="frow"><span>Recettes déclarées</span><span class="green">${mad(breakdown.totalRecettes)}</span></div>
    <div class="frow"><span>Charges déductibles</span><span class="coral">− ${mad(breakdown.totalChargesDeductibles)}</span></div>
    ${breakdown.totalReintegrations > 0 ? `<div class="frow"><span>Réintégrations</span><span style="color:#C79A3B">+ ${mad(breakdown.totalReintegrations)}</span></div>` : ""}
    <div class="frow subtotal"><span>Résultat fiscal</span><strong>${mad(breakdown.resultatFiscal)}</strong></div>
    <div class="frow"><span>IR brut</span><span>${mad(tax.grossIR)}</span></div>
    ${tax.familyDeduction > 0 ? `<div class="frow"><span>Déduction pour charges de famille</span><span class="navy">− ${mad(tax.familyDeduction)}</span></div>` : ""}
    <div class="frow"><span>IR net</span><span>${mad(tax.irNet)}</span></div>
    <div class="frow"><span>Cotisation minimale</span><span>${mad(tax.cmDue)}</span></div>
    <div class="frow total"><span>Impôt dû (${esc(tax.payableRule)})</span><strong class="navy">${mad(tax.taxDue)}</strong></div>
  </div>

  <div class="cols">
    <div class="col">
      <div class="sec-title">Détail mensuel</div>
      <table>
        <thead><tr><th>Mois</th><th class="num">Recettes</th><th class="num">Charges</th><th class="num">Net</th></tr></thead>
        <tbody>${monthlyRows}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td class="num green">${mad(totals.rec, false)}</td>
          <td class="num coral">${mad(totals.chg, false)}</td>
          <td class="num ${totals.net >= 0 ? "green" : "coral"}">${totals.net >= 0 ? "+" : ""}${mad(totals.net, false)}</td>
        </tr></tfoot>
      </table>
    </div>
    <div class="col">
      <div class="sec-title">Répartition des charges</div>
      ${catRows}
      <div class="sec-title" style="margin-top:18px">Synthèse trimestrielle</div>
      <div class="quarters">${quarters}</div>
    </div>
  </div>
</body>
</html>`;

  printHtmlDocument(html);
}
