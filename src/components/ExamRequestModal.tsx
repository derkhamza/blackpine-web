import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CabinetDoctorProfile, ExamRequestLine, ExamRequestCategory, ExamRequestTemplate } from "../lib/cabinetTypes";
import { printExamRequest } from "../lib/examRequestPrinter";
import { PatientPicker, type PickerPatient } from "./PatientPicker";
import { ModalPortal } from "./ModalPortal";
import {
  EXAM_CATALOG, EXAM_REQ_CATEGORIES, EXAM_REQ_CATEGORY_COLORS, EXAM_REQUEST_MODELS,
} from "../lib/examCatalog";

const uid = () => Math.random().toString(36).slice(2, 9);
type LineWithKey = ExamRequestLine & { _key: string };

const blankLine = (category: ExamRequestCategory = "biologie"): LineWithKey =>
  ({ _key: uid(), category, label: "", detail: "" });

interface Props {
  patientName:   string;
  patientId?:    string;
  date:          string;             // ISO "YYYY-MM-DD"
  doctorProfile: CabinetDoctorProfile;
  // When provided, the patient is chosen inside the modal (standalone use).
  patients?:     PickerPatient[];
  initialLines?:      ExamRequestLine[];
  initialIndication?: string;
  // Doctor-saved models (from doctorProfile.examRequestTemplates) + callbacks to
  // persist a new one / remove one. Omitted → only the built-in models show.
  savedTemplates?:  ExamRequestTemplate[];
  onSaveTemplate?:  (name: string, lines: ExamRequestLine[], indication?: string) => void;
  onDeleteTemplate?: (id: string) => void;
  onSave:  (data: { lines: ExamRequestLine[]; indication?: string; patientName: string; patientId?: string }) => void;
  onClose: () => void;
}

export function ExamRequestModal({
  patientName, patientId, date, doctorProfile, patients, initialLines, initialIndication,
  savedTemplates, onSaveTemplate, onDeleteTemplate, onSave, onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const [pName, setPName] = useState(patientName);
  const [pId,   setPId]   = useState<string | undefined>(patientId);
  const [lines, setLines] = useState<LineWithKey[]>(() =>
    initialLines && initialLines.length
      ? initialLines.map(l => ({ ...l, _key: uid() }))
      : [blankLine()]
  );
  const [indication, setIndication] = useState(initialIndication ?? "");

  const catLabel = (c: ExamRequestCategory) => t(`examReq.cat.${c}`);

  const updateLine = (i: number, patch: Partial<ExamRequestLine>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) =>
    setLines(prev => { const n = prev.filter((_, idx) => idx !== i); return n.length ? n : [blankLine()]; });
  const addLine = () =>
    setLines(prev => [...prev, blankLine(prev[prev.length - 1]?.category ?? "biologie")]);

  const clean = () => lines
    .map(l => ({ category: l.category, label: l.label.trim(), detail: l.detail?.trim() || undefined }))
    .filter(l => l.label.length > 0);

  // Load a model's lines into the form. Merges onto existing filled lines (so a
  // doctor can stack models) rather than replacing what they already typed.
  const applyModel = (mLines: ExamRequestLine[], mIndication?: string) => {
    setLines(prev => {
      const existing = prev.filter(l => l.label.trim());
      const seen = new Set(existing.map(l => `${l.category}|${l.label.toLowerCase()}`));
      const added = mLines
        .filter(l => !seen.has(`${l.category}|${l.label.toLowerCase()}`))
        .map(l => ({ ...l, _key: uid() }));
      const merged = [...existing, ...added];
      return merged.length ? merged : [blankLine()];
    });
    if (mIndication && !indication.trim()) setIndication(mIndication);
  };

  const saveAsTemplate = () => {
    const c = clean();
    if (!c.length || !onSaveTemplate) return;
    const name = window.prompt(t("examReq.templateNamePrompt"));
    if (!name || !name.trim()) return;
    onSaveTemplate(name.trim(), c, indication.trim() || undefined);
  };

  const hasLines = lines.some(l => l.label.trim());
  const canSubmit = hasLines && pName.trim().length > 0;

  const handlePrint = () => {
    const c = clean();
    if (!c.length || !pName.trim()) return;
    printExamRequest({ lines: c, indication: indication.trim() || undefined, patientName: pName.trim(), date, doctorProfile });
    onSave({ lines: c, indication: indication.trim() || undefined, patientName: pName.trim(), patientId: pId });
    // Keep the modal open after printing so the doctor isn't bounced back.
  };
  const handleSaveOnly = () => {
    const c = clean();
    if (!c.length || !pName.trim()) return;
    onSave({ lines: c, indication: indication.trim() || undefined, patientName: pName.trim(), patientId: pId });
    onClose();
  };

  return (
    <ModalPortal>
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal exr-modal" style={{ maxWidth: 640, maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">{t("examReq.title", { name: patientName })}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {patients ? (
            <PatientPicker
              value={pName}
              patientId={pId}
              patients={patients}
              label={t("examReq.patientLabel")}
              placeholder={t("examReq.patientPlaceholder")}
              listId="exr-patients-list"
              onChange={(name, id) => { setPName(name); setPId(id); }}
            />
          ) : (
            <div className="ord-info-strip">
              <div className="ord-info-item">
                <span className="ord-info-label">{t("examReq.patientLabel")}</span>
                <span className="ord-info-value">{pName}</span>
              </div>
              <div className="ord-info-item">
                <span className="ord-info-label">{t("examReq.dateLabel")}</span>
                <span className="ord-info-value">
                  {new Date(date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          )}

          {/* Models — one-click bundles of common exams (built-in + doctor-saved) */}
          <div className="exr-models">
            <div className="exr-models-head">
              <span className="exr-models-label">{t("examReq.modelsLabel")}</span>
              {onSaveTemplate && (
                <button type="button" className="exr-model-save" onClick={saveAsTemplate} disabled={!hasLines}>
                  {t("examReq.saveAsModel")}
                </button>
              )}
            </div>
            <div className="exr-models-chips">
              {EXAM_REQUEST_MODELS.map(m => (
                <button type="button" key={m.name} className="exr-model-chip"
                  onClick={() => applyModel(m.lines, m.indication)} title={m.name}>
                  {m.name}
                </button>
              ))}
              {(savedTemplates ?? []).map(tpl => (
                <span key={tpl.id} className="exr-model-chip exr-model-chip-custom">
                  <button type="button" className="exr-model-chip-apply"
                    onClick={() => applyModel(tpl.lines, tpl.indication)} title={tpl.name}>
                    {tpl.name}
                  </button>
                  {onDeleteTemplate && (
                    <button type="button" className="exr-model-chip-del"
                      onClick={() => onDeleteTemplate(tpl.id)} title={t("common.delete")} aria-label={t("common.delete")}>×</button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Exam lines */}
          <div className="exr-rows">
            {lines.map((l, i) => (
              <div className="exr-row" key={l._key}>
                <select
                  className="form-select exr-row-cat"
                  value={l.category}
                  onChange={e => updateLine(i, { category: e.target.value as ExamRequestCategory })}
                  style={{ borderLeft: `4px solid ${EXAM_REQ_CATEGORY_COLORS[l.category]}` }}
                >
                  {EXAM_REQ_CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                </select>
                <input
                  className="form-input exr-row-label"
                  placeholder={t("examReq.examPlaceholder")}
                  value={l.label}
                  list={`exr-cat-${l.category}`}
                  autoFocus={i === 0}
                  onChange={e => updateLine(i, { label: e.target.value })}
                />
                <input
                  className="form-input exr-row-detail"
                  placeholder={t("examReq.detailPlaceholder")}
                  value={l.detail ?? ""}
                  onChange={e => updateLine(i, { detail: e.target.value })}
                />
                <button className="exr-row-remove" onClick={() => removeLine(i)} title={t("common.delete")}>×</button>
              </div>
            ))}
          </div>

          {/* Shared datalists per category */}
          {EXAM_REQ_CATEGORIES.map(c => (
            <datalist id={`exr-cat-${c}`} key={c}>
              {EXAM_CATALOG[c].map(x => <option key={x} value={x} />)}
            </datalist>
          ))}

          <button className="ord-add-btn" onClick={addLine}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {t("examReq.addExam")}
          </button>

          {/* Clinical indication */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("examReq.indicationLabel")}</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder={t("examReq.indicationPlaceholder")}
              value={indication}
              onChange={e => setIndication(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-ghost" onClick={handleSaveOnly} disabled={!canSubmit}>
            {t("examReq.saveOnly")}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handlePrint} disabled={!canSubmit}>
              {t("examReq.printBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
