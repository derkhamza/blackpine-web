import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Patient } from "../lib/cabinetTypes";
import {
  parseCSV, autoDetectMapping, rowToPatient,
  type ColumnMapping, type ImportField,
} from "../lib/csvParser";

const IMPORT_FIELDS: ImportField[] = [
  "firstName", "lastName", "phone", "dateOfBirth", "gender", "cin", "notes",
];
const PREVIEW_ROWS = 5;

interface Props {
  existingPatients: Patient[];
  onImport: (patients: Omit<Patient, "id" | "createdAt">[]) => void;
  onClose:  () => void;
}

export function CsvImportModal({ existingPatients, onImport, onClose }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step,     setStep]    = useState<"upload" | "map">("upload");
  const [headers,  setHeaders] = useState<string[]>([]);
  const [rows,     setRows]    = useState<string[][]>([]);
  const [mapping,  setMapping] = useState<ColumnMapping>({
    firstName: null, lastName: null, phone: null,
    dateOfBirth: null, gender: null, cin: null, notes: null,
  });
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const fieldLabel = (f: ImportField): string => {
    const map: Record<ImportField, string> = {
      firstName:   t("csvModal.fieldFirstName"),
      lastName:    t("csvModal.fieldLastName"),
      phone:       t("csvModal.fieldPhone"),
      dateOfBirth: t("csvModal.fieldDob"),
      gender:      t("csvModal.fieldGender"),
      cin:         t("csvModal.fieldCin"),
      notes:       t("csvModal.fieldNotes"),
    };
    return map[f];
  };

  // ── File handling ────────────────────────────────────────────────────────────

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      setError(t("csvModal.errInvalidFile"));
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { headers, rows } = parseCSV(ev.target?.result as string);
        if (headers.length === 0) { setError(t("csvModal.errEmpty")); return; }
        setHeaders(headers);
        setRows(rows);
        setMapping(autoDetectMapping(headers));
        setError(null);
        setStep("map");
      } catch {
        setError(t("csvModal.errRead"));
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  // ── Derived stats (runs whenever mapping changes) ─────────────────────────────

  const existingPhones = new Set(
    existingPatients.map(p => p.phone?.replace(/\s/g, "")).filter(Boolean),
  );

  const parsed = rows.flatMap(row => {
    const p = rowToPatient(row, mapping);
    return p ? [p] : [];
  });

  const duplicates = parsed.filter(
    p => p.phone && existingPhones.has(p.phone.replace(/\s/g, "")),
  ).length;

  const toImport = parsed.filter(
    p => !p.phone || !existingPhones.has(p.phone.replace(/\s/g, "")),
  );

  const canMap    = mapping.firstName !== null && mapping.lastName !== null;
  const previewData = rows.slice(0, PREVIEW_ROWS);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal csv-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t("csvModal.title")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {step === "upload" && (
          <div className="modal-body">
            {/* Drop zone */}
            <div
              className={`csv-dropzone${dragging ? " dragging" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <div className="csv-drop-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M16 10v12M10 16l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="csv-drop-title">{t("csvModal.dropTitle")}</div>
              <div className="csv-drop-sub">{t("csvModal.dropSub")}</div>
              <div className="csv-drop-hint">{t("csvModal.dropHint")}</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{ display: "none" }} onChange={handleFile} />

            {error && <div className="csv-error">{error}</div>}

            {/* Sample format hint */}
            <div className="csv-sample">
              <div className="csv-sample-title">{t("csvModal.sampleTitle")}</div>
              <code className="csv-sample-code">
                prénom,nom,téléphone,date_naissance,sexe,cin<br/>
                Mohammed,Alami,0661234567,15/03/1985,M,AB123456<br/>
                Fatima,Bakkali,0712345678,22/07/1992,F,
              </code>
            </div>
          </div>
        )}

        {step === "map" && (
          <>
            <div className="modal-body csv-map-body">
              <div className="csv-file-info">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 1h6l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 1v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
                <strong>{rows.length}</strong> {t("csvModal.detectedRows", { n: rows.length })} ·{" "}
                <strong>{headers.length}</strong> {t("csvModal.detectedCols", { n: headers.length })}
              </div>

              {/* Column mapping */}
              <div className="csv-mapping">
                <div className="csv-mapping-title">{t("csvModal.mappingTitle")}</div>
                <div className="csv-mapping-grid">
                  {IMPORT_FIELDS.map(field => (
                    <div key={field} className="csv-mapping-row">
                      <label className="csv-mapping-label">
                        {fieldLabel(field)}
                      </label>
                      <select
                        className={`form-select csv-mapping-select${
                          (field === "firstName" || field === "lastName") && mapping[field] === null
                            ? " csv-select-required"
                            : ""
                        }`}
                        value={mapping[field] ?? ""}
                        onChange={e => setMapping(m => ({
                          ...m,
                          [field]: e.target.value === "" ? null : Number(e.target.value),
                        }))}
                      >
                        <option value="">{t("csvModal.ignoreOption")}</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h || t("csvModal.colNum", { n: i + 1 })}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div className="csv-preview">
                <div className="csv-preview-title">{t("csvModal.previewTitle", { n: Math.min(PREVIEW_ROWS, rows.length) })}</div>
                <div className="csv-preview-wrap">
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        {IMPORT_FIELDS.filter(f => mapping[f] !== null).map(f => (
                          <th key={f}>{fieldLabel(f).replace(" *", "")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => {
                        const p = rowToPatient(row, mapping);
                        return (
                          <tr key={i} className={p ? "" : "csv-row-invalid"}>
                            {IMPORT_FIELDS.filter(f => mapping[f] !== null).map(f => (
                              <td key={f}>
                                {mapping[f] !== null ? row[mapping[f]!] ?? "" : ""}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import summary */}
              {canMap && (
                <div className="csv-summary">
                  <div className="csv-summary-item csv-summary-add">
                    <span className="csv-summary-count">{toImport.length}</span>
                    <span>{t("csvModal.summaryToImport", { s: toImport.length !== 1 ? "s" : "" })}</span>
                  </div>
                  {duplicates > 0 && (
                    <div className="csv-summary-item csv-summary-skip">
                      <span className="csv-summary-count">{duplicates}</span>
                      <span>{t("csvModal.summaryDuplicates", { s: duplicates !== 1 ? "s" : "" })}</span>
                    </div>
                  )}
                  {parsed.length - toImport.length - duplicates > 0 && (
                    <div className="csv-summary-item csv-summary-error">
                      <span className="csv-summary-count">{parsed.length - toImport.length - duplicates}</span>
                      <span>{t("csvModal.summaryInvalid", { s: parsed.length - toImport.length - duplicates !== 1 ? "s" : "" })}</span>
                    </div>
                  )}
                </div>
              )}

              {!canMap && (
                <div className="csv-error" style={{ marginTop: 12 }}>
                  {t("csvModal.warningMap")}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep("upload")}>
                {t("csvModal.backBtn")}
              </button>
              <button
                className="btn btn-primary"
                disabled={!canMap || toImport.length === 0}
                onClick={() => { onImport(toImport); onClose(); }}
              >
                {t("csvModal.importBtn", { n: toImport.length, s: toImport.length !== 1 ? "s" : "" })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
