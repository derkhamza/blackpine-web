import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, SavedCertificate, CertificateType, CabinetDoctorProfile } from "../lib/cabinetTypes";
import { printCertificatMedical, printArretTravail, printOrientation, printAptitude, printPresence } from "../lib/certificatePrinter";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<CertificateType, string> = {
  medical:       "📋",
  arret_travail: "🏥",
  orientation:   "📩",
  aptitude:      "✅",
  presence:      "📅",
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
  } else if (cert.type === "aptitude") {
    printAptitude({ patientName, apptDate, purpose: cert.content, doctorProfile: doc });
  } else if (cert.type === "presence" && cert.dateFrom && cert.dateTo) {
    printPresence({ patientName, dateFrom: cert.dateFrom, dateTo: cert.dateTo, notes: cert.content, doctorProfile: doc });
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
  const { t, i18n } = useTranslation();

  const locale =
    i18n.language?.slice(0, 2) === "ar" ? "ar-MA" :
    i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const TYPE_LABELS: Record<CertificateType, string> = {
    medical:       t("certType.medical"),
    arret_travail: t("certType.arret_travail"),
    orientation:   t("certType.orientation"),
    aptitude:      t("certType.aptitude"),
    presence:      t("certType.presence"),
  };

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

  // ── Aptitude fields ───────────────────────────────────────────────────────
  const [aptPurpose, setAptPurpose] = useState("");

  // ── Présence fields ───────────────────────────────────────────────────────
  const [presFrom,  setPresFrom]  = useState(appt.date);
  const [presTo,    setPresTo]    = useState(appt.date);
  const [presNotes, setPresNotes] = useState("");

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
    if (certType === "aptitude") {
      return {
        id, type: "aptitude", issuedAt,
        content: aptPurpose.trim() || undefined,
      };
    }
    if (certType === "presence") {
      if (!presFrom || !presTo) return null;
      return {
        id, type: "presence", issuedAt,
        dateFrom: presFrom, dateTo: presTo,
        content: presNotes.trim() || undefined,
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
    // Keep the modal open after printing so the doctor isn't bounced back.
  }

  function handleSaveOnly() {
    const cert = buildCert();
    if (!cert) return;
    onSave(cert);
    onClose();
  }

  const canSubmit =
    certType === "orientation" ? oriSpecialist.trim().length > 0
    : certType === "presence"  ? !!presFrom && !!presTo
    : true;

  const atDays = atFrom && atTo ? daysBetween(atFrom, atTo) : 0;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cert-modal">
        <div className="modal-header">
          <h2 className="modal-title">{t("certModal.title")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* ── Type picker ── */}
          <div className="cert-type-picker">
            {(["medical", "arret_travail", "orientation", "aptitude", "presence"] as CertificateType[]).map(ct => (
              <button
                key={ct}
                className={`cert-type-btn${certType === ct ? " active" : ""}`}
                onClick={() => setCertType(ct)}
              >
                <span className="cert-type-icon">{TYPE_ICONS[ct]}</span>
                <span className="cert-type-label">{TYPE_LABELS[ct]}</span>
              </button>
            ))}
          </div>

          {/* ── Certificat médical ── */}
          {certType === "medical" && (
            <div className="cert-form">
              <div className="form-group">
                <label className="form-label">
                  {t("certModal.medLabel")}
                  <span className="cert-optional"> {t("common.optional")}</span>
                </label>
                <textarea
                  className="form-input cert-textarea"
                  rows={5}
                  placeholder={t("certModal.medPlaceholder")}
                  value={medContent}
                  onChange={(e) => setMedContent(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="cert-preview-hint">
                {t("certModal.medHint")}
              </div>
            </div>
          )}

          {/* ── Arrêt de travail ── */}
          {certType === "arret_travail" && (
            <div className="cert-form">
              <div className="cert-at-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("certificats.arretFrom")}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={atFrom}
                    onChange={(e) => setAtFrom(e.target.value)}
                  />
                </div>
                <div className="cert-at-arrow">→</div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("certModal.arretToLabel")}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={atTo}
                    onChange={(e) => setAtTo(e.target.value)}
                  />
                </div>
                {atDays > 0 && (
                  <div className="cert-at-days">{t("certModal.days", { n: atDays })}</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("certModal.arretDiagLabel")}
                  <span className="cert-optional"> {t("certModal.arretOptional")}</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={t("certModal.arretDiagPlaceholder")}
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
                  {t("certModal.oriAddressedTo")} <span className="cert-required">*</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={t("certModal.oriAddressedPlaceholder")}
                  value={oriSpecialist}
                  onChange={(e) => setOriSpecialist(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("certificats.reasonLabel")}</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={t("certificats.reasonPlaceholder")}
                  value={oriReason}
                  onChange={(e) => setOriReason(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("certificats.summaryLabel")}
                  <span className="cert-optional"> {t("common.optional")}</span>
                </label>
                <textarea
                  className="form-input cert-textarea"
                  rows={3}
                  placeholder={t("certificats.summaryPlaceholder")}
                  value={oriClinical}
                  onChange={(e) => setOriClinical(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Aptitude ── */}
          {certType === "aptitude" && (
            <div className="cert-form">
              <div className="form-group">
                <label className="form-label">
                  {t("certModal.aptPurposeLabel")}
                  <span className="cert-optional"> {t("common.optional")}</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={t("certModal.aptPurposePlaceholder")}
                  value={aptPurpose}
                  onChange={(e) => setAptPurpose(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="cert-preview-hint">
                {t("certModal.aptHint", {
                  date: new Date(appt.date + "T12:00:00").toLocaleDateString(locale),
                })}
              </div>
            </div>
          )}

          {/* ── Présence ── */}
          {certType === "presence" && (
            <div className="cert-form">
              <div className="cert-at-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("certificats.arretFrom")}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={presFrom}
                    onChange={(e) => setPresFrom(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="cert-at-arrow">→</div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("certificats.arretTo")}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={presTo}
                    onChange={(e) => setPresTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t("certModal.presObsLabel")}
                  <span className="cert-optional"> {t("common.optional")}</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder={t("certModal.presObsPlaceholder")}
                  value={presNotes}
                  onChange={(e) => setPresNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── History ── */}
          {history.length > 0 && (
            <div className="cert-history">
              <div className="cert-history-title">
                {t("certModal.historyTitle")}
              </div>
              {[...history].reverse().map(c => (
                <div key={c.id} className="cert-history-row">
                  <span className="cert-history-icon">{TYPE_ICONS[c.type]}</span>
                  <span className="cert-history-type">{TYPE_LABELS[c.type]}</span>
                  {c.type === "arret_travail" && c.duration && (
                    <span className="cert-history-meta">{t("certModal.days", { n: c.duration })}</span>
                  )}
                  {c.type === "orientation" && c.specialist && (
                    <span className="cert-history-meta">{c.specialist}</span>
                  )}
                  <span className="cert-history-date">
                    {new Date(c.issuedAt).toLocaleDateString(locale)}
                  </span>
                  <button
                    className="cert-reprint-btn"
                    onClick={() => reprintCert(c, patientName, appt.date, doctorProfile)}
                  >
                    {t("certModal.reprint")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-ghost" onClick={handleSaveOnly} disabled={!canSubmit}>
            {t("certModal.saveOnly")}
          </button>
          <button className="btn btn-primary" onClick={handlePrintSave} disabled={!canSubmit}>
            📄 {t("certModal.printSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
