import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  CabinetDoctorProfile, MedicalReport, MedicalReportKind, ImagingModality,
} from "../lib/cabinetTypes";
import { IMAGING_MODALITY_LABELS } from "../lib/cabinetTypes";
import { printMedicalReport } from "../lib/medicalReportPrinter";
import { PatientPicker, type PickerPatient } from "./PatientPicker";
import { ModalPortal } from "./ModalPortal";
import { useModalA11y } from "../lib/a11y";

const MODALITIES: ImagingModality[] = ["echographie", "radiologie", "scanner", "irm", "autre"];

interface Props {
  patientName:   string;
  patientId?:    string;
  date:          string;             // ISO "YYYY-MM-DD"
  doctorProfile: CabinetDoctorProfile;
  patients?:     PickerPatient[];    // when set, patient is chosen in the modal (standalone)
  initial?:      MedicalReport;      // edit mode
  defaultKind?:  MedicalReportKind;
  source?:       "standalone" | "appointment";
  appointmentId?: string;
  onSave:  (data: Omit<MedicalReport, "id" | "createdAt">) => void;
  onClose: () => void;
}

export function MedicalReportModal({
  patientName, patientId, date, doctorProfile, patients, initial, defaultKind,
  source, appointmentId, onSave, onClose,
}: Props) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const [kind, setKind]           = useState<MedicalReportKind>(initial?.kind ?? defaultKind ?? "imaging");
  const [pName, setPName]         = useState(initial?.patientName ?? patientName);
  const [pId,   setPId]           = useState<string | undefined>(initial?.patientId ?? patientId);
  const [rDate, setRDate]         = useState(initial?.date ?? date);
  const [title, setTitle]         = useState(initial?.title ?? "");
  const [modality, setModality]   = useState<ImagingModality>(initial?.modality ?? "echographie");
  const [indication, setIndication] = useState(initial?.indication ?? "");
  const [technique, setTechnique] = useState(initial?.technique ?? "");
  const [findings, setFindings]   = useState(initial?.findings ?? "");
  const [conclusion, setConclusion] = useState(initial?.conclusion ?? "");
  const [body, setBody]           = useState(initial?.body ?? "");

  const buildReport = (): Omit<MedicalReport, "id" | "createdAt"> => ({
    kind,
    patientName: pName.trim(),
    patientId:   pId,
    date:        rDate,
    title:       title.trim() || undefined,
    source:      initial?.source ?? source ?? (patients ? "standalone" : "appointment"),
    appointmentId: initial?.appointmentId ?? appointmentId,
    ...(kind === "imaging"
      ? {
          modality,
          indication: indication.trim() || undefined,
          technique:  technique.trim()  || undefined,
          findings:   findings.trim()   || undefined,
          conclusion: conclusion.trim() || undefined,
        }
      : { body: body.trim() || undefined }),
  });

  const hasContent = kind === "imaging"
    ? !!(findings.trim() || conclusion.trim() || title.trim())
    : !!(body.trim() || title.trim());
  const canSubmit = pName.trim().length > 0 && hasContent;

  const handlePrint = () => {
    if (!canSubmit) return;
    const data = buildReport();
    printMedicalReport({
      report: { ...data, id: initial?.id ?? "preview", createdAt: initial?.createdAt ?? new Date().toISOString() },
      doctorProfile,
    });
    onSave(data); // keep the modal open after printing
  };
  const handleSaveOnly = () => {
    if (!canSubmit) return;
    onSave(buildReport());
    onClose();
  };

  const ta = (val: string, set: (v: string) => void, rows: number, ph: string) => (
    <textarea className="form-input" rows={rows} placeholder={ph} value={val} onChange={e => set(e.target.value)} />
  );

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 640, maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial ? t("medReport.editTitle") : t("medReport.title")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Kind toggle */}
          <div className="appt-type-pills" style={{ marginBottom: 12 }}>
            {(["imaging", "report"] as MedicalReportKind[]).map(k => (
              <button
                key={k}
                type="button"
                className={`appt-type-pill${kind === k ? " active" : ""}`}
                onClick={() => setKind(k)}
              >{t(`medReport.kind_${k}`)}</button>
            ))}
          </div>

          {patients ? (
            <PatientPicker
              value={pName}
              patientId={pId}
              patients={patients}
              label={t("medReport.patientLabel")}
              placeholder={t("medReport.patientPlaceholder")}
              listId="medreport-patients-list"
              onChange={(name, id) => { setPName(name); setPId(id); }}
            />
          ) : (
            <div className="ord-info-strip">
              <div className="ord-info-item">
                <span className="ord-info-label">{t("medReport.patientLabel")}</span>
                <span className="ord-info-value">{pName}</span>
              </div>
              <div className="ord-info-item">
                <span className="ord-info-label">{t("medReport.dateLabel")}</span>
                <span className="ord-info-value">
                  {new Date(rDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {kind === "imaging" && (
              <div className="form-group" style={{ flex: "0 0 auto", minWidth: 170 }}>
                <label className="form-label">{t("medReport.modalityLabel")}</label>
                <select className="form-select" value={modality} onChange={e => setModality(e.target.value as ImagingModality)}>
                  {MODALITIES.map(m => <option key={m} value={m}>{IMAGING_MODALITY_LABELS[m]}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ flex: "0 0 auto", minWidth: 150 }}>
              <label className="form-label">{t("medReport.dateLabel")}</label>
              <input className="form-input" type="date" value={rDate} onChange={e => setRDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">{t("medReport.titleLabel")}</label>
              <input
                className="form-input"
                placeholder={kind === "imaging" ? IMAGING_MODALITY_LABELS[modality] : t("medReport.titlePlaceholderReport")}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
          </div>

          {kind === "imaging" ? (
            <>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">{t("medReport.indicationLabel")}</label>
                {ta(indication, setIndication, 2, t("medReport.indicationPlaceholder"))}
              </div>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">{t("medReport.techniqueLabel")}</label>
                {ta(technique, setTechnique, 2, t("medReport.techniquePlaceholder"))}
              </div>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">{t("medReport.findingsLabel")}</label>
                {ta(findings, setFindings, 6, t("medReport.findingsPlaceholder"))}
              </div>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">{t("medReport.conclusionLabel")}</label>
                {ta(conclusion, setConclusion, 3, t("medReport.conclusionPlaceholder"))}
              </div>
            </>
          ) : (
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">{t("medReport.bodyLabel")}</label>
              {ta(body, setBody, 10, t("medReport.bodyPlaceholder"))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-ghost" onClick={handleSaveOnly} disabled={!canSubmit}>
            {t("medReport.saveOnly")}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handlePrint} disabled={!canSubmit}>
              {t("medReport.printBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
