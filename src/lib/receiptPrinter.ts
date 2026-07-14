import type { CabinetDoctorProfile, BillingLine } from "./cabinetTypes";
import { printHtmlDocument } from "./printDoc";
import {
  DOC_DEFAULT_MARGINS, designForKind, resolveMargins, resolvePageSize,
  pageRule, backgroundHtml, blockStyle, logoHtml,
  typographyCss, brandFooterHtml,
} from "./docDesign";

// Escape every user-controlled value before it enters the print HTML. The print
// document is rendered in a same-origin iframe, so an unescaped patient/doctor
// field (e.g. an online-booking name) could otherwise inject a script that reads
// the auth token. Never interpolate raw strings below.
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── French number-to-words ─────────────────────────────────────────────────────

const ONES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const TENS_FR = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function belowHundred(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  if (t <= 6) {
    return TENS_FR[t] + (o === 0 ? "" : o === 1 ? "-et-un" : "-" + ONES[o]);
  }
  if (t === 7) return "soixante-" + ONES[10 + o];       // 70–79
  if (t === 8) return "quatre-vingt" + (o === 0 ? "s" : "-" + ONES[o]); // 80–89
  return "quatre-vingt-" + ONES[10 + o];                // 90–99
}

function belowThousand(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100), r = n % 100;
  let res = "";
  if (h === 1) res = "cent";
  else if (h > 1) res = ONES[h] + " cent" + (r === 0 ? "s" : "");
  const sub = belowHundred(r);
  return res + (res && sub ? " " : "") + sub;
}

function numberToFr(n: number): string {
  if (n === 0) return "zéro";
  let out = "", rem = n;

  if (rem >= 1_000_000) {
    const m = Math.floor(rem / 1_000_000);
    out += belowThousand(m) + " million" + (m > 1 ? "s" : "");
    rem %= 1_000_000;
    if (rem > 0) out += " ";
  }
  if (rem >= 1000) {
    const k = Math.floor(rem / 1000);
    out += (k === 1 ? "mille" : belowThousand(k) + " mille");
    rem %= 1000;
    if (rem > 0) out += " ";
  }
  if (rem > 0) out += belowThousand(rem);
  return out.trim();
}

export function amountInWords(amount: number): string {
  const mad      = Math.floor(amount);
  const centimes = Math.round((amount - mad) * 100);
  let text = numberToFr(mad) + " dirham" + (mad !== 1 ? "s" : "");
  if (centimes > 0) {
    text += " et " + numberToFr(centimes) + " centime" + (centimes !== 1 ? "s" : "");
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── Receipt counter ────────────────────────────────────────────────────────────

function getNextReceiptNumber(year: number): string {
  const key = `bp.receiptCounter.${year}`;
  const next = (parseInt(localStorage.getItem(key) ?? "0", 10) || 0) + 1;
  localStorage.setItem(key, String(next));
  return `REC-${year}-${String(next).padStart(4, "0")}`;
}

// ── Receipt HTML ───────────────────────────────────────────────────────────────

export interface ReceiptOptions {
  patientName:      string;
  consultationType: string;   // e.g. "Consultation"
  appointmentDate:  string;   // ISO "YYYY-MM-DD"
  appointmentTime?: string;   // "HH:MM"
  amount:           number;   // amount actually paid (montant réglé)
  total?:           number;   // full bill — shown only when a balance remains
  balance?:         number;   // outstanding after this payment
  items?:           BillingLine[]; // itemized breakdown (base + acts)
  reduction?:       number;        // MAD discount
  doctorProfile:    CabinetDoctorProfile;
}

export function printReceipt(opts: ReceiptOptions): void {
  const {
    patientName, consultationType, appointmentDate, appointmentTime,
    amount, doctorProfile,
  } = opts;

  const fmtMAD = (n: number) =>
    n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
  const items     = opts.items && opts.items.length > 1 ? opts.items : null;
  const reduction = opts.reduction && opts.reduction > 0 ? opts.reduction : 0;
  const breakdownRows = items
    ? items.map(l => `<tr><td>${esc(l.label)}${l.qty > 1 ? ` ×${l.qty}` : ""}</td>`
        + `<td style="text-align:right;white-space:nowrap;">${fmtMAD(l.qty * l.unitPrice)}</td></tr>`).join("")
      + (reduction > 0 ? `<tr><td>Remise</td><td style="text-align:right;white-space:nowrap;">− ${fmtMAD(reduction)}</td></tr>` : "")
    : "";

  const year      = new Date(appointmentDate + "T12:00:00").getFullYear();
  const receiptNo = getNextReceiptNumber(year);
  const dateLabel = new Date(appointmentDate + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const cityPart  = doctorProfile.address
    ? doctorProfile.address.split(",").pop()?.trim() ?? "Maroc"
    : "Maroc";

  const amtWords = amountInWords(amount);

  // Doctor-defined page design (margins / block positions / logo / letterhead).
  const design  = designForKind(doctorProfile.documentSettings, "receipt");
  const margins = resolveMargins(design, DOC_DEFAULT_MARGINS.receipt);
  const bs = (key: string) => blockStyle(design, key, margins);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Reçu ${receiptNo}</title>
  <style>
    ${pageRule(resolvePageSize(design, "A5").css, margins)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Arial", sans-serif; font-size: 10.5pt;
      color: #111; background: #fff; position: relative;
    }

    /* Header */
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; border-bottom: 2px solid var(--doc-accent,#0A4E7E);
      margin-bottom: 14px;
    }
    .doc-name    { font-size: 13.5pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); margin-bottom: 3px; }
    .doc-meta    { font-size: 9pt; color: #444; line-height: 1.5; }
    .logo-block  { text-align: right; }
    .logo-mark   {
      width: 44px; height: 44px; border-radius: 10px;
      background: var(--doc-accent,#0A4E7E); display: flex; align-items: center;
      justify-content: center; margin-left: auto; margin-bottom: 4px;
    }
    .logo-text   { font-size: 8pt; color: var(--doc-accent,#0A4E7E); font-weight: bold; }

    /* Title */
    .title-block {
      text-align: center; margin-bottom: 16px;
      padding: 10px; background: #F0F7FD; border-radius: 8px;
    }
    .title-main { font-size: 14pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); letter-spacing: 1px; }
    .title-sub  { font-size: 9pt; color: #555; margin-top: 3px; }

    /* Info rows */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .info-table tr td { padding: 5px 8px; font-size: 10pt; }
    .info-table tr:nth-child(even) { background: #f8fafc; }
    .info-label { font-weight: 600; color: var(--doc-accent,#0A4E7E); width: 38%; }

    /* Amount */
    .amount-block {
      border: 2px solid var(--doc-accent,#0A4E7E); border-radius: 10px;
      padding: 14px 18px; margin-bottom: 16px; text-align: center;
    }
    .amount-lbl  { font-size: 9pt; text-transform: uppercase; color: #555; letter-spacing: 1px; margin-bottom: 6px; }
    .amount-val  { font-size: 26pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); }
    .amount-unit { font-size: 13pt; font-weight: normal; color: var(--doc-accent,#0A4E7E); }
    .amount-words {
      margin-top: 8px; font-size: 9pt; font-style: italic; color: #444;
      border-top: 1px dashed #ccc; padding-top: 6px;
    }

    /* Signature */
    .signature-block {
      display: flex; justify-content: space-between; margin-top: 14px;
    }
    .sig-col { width: 48%; }
    .sig-label { font-size: 9pt; font-weight: 600; color: #555; margin-bottom: 40px; }
    .sig-line  { border-top: 1px solid #999; padding-top: 3px; font-size: 8pt; color: #888; }

    /* Footer */
    .footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd;
      font-size: 8pt; color: #888; text-align: center;
    }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  ${typographyCss(doctorProfile.documentSettings)}</style>
</head>
<body>
  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <!-- Header -->
  <div class="header" style="${bs("header")}">
    <div class="doc-left">
      <div class="doc-name">${esc(doctorProfile.fullName || "Dr.")}</div>
      <div class="doc-meta">
        ${doctorProfile.specialtyLabel ? esc(doctorProfile.specialtyLabel) + "<br/>" : ""}
        ${doctorProfile.address        ? esc(doctorProfile.address)        + "<br/>" : ""}
        ${doctorProfile.phone          ? "Tél : " + esc(doctorProfile.phone) + "<br/>" : ""}
        ${doctorProfile.ordre          ? "N° Ordre : " + esc(doctorProfile.ordre) + "<br/>" : ""}
        ${doctorProfile.inpe           ? "INPE : " + esc(doctorProfile.inpe)            : ""}
      </div>
    </div>
  </div>

  <!-- Receipt title -->
  <div class="title-block" style="${bs("title")}">
    <div class="title-main">REÇU DE PAIEMENT</div>
    <div class="title-sub">N° ${receiptNo} &nbsp;·&nbsp; ${esc(cityPart)}, le ${dateLabel}</div>
  </div>

  <!-- Info -->
  <div style="${bs("info")}">
    <table class="info-table">
      <tr>
        <td class="info-label">Reçu de :</td>
        <td>${esc(patientName)}</td>
      </tr>
      <tr>
        <td class="info-label">Pour :</td>
        <td>${esc(consultationType)}</td>
      </tr>
      <tr>
        <td class="info-label">Date du RDV :</td>
        <td>${dateLabel}${appointmentTime ? " à " + appointmentTime : ""}</td>
      </tr>
    </table>
    ${breakdownRows ? `<table class="info-table" style="margin-bottom:12px;">
      <tbody>${breakdownRows}</tbody>
    </table>` : ""}
  </div>

  <!-- Amount -->
  <div style="${bs("amount")}">
    <div class="amount-block">
      <div class="amount-lbl">Montant réglé</div>
      <div class="amount-val">
        ${amount.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span class="amount-unit"> MAD</span>
      </div>
      <div class="amount-words">En lettres : ${amtWords}</div>
    </div>
    ${opts.balance && opts.balance > 0 ? `<table class="info-table" style="margin-top:12px;margin-bottom:12px;">
      <tr><td class="info-label">Total facturé :</td><td style="text-align:right;">${fmtMAD(opts.total ?? amount)}</td></tr>
      <tr><td class="info-label" style="color:#C0392B;">Reste à payer :</td><td style="text-align:right;color:#C0392B;font-weight:700;">${fmtMAD(opts.balance)}</td></tr>
    </table>` : ""}
  </div>

  <!-- Signature -->
  <div class="signature-block" style="${bs("signature")}">
    <div class="sig-col">
      <div class="sig-label">Signature du patient :</div>
      <div class="sig-line">Lu et approuvé</div>
    </div>
    <div class="sig-col" style="text-align:right;">
      <div class="sig-label">Signature et cachet du médecin :</div>
      <div class="sig-line">Pour acquit</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer" style="${bs("footer")}">
    Ce reçu tient lieu de quittance de paiement · N° ${receiptNo}
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
${brandFooterHtml(doctorProfile.documentSettings)}</body>
</html>`;

  printHtmlDocument(html);
}
