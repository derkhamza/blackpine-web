import type { CabinetDoctorProfile, BillingLine } from "./cabinetTypes";
import { DEFAULT_DOCUMENT_SETTINGS } from "./cabinetTypes";
import { billSubtotal as calcSubtotal, billLineDiscounts, billNet } from "./billing";
import { amountInWords } from "./receiptPrinter";
import { printHtmlDocument } from "./printDoc";
import {
  FACTURE_DEFAULT_MARGINS, resolveMargins, pageRule, resolvePageSize, backgroundHtml,
  blockStyle, blockHidden, logoHtml, designForKind,
} from "./docDesign";

// ── Sequential invoice counter ────────────────────────────────────────────────

export function nextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const key  = `bp.invoiceSeq.${year}`;
  const next = (parseInt(localStorage.getItem(key) ?? "0", 10) || 0) + 1;
  localStorage.setItem(key, String(next));
  return `FAC-${year}-${String(next).padStart(4, "0")}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FactureOptions {
  invoiceNumber:   string;
  invoiceDate:     string;       // YYYY-MM-DD
  patientName:     string;
  patientCnops?:   string;
  serviceLabel:    string;       // e.g. "Consultation médicale" (fallback single line)
  serviceDate:     string;       // YYYY-MM-DD — appointment date
  amount:          number;       // net total (after reduction)
  items?:          BillingLine[]; // itemized breakdown (base + acts); overrides serviceLabel
  reduction?:      number;        // MAD discount applied to the subtotal
  doctorProfile:   CabinetDoctorProfile;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDateLong(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtMAD(n: number): string {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

// ── Print function ────────────────────────────────────────────────────────────

export function printFacture(opts: FactureOptions): void {
  const { invoiceNumber, invoiceDate, patientName, patientCnops, serviceLabel, serviceDate, amount, doctorProfile: doc } = opts;
  const ds = { ...DEFAULT_DOCUMENT_SETTINGS, ...(doc.documentSettings ?? {}) };
  // Advanced page design (margins / block positions / logo / letterhead
  // background) — the page designer saves it under designs.facture, so read it
  // via designForKind (falls back to the legacy factureDesign field).
  const design  = designForKind(ds, "facture");
  const margins = resolveMargins(design, FACTURE_DEFAULT_MARGINS);
  const bs = (key: string) => blockStyle(design, key, margins);

  // Build the itemized rows. Falls back to a single line for legacy records.
  const lines: BillingLine[] = (opts.items && opts.items.length)
    ? opts.items
    : [{ label: serviceLabel, qty: 1, unitPrice: amount }];
  const subtotal  = calcSubtotal(lines);                               // gross (before discounts)
  const lineDisc  = billLineDiscounts(lines);                          // sum of per-act discounts
  const reduction = opts.reduction && opts.reduction > 0 ? opts.reduction : 0;
  const net       = opts.items && opts.items.length ? billNet(lines, reduction) : amount;

  const remiseLabel = (l: BillingLine): string =>
    l.remiseType === "pct" ? `remise ${l.remise}%` : `remise ${fmtMAD(l.remise || 0)}`;

  const itemRows = lines.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(l.label)}${(l.remise && l.remise > 0) ? ` <span style="color:#777;font-size:8.5pt;">(${remiseLabel(l)})</span>` : ""}</td>
        <td>${fmtDateLong(serviceDate)}</td>
        <td class="r">${l.qty}</td>
        <td class="r">${fmtMAD(l.unitPrice)}</td>
        <td class="r">${fmtMAD(l.qty * l.unitPrice)}</td>
      </tr>`).join("");

  const lineDiscRow = lineDisc > 0 ? `
      <tr>
        <td colspan="4"></td>
        <td class="lbl">Remises sur actes</td>
        <td class="val">− ${fmtMAD(lineDisc)}</td>
      </tr>` : "";
  const reductionRow = reduction > 0 ? `
      <tr>
        <td colspan="4"></td>
        <td class="lbl">Remise globale</td>
        <td class="val">− ${fmtMAD(reduction)}</td>
      </tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Facture ${esc(invoiceNumber)}</title>
  <style>
    ${pageRule(resolvePageSize(design, "A4").css, margins)}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.5; position: relative; }

    /* ── Top band ─────────────────────────────────────────────────────────── */
    .top-band {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 0;
    }
    .doc-name  { font-size: 14pt; font-weight: bold; color: #0A4E7E; margin-bottom: 4px; }
    .doc-meta  { font-size: 9pt; color: #444; line-height: 1.65; }
    .inv-block { text-align: right; }
    .inv-title { font-size: 22pt; font-weight: 900; color: #0A4E7E; letter-spacing: 1px; }
    .inv-num   { font-size: 11pt; font-weight: 700; color: #0A4E7E; margin-top: 2px; }
    .inv-date  { font-size: 9pt; color: #555; margin-top: 3px; }

    /* ── Divider ──────────────────────────────────────────────────────────── */
    .rule { border: none; border-top: 2px solid #0A4E7E; margin: 12px 0; }
    .rule-thin { border: none; border-top: 1px solid #C8DFF0; margin: 10px 0; }

    /* ── Parties ──────────────────────────────────────────────────────────── */
    .parties { display: flex; gap: 20px; margin-bottom: 20px; }
    .party { flex: 1; }
    .party-label {
      font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: #0A4E7E; border-bottom: 1.5px solid #C8DFF0; padding-bottom: 4px; margin-bottom: 8px;
    }
    .party-name { font-size: 11pt; font-weight: 700; margin-bottom: 3px; }
    .party-detail { font-size: 9pt; color: #444; line-height: 1.6; }

    /* ── Line items ───────────────────────────────────────────────────────── */
    /* The per-act / per-consultation lines and their remises stay small; the
       final TOTAL line is the emphasised element. */
    table.items {
      width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 8.5pt;
    }
    .items thead { display: table-header-group; }
    .items tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .items thead tr { background: #0A4E7E; color: #fff; }
    .items thead th { padding: 6px 10px; text-align: left; font-size: 8pt; font-weight: 700; letter-spacing: 0.3px; }
    .items thead th.r { text-align: right; }
    .items tbody td { padding: 5px 10px; border-bottom: 1px solid #E2EFF8; vertical-align: top; font-size: 8.5pt; }
    .items tbody td.r { text-align: right; white-space: nowrap; }
    .items tbody tr:last-child td { border-bottom: none; }
    .items tfoot td { padding: 4px 10px; font-size: 8.5pt; }
    .items tfoot .sep { border-top: 1.5px solid #0A4E7E; }
    .items tfoot .lbl { color: #666; text-align: right; padding-right: 14px; font-size: 8.5pt; }
    .items tfoot .val { text-align: right; white-space: nowrap; font-size: 8.5pt; }
    /* Emphasised grand-total row: larger type, heavy rule and a soft highlight. */
    .items tfoot .total-lbl {
      font-weight: 800; text-align: right; padding: 10px 14px 10px 0; font-size: 13pt;
      color: #0A4E7E; border-top: 2.5px solid #0A4E7E; background: #EFF6FB;
    }
    .items tfoot .total-val {
      font-weight: 900; text-align: right; font-size: 17pt; color: #0A4E7E; white-space: nowrap;
      padding: 10px 10px; border-top: 2.5px solid #0A4E7E; background: #EFF6FB;
    }

    /* ── Amount in words ──────────────────────────────────────────────────── */
    .amount-words {
      margin: 14px 0; padding: 10px 14px;
      background: #EFF6FB; border-radius: 6px; font-size: 9.5pt;
      color: #333; font-style: italic;
    }
    .amount-words strong { font-style: normal; color: #0A4E7E; }

    /* ── TVA note ─────────────────────────────────────────────────────────── */
    .tva-note {
      font-size: 8pt; color: #777; margin: 10px 0;
      border-left: 3px solid #C8DFF0; padding-left: 10px;
    }

    /* ── Signature ────────────────────────────────────────────────────────── */
    .sig-row { display: flex; justify-content: flex-end; margin-top: 28px; }
    .sig-block { width: 200px; text-align: center; }
    .sig-label { font-size: 9pt; color: #555; margin-bottom: 40px; }
    .sig-box   { border-top: 1px solid #aaa; padding-top: 4px; font-size: 8.5pt; color: #333; }

    /* ── Footer ───────────────────────────────────────────────────────────── */
    .footer {
      margin-top: 30px; padding-top: 8px; border-top: 1px solid #ddd;
      font-size: 8pt; color: #aaa; text-align: center;
    }

    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>

  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <!-- Top band -->
  <div class="top-band">
    ${blockHidden(design, "header") ? "<div></div>" : `<div style="${bs("header")}">
      <div class="doc-name">${esc(doc.fullName || "Cabinet médical")}</div>
      <div class="doc-meta">
        ${doc.specialtyLabel ? esc(doc.specialtyLabel) + "<br/>"          : ""}
        ${doc.ordre          ? "N° Ordre : " + esc(doc.ordre) + "<br/>"   : ""}
        ${ds.showInpe && doc.inpe ? "INPE : " + esc(doc.inpe) + "<br/>"   : ""}
        ${ds.showIce  && doc.ice  ? "ICE : " + esc(doc.ice) + "<br/>"     : ""}
        ${doc.address        ? esc(doc.address) + "<br/>"                  : ""}
        ${doc.phone          ? "Tél : " + esc(doc.phone) + "<br/>"         : ""}
        ${ds.headerNote      ? `<span style="font-style:italic;">${esc(ds.headerNote)}</span>` : ""}
      </div>
    </div>`}
    <div class="inv-block" style="${bs("invoice")}">
      <div class="inv-title">FACTURE</div>
      <div class="inv-num">N° ${esc(invoiceNumber)}</div>
      <div class="inv-date">${fmtDateLong(invoiceDate)}</div>
    </div>
  </div>

  <hr class="rule" style="${blockHidden(design, "header") ? "display:none;" : ""}"/>

  <!-- Parties -->
  <div class="parties" style="${bs("parties")}">
    <div class="party">
      <div class="party-label">Prestataire</div>
      <div class="party-name">${esc(doc.fullName || "Cabinet médical")}</div>
      <div class="party-detail">
        ${doc.specialtyLabel ? esc(doc.specialtyLabel) + "<br/>" : ""}
        ${doc.address        ? esc(doc.address) + "<br/>"         : ""}
        ${doc.phone          ? "Tél : " + esc(doc.phone) + "<br/>": ""}
        ${doc.ordre          ? "N° Ordre : " + esc(doc.ordre) + "<br/>" : ""}
        ${ds.showInpe && doc.inpe ? "INPE : " + esc(doc.inpe) + "<br/>" : ""}
        ${ds.showIce  && doc.ice  ? "ICE : " + esc(doc.ice) + "<br/>"   : ""}
        ${ds.showRib  && doc.rib  ? "RIB : " + esc(doc.rib)             : ""}
      </div>
    </div>
    <div class="party">
      <div class="party-label">Destinataire</div>
      <div class="party-name">${esc(patientName)}</div>
      <div class="party-detail">
        ${patientCnops ? "N° AMO / CNOPS : " + esc(patientCnops) : ""}
      </div>
    </div>
  </div>

  <!-- Line items -->
  <div style="${bs("items")}">
  <table class="items">
    <thead>
      <tr>
        <th style="width:36px">N°</th>
        <th>Désignation</th>
        <th>Date de prestation</th>
        <th class="r">Qté</th>
        <th class="r">Prix unitaire</th>
        <th class="r">Montant</th>
      </tr>
    </thead>
    <tbody>${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4"></td>
        <td class="lbl">Total HT</td>
        <td class="val sep">${fmtMAD(subtotal)}</td>
      </tr>${lineDiscRow}${reductionRow}
      <tr>
        <td colspan="4"></td>
        <td class="lbl">TVA</td>
        <td class="val">Exonérée</td>
      </tr>
      <tr>
        <td colspan="4"></td>
        <td class="total-lbl">TOTAL TTC</td>
        <td class="total-val">${fmtMAD(net)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Amount in words -->
  <div class="amount-words">
    <strong>Arrêté la présente facture à la somme de :</strong>
    ${esc(amountInWords(net))}
  </div>

  <!-- TVA note -->
  <div class="tva-note">
    Exonération de TVA conformément à l'article 91-I-B du Code Général des Impôts (CGI) —
    les actes médicaux et paramédicaux sont exonérés de TVA au Maroc.
  </div>
  </div>

  <!-- Signature -->
  <div class="sig-row" style="${bs("signature")}">
    <div class="sig-block">
      <div class="sig-label">Signature et cachet du prestataire</div>
      <div class="sig-box">${esc(doc.fullName || "")}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer" style="${bs("footer")}">
    ${ds.footerNote ? esc(ds.footerNote) : `Note d'honoraires ${esc(invoiceNumber)} · Document à conserver`}
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  printHtmlDocument(html);
}
