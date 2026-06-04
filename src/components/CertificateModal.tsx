import { useState } from "react";
import type { Appointment, SavedCertificate, CertificateType, CabinetDoctorProfile } from "../lib/cabinetTypes";
import { printCertificatMedical, printArretTravail, printOrientation } from "../lib/certificatePrinter";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CertificateType, string> = {
  medical:       "Certificat médical",
  arret_travail: "Arrêt de travail",
  orientation:   "Lettre d'orientation",
};
const TYPE_ICONS: Record<CertificateType, string> = {
  medical:       "📋",
  arret_travail: "🏥",
  orientation:   "📩",
};

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.max(1,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1,
  );
}

// ── Reprint helper ────────────────────────────────────────────────────────────

function reprintCert(cert: SavedCertificate, patientName: string, apptDate: string, doc: CabinetDoctorProfile) {
  if (cert.type === "medical") {
    printCertificatMedical({ patientName, apptDate, content: cert.content, doctorProfile: doc });
  } else if (cert.type === "arret_travail" && cert.dateFrom && cert.dateTo) {
    printArretTravail({ patientName, dateFrom: cert.dateFrom, dateTo: cert.dateTo, diagnosis: cert.content, doctorProfile: doc });
  } else if (cert.type === "orientation" && cert.specialist) {
    printOrientation({ patientName, apptDate, specialist: cert.specialist, reason: cert.reason ?? "", clinicalSummary: cert.clinicalSummary, doctorProfile: doc });
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  appt:          Appointment;
  patientName:   string;
  doctorProfile: CabinetDoctorProfile;
  onSave:        (cert: SavedCertificate) => void;
  onClose:       () => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function CertificateModal({ appt, patientName, doctorProfile, onSave, onClose }: Props) {
  const [certType, setCertType] = useState<CertificateType>("medical");

  // ── Certificat médical fields ─────────────────────────────────────────────
  const [medContent, setMedContent] = useState("");

  // ── Arrêt de travail fields ───────────────────────────────────────────────
  const [atFrom, setAtFrom] = useState(appt.date);
  const [atTo,   setAtTo]   = useState(addDays(appt.date, 2));
  const [atDiag, setAtDiag] = useState(appt.consultationNote?.diagnosis ?? "");

  // ── Orientation fields ────────────────────────────────────────────────────
  const [oriSpecialist, setOriSpecialist] = useState("");
  const [oriReason,     setOriReason]     = useState(appt.consultationNote?.motif ?? "");
  const [oriClinical,   setOriClinical]   = useState(appt.consultationNote?.diagnosis ?? "");

  const history = appt.savedCertificates ?? [];

  // ── Build cert object ─────────────────────────────────────────────────────

  function buildCert(): SavedCertificate | null {
    const id = Math.random().toString(36).slice(2, 9);
    const issuedAt = new Date().toISOString();

    if (certType === "medical") {
      return { id, type: "medical", issuedAt, content: medContent.trim() || undefined };
    }
    if (certType === "arret_travail") {
      if (!atFrom || !atTo) return null;
      return {
        id, type: "arret_travail", issuedAt,
        dateFrom: atFrom, dateTo: atTo, duration: daysBetween(atFrom, atTo),
        content: atDiag.trim() || undefined,
      };
    }
    if (certType === "orientation") {
      if (!oriSpecialist.trim()) return null;
      return {
        id, type: "orientation", issuedAt,
        specialist: oriSpecialist.trim(),
        reason: oriReason.trim() || undefined,
        clinicalSummary: oriClinical.trim() || undefined,
      };
    }
    return null;
  }

  function doPrint(cert: SavedCertificate) {
    reprintCert(cert, patientName, appt.date, doctorProfile);
  }

  function handlePrintSave() {
    const cert = buildCert();
    if (!cert) return;
    doPrint(cert);
    onSave(cert);
    onClose();
  }

  function handleSaveOnly() {
    const cert = buildCert();
    if (!cert) return;
    onSave(cert);
    onClose();
  }

  const canSubmit =
    certType === "orientation" ? oriSpecialist.trim().length > 0 : true;

  const atDays = atFrom && atTo ? daysBetween(atFrom, atTo) : 0;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cert-modal">
        <div className="modal-header">
          <h2 className="modal-title">📄 Certificats & Attestations</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* ── Type picker ── */}
          <div className="cert-type-picker">
            {(["medical", "arret_travail", "orientation"] as CertificateType[]).map(t => (
              <button
                key={t}
                className={`cert-type-btn${certType === t ? " active" : ""}`}
                onClick={() => setCertType(t)}
              >
                <span className="cert-type-icon">{TYPE_ICONS[t]}</span>
                <span className="cert-type-label">{TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>

          {/* ── Certificat médical ── */}
          {certType === "medical" && (
            <div className="cert-form">
              <div className="form-group">
                <label className="form-label">
                  Observation / motif du certificat
                  <span className="cert-optional"> (facultatif)</span>
                </label>
                <textarea
                  className="form-input cert-textarea"
                  rows={5}
                  placeholder="Ex : apte à la pratique sportive, absence de contre-indication à la reprise du travail, nécessite un régime alimentaire adapté…"
                  value={medContent}
                  onChange={(e) => setMedContent(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="cert-preview-hint">
                Inclura automatiquement : nom du patient · date de consultation · signature du médecin
              </div>
            </div>
          )}

          {/* ── Arrêt de travail ── */}
          {certType === "arret_travail" && (
            <div className="cert-form">
              <div className="cert-at-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Du</label>
                  <input
                    className="form-input"
                    type="date"
                    value={atFrom}
                    onChange={(e) => setAtFrom(e.target.value)}
                  />
                </div>
                <div className="cert-at-arrow">→</div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Au (inclus)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={atTo}
                    onChange={(e) => setAtTo(e.target.value)}
                  />
                </div>
                {atDays > 0 && (
                  <div className="cert-at-days">{atDays} j.</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">
                  Diagnostic / raison
                  <span className="cert-optional"> (facultatif — omis si vide)</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ex : syndrome grippal, lombalgie aiguë…"
                  value={atDiag}
                  onChange={(e) => setAtDiag(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* ── Orientation ── */}
          {certType === "orientation" && (
            <div className="cert-form">
              <div className="form-group">
                <label className="form-label">
                  Adressé à <span className="cert-required">*</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ex : Dr. Hassan Benali — Cardiologue, Service de Cardiologie CHU Ibn Sina"
                  value={oriSpecialist}
                  onChange={(e) => setOriSpecialist(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif d'orientation</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ex : bilan cardiologique, douleurs thoraciques d'effort récurrentes…"
                  value={oriReason}
                  onChange={(e) => setOriReason(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Résumé clinique
                  <span className="cert-optional"> (facultatif)</span>
                </label>
                <textarea
                  className="form-input cert-textarea"
                  rows={3}
                  placeholder="Antécédents pertinents, examens réalisés, résultats biologiques…"
                  value={oriClinical}
                  onChange={(e) => setOriClinical(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── History ── */}
          {history.length > 0 && (
            <div className="cert-history">
              <div className="cert-history-title">
                Certificats déjà émis pour ce rendez-vous
              </div>
              {[...history].reverse().map(c => (
                <div key={c.id} className="cert-history-row">
                  <span className="cert-history-icon">{TYPE_ICONS[c.type]}</span>
                  <span className="cert-history-type">{TYPE_LABELS[c.type]}</span>
                  {c.type === "arret_travail" && c.duration && (
                    <span className="cert-history-meta">{c.duration} j.</span>
                  )}
                  {c.type === "orientation" && c.specialist && (
                    <span className="cert-history-meta">{c.specialist}</span>
                  )}
                  <span className="cert-history-date">
                    {new Date(c.issuedAt).toLocaleDateString("fr-FR")}
                  </span>
                  <button
                    className="cert-reprint-btn"
                    onClick={() => reprintCert(c, patientName, appt.date, doctorProfile)}
                  >
                    Réimprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-ghost" onClick={handleSaveOnly} disabled={!canSubmit}>
            Enregistrer sans imprimer
          </button>
          <button className="btn btn-primary" onClick={handlePrintSave} disabled={!canSubmit}>
            📄 Imprimer & Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
