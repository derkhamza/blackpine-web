import type {
  Patient, Appointment, CabinetDoctorProfile,
  Prescription, ExamResult, Certificate,
} from "./cabinetTypes";
import {
  apptTypeLabel, EXAM_TYPE_LABELS, CERT_TYPE_LABELS,
} from "./cabinetTypes";
import { calcAge } from "./format";
import { fullName as fmtFullName } from "./nameFormat";
import {
  DOC_DEFAULT_MARGINS, designForKind, resolveMargins, resolvePageSize,
  pageRule, backgroundHtml, blockStyle, logoHtml,
} from "./docDesign";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", opts ?? {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
function ageLabel(dob?: string): string {
  const y = calcAge(dob);
  return y == null ? "—" : `${y} ans`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Vitals summary ────────────────────────────────────────────────────────────

function latestVitals(appts: Appointment[]): string {
  const withVitals = [...appts]
    .filter(a => a.vitalSigns && Object.values(a.vitalSigns).some(v => v != null))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (withVitals.length === 0) return "";
  const vs = withVitals[0].vitalSigns!;
  const date = fmtDate(withVitals[0].date);
  const parts: string[] = [];
  if (vs.bpSys != null && vs.bpDia != null) parts.push(`TA ${vs.bpSys}/${vs.bpDia} mmHg`);
  if (vs.hr     != null) parts.push(`FC ${vs.hr} bpm`);
  if (vs.temp   != null) parts.push(`T° ${vs.temp} °C`);
  if (vs.spo2   != null) parts.push(`SpO₂ ${vs.spo2}%`);
  if (vs.weight != null) parts.push(`Poids ${vs.weight} kg`);
  if (vs.height != null) parts.push(`Taille ${vs.height} cm`);
  return parts.length > 0
    ? `<div class="vs-line"><strong>Dernières constantes (${date})</strong> : ${parts.join(" · ")}</div>`
    : "";
}

// ── Ordonnances from appointments ─────────────────────────────────────────────

function activeOrdonnances(appts: Appointment[]): string {
  const withOrd = [...appts]
    .filter(a => a.savedOrdonnance && a.savedOrdonnance.lines.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (withOrd.length === 0) return "";
  const latest = withOrd[0];
  const date   = fmtDate(latest.date);
  const lines  = latest.savedOrdonnance!.lines
    .map((l, i) => `
      <tr>
        <td class="ord-n">${i + 1}.</td>
        <td><strong>${escHtml(l.drug)}</strong>${l.dosage ? " — " + escHtml(l.dosage) : ""}</td>
        <td>${escHtml(l.frequency)}</td>
        <td>${escHtml(l.duration)}</td>
      </tr>`)
    .join("");
  return `
    <div class="section-block">
      <div class="section-title">Dernière ordonnance (consultation) <span class="date-chip">${date}</span></div>
      <table class="ord-table">
        <thead><tr><th></th><th>Médicament</th><th>Fréquence</th><th>Durée</th></tr></thead>
        <tbody>${lines}</tbody>
      </table>
    </div>`;
}

// ── Standalone prescriptions ──────────────────────────────────────────────────

function standalonePrescriptionsSection(prescriptions: Prescription[]): string {
  if (prescriptions.length === 0) return "";
  const sorted = [...prescriptions].sort((a, b) => b.date.localeCompare(a.date));
  const items = sorted.map(p => {
    const rows = (p.lines ?? []).map((l, i) => `
      <tr>
        <td class="ord-n">${i + 1}.</td>
        <td><strong>${escHtml(l.drug)}</strong>${l.dosage ? " — " + escHtml(l.dosage) : ""}</td>
        <td>${escHtml(l.frequency)}</td>
        <td>${escHtml(l.duration)}</td>
      </tr>`).join("");
    return `
      <div class="rx-block">
        <div class="rx-header">
          <span class="rx-tag">℞</span>
          <span class="rx-date">${fmtDate(p.date)}</span>
          ${p.notes ? `<span class="rx-notes">${escHtml(p.notes)}</span>` : ""}
        </div>
        <table class="ord-table">
          <thead><tr><th></th><th>Médicament</th><th>Fréquence</th><th>Durée</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");
  return `
    <div class="section-block">
      <div class="section-title">Ordonnances <span class="date-chip">${sorted.length} ordonnance${sorted.length > 1 ? "s" : ""}</span></div>
      ${items}
    </div>`;
}

// ── Exam results ──────────────────────────────────────────────────────────────

function examResultsSection(examResults: ExamResult[]): string {
  if (examResults.length === 0) return "";
  const sorted = [...examResults].sort((a, b) => b.date.localeCompare(a.date));
  const rows = sorted.map(e => {
    const abnormal = e.values.filter(v => v.isAbnormal).length;
    const valSummary = e.values.length > 0
      ? e.values.slice(0, 4).map(v =>
          `${escHtml(v.label)}: <strong${v.isAbnormal ? ' class="val-abnormal"' : ""}>${escHtml(v.value)}</strong>${v.unit ? " " + escHtml(v.unit) : ""}`
        ).join(", ") + (e.values.length > 4 ? `, <em>+${e.values.length - 4} autres</em>` : "")
      : (e.notes ? escHtml(e.notes.slice(0, 120)) : "—");
    const abnormalBadge = abnormal > 0
      ? `<span class="badge-abnormal">⚠ ${abnormal} anormal${abnormal > 1 ? "es" : "e"}</span>`
      : "";
    return `
    <tr>
      <td class="no-wrap">${fmtDate(e.date)}</td>
      <td><span class="exam-type-label">${EXAM_TYPE_LABELS[e.type] ?? e.type}</span></td>
      <td><strong>${escHtml(e.title)}</strong>${e.labName ? `<br/><small>${escHtml(e.labName)}</small>` : ""}</td>
      <td class="exam-values">${valSummary} ${abnormalBadge}</td>
    </tr>`;
  }).join("");
  return `
    <div class="section-block">
      <div class="section-title">Examens complémentaires <span class="date-chip">${sorted.length} résultat${sorted.length > 1 ? "s" : ""}</span></div>
      <table class="consult-table">
        <thead>
          <tr>
            <th>Date</th><th>Type</th><th>Examen / Labo</th><th>Résultats</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Certificates ──────────────────────────────────────────────────────────────

function certificatesSection(certificates: Certificate[]): string {
  if (certificates.length === 0) return "";
  const sorted = [...certificates].sort((a, b) => b.date.localeCompare(a.date));
  const rows = sorted.map(c => {
    let detail = "";
    if (c.type === "arret_travail") {
      const parts: string[] = [];
      if (c.dateFrom) parts.push(`du ${fmtDate(c.dateFrom)}`);
      if (c.dateTo)   parts.push(`au ${fmtDate(c.dateTo)}`);
      if (c.duration) parts.push(`(${c.duration} j)`);
      detail = parts.join(" ");
      if (c.content) detail += `<br/><em>${escHtml(c.content.slice(0, 120))}</em>`;
    } else if (c.type === "orientation") {
      const parts: string[] = [];
      if (c.specialist) parts.push(`→ ${escHtml(c.specialist)}`);
      if (c.reason)     parts.push(escHtml(c.reason.slice(0, 80)));
      detail = parts.join(" · ");
      if (c.clinicalSummary) detail += `<br/><em>${escHtml(c.clinicalSummary.slice(0, 120))}</em>`;
    } else {
      if (c.content) detail = escHtml(c.content.slice(0, 160));
    }
    return `
    <tr>
      <td class="no-wrap">${fmtDate(c.date)}</td>
      <td><span class="cert-type-label">${CERT_TYPE_LABELS[c.type] ?? c.type}</span></td>
      <td class="note-cell">${detail || "—"}</td>
    </tr>`;
  }).join("");
  return `
    <div class="section-block">
      <div class="section-title">Certificats &amp; courriers <span class="date-chip">${sorted.length} document${sorted.length > 1 ? "s" : ""}</span></div>
      <table class="consult-table">
        <thead>
          <tr><th>Date</th><th>Type</th><th>Détails</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function printPatientReport(opts: {
  patient:         Patient;
  appointments:    Appointment[];
  doctorProfile:   CabinetDoctorProfile;
  prescriptions?:  Prescription[];
  examResults?:    ExamResult[];
  certificates?:   Certificate[];
}): void {
  const {
    patient, appointments, doctorProfile,
    prescriptions  = [],
    examResults    = [],
    certificates   = [],
  } = opts;
  const fullName = fmtFullName(patient);

  // Sort appointments newest-first
  const patientAppts = [...appointments]
    .filter(a => a.patientId === patient.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const printDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Build consultation rows (last 25)
  const consultRows = patientAppts.slice(0, 25).map(a => {
    const hasNote = a.consultationNote?.diagnosis || a.consultationNote?.motif;
    const noteText = (a.consultationNote?.diagnosis ?? a.consultationNote?.motif ?? "").slice(0, 80);
    const billedCell = a.billedAmount ? `${a.billedAmount.toLocaleString("fr-MA")} MAD` : "—";
    const statusClass = a.status === "completed" ? "status-ok"
      : a.status === "cancelled" || a.status === "no_show" ? "status-cancel"
      : "status-pending";
    return `
    <tr>
      <td class="no-wrap">${fmtDate(a.date)}</td>
      <td>${apptTypeLabel(a.type)}</td>
      <td><span class="${statusClass}">${a.status === "completed" ? "Terminé" : a.status === "cancelled" ? "Annulé" : a.status === "no_show" ? "Absent" : "Planifié"}</span></td>
      <td class="note-cell">${hasNote ? escHtml(noteText) + (noteText.length >= 80 ? "…" : "") : "—"}</td>
      <td class="amount-cell">${billedCell}</td>
    </tr>`;
  }).join("");

  // Doctor-defined page design. The report is a flowing multi-page dossier, so
  // only margins / paper / logo / letterhead + header/footer show-hide apply
  // (blockStyle never positions absolutely here — no section carries x/y).
  const design  = designForKind(doctorProfile.documentSettings, "report");
  const margins = resolveMargins(design, DOC_DEFAULT_MARGINS.report);
  const bs = (key: string) => blockStyle(design, key, margins);

  const alertHtml = patient.allergies ? `
    <div class="allergy-alert">
      <div class="alert-icon">⚠</div>
      <div><strong>Allergies :</strong> ${escHtml(patient.allergies)}</div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Dossier — ${escHtml(fullName)}</title>
  <style>
    ${pageRule(resolvePageSize(design, "A4").css, margins)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; position: relative; }

    /* Header */
    .hdr { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #0A4E7E; padding-bottom: 10px; margin-bottom: 12px; }
    .doc-name { font-size: 13pt; font-weight: bold; color: #0A4E7E; margin-bottom: 3px; }
    .doc-meta { font-size: 8.5pt; color: #444; line-height: 1.65; }
    .print-date { font-size: 8.5pt; color: #555; text-align: right; padding-top: 4px; }

    /* Patient band */
    .patient-band {
      background: #F0F7FD; border-radius: 8px; padding: 10px 14px;
      margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;
    }
    .patient-name { font-size: 16pt; font-weight: bold; color: #0A4E7E; }
    .patient-meta { font-size: 9pt; color: #444; margin-top: 3px; }
    .patient-badge {
      display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9pt;
      font-weight: 700; margin-right: 5px; margin-top: 2px;
    }
    .badge-blood { background: #fde8e8; color: #c0392b; }
    .badge-cnops { background: #f0e8ff; color: #6b46c1; }

    /* Allergy alert */
    .allergy-alert {
      display: flex; align-items: flex-start; gap: 10px;
      background: #fde8e8; border: 1.5px solid #e74c3c; border-radius: 6px;
      padding: 8px 12px; margin-bottom: 12px; font-size: 10pt;
    }
    .alert-icon { font-size: 14pt; line-height: 1; flex-shrink: 0; }

    /* Sections */
    .section-block { margin-bottom: 14px; }
    .section-title {
      font-size: 10pt; font-weight: 700; color: #0A4E7E; margin-bottom: 6px;
      border-bottom: 1px solid #c8dff0; padding-bottom: 3px;
      break-after: avoid; page-break-after: avoid;   /* keep heading with its content */
    }
    .date-chip {
      font-weight: normal; font-size: 8.5pt; color: #666;
      background: #e8f2fa; border-radius: 10px; padding: 1px 6px; margin-left: 6px;
    }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .info-cell { background: #f7fafd; border: 1px solid #d0dde9; border-radius: 5px; padding: 7px 10px; }
    .info-lbl { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #0A4E7E; margin-bottom: 2px; }
    .info-val { font-size: 9.5pt; white-space: pre-wrap; }

    /* Vitals */
    .vs-line { font-size: 9.5pt; margin-bottom: 8px; color: #222; }

    /* Shared table style */
    table.consult-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 6px; }
    .consult-table thead { display: table-header-group; }
    .consult-table tbody tr, .consult-table tr { break-inside: avoid; page-break-inside: avoid; }
    .consult-table th {
      background: #0A4E7E; color: #fff; padding: 5px 8px; text-align: left;
      font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .consult-table td { padding: 5px 8px; border-bottom: 1px solid #e5eef5; vertical-align: top; }
    .consult-table tr:nth-child(even) td { background: #f7fafd; }
    .status-ok     { color: #15a876; font-weight: 600; }
    .status-cancel { color: #e85b5b; font-weight: 600; }
    .status-pending { color: #d4962a; }
    .note-cell { color: #444; font-style: italic; max-width: 220px; }
    .amount-cell { text-align: right; white-space: nowrap; }
    .no-wrap { white-space: nowrap; }

    /* Ordonnance table */
    table.ord-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 4px; }
    .ord-table th { background: #EFF6FB; color: #0A4E7E; padding: 4px 8px; font-size: 8pt; text-align: left; }
    .ord-table td { padding: 4px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    .ord-n { color: #0A4E7E; font-weight: 700; width: 18px; }

    /* Standalone Rx blocks */
    .rx-block { margin-bottom: 10px; }
    .rx-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .rx-tag { font-size: 11pt; font-weight: 700; color: #15a876; }
    .rx-date { font-size: 9pt; color: #555; }
    .rx-notes { font-size: 8.5pt; color: #888; font-style: italic; }

    /* Exam values */
    .exam-values { font-size: 8.5pt; color: #333; }
    .val-abnormal { color: #e85b5b; }
    .badge-abnormal { display: inline-block; background: #fde8e8; color: #c0392b;
                      border-radius: 10px; padding: 1px 6px; font-size: 7.5pt; font-weight: 700; margin-left: 4px; }
    .exam-type-label { display: inline-block; background: #EFF6FB; color: #0A4E7E;
                       border-radius: 10px; padding: 1px 6px; font-size: 8pt; font-weight: 600; white-space: nowrap; }
    .cert-type-label { display: inline-block; background: #f0e8ff; color: #6b46c1;
                       border-radius: 10px; padding: 1px 6px; font-size: 8pt; font-weight: 600; white-space: nowrap; }

    /* Footer */
    .footer-row {
      margin-top: 18px; border-top: 1px solid #ddd; padding-top: 10px;
      display: flex; justify-content: space-between; font-size: 8pt; color: #888;
    }
    .sig-area { text-align: right; }
    .sig-lbl { margin-bottom: 28px; font-size: 8.5pt; color: #555; }
    .sig-line { border-top: 1px solid #aaa; width: 120px; padding-top: 3px; font-size: 7.5pt; color: #aaa; margin-left: auto; }

    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <!-- Header -->
  <div class="hdr" style="${bs("header")}">
    <div>
      <div class="doc-name">${escHtml(doctorProfile.fullName || "Cabinet médical")}</div>
      <div class="doc-meta">
        ${doctorProfile.specialtyLabel ? escHtml(doctorProfile.specialtyLabel) + "<br/>" : ""}
        ${doctorProfile.address        ? escHtml(doctorProfile.address)        + "<br/>" : ""}
        ${doctorProfile.phone          ? "Tél : " + escHtml(doctorProfile.phone) + "<br/>" : ""}
        ${doctorProfile.ordre          ? "N° Ordre : " + escHtml(doctorProfile.ordre) + "<br/>" : ""}
        ${doctorProfile.inpe           ? "INPE : " + escHtml(doctorProfile.inpe) : ""}
      </div>
    </div>
    <div class="print-date">
      DOSSIER PATIENT<br/>
      Édité le ${printDate}
    </div>
  </div>

  <!-- Patient band -->
  <div class="patient-band">
    <div>
      <div class="patient-name">${escHtml(fullName)}</div>
      <div class="patient-meta">
        ${patient.gender === "M" ? "Homme · " : patient.gender === "F" ? "Femme · " : ""}
        ${patient.dateOfBirth ? "né(e) le " + fmtDate(patient.dateOfBirth) + " · " + ageLabel(patient.dateOfBirth) : ""}
        ${patient.phone ? " · " + escHtml(patient.phone) : ""}
      </div>
    </div>
    <div>
      ${patient.bloodType  ? `<span class="patient-badge badge-blood">🩸 ${patient.bloodType}</span>`        : ""}
      ${patient.cnopsNumber ? `<span class="patient-badge badge-cnops">AMO ${escHtml(patient.cnopsNumber)}</span>` : ""}
    </div>
  </div>

  <!-- Allergy alert -->
  ${alertHtml}

  <!-- Medical info grid -->
  <div class="info-grid">
    <div class="info-cell">
      <div class="info-lbl">Antécédents médicaux</div>
      <div class="info-val">${patient.antecedents ? escHtml(patient.antecedents) : "—"}</div>
    </div>
    <div class="info-cell">
      <div class="info-lbl">Médicaments en cours</div>
      <div class="info-val">${patient.currentMedications ? escHtml(patient.currentMedications) : "—"}</div>
    </div>
  </div>

  <!-- Latest vitals -->
  ${latestVitals(patientAppts)}

  <!-- Consultation history -->
  ${patientAppts.length > 0 ? `
  <div class="section-block">
    <div class="section-title">
      Historique des consultations
      <span class="date-chip">${patientAppts.length} rendez-vous · ${patientAppts.length > 25 ? "25 derniers affichés" : "tous"}</span>
    </div>
    <table class="consult-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Statut</th>
          <th>Diagnostic / Motif</th>
          <th>Montant</th>
        </tr>
      </thead>
      <tbody>${consultRows}</tbody>
    </table>
  </div>` : ""}

  <!-- Latest ordonnance from appointments -->
  ${activeOrdonnances(patientAppts)}

  <!-- Standalone prescriptions -->
  ${standalonePrescriptionsSection(prescriptions)}

  <!-- Exam results -->
  ${examResultsSection(examResults)}

  <!-- Certificates -->
  ${certificatesSection(certificates)}

  <!-- Notes -->
  ${patient.notes ? `
  <div class="section-block">
    <div class="section-title">Notes libres</div>
    <div style="font-size:9.5pt;color:#444;font-style:italic;">${escHtml(patient.notes)}</div>
  </div>` : ""}

  <!-- Footer -->
  <div class="footer-row" style="${bs("footer")}">
    <div>Dossier confidentiel — usage médical exclusif<br/>${escHtml(fullName)}</div>
    <div class="sig-area">
      <div class="sig-lbl">Signature du médecin :</div>
      <div class="sig-line">Pour copie conforme</div>
    </div>
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
}
