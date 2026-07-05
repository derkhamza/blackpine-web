import type { CabinetDoctorProfile, ExamRequestLine, ExamRequestCategory } from "./cabinetTypes";
import { DEFAULT_DOCUMENT_SETTINGS } from "./cabinetTypes";
import { EXAM_REQ_CATEGORY_LABELS, EXAM_REQ_CATEGORIES } from "./examCatalog";
import {
  DOC_DEFAULT_MARGINS, designForKind, resolveMargins, resolvePageSize,
  pageRule, backgroundHtml, blockStyle, blockHidden, logoHtml,
} from "./docDesign";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printExamRequest(opts: {
  lines:         ExamRequestLine[];
  indication?:   string;
  patientName:   string;
  date:          string;           // ISO "YYYY-MM-DD"
  doctorProfile: CabinetDoctorProfile;
}): void {
  const { lines, indication, patientName, date, doctorProfile: doc } = opts;
  const ds = { ...DEFAULT_DOCUMENT_SETTINGS, ...(doc.documentSettings ?? {}) };
  const letterhead = ds.layout === "letterhead";
  // Doctor-defined page design (margins / block positions / logo / letterhead).
  const design  = designForKind(doc.documentSettings, "examRequest");
  const margins = resolveMargins(design, DOC_DEFAULT_MARGINS.examRequest);
  const bs = (key: string) => blockStyle(design, key, margins);

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const cityPart = doc.address ? doc.address.split(",").pop()?.trim() ?? "" : "";

  // Group requested exams by category, keeping the canonical category order.
  const byCat = new Map<ExamRequestCategory, ExamRequestLine[]>();
  for (const l of lines) {
    if (!l.label.trim()) continue;
    if (!byCat.has(l.category)) byCat.set(l.category, []);
    byCat.get(l.category)!.push(l);
  }
  const groupsHtml = EXAM_REQ_CATEGORIES
    .filter(c => byCat.has(c))
    .map(c => {
      const items = byCat.get(c)!.map(l => `
        <li class="exr-item">
          <span class="exr-label">${esc(l.label)}</span>
          ${l.detail ? `<span class="exr-detail"> — ${esc(l.detail)}</span>` : ""}
        </li>`).join("");
      return `
      <div class="exr-group">
        <div class="exr-cat">${esc(EXAM_REQ_CATEGORY_LABELS[c])}</div>
        <ul class="exr-list">${items}</ul>
      </div>`;
    }).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Demande d'examens — ${esc(patientName)}</title>
  <style>
    ${pageRule(resolvePageSize(design, "A5").css, margins)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; background: #fff; position: relative; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; border-bottom: 2px solid #0A4E7E; margin-bottom: 12px; }
    .doc-name { font-size: 13.5pt; font-weight: bold; color: #0A4E7E; margin-bottom: 3px; }
    .doc-meta { font-size: 8.5pt; color: #444; line-height: 1.7; }
    .date-bloc { text-align: right; font-size: 9pt; color: #333; line-height: 1.7; }
    .title { text-align: center; font-size: 13pt; font-weight: bold; color: #0A4E7E;
      letter-spacing: 1px; text-transform: uppercase; margin: 4px 0 12px; }
    .patient-line { margin-bottom: 10px; font-size: 10pt;
      border-left: 3px solid #0A4E7E; padding-left: 8px; }
    .indication { font-size: 9.5pt; color: #333; margin-bottom: 12px;
      background: #F0F7FD; border-radius: 5px; padding: 8px 10px; }
    .indication strong { color: #0A4E7E; }
    .exr-group { margin-bottom: 12px; break-inside: avoid; }
    .exr-cat { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .5px;
      color: #0A4E7E; border-bottom: 1px solid #C8DFF0; padding-bottom: 3px; margin-bottom: 5px; }
    .exr-list { list-style: none; }
    .exr-item { font-size: 10.5pt; padding: 3px 0 3px 16px; position: relative; }
    .exr-item::before { content: "▪"; position: absolute; left: 2px; color: #0A4E7E; font-size: 8pt; top: 4px; }
    .exr-label { font-weight: bold; }
    .exr-detail { color: #555; font-style: italic; }
    .sig-area { margin-top: 18px; text-align: right; padding-top: 10px; border-top: 1px solid #ddd; }
    .sig-label { font-size: 9pt; color: #555; margin-bottom: 30px; }
    .sig-line { border-top: 1px solid #999; width: 120px; margin-left: auto; padding-top: 3px; font-size: 8pt; color: #888; }
    .footer { margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 6px;
      font-size: 7.5pt; color: #999; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <div class="header" style="${letterhead ? "border:none;padding-top:28mm;" : ""}${blockHidden(design, "header") && blockHidden(design, "date") ? "display:none;" : ""}">
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
    <div class="date-bloc" style="${bs("date")}">${cityPart ? esc(cityPart) + "<br/>" : ""}Le ${dateLabel}</div>
  </div>

  <div class="title">Demande d'examens</div>

  <div class="patient-line" style="${bs("patient")}">Patient(e) : <strong>${esc(patientName)}</strong></div>

  ${indication ? `<div class="indication" style="${bs("indication")}"><strong>Renseignements cliniques :</strong> ${esc(indication)}</div>` : ""}

  <div style="${bs("body")}">${groupsHtml || '<div style="color:#aaa;font-style:italic">(aucun examen demandé)</div>'}</div>

  <div class="sig-area" style="${bs("signature")}">
    <div class="sig-label">Signature et cachet du médecin :</div>
    <div class="sig-line">${esc(doc.fullName || "")}</div>
  </div>

  <div class="footer" style="${bs("footer")}">
    ${ds.footerNote ? esc(ds.footerNote) : "Demande d'examens complémentaires · Document médical"}
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
}
