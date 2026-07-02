// Moroccan payroll calculation — exact copy of blackpine-app/lib/payrollCalc.ts

import type { CabinetDoctorProfile, ContractType, Employee } from "./cabinetTypes";

export interface PayrollResult {
  grossSalary: number;
  cnssEmployee: number;
  amoEmployee: number;
  deductionPro: number;
  netImposable: number;
  irBrut: number;
  irFamille: number;
  irNet: number;
  netSalary: number;
  cnssEmployer: number;
  exempt: boolean;        // true for ANAPEC (Idmaj) — no charges, full salary
}

const CNSS_EMPLOYEE_RATE = 0.0674;
const CNSS_SALARY_CAP    = 6_000;
const CNSS_EMPLOYER_RATE = 0.2109;
const DEDUCTION_PRO_RATE = 0.20;
const DEDUCTION_PRO_MAX  = 2_500;

function calcIrMensuel(netImposable: number): number {
  if (netImposable <= 0)       return 0;
  if (netImposable <= 2_500)   return 0;
  if (netImposable <= 5_000)   return netImposable * 0.10 - 250;
  if (netImposable <= 10_000)  return netImposable * 0.20 - 750;
  if (netImposable <= 15_000)  return netImposable * 0.30 - 1_750;
  if (netImposable <= 20_000)  return netImposable * 0.34 - 2_350;
  return netImposable * 0.38 - 3_150;
}

export function computePayroll(
  grossSalary: number,
  dependents = 0,
  contractType: ContractType = "cdi",
): PayrollResult {
  const gross = Math.max(0, grossSalary);

  // ANAPEC "Contrat d'insertion" (Idmaj): the indemnité is exempt from CNSS,
  // AMO and IR — the employee receives the entire gross and the cabinet pays no
  // employer charges.
  if (contractType === "anapec") {
    return {
      grossSalary: gross, cnssEmployee: 0, amoEmployee: 0, deductionPro: 0,
      netImposable: gross, irBrut: 0, irFamille: 0, irNet: 0,
      netSalary: gross, cnssEmployer: 0, exempt: true,
    };
  }

  const cotisableCnss = Math.min(gross, CNSS_SALARY_CAP);
  const cnssEmployee  = Math.round(cotisableCnss * CNSS_EMPLOYEE_RATE * 100) / 100;
  const amoEmployee   = Math.round(cotisableCnss * 0.0226 * 100) / 100;
  const deductionPro  = Math.min(gross * DEDUCTION_PRO_RATE, DEDUCTION_PRO_MAX);
  const netImposable  = Math.max(0, gross - cnssEmployee - deductionPro);
  const irBrut        = calcIrMensuel(netImposable);
  const irFamille     = (dependents ?? 0) * 30;
  const irNet         = Math.max(0, Math.round((irBrut - irFamille) * 100) / 100);
  const netSalary     = Math.round((gross - cnssEmployee - irNet) * 100) / 100;
  const cnssEmployer  = Math.round(cotisableCnss * CNSS_EMPLOYER_RATE * 100) / 100;
  return { grossSalary: gross, cnssEmployee, amoEmployee, deductionPro, netImposable, irBrut, irFamille, irNet, netSalary, cnssEmployer, exempt: false };
}

export function fmtMAD(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} MAD`;
}

export function currentMonthLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ── Bulletin de paie HTML ─────────────────────────────────────────────────────

const MONTH_NAMES_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function fmtN(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bRow(label: string, base: string, rate: string, amt: string, muted = false) {
  return `<tr${muted ? ' class="muted"' : ""}>
    <td>${label}</td><td class="r">${base}</td>
    <td class="r">${rate}</td><td class="r">${amt}</td>
  </tr>`;
}

export function printBulletin(
  employee: Employee,
  month: number,   // 1–12
  year: number,
  doctorProfile: CabinetDoctorProfile,
): void {
  const p = computePayroll(employee.baseSalary, employee.dependents ?? 0, employee.contractType ?? "cdi");
  const monthLabel = `${MONTH_NAMES_FR[month - 1]} ${year}`;
  const coutTotal  = p.grossSalary + p.cnssEmployer;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Bulletin de paie — ${employee.firstName} ${employee.lastName} — ${monthLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; background: #fff; }
    .hdr { display: flex; justify-content: space-between; padding-bottom: 10px;
           border-bottom: 2px solid #0A4E7E; margin-bottom: 14px; }
    .doc-name  { font-size: 14pt; font-weight: bold; color: #0A4E7E; margin-bottom: 4px; }
    .doc-meta  { font-size: 9pt; color: #555; line-height: 1.6; }
    .logo-mark { width: 42px; height: 42px; border-radius: 10px; background: #0A4E7E;
                 display: flex; align-items: center; justify-content: center;
                 margin-left: auto; margin-bottom: 3px; }
    .logo-txt  { font-size: 8pt; color: #0A4E7E; font-weight: bold; text-align: right; }
    .title-band {
      background: #F0F7FD; border-radius: 8px; padding: 10px 14px;
      margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;
    }
    .title-main { font-size: 13pt; font-weight: bold; color: #0A4E7E; }
    .title-sub  { font-size: 10pt; color: #555; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .info-box  { border: 1px solid #d0dde9; border-radius: 6px; padding: 8px 10px; }
    .info-lbl  { font-size: 8pt; font-weight: 700; color: #0A4E7E; text-transform: uppercase;
                 letter-spacing: 0.4px; margin-bottom: 2px; }
    .info-val  { font-size: 10pt; }
    table  { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5pt; }
    thead { display: table-header-group; }
    tbody tr { break-inside: avoid; page-break-inside: avoid; }
    thead th {
      background: #0A4E7E; color: #fff; padding: 7px 10px; text-align: left;
      font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
    }
    thead th.r { text-align: right; }
    tbody tr:nth-child(even):not(.section-row):not(.muted) { background: #f7fafd; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5eef5; }
    td.r { text-align: right; }
    tr.muted td { color: #888; font-style: italic; }
    tr.section-row td { background: #dce8f5; padding: 5px 10px; font-size: 8pt;
      font-weight: 700; text-transform: uppercase; color: #0A4E7E; letter-spacing: 0.4px; }
    tfoot td { font-weight: 700; background: #EFF6FB; padding: 8px 10px;
               border-top: 2px solid #0A4E7E; font-size: 10pt; }
    .net-block { border: 2px solid #0A4E7E; border-radius: 10px; padding: 14px 18px;
                 text-align: center; margin-bottom: 14px; }
    .net-lbl { font-size: 8.5pt; text-transform: uppercase; color: #555; letter-spacing: 1px; }
    .net-val { font-size: 28pt; font-weight: bold; color: #0A4E7E; }
    .net-unit { font-size: 14pt; font-weight: normal; }
    .cost-row { display: flex; justify-content: space-between; padding: 7px 10px;
                background: #FFF8F0; border: 1px solid #f0d8b0; border-radius: 6px;
                font-size: 9.5pt; margin-bottom: 14px; }
    .sig { display: flex; justify-content: space-between; margin-top: 12px; }
    .sig-col { width: 45%; }
    .sig-lbl { font-size: 8.5pt; font-weight: 600; color: #555; margin-bottom: 36px; }
    .sig-line { border-top: 1px solid #aaa; padding-top: 4px; font-size: 8pt; color: #888; }
    .footer { margin-top: 14px; border-top: 1px solid #ddd; padding-top: 8px;
              font-size: 7.5pt; color: #aaa; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="doc-name">${doctorProfile.fullName || "Cabinet médical"}</div>
      <div class="doc-meta">
        ${doctorProfile.specialtyLabel ? doctorProfile.specialtyLabel + "<br/>" : ""}
        ${doctorProfile.address        ? doctorProfile.address        + "<br/>" : ""}
        ${doctorProfile.phone          ? "Tél : " + doctorProfile.phone          : ""}
      </div>
    </div>
    <div style="text-align:right;">
      <div class="logo-mark">
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
          <path d="M4 4h5.5a3.5 3.5 0 0 1 0 7H4V4Z" fill="white" fill-opacity="0.9"/>
          <path d="M4 11h6a4 4 0 0 1 0 8H4v-8Z" fill="white" fill-opacity="0.6"/>
        </svg>
      </div>
      <div class="logo-txt">Iyadaty</div>
    </div>
  </div>

  <div class="title-band">
    <div class="title-main">BULLETIN DE PAIE</div>
    <div class="title-sub">${monthLabel}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-lbl">Employé(e)</div>
      <div class="info-val">${employee.firstName} ${employee.lastName}</div>
    </div>
    <div class="info-box">
      <div class="info-lbl">Poste</div>
      <div class="info-val">${employee.role}</div>
    </div>
    <div class="info-box">
      <div class="info-lbl">N° CNSS</div>
      <div class="info-val">${employee.cnssNumber || "—"}</div>
    </div>
    <div class="info-box">
      <div class="info-lbl">Personnes à charge</div>
      <div class="info-val">${employee.dependents ?? 0}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Rubrique</th>
        <th class="r">Base (MAD)</th>
        <th class="r">Taux</th>
        <th class="r">Montant (MAD)</th>
      </tr>
    </thead>
    <tbody>
      <tr class="section-row"><td colspan="4">Rémunération brute</td></tr>
      ${bRow("Salaire de base", fmtN(p.grossSalary), "—", fmtN(p.grossSalary))}
      ${p.exempt
        ? `<tr class="section-row"><td colspan="4">Contrat ANAPEC (Idmaj) — exonération</td></tr>
           ${bRow("CNSS / AMO / IR", "—", "Exonéré", "− 0,00")}
           <tr class="muted"><td colspan="4">Indemnité d'insertion exonérée de charges sociales et d'IR. L'employé(e) perçoit l'intégralité du salaire brut.</td></tr>`
        : `<tr class="section-row"><td colspan="4">Cotisations salariales</td></tr>
      ${bRow("CNSS (court terme + AMO salariale)", fmtN(Math.min(p.grossSalary, CNSS_SALARY_CAP)), "6,74 %", `− ${fmtN(p.cnssEmployee)}`)}
      ${bRow("Déduction forfaitaire frais pro", fmtN(p.grossSalary), "20 %", `− ${fmtN(p.deductionPro)}`, true)}
      <tr class="section-row"><td colspan="4">Impôt sur le revenu</td></tr>
      ${bRow("Base nette imposable", "—", "—", fmtN(p.netImposable), true)}
      ${bRow("IR mensuel (barème)", "—", "—", `− ${fmtN(p.irBrut)}`)}
      ${(employee.dependents ?? 0) > 0
          ? bRow(`Déduction famille (${employee.dependents} pers.)`, "—", "30 MAD/pers.", `+ ${fmtN(p.irFamille)}`)
          : ""}`}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">NET À PAYER</td>
        <td class="r">${fmtN(p.netSalary)} MAD</td>
      </tr>
    </tfoot>
  </table>

  <div class="net-block">
    <div class="net-lbl">Net à payer au salarié</div>
    <div class="net-val">${fmtN(p.netSalary)} <span class="net-unit">MAD</span></div>
  </div>

  <div class="cost-row">
    <span>Charges patronales (CNSS 21,09 %) : <strong>${fmtN(p.cnssEmployer)} MAD</strong></span>
    <span>Coût total cabinet : <strong>${fmtN(coutTotal)} MAD</strong></span>
  </div>

  <div class="sig">
    <div class="sig-col">
      <div class="sig-lbl">Signature de l'employé(e) :</div>
      <div class="sig-line">Lu et approuvé</div>
    </div>
    <div class="sig-col" style="text-align:right;">
      <div class="sig-lbl">Signature et cachet de l'employeur :</div>
      <div class="sig-line">Pour acquit</div>
    </div>
  </div>

  <div class="footer">
    Bulletin établi le ${new Date().toLocaleDateString("fr-FR")} · Généré par Iyadaty
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=760,height=950");
  if (!win) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
}
