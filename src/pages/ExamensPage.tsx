import { confirmDialog } from "../lib/confirm";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clickable } from "../lib/a11y";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import { fullName as fmtFullName } from "../lib/nameFormat";
import type { ExamResult, ExamType, ExamValue } from "../lib/cabinetTypes";
import { EXAM_TYPE_LABELS, EXAM_TYPE_COLORS } from "../lib/cabinetTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

const EXAM_TYPES: ExamType[] = ["biologie", "imagerie", "ecg", "autre"];

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function isValueAbnormal(v: ExamValue): boolean {
  if (v.isAbnormal !== undefined) return v.isAbnormal;
  const n = parseFloat(v.value);
  if (isNaN(n)) return false;
  if (v.refMin !== undefined && n < v.refMin) return true;
  if (v.refMax !== undefined && n > v.refMax) return true;
  return false;
}

function examHasAbnormal(exam: ExamResult): boolean {
  return exam.values.some(v => isValueAbnormal(v));
}

// Medical lab reference values — kept in professional notation (no translation needed)
const COMMON_LABS: Array<{ label: string; unit: string; refMin: number; refMax: number }> = [
  { label: "Hémoglobine",      unit: "g/dL",    refMin: 12,  refMax: 17 },
  { label: "Globules rouges",  unit: "×10⁶/µL", refMin: 3.8, refMax: 5.9 },
  { label: "Globules blancs",  unit: "×10³/µL", refMin: 4,   refMax: 11 },
  { label: "Plaquettes",       unit: "×10³/µL", refMin: 150, refMax: 400 },
  { label: "Glycémie",         unit: "g/L",     refMin: 0.7, refMax: 1.1 },
  { label: "Créatinine",       unit: "µmol/L",  refMin: 50,  refMax: 110 },
  { label: "Urée",             unit: "mmol/L",  refMin: 2.5, refMax: 7.5 },
  { label: "ASAT (GOT)",       unit: "UI/L",    refMin: 0,   refMax: 40 },
  { label: "ALAT (GPT)",       unit: "UI/L",    refMin: 0,   refMax: 40 },
  { label: "Cholestérol total",unit: "g/L",     refMin: 0,   refMax: 2 },
  { label: "LDL",              unit: "g/L",     refMin: 0,   refMax: 1.6 },
  { label: "HDL",              unit: "g/L",     refMin: 0.4, refMax: 1.6 },
  { label: "Triglycérides",    unit: "g/L",     refMin: 0,   refMax: 1.5 },
  { label: "TSH",              unit: "mUI/L",   refMin: 0.4, refMax: 4 },
  { label: "CRP",              unit: "mg/L",    refMin: 0,   refMax: 10 },
  { label: "Vitamine D",       unit: "ng/mL",   refMin: 30,  refMax: 100 },
  { label: "Ferritine",        unit: "ng/mL",   refMin: 15,  refMax: 300 },
  { label: "HbA1c",            unit: "%",       refMin: 0,   refMax: 5.7 },
];

// Print function — intentionally kept in French (official medical document)
function printExam(exam: ExamResult, doctorName?: string) {
  // Escape free-text before interpolating into the print HTML: values can be
  // patient/secretary-supplied, so unescaped they inject script into the same-
  // origin print window and steal the session token. The numeric abnormal-check
  // runs on the RAW value, so escape only at the display points.
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string, string>)[m]);
  const abnormal = exam.values.filter(v => isValueAbnormal(v));
  const valRows = exam.values.map(v => {
    const abn = isValueAbnormal(v);
    return `<tr style="${abn ? "background:#FFF0F0;" : ""}">
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${esc(v.label)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:${abn ? "#E85B5B" : "#111"}">
        ${esc(v.value)}${v.unit ? " " + esc(v.unit) : ""}${abn ? " ⚠" : ""}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#888;font-size:12px;text-align:right">
        ${v.refMin !== undefined && v.refMax !== undefined
          ? v.refMin + " – " + v.refMax + (v.unit ? " " + v.unit : "")
          : ""}
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { margin: 24px; font-family: Arial, sans-serif; color: #111; font-size: 14px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #555; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; padding: 7px 10px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
  .alert { background: #FFF3F3; border: 1px solid #E85B5B; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #E85B5B; margin-bottom: 16px; }
  .footer { margin-top: 20px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head><body>
<h1>${esc(exam.title)}</h1>
<div class="sub">
  Patient : <strong>${esc(exam.patientName)}</strong> &nbsp;|&nbsp;
  Date : <strong>${new Date(exam.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong> &nbsp;|&nbsp;
  Type : ${EXAM_TYPE_LABELS[exam.type]}
  ${exam.labName ? " &nbsp;|&nbsp; Labo : " + esc(exam.labName) : ""}
</div>
${abnormal.length > 0
  ? `<div class="alert">⚠ ${abnormal.length} résultat${abnormal.length > 1 ? "s" : ""} anormal${abnormal.length > 1 ? "aux" : ""} : ${abnormal.map(v => esc(v.label)).join(", ")}</div>`
  : ""}
<table>
  <thead><tr>
    <th>Paramètre</th>
    <th style="text-align:right">Résultat</th>
    <th style="text-align:right">Valeurs normales</th>
  </tr></thead>
  <tbody>${valRows}</tbody>
</table>
${exam.notes ? `<div style="background:#f9f9f9;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:14px"><strong>Observations :</strong> ${esc(exam.notes)}</div>` : ""}
<div class="footer">
  Médecin : ${esc(doctorName ?? "—")} &nbsp;|&nbsp; Imprimé le ${new Date().toLocaleDateString("fr-FR")}
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Exam value editor row ──────────────────────────────────────────────────────

interface ValueRowProps {
  value:     ExamValue;
  onChange:  (v: ExamValue) => void;
  onRemove:  () => void;
  showRemove: boolean;
  examType:  ExamType;
}

function ValueRow({ value, onChange, onRemove, showRemove, examType }: ValueRowProps) {
  const { t } = useTranslation();
  const labelRef = useRef<HTMLInputElement>(null);

  const selectPreset = (preset: typeof COMMON_LABS[0]) => {
    onChange({ ...value, label: preset.label, unit: preset.unit, refMin: preset.refMin, refMax: preset.refMax });
  };

  const numVal  = parseFloat(value.value);
  const abnormal = isValueAbnormal(value);

  return (
    <div className={`exam-value-row${abnormal ? " abnormal" : ""}`}>
      <div className="exam-value-main">
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input ref={labelRef} className="form-input exam-value-label"
            value={value.label} onChange={e => onChange({ ...value, label: e.target.value })}
            placeholder={t("examens.paramPlaceholder")}
            list={examType === "biologie" ? "common-labs-list" : undefined} required />
          {examType === "biologie" && (
            <datalist id="common-labs-list">
              {COMMON_LABS.map(l => <option key={l.label} value={l.label} />)}
            </datalist>
          )}
        </div>
        <input className={`form-input exam-value-val${abnormal ? " exam-val-abnormal" : ""}`}
          value={value.value} onChange={e => onChange({ ...value, value: e.target.value })}
          placeholder={t("examens.valuePlaceholder")} required />
        <input className="form-input exam-value-unit"
          value={value.unit ?? ""} onChange={e => onChange({ ...value, unit: e.target.value || undefined })}
          placeholder={t("examens.unitPlaceholder")} />
      </div>
      <div className="exam-value-refs">
        <input className="form-input exam-value-ref" type="number" step="any"
          value={value.refMin ?? ""}
          onChange={e => { const v = parseFloat(e.target.value); onChange({ ...value, refMin: isNaN(v) ? undefined : v }); }}
          placeholder={t("examens.minNorm")} />
        <span style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0 }}>—</span>
        <input className="form-input exam-value-ref" type="number" step="any"
          value={value.refMax ?? ""}
          onChange={e => { const v = parseFloat(e.target.value); onChange({ ...value, refMax: isNaN(v) ? undefined : v }); }}
          placeholder={t("examens.maxNorm")} />
        {examType === "biologie" && value.label && (
          <button type="button" className="exam-preset-btn"
            onClick={() => {
              const preset = COMMON_LABS.find(l => l.label.toLowerCase() === value.label.toLowerCase());
              if (preset) selectPreset(preset);
            }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 1 0 8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M6 2v4M4 4l2-2 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {isNaN(numVal) && value.value && (
          <button type="button" className={`exam-flag-btn${value.isAbnormal ? " active" : ""}`}
            onClick={() => onChange({ ...value, isAbnormal: !value.isAbnormal })}>⚠</button>
        )}
        {showRemove && (
          <button type="button" className="po-line-remove" onClick={onRemove}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Exam form modal ────────────────────────────────────────────────────────────

interface ExamModalProps {
  initial?:   Partial<ExamResult>;
  patients:   { id: string; firstName: string; lastName: string }[];
  doctorName?: string;
  onSave:     (e: Omit<ExamResult, "id" | "createdAt">) => void;
  onClose:    () => void;
}

function ExamModal({ initial, patients, doctorName, onSave, onClose }: ExamModalProps) {
  const { t } = useTranslation();
  const today = todayIso();
  const [patientId,   setPatientId]   = useState(initial?.patientId    ?? "");
  const [patientName, setPatientName] = useState(initial?.patientName  ?? "");
  const [type,        setType]        = useState<ExamType>(initial?.type ?? "biologie");
  const [date,        setDate]        = useState(initial?.date         ?? today);
  const [title,       setTitle]       = useState(initial?.title        ?? "");
  const [labName,     setLabName]     = useState(initial?.labName      ?? "");
  const [requestedBy, setRequestedBy] = useState(initial?.requestedBy  ?? "");
  const [notes,       setNotes]       = useState(initial?.notes        ?? "");
  const [values,      setValues]      = useState<ExamValue[]>(
    initial?.values?.length
      ? initial.values
      : [{ label: "", value: "", unit: undefined, refMin: undefined, refMax: undefined }]
  );

  const handleSelectPatient = (pid: string) => {
    setPatientId(pid);
    const p = patients.find(x => x.id === pid);
    setPatientName(p ? fmtFullName(p) : "");
  };

  const addValue  = () => setValues(prev => [...prev, { label: "", value: "", unit: undefined, refMin: undefined, refMax: undefined }]);
  const updateValue = (i: number, v: ExamValue) => setValues(prev => prev.map((x, j) => j === i ? v : x));
  const removeValue = (i: number) => setValues(prev => prev.filter((_, j) => j !== i));

  const autoFillFromTitle = () => {
    const lower = title.toLowerCase();
    let presets: typeof COMMON_LABS = [];
    if (lower.includes("nfs") || lower.includes("numération"))
      presets = COMMON_LABS.filter(l => ["Hémoglobine","Globules rouges","Globules blancs","Plaquettes"].includes(l.label));
    else if (lower.includes("bilan lipidique") || lower.includes("lipid"))
      presets = COMMON_LABS.filter(l => ["Cholestérol total","LDL","HDL","Triglycérides"].includes(l.label));
    else if (lower.includes("bilan hépatique") || lower.includes("transaminase"))
      presets = COMMON_LABS.filter(l => ["ASAT (GOT)","ALAT (GPT)"].includes(l.label));
    else if (lower.includes("glycémie") || lower.includes("glucose"))
      presets = COMMON_LABS.filter(l => l.label === "Glycémie");
    else if (lower.includes("hba1c") || lower.includes("hémoglobine glyquée"))
      presets = COMMON_LABS.filter(l => l.label === "HbA1c");
    else if (lower.includes("thyroïde") || lower.includes("tsh"))
      presets = COMMON_LABS.filter(l => l.label === "TSH");
    else if (lower.includes("bilan rénal") || lower.includes("créatinine"))
      presets = COMMON_LABS.filter(l => ["Créatinine","Urée"].includes(l.label));
    if (presets.length > 0)
      setValues(presets.map(p => ({ label: p.label, value: "", unit: p.unit, refMin: p.refMin, refMax: p.refMax })));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validValues = values.filter(v => v.label.trim() && v.value.trim());
    if (!title.trim() || validValues.length === 0) return;
    const linkedPatient = patientId ? patients.find(p => p.id === patientId) : undefined;
    const name = linkedPatient ? fmtFullName(linkedPatient) : patientName.trim();
    onSave({
      patientId:   patientId   || undefined,
      patientName: name        || "Patient inconnu",
      type, date,
      title:       title.trim(),
      labName:     labName.trim()     || undefined,
      requestedBy: requestedBy.trim() || undefined,
      notes:       notes.trim()       || undefined,
      values:      validValues,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {initial?.id ? t("examens.modalEdit") : t("examens.modalNew")}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("examens.patient")}</label>
                <select className="form-input" value={patientId}
                  onChange={e => handleSelectPatient(e.target.value)}>
                  <option value="">{t("examens.patientSelect")}</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{fmtFullName(p)}</option>
                  ))}
                </select>
              </div>
              {!patientId && (
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("examens.patientFree")}</label>
                  <input className="form-input" value={patientName}
                    onChange={e => setPatientName(e.target.value)}
                    placeholder={t("examens.patientPlaceholder")} />
                </div>
              )}
              <div className="form-group" style={{ flex: "0 0 150px" }}>
                <label className="form-label">{t("examens.typeField")}</label>
                <select className="form-input" value={type}
                  onChange={e => setType(e.target.value as ExamType)}>
                  {EXAM_TYPES.map(et => (
                    <option key={et} value={et}>{EXAM_TYPE_LABELS[et]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("examens.examTitleField")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="form-input" value={title}
                    onChange={e => setTitle(e.target.value)} onBlur={autoFillFromTitle}
                    placeholder={t("examens.examTitlePlaceholder")} required style={{ flex: 1 }}
                    list="exam-titles-list" />
                  <datalist id="exam-titles-list">
                    {["NFS","Bilan lipidique","Bilan hépatique","Glycémie à jeun","HbA1c","TSH",
                      "Bilan rénal","CRP","Vitamine D","Ferritine",
                      "ECG de repos","Radiographie thoracique","Échographie abdominale",
                      "Échographie cardiaque","IRM","Scanner","Bilan pré-opératoire"].map(ti => (
                      <option key={ti} value={ti} />
                    ))}
                  </datalist>
                  {type === "biologie" && (
                    <button type="button" className="btn btn-ghost"
                      style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={autoFillFromTitle}>
                      Auto-fill
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ flex: "0 0 150px" }}>
                <label className="form-label">{t("examens.dateField")}</label>
                <input className="form-input" type="date" value={date}
                  onChange={e => setDate(e.target.value)} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("examens.labField")}</label>
                <input className="form-input" value={labName}
                  onChange={e => setLabName(e.target.value)}
                  placeholder={t("examens.labPlaceholder")} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("examens.prescField")}</label>
                <input className="form-input" value={requestedBy}
                  onChange={e => setRequestedBy(e.target.value)}
                  placeholder={doctorName ?? "Médecin prescripteur"} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {t("examens.resultsLabel")}
                {type === "biologie" && (
                  <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                    {t("examens.resultsBioHint")}
                  </span>
                )}
              </label>
              <div className="exam-values-list">
                <div className="exam-values-header">
                  <span className="exam-col-lbl">{t("examens.colParam")}</span>
                  <span className="exam-col-val">{t("examens.colResult")}</span>
                  <span className="exam-col-unit">{t("examens.colUnit")}</span>
                  <span className="exam-col-refs">{t("examens.colRef")}</span>
                </div>
                {values.map((v, i) => (
                  <ValueRow key={i} value={v} onChange={nv => updateValue(i, nv)}
                    onRemove={() => removeValue(i)} showRemove={values.length > 1} examType={type} />
                ))}
                <button type="button" className="po-add-line-btn" onClick={addValue}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {t("examens.addParam")}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {type === "imagerie" ? t("examens.radioReportLabel") : t("examens.notesLabel")}
                {type === "imagerie" && !notes.trim() && (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => setNotes(t("examens.radioReportTemplate"))}>
                    {t("examens.radioInsertTemplate")}
                  </button>
                )}
              </label>
              <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
                rows={type === "imagerie" ? 6 : 2}
                placeholder={type === "imagerie" ? t("examens.radioReportPlaceholder")
                           : type === "biologie" ? t("examens.bioNotesPlaceholder")
                           : t("examens.notesPlaceholder")} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("examens.saveExam")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Exam card ──────────────────────────────────────────────────────────────────

function ExamCard({ exam, locale, onEdit, onDelete, onPrint }: {
  exam:    ExamResult;
  locale:  string;
  onEdit:  () => void;
  onDelete:() => void;
  onPrint: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasAbnormal = examHasAbnormal(exam);
  const color = EXAM_TYPE_COLORS[exam.type];

  return (
    <div className={`exam-card${hasAbnormal ? " has-abnormal" : ""}`}>
      <div className="exam-card-accent" style={{ background: color }} />
      <div className="exam-card-body" {...clickable(() => setExpanded(o => !o))} aria-expanded={expanded} style={{ cursor: "pointer", flex: 1 }}>
        <div className="exam-card-header">
          <div className="exam-card-title-row">
            <span className="exam-card-title">{exam.title}</span>
            <span className="exam-type-badge" style={{ background: color + "22", color }}>
              {EXAM_TYPE_LABELS[exam.type]}
            </span>
            {hasAbnormal && (
              <span className="exam-abnormal-badge">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L1 10h10L6 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M6 5v2.5M6 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {t("examens.anomaly")}
              </span>
            )}
          </div>
          <div className="exam-card-meta">
            <span className="exam-patient">{exam.patientName}</span>
            <span>{fmtDate(exam.date, locale)}</span>
            {exam.labName && <span style={{ color: "var(--muted)" }}>{exam.labName}</span>}
            <span style={{ color: "var(--muted)", fontSize: 11 }}>
              {t("examens.nParam", { n: exam.values.length, s: exam.values.length !== 1 ? "s" : "" })}
            </span>
          </div>
        </div>

        {expanded && (
          <div className="exam-values-table">
            {exam.values.map((v, i) => {
              const abn = isValueAbnormal(v);
              return (
                <div key={i} className={`exam-val-row${abn ? " abn" : ""}`}>
                  <span className="exam-val-label">{v.label}</span>
                  <span className="exam-val-value" style={{ color: abn ? "var(--coral)" : "var(--text)" }}>
                    {v.value}{v.unit ? " " + v.unit : ""}
                    {abn && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 4 }}>
                        <path d="M6 1L1 10h10L6 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="exam-val-ref">
                    {v.refMin !== undefined && v.refMax !== undefined
                      ? v.refMin + " – " + v.refMax + (v.unit ? " " + v.unit : "") : ""}
                  </span>
                </div>
              );
            })}
            {exam.notes && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
                {exam.notes}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="exam-card-actions">
        <button className="tele-action-btn" onClick={onPrint}
          aria-label={t("common.print", { defaultValue: "Imprimer" })} title={t("common.print", { defaultValue: "Imprimer" })}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 5V2h8v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <rect x="1" y="5" width="12" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M3 9h8v3H3z" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
        <button className="tele-action-btn" onClick={onEdit}
          aria-label={t("common.edit")} title={t("common.edit")}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="tx-delete" onClick={onDelete}
          aria-label={t("common.delete")} title={t("common.delete")}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ViewTab = "all" | "abnormal" | "biologie" | "imagerie" | "ecg" | "autre";

export function ExamensPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const today = todayIso();
  const { examResults, addExamResult, updateExamResult, deleteExamResult, patients, doctorProfile } = useCabinet();

  const [tab,       setTab]       = useState<ViewTab>("all");
  const [modal,     setModal]     = useState<{ exam?: ExamResult } | null>(null);
  const [search,    setSearch]    = useState("");
  const [filterPat, setFilterPat] = useState("all");

  const showToast = useToast();

  const kpi = useMemo(() => {
    const thisMonth = today.slice(0, 7);
    return {
      total:    examResults.length,
      abnormal: examResults.filter(examHasAbnormal).length,
      thisMonth: examResults.filter(e => e.date.startsWith(thisMonth)).length,
      biology:  examResults.filter(e => e.type === "biologie").length,
    };
  }, [examResults, today]);

  const filtered = useMemo(() =>
    examResults
      .filter(e => {
        if (tab === "abnormal" && !examHasAbnormal(e)) return false;
        if (tab !== "all" && tab !== "abnormal" && e.type !== tab) return false;
        if (filterPat !== "all" && e.patientId !== filterPat && e.patientName !== filterPat) return false;
        if (search) {
          const q = search.toLowerCase();
          return e.title.toLowerCase().includes(q) ||
            e.patientName.toLowerCase().includes(q) ||
            e.values.some(v => v.label.toLowerCase().includes(q)) ||
            (e.labName ?? "").toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [examResults, tab, filterPat, search]);

  const examPatients = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of examResults) {
      if (e.patientId) map.set(e.patientId, e.patientName);
      else map.set(e.patientName, e.patientName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [examResults]);

  const doctorName = doctorProfile.fullName || undefined;

  const tabs: [ViewTab, string, number][] = [
    ["all",      t("examens.tabAll"),      kpi.total],
    ["abnormal", t("examens.tabAbnormal"), kpi.abnormal],
    ["biologie", t("examens.tabBiology"),  examResults.filter(e => e.type === "biologie").length],
    ["imagerie", t("examens.tabImagerie"), examResults.filter(e => e.type === "imagerie").length],
    ["ecg",      t("examens.tabEcg"),      examResults.filter(e => e.type === "ecg").length],
    ["autre",    t("examens.tabAutre"),    examResults.filter(e => e.type === "autre").length],
  ];

  return (
    <Layout
      title={t("examens.title")}
      subtitle={t("examens.subtitle", { n: examResults.length, s: examResults.length !== 1 ? "s" : "" })}
      actions={
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {t("examens.newExam")}
        </button>
      }
    >
      <div className="stock-kpi-strip">
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpi.total}</div>
          <div className="stock-kpi-lbl">{t("examens.kpiTotal")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--blue)" }}>{kpi.biology}</div>
          <div className="stock-kpi-lbl">{t("examens.kpiBiology")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: kpi.abnormal > 0 ? "var(--coral)" : "var(--text)" }}>
            {kpi.abnormal}
          </div>
          <div className="stock-kpi-lbl">{t("examens.kpiAbnormal")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--green)" }}>{kpi.thisMonth}</div>
          <div className="stock-kpi-lbl">{t("examens.kpiThisMonth")}</div>
        </div>
      </div>

      {kpi.abnormal > 0 && tab !== "abnormal" && (
        <div className="note-alert-bar"
          style={{ borderColor: "var(--coral)", color: "var(--coral)", background: "#E85B5B10", cursor: "pointer" }}
          onClick={() => setTab("abnormal")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L1 12h12L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>
            {t("examens.alertAbnormal", { n: kpi.abnormal, s: kpi.abnormal !== 1 ? "s" : "", aux: kpi.abnormal !== 1 ? "aux" : "" })}
          </span>
        </div>
      )}

      <div className="four-tabs">
        {tabs.filter(([tab2, , cnt]) => cnt > 0 || tab2 === "all" || tab2 === "abnormal").map(([tab2, label, cnt]) => (
          <button key={tab2} className={`four-tab${tab === tab2 ? " active" : ""}`}
            onClick={() => setTab(tab2)}>
            {label}
            <span className="stock-pill-count">{cnt}</span>
          </button>
        ))}
      </div>

      <div className="four-toolbar">
        <select className="form-input" style={{ flex: "0 0 180px", fontSize: 12 }}
          value={filterPat} onChange={e => setFilterPat(e.target.value)}>
          <option value="all">{t("examens.filterPatients")}</option>
          {examPatients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="stock-search-wrap" style={{ flex: 1 }}>
          <svg className="stock-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input className="stock-search-input" placeholder={t("examens.search")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="agenda-empty" style={{ marginTop: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {examResults.length === 0 ? t("examens.emptyNone") : t("examens.emptyNoResults")}
          </div>
          {examResults.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal({})}>
              {t("examens.addBtn")}
            </button>
          )}
        </div>
      ) : (
        <div className="exam-list">
          {filtered.map(e => (
            <ExamCard key={e.id} exam={e} locale={locale}
              onEdit={() => setModal({ exam: e })}
              onDelete={async () => {
                if (await confirmDialog(t("examens.deleteConfirm", { title: e.title }))) {
                  deleteExamResult(e.id);
                  showToast(t("examens.toastDeleted"));
                }
              }}
              onPrint={() => printExam(e, doctorName)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <ExamModal initial={modal.exam} patients={patients} doctorName={doctorName}
          onSave={data => {
            if (modal.exam) { updateExamResult({ ...modal.exam, ...data }); showToast(t("examens.toastModified")); }
            else { addExamResult(data); showToast(t("examens.toastAdded")); }
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

    </Layout>
  );
}
