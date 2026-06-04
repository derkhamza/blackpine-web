import type { OrdonnanceLine, CabinetDoctorProfile } from "./cabinetTypes";

// ── Common drug suggestions (datalist) ───────────────────────────────────────

export const COMMON_DRUGS: string[] = [
  "Amoxicilline cp 500 mg",
  "Amoxicilline cp 1 g",
  "Amoxicilline + Acide clavulanique cp 1 g",
  "Azithromycine cp 500 mg",
  "Ciprofloxacine cp 500 mg",
  "Métronidazole cp 500 mg",
  "Paracétamol cp 500 mg",
  "Paracétamol cp 1 g",
  "Ibuprofène cp 200 mg",
  "Ibuprofène cp 400 mg",
  "Diclofénac cp 50 mg",
  "Aspirine cp 500 mg",
  "Oméprazole gél 20 mg",
  "Ranitidine cp 150 mg",
  "Métoclopramide cp 10 mg",
  "Dompéridone cp 10 mg",
  "Loratadine cp 10 mg",
  "Cétirizine cp 10 mg",
  "Prednisolone cp 5 mg",
  "Prednisolone cp 20 mg",
  "Prednisone cp 5 mg",
  "Prednisone cp 20 mg",
  "Salbutamol inhalateur",
  "Budesonide inhalateur",
  "Atenolol cp 50 mg",
  "Amlodipine cp 5 mg",
  "Lisinopril cp 10 mg",
  "Metformine cp 500 mg",
  "Metformine cp 850 mg",
  "Glibenclamide cp 5 mg",
  "Atorvastatine cp 20 mg",
  "Simvastatine cp 20 mg",
];

// ── Common frequencies ────────────────────────────────────────────────────────
export const COMMON_FREQUENCIES: string[] = [
  "1 fois par jour",
  "2 fois par jour",
  "3 fois par jour",
  "4 fois par jour",
  "Matin et soir",
  "Matin, midi et soir",
  "Le soir au coucher",
  "Le matin à jeun",
  "Au besoin (max 3/jour)",
  "Toutes les 8 heures",
  "Toutes les 6 heures",
  "Toutes les 4 heures",
];

// ── Common durations ──────────────────────────────────────────────────────────
export const COMMON_DURATIONS: string[] = [
  "3 jours",
  "5 jours",
  "7 jours",
  "10 jours",
  "14 jours",
  "21 jours",
  "1 mois",
  "2 mois",
  "3 mois",
  "6 mois",
  "À vie",
  "Si besoin",
];

// ── Print ordonnance ──────────────────────────────────────────────────────────

export function printOrdonnance(opts: {
  lines:        OrdonnanceLine[];
  patientName:  string;
  date:         string;           // ISO "YYYY-MM-DD"
  doctorProfile: CabinetDoctorProfile;
}): void {
  const { lines, patientName, date, doctorProfile } = opts;

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const cityPart = doctorProfile.address
    ? doctorProfile.address.split(",").pop()?.trim() ?? ""
    : "";

  const lineHtml = lines.map((l, i) => {
    const doseStr  = l.dosage    ? ` — ${l.dosage}`  : "";
    const notesStr = l.notes     ? `<div class="rx-notes">${l.notes}</div>` : "";
    return `
    <div class="rx-item">
      <div class="rx-num">${i + 1}.</div>
      <div class="rx-body">
        <div class="rx-drug">${l.drug}${doseStr}</div>
        <div class="rx-posol">Prendre ${l.frequency} pendant ${l.duration}.</div>
        ${notesStr}
      </div>
    </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Ordonnance — ${patientName}</title>
  <style>
    @page { size: A5 portrait; margin: 13mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; background: #fff; }

    /* Header */
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; border-bottom: 2px solid #0A4E7E; margin-bottom: 12px;
    }
    .doc-name  { font-size: 13.5pt; font-weight: bold; color: #0A4E7E; margin-bottom: 3px; }
    .doc-meta  { font-size: 8.5pt; color: #444; line-height: 1.7; }
    .date-bloc { text-align: right; font-size: 9pt; color: #333; line-height: 1.7; }

    /* Patient */
    .patient-line {
      margin-bottom: 12px; font-size: 10pt;
      border-left: 3px solid #0A4E7E; padding-left: 8px;
    }

    /* Rx symbol */
    .rx-symbol { font-size: 32pt; color: #0A4E7E; font-style: italic; margin-bottom: 10px; line-height: 1; }

    /* Medication items */
    .rx-list { display: flex; flex-direction: column; gap: 10px; min-height: 90mm; }
    .rx-item { display: flex; gap: 8px; }
    .rx-num  { font-size: 10pt; font-weight: bold; color: #0A4E7E; width: 18px; flex-shrink: 0; padding-top: 1px; }
    .rx-body { flex: 1; }
    .rx-drug { font-size: 11pt; font-weight: bold; text-transform: uppercase; }
    .rx-posol { font-size: 9.5pt; color: #333; margin-top: 2px; font-style: italic; }
    .rx-notes { font-size: 8.5pt; color: #666; margin-top: 1px; }

    /* Signature */
    .sig-area {
      margin-top: 14px; text-align: right;
      padding-top: 10px; border-top: 1px solid #ddd;
    }
    .sig-label { font-size: 9pt; color: #555; margin-bottom: 30px; }
    .sig-line  { border-top: 1px solid #999; width: 120px; margin-left: auto; padding-top: 3px; font-size: 8pt; color: #888; }

    /* Footer */
    .footer { margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 6px;
              font-size: 7.5pt; color: #999; text-align: center; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="doc-name">${doctorProfile.fullName || "Dr."}</div>
      <div class="doc-meta">
        ${doctorProfile.specialtyLabel ? doctorProfile.specialtyLabel + "<br/>" : ""}
        ${doctorProfile.address        ? doctorProfile.address        + "<br/>" : ""}
        ${doctorProfile.phone          ? "Tél : " + doctorProfile.phone + "<br/>" : ""}
        ${doctorProfile.inpe           ? "INPE : " + doctorProfile.inpe          : ""}
      </div>
    </div>
    <div class="date-bloc">
      ${cityPart ? cityPart + "<br/>" : ""}Le ${dateLabel}
    </div>
  </div>

  <div class="patient-line">
    Patient(e) : <strong>${patientName}</strong>
  </div>

  <div class="rx-symbol">℞</div>

  <div class="rx-list">
    ${lines.length > 0 ? lineHtml : '<div style="color:#aaa;font-style:italic">(aucune prescription)</div>'}
  </div>

  <div class="sig-area">
    <div class="sig-label">Signature et cachet du médecin :</div>
    <div class="sig-line">Lu et approuvé</div>
  </div>

  <div class="footer">
    Ordonnance médicale — Valable 1 mois · Document confidentiel
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
}
