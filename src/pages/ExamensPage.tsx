import { FormEvent, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import type { ExamResult, ExamType, ExamValue } from "../lib/cabinetTypes";
import { EXAM_TYPE_LABELS, EXAM_TYPE_COLORS } from "../lib/cabinetTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

const EXAM_TYPES: ExamType[] = ["biologie", "imagerie", "ecg", "autre"];

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function isValueAbnormal(v: ExamValue): boolean {
  if (v.isAbnormal !== undefined) return v.isAbnormal;
  const num = parseFloat(v.value);
  if (isNaN(num)) return false;
  if (v.refMin !== undefined && num < v.refMin) return true;
  if (v.refMax !== undefined && num > v.refMax) return true;
  return false;
}

function examHasAbnormal(exam: ExamResult): boolean {
  return exam.values.some(v => isValueAbnormal(v));
}

// Common lab reference values (biologie)
const COMMON_LABS: Array<{ label: string; unit: string; refMin: number; refMax: number }> = [
  { label: "Hémoglobine", unit: "g/dL", refMin: 12, refMax: 17 },
  { label: "Globules rouges", unit: "×10⁶/µL", refMin: 3.8, refMax: 5.9 },
  { label: "Globules blancs", unit: "×10³/µL", refMin: 4, refMax: 11 },
  { label: "Plaquettes", unit: "×10³/µL", refMin: 150, refMax: 400 },
  { label: "Glycémie", unit: "g/L", refMin: 0.7, refMax: 1.1 },
  { label: "Créatinine", unit: "µmol/L", refMin: 50, refMax: 110 },
  { label: "Urée", unit: "mmol/L", refMin: 2.5, refMax: 7.5 },
  { label: "ASAT (GOT)", unit: "UI/L", refMin: 0, refMax: 40 },
  { label: "ALAT (GPT)", unit: "UI/L", refMin: 0, refMax: 40 },
  { label: "Cholestérol total", unit: "g/L", refMin: 0, refMax: 2 },
  { label: "LDL", unit: "g/L", refMin: 0, refMax: 1.6 },
  { label: "HDL", unit: "g/L", refMin: 0.4, refMax: 1.6 },
  { label: "Triglycérides", unit: "g/L", refMin: 0, refMax: 1.5 },
  { label: "TSH", unit: "mUI/L", refMin: 0.4, refMax: 4 },
  { label: "CRP", unit: "mg/L", refMin: 0, refMax: 10 },
  { label: "Vitamine D", unit: "ng/mL", refMin: 30, refMax: 100 },
  { label: "Ferritine", unit: "ng/mL", refMin: 15, refMax: 300 },
  { label: "HbA1c", unit: "%", refMin: 0, refMax: 5.7 },
];

function printExam(exam: ExamResult, doctorName?: string) {
  const abnormal = exam.values.filter(v => isValueAbnormal(v));
  const valRows = exam.values.map(v => {
    const abn = isValueAbnormal(v);
    return `<tr style="${abn ? "background:#FFF0F0;" : ""}">
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${v.label}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:${abn ? "#E85B5B" : "#111"}">
        ${v.value}${v.unit ? " " + v.unit : ""}${abn ? " ⚠" : ""}
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
<h1>${exam.title}</h1>
<div class="sub">
  Patient : <strong>${exam.patientName}</strong> &nbsp;|&nbsp;
  Date : <strong>${fmtDate(exam.date)}</strong> &nbsp;|&nbsp;
  Type : ${EXAM_TYPE_LABELS[exam.type]}
  ${exam.labName ? " &nbsp;|&nbsp; Labo : " + exam.labName : ""}
</div>
${abnormal.length > 0
  ? `<div class="alert">⚠ ${abnormal.length} résultat${abnormal.length > 1 ? "s" : ""} anormal${abnormal.length > 1 ? "aux" : ""} : ${abnormal.map(v => v.label).join(", ")}</div>`
  : ""}
<table>
  <thead><tr>
    <th>Paramètre</th>
    <th style="text-align:right">Résultat</th>
    <th style="text-align:right">Valeurs normales</th>
  </tr></thead>
  <tbody>${valRows}</tbody>
</table>
${exam.notes ? `<div style="background:#f9f9f9;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:14px"><strong>Observations :</strong> ${exam.notes}</div>` : ""}
<div class="footer">
  Médecin : ${doctorName ?? "—"} &nbsp;|&nbsp; Imprimé le ${new Date().toLocaleDateString("fr-FR")}
</div>
<script>window.onload = () => window.print();</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Exam value editor row ──────────────────────────────────────────────────────

interface ValueRowProps {
  value: ExamValue;
  onChange: (v: ExamValue) => void;
  onRemove: () => void;
  showRemove: boolean;
  examType: ExamType;
}

function ValueRow({ value, onChange, onRemove, showRemove, examType }: ValueRowProps) {
  const labelRef = useRef<HTMLInputElement>(null);

  const selectPreset = (preset: typeof COMMON_LABS[0]) => {
    onChange({
      ...value,
      label:  preset.label,
      unit:   preset.unit,
      refMin: preset.refMin,
      refMax: preset.refMax,
    });
  };

  const numVal = parseFloat(value.value);
  const abnormal = isValueAbnormal(value);

  return (
    <div className={`exam-value-row${abnormal ? " abnormal" : ""}`}>
      <div className="exam-value-main">
        {/* Label */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input
            ref={labelRef}
            className="form-input exam-value-label"
            value={value.label}
            onChange={e => onChange({ ...value, label: e.target.value })}
            placeholder="Paramètre *"
            list={examType === "biologie" ? "common-labs-list" : undefined}
            required
          />
          {examType === "biologie" && (
            <datalist id="common-labs-list">
              {COMMON_LABS.map(l => (
                <option key={l.label} value={l.label} />
              ))}
            </datalist>
          )}
        </div>
        {/* Value */}
        <input
          className={`form-input exam-value-val${abnormal ? " exam-val-abnormal" : ""}`}
          value={value.value}
          onChange={e => onChange({ ...value, value: e.target.value })}
          placeholder="Résultat"
          required
        />
        {/* Unit */}
        <input
          className="form-input exam-value-unit"
          value={value.unit ?? ""}
          onChange={e => onChange({ ...value, unit: e.target.value || undefined })}
          placeholder="Unité"
        />
      </div>
      <div className="exam-value-refs">
        {/* Ref range */}
        <input
          className="form-input exam-value-ref"
          type="number"
          step="any"
          value={value.refMin ?? ""}
          onChange={e => {
            const v = parseFloat(e.target.value);
            onChange({ ...value, refMin: isNaN(v) ? undefined : v });
          }}
          placeholder="Min norm."
          title="Valeur normale minimale"
        />
        <span style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0 }}>—</span>
        <input
          className="form-input exam-value-ref"
          type="number"
          step="any"
          value={value.refMax ?? ""}
          onChange={e => {
            const v = parseFloat(e.target.value);
            onChange({ ...value, refMax: isNaN(v) ? undefined : v });
          }}
          placeholder="Max norm."
          title="Valeur normale maximale"
        />
        {/* Preset fill button */}
        {examType === "biologie" && value.label && (
          <button
            type="button"
            className="exam-preset-btn"
            title="Charger les valeurs normales pour ce paramètre"
            onClick={() => {
              const preset = COMMON_LABS.find(l => l.label.toLowerCase() === value.label.toLowerCase());
              if (preset) selectPreset(preset);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 1 0 8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M6 2v4M4 4l2-2 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {/* Manual abnormal flag */}
        {isNaN(numVal) && value.value && (
          <button
            type="button"
            className={`exam-flag-btn${value.isAbnormal ? " active" : ""}`}
            title={value.isAbnormal ? "Marquer comme normal" : "Marquer comme anormal"}
            onClick={() => onChange({ ...value, isAbnormal: !value.isAbnormal })}
          >
            ⚠
          </button>
        )}
        {/* Remove */}
        {showRemove && (
          <button type="button" className="po-line-remove" onClick={onRemove} title="Supprimer">
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
  const today = todayIso();
  const [patientId,    setPatientId]    = useState(initial?.patientId    ?? "");
  const [patientName,  setPatientName]  = useState(initial?.patientName  ?? "");
  const [type,         setType]         = useState<ExamType>(initial?.type ?? "biologie");
  const [date,         setDate]         = useState(initial?.date         ?? today);
  const [title,        setTitle]        = useState(initial?.title        ?? "");
  const [labName,      setLabName]      = useState(initial?.labName      ?? "");
  const [requestedBy,  setRequestedBy]  = useState(initial?.requestedBy  ?? "");
  const [notes,        setNotes]        = useState(initial?.notes        ?? "");
  const [values, setValues] = useState<ExamValue[]>(
    initial?.values?.length
      ? initial.values
      : [{ label: "", value: "", unit: undefined, refMin: undefined, refMax: undefined }]
  );

  const handleSelectPatient = (pid: string) => {
    setPatientId(pid);
    const p = patients.find(x => x.id === pid);
    if (p) setPatientName(p.firstName + " " + p.lastName);
    else setPatientName("");
  };

  const addValue = () =>
    setValues(prev => [...prev, { label: "", value: "", unit: undefined, refMin: undefined, refMax: undefined }]);

  const updateValue = (i: number, v: ExamValue) =>
    setValues(prev => prev.map((x, j) => j === i ? v : x));

  const removeValue = (i: number) =>
    setValues(prev => prev.filter((_, j) => j !== i));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validValues = values.filter(v => v.label.trim() && v.value.trim());
    if (!title.trim() || validValues.length === 0) return;
    const name = patientId
      ? (patients.find(p => p.id === patientId)?.firstName ?? "") + " " + (patients.find(p => p.id === patientId)?.lastName ?? "")
      : patientName.trim();
    onSave({
      patientId:   patientId   || undefined,
      patientName: name        || "Patient inconnu",
      type,
      date,
      title:       title.trim(),
      labName:     labName.trim()     || undefined,
      requestedBy: requestedBy.trim() || undefined,
      notes:       notes.trim()       || undefined,
      values:      validValues,
    });
  };

  const autoFillFromTitle = () => {
    // map exam title to preset values
    const lower = title.toLowerCase();
    let presets: typeof COMMON_LABS = [];
    if (lower.includes("nfs") || lower.includes("numération")) {
      presets = COMMON_LABS.filter(l => ["Hémoglobine", "Globules rouges", "Globules blancs", "Plaquettes"].includes(l.label));
    } else if (lower.includes("bilan lipidique") || lower.includes("lipid")) {
      presets = COMMON_LABS.filter(l => ["Cholestérol total", "LDL", "HDL", "Triglycérides"].includes(l.label));
    } else if (lower.includes("bilan hépatique") || lower.includes("transaminase")) {
      presets = COMMON_LABS.filter(l => ["ASAT (GOT)", "ALAT (GPT)"].includes(l.label));
    } else if (lower.includes("glycémie") || lower.includes("glucose")) {
      presets = COMMON_LABS.filter(l => l.label === "Glycémie");
    } else if (lower.includes("hba1c") || lower.includes("hémoglobine glyquée")) {
      presets = COMMON_LABS.filter(l => l.label === "HbA1c");
    } else if (lower.includes("thyroïde") || lower.includes("tsh")) {
      presets = COMMON_LABS.filter(l => l.label === "TSH");
    } else if (lower.includes("bilan rénal") || lower.includes("créatinine")) {
      presets = COMMON_LABS.filter(l => ["Créatinine", "Urée"].includes(l.label));
    }
    if (presets.length > 0) {
      setValues(presets.map(p => ({
        label: p.label, value: "", unit: p.unit, refMin: p.refMin, refMax: p.refMax,
      })));
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{initial?.id ? "Modifier l'examen" : "Nouvel examen / résultat"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Patient + type */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Patient</label>
                <select
                  className="form-input"
                  value={patientId}
                  onChange={e => handleSelectPatient(e.target.value)}
                >
                  <option value="">— Sélectionner ou saisir —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
              {!patientId && (
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Nom du patient (libre)</label>
                  <input
                    className="form-input"
                    value={patientName}
                    onChange={e => setPatientName(e.target.value)}
                    placeholder="Prénom Nom"
                  />
                </div>
              )}
              <div className="form-group" style={{ flex: "0 0 150px" }}>
                <label className="form-label">Type</label>
                <select className="form-input" value={type} onChange={e => setType(e.target.value as ExamType)}>
                  {EXAM_TYPES.map(t => (
                    <option key={t} value={t}>{EXAM_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title + date */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Titre de l'examen *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={autoFillFromTitle}
                    placeholder="Ex : NFS, Glycémie à jeun, Echo abdominale…"
                    required
                    style={{ flex: 1 }}
                    list="exam-titles-list"
                  />
                  <datalist id="exam-titles-list">
                    {["NFS", "Bilan lipidique", "Bilan hépatique", "Glycémie à jeun", "HbA1c", "TSH",
                      "Bilan rénal", "CRP", "Vitamine D", "Ferritine",
                      "ECG de repos", "Radiographie thoracique", "Échographie abdominale",
                      "Échographie cardiaque", "IRM", "Scanner", "Bilan pré-opératoire"].map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {type === "biologie" && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, whiteSpace: "nowrap" }}
                      onClick={autoFillFromTitle}
                      title="Remplir automatiquement les paramètres"
                    >
                      Auto-fill
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ flex: "0 0 150px" }}>
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={date}
                  onChange={e => setDate(e.target.value)} required />
              </div>
            </div>

            {/* Lab + doctor */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Laboratoire / Centre</label>
                <input className="form-input" value={labName}
                  onChange={e => setLabName(e.target.value)}
                  placeholder="Ex : Laboratoire Al-Shifa" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Prescripteur</label>
                <input className="form-input" value={requestedBy}
                  onChange={e => setRequestedBy(e.target.value)}
                  placeholder={doctorName ?? "Médecin prescripteur"} />
              </div>
            </div>

            {/* Values */}
            <div className="form-group">
              <label className="form-label">
                Résultats
                {type === "biologie" && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>← saisir le nom et presser Tab pour charger les normes</span>}
              </label>
              <div className="exam-values-list">
                <div className="exam-values-header">
                  <span className="exam-col-lbl">Paramètre</span>
                  <span className="exam-col-val">Résultat</span>
                  <span className="exam-col-unit">Unité</span>
                  <span className="exam-col-refs">Min — Max normal</span>
                </div>
                {values.map((v, i) => (
                  <ValueRow
                    key={i}
                    value={v}
                    onChange={nv => updateValue(i, nv)}
                    onRemove={() => removeValue(i)}
                    showRemove={values.length > 1}
                    examType={type}
                  />
                ))}
                <button type="button" className="po-add-line-btn" onClick={addValue}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Ajouter un paramètre
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Observations / Conclusion</label>
              <textarea
                className="form-input" value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2} placeholder="Observations cliniques, conclusion du biologiste…" />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">
              {initial?.id ? "Enregistrer" : "Enregistrer l'examen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Exam card ──────────────────────────────────────────────────────────────────

function ExamCard({
  exam,
  onEdit,
  onDelete,
  onPrint,
}: {
  exam:     ExamResult;
  onEdit:   () => void;
  onDelete: () => void;
  onPrint:  () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAbnormal = examHasAbnormal(exam);
  const color = EXAM_TYPE_COLORS[exam.type];

  return (
    <div className={`exam-card${hasAbnormal ? " has-abnormal" : ""}`}>
      <div className="exam-card-accent" style={{ background: color }} />
      <div className="exam-card-body" onClick={() => setExpanded(o => !o)} style={{ cursor: "pointer", flex: 1 }}>
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
                Anomalie
              </span>
            )}
          </div>
          <div className="exam-card-meta">
            <span className="exam-patient">{exam.patientName}</span>
            <span>{fmtDate(exam.date)}</span>
            {exam.labName && <span style={{ color: "var(--muted)" }}>{exam.labName}</span>}
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{exam.values.length} paramètre{exam.values.length !== 1 ? "s" : ""}</span>
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
                      ? v.refMin + " – " + v.refMax + (v.unit ? " " + v.unit : "")
                      : ""}
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
        <button className="tele-action-btn" title="Imprimer" onClick={onPrint}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 5V2h8v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <rect x="1" y="5" width="12" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M3 9h8v3H3z" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <button className="tele-action-btn" title="Modifier" onClick={onEdit}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="tx-delete" title="Supprimer" onClick={onDelete}>
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
  const today = todayIso();
  const { examResults, addExamResult, updateExamResult, deleteExamResult, patients, doctorProfile } = useCabinet();

  const [tab,       setTab]       = useState<ViewTab>("all");
  const [modal,     setModal]     = useState<{ exam?: ExamResult } | null>(null);
  const [search,    setSearch]    = useState("");
  const [filterPat, setFilterPat] = useState("all");
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  // KPIs
  const kpi = useMemo(() => {
    const thisMonth = today.slice(0, 7);
    return {
      total:         examResults.length,
      abnormal:      examResults.filter(examHasAbnormal).length,
      thisMonth:     examResults.filter(e => e.date.startsWith(thisMonth)).length,
      biology:       examResults.filter(e => e.type === "biologie").length,
    };
  }, [examResults, today]);

  // Filtered
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

  // Unique patients in exam list for filter
  const examPatients = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of examResults) {
      if (e.patientId) map.set(e.patientId, e.patientName);
      else map.set(e.patientName, e.patientName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [examResults]);

  const doctorName = doctorProfile.fullName || undefined;

  return (
    <Layout
      title="Examens & Biologie"
      subtitle={`${examResults.length} résultat${examResults.length !== 1 ? "s" : ""} enregistré${examResults.length !== 1 ? "s" : ""}`}
      actions={
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nouvel examen
        </button>
      }
    >
      {/* ── KPI strip ── */}
      <div className="four-kpi-strip">
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpi.total}</div>
          <div className="stock-kpi-lbl">Examens</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--blue)" }}>{kpi.biology}</div>
          <div className="stock-kpi-lbl">Bilans biologiques</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: kpi.abnormal > 0 ? "var(--coral)" : "var(--text)" }}>
            {kpi.abnormal}
          </div>
          <div className="stock-kpi-lbl">Résultats anormaux</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--green)" }}>{kpi.thisMonth}</div>
          <div className="stock-kpi-lbl">Ce mois</div>
        </div>
      </div>

      {/* ── Abnormal alert ── */}
      {kpi.abnormal > 0 && tab !== "abnormal" && (
        <div
          className="note-alert-bar"
          style={{ borderColor: "var(--coral)", color: "var(--coral)", background: "#E85B5B10", cursor: "pointer" }}
          onClick={() => setTab("abnormal")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L1 12h12L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>{kpi.abnormal} résultat{kpi.abnormal > 1 ? "s" : ""} anormal{kpi.abnormal > 1 ? "aux" : ""} — cliquer pour filtrer</span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="four-tabs">
        {([
          ["all",      "Tous",          kpi.total],
          ["abnormal", "Anormaux",      kpi.abnormal],
          ["biologie", "Biologie",      examResults.filter(e => e.type === "biologie").length],
          ["imagerie", "Imagerie",      examResults.filter(e => e.type === "imagerie").length],
          ["ecg",      "ECG",           examResults.filter(e => e.type === "ecg").length],
          ["autre",    "Autres",        examResults.filter(e => e.type === "autre").length],
        ] as [ViewTab, string, number][]).filter(([t, , cnt]) => cnt > 0 || t === "all" || t === "abnormal").map(([t, label, cnt]) => (
          <button
            key={t}
            className={`four-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {label}
            <span className="stock-pill-count">{cnt}</span>
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="four-toolbar">
        <select
          className="form-input"
          style={{ flex: "0 0 180px", fontSize: 12 }}
          value={filterPat}
          onChange={e => setFilterPat(e.target.value)}
        >
          <option value="all">Tous les patients</option>
          {examPatients.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="stock-search-wrap" style={{ flex: 1 }}>
          <svg className="stock-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="stock-search-input"
            placeholder="Rechercher un examen, paramètre, patient…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className="agenda-empty" style={{ marginTop: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {examResults.length === 0 ? "Aucun examen enregistré" : "Aucun résultat"}
          </div>
          {examResults.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal({})}>
              Enregistrer un examen
            </button>
          )}
        </div>
      ) : (
        <div className="exam-list">
          {filtered.map(e => (
            <ExamCard
              key={e.id}
              exam={e}
              onEdit={() => setModal({ exam: e })}
              onDelete={() => {
                if (confirm(`Supprimer l'examen "${e.title}" ?`)) {
                  deleteExamResult(e.id);
                  showToast("Examen supprimé");
                }
              }}
              onPrint={() => printExam(e, doctorName)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal !== null && (
        <ExamModal
          initial={modal.exam}
          patients={patients}
          doctorName={doctorName}
          onSave={data => {
            if (modal.exam) { updateExamResult({ ...modal.exam, ...data }); showToast("Examen modifié"); }
            else { addExamResult(data); showToast("Examen enregistré"); }
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
