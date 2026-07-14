import type { CabinetDoctorProfile, MedicalReport } from "./cabinetTypes";
import { DEFAULT_DOCUMENT_SETTINGS, IMAGING_MODALITY_LABELS } from "./cabinetTypes";
import { printHtmlDocument } from "./printDoc";
import {
  DOC_DEFAULT_MARGINS, designForKind, resolveMargins, resolvePageSize,
  pageRule, backgroundHtml, blockStyle, blockHidden, logoHtml,
  typographyCss, brandFooterHtml,
} from "./docDesign";

// Printer for medical reports: an imaging compte rendu (échographie / radio / IRM)
// or a free-form rapport médical. Prints through the shared letterhead pipeline
// (docDesign) like the other documents, so the doctor's entête / logo / margins /
// pre-printed-paper settings all apply. Printed text is French, like every doc.

function esc(s: string | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Keep the doctor's line breaks in prose sections.
function prose(s: string | undefined): string {
  return esc(s).replace(/\n/g, "<br/>");
}

/** Display title for a report (explicit title, else modality/kind default). */
export function reportTitle(r: MedicalReport): string {
  if (r.title && r.title.trim()) return r.title.trim();
  if (r.kind === "imaging") return r.modality ? IMAGING_MODALITY_LABELS[r.modality] : "Compte rendu d'imagerie";
  return "Rapport médical";
}

export function printMedicalReport(opts: {
  report:        MedicalReport;
  doctorProfile: CabinetDoctorProfile;
}): void {
  const { report: r, doctorProfile: doc } = opts;
  const kind = r.kind === "imaging" ? "compteRendu" : "rapportMedical";
  const ds = { ...DEFAULT_DOCUMENT_SETTINGS, ...(doc.documentSettings ?? {}) };
  const letterhead = ds.layout === "letterhead";
  const design  = designForKind(doc.documentSettings, kind);
  const margins = resolveMargins(design, DOC_DEFAULT_MARGINS[kind]);
  const bs = (key: string) => blockStyle(design, key, margins);

  const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const cityPart = doc.address ? doc.address.split(",").pop()?.trim() ?? "" : "";
  const title = reportTitle(r);

  const section = (label: string, val?: string, concl = false) =>
    val && val.trim()
      ? `<div class="cr-sec${concl ? " cr-concl" : ""}"><div class="cr-sec-h">${esc(label)}</div><div class="cr-sec-b">${prose(val)}</div></div>`
      : "";

  let bodyHtml: string;
  if (r.kind === "imaging") {
    bodyHtml =
      section("Renseignements cliniques", r.indication) +
      section("Technique", r.technique) +
      section("Résultat", r.findings) +
      section("Conclusion", r.conclusion, true);
  } else {
    bodyHtml = `<div class="cr-sec-b">${prose(r.body)}</div>`;
  }
  if (!bodyHtml.trim()) bodyHtml = '<div style="color:#aaa;font-style:italic">(document vide)</div>';

  const modalityLine = r.kind === "imaging" && r.modality
    ? `<div class="cr-modality">${esc(IMAGING_MODALITY_LABELS[r.modality])}</div>` : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(title)} — ${esc(r.patientName)}</title>
  <style>
    ${pageRule(resolvePageSize(design, "A4").css, margins)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11.5pt; color: #111; background: #fff; position: relative; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; border-bottom: 2px solid var(--doc-accent,#0A4E7E); margin-bottom: 14px; }
    .doc-name { font-size: 14pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); margin-bottom: 3px; }
    .doc-meta { font-size: 8.5pt; color: #444; line-height: 1.7; }
    .date-bloc { text-align: right; font-size: 9pt; color: #333; line-height: 1.7; }
    .title { text-align: center; font-size: 14pt; font-weight: bold; color: var(--doc-accent,#0A4E7E);
      letter-spacing: 1px; text-transform: uppercase; margin: 6px 0 2px; }
    .cr-modality { text-align: center; font-size: 10pt; color: #555; margin-bottom: 12px; }
    .patient-line { margin-bottom: 14px; font-size: 10.5pt; border-left: 3px solid var(--doc-accent,#0A4E7E); padding-left: 8px; }
    .cr-sec { margin-bottom: 13px; break-inside: avoid; }
    .cr-sec-h { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: .5px;
      color: var(--doc-accent,#0A4E7E); border-bottom: 1px solid #C8DFF0; padding-bottom: 3px; margin-bottom: 5px; }
    .cr-sec-b { font-size: 11pt; line-height: 1.6; text-align: justify; }
    .cr-concl .cr-sec-b { font-weight: bold; }
    .sig-area { margin-top: 26px; text-align: right; padding-top: 10px; }
    .sig-label { font-size: 9pt; color: #555; margin-bottom: 34px; }
    .sig-line { border-top: 1px solid #999; width: 150px; margin-left: auto; padding-top: 3px; font-size: 8pt; color: #888; }
    .footer { margin-top: 14px; border-top: 1px dashed #ccc; padding-top: 6px;
      font-size: 7.5pt; color: #999; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  ${typographyCss(ds)}</style>
</head>
<body>
  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <div class="header" style="${letterhead ? "border:none;padding-top:28mm;" : ""}${blockHidden(design, "header") ? "display:none;" : ""}">
    ${letterhead || blockHidden(design, "header") ? `<div></div>` : `<div style="${bs("header")}">
      <div class="doc-name">${esc(doc.fullName || "Dr.")}</div>
      <div class="doc-meta">
        ${doc.specialtyLabel ? esc(doc.specialtyLabel) + "<br/>" : ""}
        ${doc.address        ? esc(doc.address)        + "<br/>" : ""}
        ${doc.phone          ? "Tél : " + esc(doc.phone) + "<br/>" : ""}
        ${doc.ordre          ? "N° Ordre : " + esc(doc.ordre) + "<br/>" : ""}
        ${ds.showInpe && doc.inpe ? "INPE : " + esc(doc.inpe) : ""}
      </div>
    </div>`}
    <div class="date-bloc">${cityPart ? esc(cityPart) + ", " : ""}le ${dateLabel}</div>
  </div>

  <div class="title">${esc(title)}</div>
  ${modalityLine}

  <div class="patient-line"><strong>${esc(r.patientName)}</strong></div>

  <div>${bodyHtml}</div>

  <div class="sig-area">
    <div class="sig-label">Signature et cachet du médecin :</div>
    <div class="sig-line">${esc(doc.fullName || "")}</div>
  </div>

  <div class="footer" style="${bs("footer")}">
    ${ds.footerNote ? esc(ds.footerNote) : "Document médical"}
  </div>
${brandFooterHtml()}</body>
</html>`;

  printHtmlDocument(html);
}
