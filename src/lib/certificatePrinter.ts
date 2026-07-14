import type { CabinetDoctorProfile } from "./cabinetTypes";
import {
  DOC_DEFAULT_MARGINS, designForKind, resolveMargins, resolvePageSize,
  pageRule, backgroundHtml, blockStyle, logoHtml,
  typographyCss, brandFooterHtml,
} from "./docDesign";

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function popup(html: string): void {
  const win = window.open("", "_blank", "width=700,height=920");
  if (!win) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
}

// ── Shared CSS ────────────────────────────────────────────────────────────────

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.65; position: relative; }

  /* Header */
  .cert-hdr {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 8px;
  }
  .cert-doc-name { font-size: 12pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); margin-bottom: 3px; }
  .cert-doc-meta { font-size: 8.5pt; color: #444; line-height: 1.6; }
  .cert-logo {
    width: 36px; height: 36px; border-radius: 8px;
    background: var(--doc-accent,#0A4E7E); color: #fff; display: flex; align-items: center;
    justify-content: center; font-size: 18pt; font-weight: 900; font-family: Georgia, serif;
    flex-shrink: 0;
  }
  .cert-rule { border: none; border-top: 2px solid var(--doc-accent,#0A4E7E); margin: 8px 0 16px; }

  /* Title */
  .cert-title {
    text-align: center; font-size: 13pt; font-weight: 800; color: var(--doc-accent,#0A4E7E);
    letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 6px;
  }
  .cert-subtitle {
    text-align: center; font-size: 8.5pt; color: #666; font-style: italic;
    margin-bottom: 16px;
  }

  /* Body */
  .cert-body { font-size: 10.5pt; line-height: 1.7; }
  .cert-body p { margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; }
  .cert-patient { font-weight: bold; text-decoration: underline; }

  /* Arrêt de travail box */
  .cert-at-box {
    margin: 14px 0; padding: 10px 14px; text-align: center;
    border: 1.5px solid var(--doc-accent,#0A4E7E); border-radius: 6px; background: #EFF6FB;
  }
  .cert-at-duration { font-size: 13pt; font-weight: 800; color: var(--doc-accent,#0A4E7E); }
  .cert-at-dates    { font-size: 9pt; color: #444; margin-top: 3px; }
  .cert-diag        { font-style: italic; color: #555; margin: 8px 0; }

  /* Orientation "to" block */
  .cert-ori-to {
    background: #EFF6FB; border-left: 3px solid var(--doc-accent,#0A4E7E);
    padding: 8px 12px; margin: 12px 0; border-radius: 0 5px 5px 0;
  }
  .cert-ori-to-label { font-size: 7.5pt; font-weight: 700; color: var(--doc-accent,#0A4E7E); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
  .cert-ori-specialist { font-size: 11pt; font-weight: 800; color: var(--doc-accent,#0A4E7E); }

  /* Footer */
  .cert-footer {
    margin-top: 22px; display: flex; justify-content: space-between; align-items: flex-end;
  }
  .cert-city-date { font-size: 9pt; color: #444; }
  .cert-sig-block { text-align: center; }
  .cert-sig-label { font-size: 8.5pt; color: #666; margin-bottom: 6px; }
  .cert-sig-box   { width: 130px; height: 60px; border: 1px solid #aaa; border-radius: 4px; margin: 0 auto 5px; }
  .cert-sig-name  { font-size: 9pt; color: #333; }

  /* Legal footer */
  .cert-legal {
    margin-top: 14px; font-size: 7pt; color: #aaa; text-align: center;
    border-top: 1px solid #ddd; padding-top: 5px;
  }

  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
`;

// ── Shared fragments ──────────────────────────────────────────────────────────

function hdr(doc: CabinetDoctorProfile): string {
  return `
  <div class="cert-hdr">
    <div>
      <div class="cert-doc-name">${esc(doc.fullName || "Cabinet médical")}</div>
      <div class="cert-doc-meta">
        ${doc.specialtyLabel ? esc(doc.specialtyLabel) + "<br/>" : ""}
        ${doc.ordre          ? "N° Ordre : " + esc(doc.ordre) + "<br/>" : ""}
        ${doc.inpe           ? "INPE : " + esc(doc.inpe) + "<br/>" : ""}
        ${doc.address        ? esc(doc.address) + "<br/>"           : ""}
        ${doc.phone          ? "Tél : " + esc(doc.phone)            : ""}
      </div>
    </div>
  </div>
  <hr class="cert-rule"/>`;
}

function footer(doc: CabinetDoctorProfile): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  return `
  <div class="cert-footer">
    <div class="cert-city-date">Fait le ${today}</div>
    <div class="cert-sig-block">
      <div class="cert-sig-label">Signature et cachet</div>
      <div class="cert-sig-box"></div>
      <div class="cert-sig-name">${esc(doc.fullName || "")}</div>
    </div>
  </div>`;
}

function wrap(title: string, body: string, legalNote: string, doc: CabinetDoctorProfile): string {
  // Doctor-defined page design (margins / block positions / logo / letterhead).
  const design  = designForKind(doc.documentSettings, "certificate");
  const margins = resolveMargins(design, DOC_DEFAULT_MARGINS.certificate);
  const bs = (key: string) => blockStyle(design, key, margins);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(title)}</title>
  <style>${pageRule(resolvePageSize(design, "A5").css, margins)}${BASE_CSS}${typographyCss(doc.documentSettings)}</style>
</head>
<body>
  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <div style="${bs("header")}">${hdr(doc)}</div>
  <div class="cert-content" style="${bs("body")}">${body}</div>
  <div style="${bs("signature")}">${footer(doc)}</div>
  <div class="cert-legal" style="${bs("footer")}">${esc(legalNote)}</div>
  <script>window.onload=function(){window.print();};<\/script>
${brandFooterHtml(doc.documentSettings)}</body>
</html>`;
}

// ── Certificat médical ────────────────────────────────────────────────────────

export interface CertMedicalOpts {
  patientName:   string;
  apptDate:      string;
  content?:      string;
  doctorProfile: CabinetDoctorProfile;
}

export function printCertificatMedical(opts: CertMedicalOpts): void {
  const { patientName, apptDate, content, doctorProfile: doc } = opts;
  const body = `
    <div class="cert-title">Certificat Médical</div>
    <div class="cert-body">
      <p>
        Je soussigné(e), <strong>${esc(doc.fullName || "le médecin soussigné")}</strong>${doc.specialtyLabel ? ", " + esc(doc.specialtyLabel) : ""},
        certifie avoir examiné :
      </p>
      <p style="margin:12px 0;font-size:12pt;">
        <span class="cert-patient">${esc(patientName)}</span>
      </p>
      <p>Consulté(e) le <strong>${fmtDate(apptDate)}</strong>.</p>
      ${content ? `<p style="margin-top:14px;white-space:pre-wrap;">${esc(content)}</p>` : ""}
      <p style="margin-top:16px;">
        Ce certificat est délivré à la demande de l'intéressé(e)
        pour servir et valoir ce que de droit.
      </p>
    </div>`;
  popup(wrap(`Certificat Médical — ${patientName}`, body,
    "Document médical confidentiel — usage exclusif prévu", doc));
}

// ── Arrêt de travail ──────────────────────────────────────────────────────────

export interface CertArretOpts {
  patientName:   string;
  dateFrom:      string;
  dateTo:        string;
  diagnosis?:    string;
  doctorProfile: CabinetDoctorProfile;
}

export function printArretTravail(opts: CertArretOpts): void {
  const { patientName, dateFrom, dateTo, diagnosis, doctorProfile: doc } = opts;
  const days = Math.max(1,
    Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1,
  );
  const body = `
    <div class="cert-title">Arrêt de Travail</div>
    <div class="cert-subtitle">Certificat médical d'incapacité temporaire de travail</div>
    <div class="cert-body">
      <p>
        Je soussigné(e), <strong>${esc(doc.fullName || "le médecin soussigné")}</strong>${doc.specialtyLabel ? ", " + esc(doc.specialtyLabel) : ""},
        certifie que l'état de santé de :
      </p>
      <p style="margin:10px 0;font-size:12pt;">
        <span class="cert-patient">${esc(patientName)}</span>
      </p>
      <p>nécessite un arrêt de travail pour raison médicale.</p>
      <div class="cert-at-box">
        <div class="cert-at-duration">${days} jour${days > 1 ? "s" : ""} d'arrêt de travail</div>
        <div class="cert-at-dates">Du ${fmtDate(dateFrom)} au ${fmtDate(dateTo)} inclus</div>
      </div>
      ${diagnosis ? `<p class="cert-diag">Diagnostic : ${esc(diagnosis)}</p>` : ""}
      <p>Tout renouvellement devra faire l'objet d'une nouvelle consultation médicale.</p>
    </div>`;
  popup(wrap(`Arrêt de travail — ${patientName}`, body,
    "À remettre à l'employeur et/ou à la CNSS — Document médical confidentiel", doc));
}

// ── Lettre d'orientation ──────────────────────────────────────────────────────

export interface CertOrientationOpts {
  patientName:      string;
  apptDate:         string;
  specialist:       string;
  reason:           string;
  clinicalSummary?: string;
  doctorProfile:    CabinetDoctorProfile;
}

// ── Certificat d'aptitude ─────────────────────────────────────────────────────

export interface CertAptitudeOpts {
  patientName:   string;
  apptDate:      string;
  purpose?:      string;
  doctorProfile: CabinetDoctorProfile;
}

export function printAptitude(opts: CertAptitudeOpts): void {
  const { patientName, apptDate, purpose, doctorProfile: doc } = opts;
  const body = `
    <div class="cert-title">Certificat d'Aptitude Médicale</div>
    <div class="cert-body">
      <p>
        Je soussigné(e), <strong>${esc(doc.fullName || "le médecin soussigné")}</strong>${doc.specialtyLabel ? ", " + esc(doc.specialtyLabel) : ""},
        certifie avoir examiné ce jour :
      </p>
      <p style="margin:12px 0;font-size:12pt;">
        <span class="cert-patient">${esc(patientName)}</span>
      </p>
      <p>Consulté(e) le <strong>${fmtDate(apptDate)}</strong>.</p>
      <p style="margin-top:14px;">
        ${purpose
          ? `À l'issue de cet examen, je certifie que <strong>${esc(patientName)}</strong> est <strong>${esc(purpose)}</strong>.`
          : `À l'issue de cet examen, je certifie l'aptitude de <strong>${esc(patientName)}</strong> à l'activité concernée.`
        }
      </p>
      <p style="margin-top:12px;">
        Ce certificat est délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit.
      </p>
    </div>`;
  popup(wrap(`Certificat d'aptitude — ${patientName}`, body,
    "Document médical confidentiel — usage exclusif prévu", doc));
}

// ── Attestation de présence ───────────────────────────────────────────────────

export interface CertPresenceOpts {
  patientName:   string;
  dateFrom:      string;
  dateTo:        string;
  notes?:        string;
  doctorProfile: CabinetDoctorProfile;
}

export function printPresence(opts: CertPresenceOpts): void {
  const { patientName, dateFrom, dateTo, notes, doctorProfile: doc } = opts;
  const sameDay = dateFrom === dateTo;
  const body = `
    <div class="cert-title">Attestation de Présence</div>
    <div class="cert-body">
      <p>
        Je soussigné(e), <strong>${esc(doc.fullName || "le médecin soussigné")}</strong>${doc.specialtyLabel ? ", " + esc(doc.specialtyLabel) : ""},
        atteste la présence de :
      </p>
      <p style="margin:12px 0;font-size:12pt;">
        <span class="cert-patient">${esc(patientName)}</span>
      </p>
      <div class="cert-at-box">
        ${sameDay
          ? `<div class="cert-at-duration">Le ${fmtDate(dateFrom)}</div>`
          : `<div class="cert-at-duration">Du ${fmtDate(dateFrom)} au ${fmtDate(dateTo)}</div>`
        }
      </div>
      ${notes ? `<p class="cert-diag">${esc(notes)}</p>` : ""}
      <p style="margin-top:14px;">
        Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.
      </p>
    </div>`;
  popup(wrap(`Attestation de présence — ${patientName}`, body,
    "Document médical confidentiel", doc));
}

// ── Lettre d'orientation ──────────────────────────────────────────────────────

export function printOrientation(opts: CertOrientationOpts): void {
  const { patientName, apptDate, specialist, reason, clinicalSummary, doctorProfile: doc } = opts;
  const body = `
    <div class="cert-title">Lettre d'Orientation Médicale</div>
    <div class="cert-body">
      <div class="cert-ori-to">
        <div class="cert-ori-to-label">À l'attention de</div>
        <div class="cert-ori-specialist">${esc(specialist)}</div>
      </div>
      <p>Cher(e) Confrère / Consœur,</p>
      <p style="margin-top:10px;">
        J'ai l'honneur de vous adresser mon patient(e)&nbsp;:
        <span class="cert-patient">&nbsp;${esc(patientName)}</span>,
        consulté(e) le <strong>${fmtDate(apptDate)}</strong>.
      </p>
      ${reason ? `<p style="margin-top:10px;"><strong>Motif d'orientation :</strong> ${esc(reason)}</p>` : ""}
      ${clinicalSummary ? `
      <p style="margin-top:10px;">
        <strong>Résumé clinique :</strong><br/>
        <span style="color:#333;">${esc(clinicalSummary)}</span>
      </p>` : ""}
      <p style="margin-top:14px;">
        En vous remerciant de l'attention portée à ce(tte) patient(e),
        je reste disponible pour tout renseignement complémentaire.
      </p>
      <p style="margin-top:8px;">Confraternellement,</p>
    </div>`;
  popup(wrap(`Lettre d'orientation — ${patientName}`, body,
    "Lettre médicale confidentielle", doc));
}
