import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OrdonnanceLine, CabinetDoctorProfile } from "../lib/cabinetTypes";
import {
  printOrdonnance,
  COMMON_DRUGS, COMMON_FREQUENCIES, COMMON_DURATIONS,
} from "../lib/ordonnancePrinter";
import { useCabinet } from "../context/CabinetContext";
import { searchMedications, type MedicationHit } from "../api/client";
import { track } from "../lib/analytics";

// Build a clean, prescribable label from an official DMP record. Includes the
// DCI so the native datalist matches both brand- and molecule-typed searches.
function medOptionValue(h: MedicationHit): string {
  const brand = h.nom.trim();
  const dci = (h.dci ?? "").trim();
  return dci && !brand.toUpperCase().includes(dci.toUpperCase())
    ? `${brand} (${dci})`
    : brand;
}
function medOptionLabel(h: MedicationHit): string {
  const bits = [h.forme, h.tauxRemboursement ? `remb. ${h.tauxRemboursement}` : "", h.ppv ? `${h.ppv} DH` : ""]
    .filter(Boolean);
  return bits.join(" · ");
}

// ── Allergy safety helpers ────────────────────────────────────────────────────

// "RAS", "aucune", etc. mean *no* allergy — never warn for these.
const NONE_ALLERGY = new Set(["aucune", "aucun", "ras", "neant", "non", "rien", "none", "no", "-", "0", "nil"]);

function normalizeTxt(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Split a free-text allergy field into matchable terms (≥3 chars, no sentinels). */
function parseAllergyTerms(allergies?: string): string[] {
  if (!allergies) return [];
  const norm = normalizeTxt(allergies).trim();
  if (!norm || NONE_ALLERGY.has(norm)) return [];
  return norm
    .split(/[,;/\n·]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !NONE_ALLERGY.has(t));
}

/** Does a prescribed drug name contain any recorded allergy term? */
function drugConflicts(drug: string, terms: string[]): boolean {
  if (!drug.trim() || terms.length === 0) return false;
  const d = normalizeTxt(drug);
  return terms.some(term => d.includes(term));
}

// ── Datalist helpers ──────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

type LineWithKey = OrdonnanceLine & { _key: string };

const blankLine = (): LineWithKey => ({
  _key: uid(), drug: "", dosage: "", frequency: "2 fois par jour", duration: "7 jours", notes: "",
});

// ── Single medication row ─────────────────────────────────────────────────────

function MedRow({
  line, idx, total, allDrugs, conflict, onChange, onDelete, onMove,
}: {
  line:     LineWithKey;
  idx:      number;
  total:    number;
  allDrugs: string[];
  conflict?: boolean;
  onChange: (patch: Partial<OrdonnanceLine>) => void;
  onDelete: () => void;
  onMove:   (dir: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const drugId = `drug-list-${line._key}`;
  const freqId = `freq-list-${line._key}`;
  const durId  = `dur-list-${line._key}`;

  // Live search against the official DMP/CNOPS reference (online); the static
  // `allDrugs` list remains as the offline fallback.
  const [serverHits, setServerHits] = useState<MedicationHit[]>([]);
  useEffect(() => {
    const q = line.drug.trim();
    if (q.length < 2) { setServerHits([]); return; }
    let cancelled = false;
    const ctrl = new AbortController();
    const tid = setTimeout(() => {
      searchMedications(q, ctrl.signal)
        .then(hits => { if (!cancelled) setServerHits(hits); })
        .catch(() => { /* offline / aborted → keep static list */ });
    }, 250);
    return () => { cancelled = true; clearTimeout(tid); ctrl.abort(); };
  }, [line.drug]);

  return (
    <div className="ord-med-row">
      <div className="ord-med-num">{idx + 1}.</div>

      <div className="ord-med-fields">
        {/* Drug name */}
        <div className="ord-field-wide">
          <input
            className={`form-input ord-input${conflict ? " ord-input-conflict" : ""}`}
            style={conflict ? { borderColor: "var(--coral)", background: "var(--coral-soft)" } : undefined}
            placeholder={t("ordModal.drugPlaceholder")}
            value={line.drug}
            onChange={e => onChange({ drug: e.target.value })}
            list={drugId}
            autoFocus={idx === 0}
            title={conflict ? t("ordModal.allergyConflict", { drugs: line.drug }) : undefined}
          />
          <datalist id={drugId}>
            {serverHits.map(h => (
              <option key={h.code} value={medOptionValue(h)} label={medOptionLabel(h)} />
            ))}
            {allDrugs.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>

        <div className="ord-field-row">
          {/* Dosage */}
          <div className="ord-field-sm">
            <input
              className="form-input ord-input"
              placeholder={t("ordModal.dosagePlaceholder")}
              value={line.dosage ?? ""}
              onChange={e => onChange({ dosage: e.target.value })}
            />
          </div>

          {/* Frequency */}
          <div className="ord-field-md">
            <input
              className="form-input ord-input"
              placeholder={t("ordModal.freqPlaceholder")}
              value={line.frequency}
              onChange={e => onChange({ frequency: e.target.value })}
              list={freqId}
            />
            <datalist id={freqId}>
              {COMMON_FREQUENCIES.map(f => <option key={f} value={f} />)}
            </datalist>
          </div>

          {/* Duration */}
          <div className="ord-field-sm">
            <input
              className="form-input ord-input"
              placeholder={t("ordModal.durPlaceholder")}
              value={line.duration}
              onChange={e => onChange({ duration: e.target.value })}
              list={durId}
            />
            <datalist id={durId}>
              {COMMON_DURATIONS.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
        </div>

        {/* Notes */}
        <input
          className="form-input ord-input ord-notes-input"
          placeholder={t("ordModal.notesPlaceholder")}
          value={line.notes ?? ""}
          onChange={e => onChange({ notes: e.target.value })}
        />
      </div>

      {/* Actions */}
      <div className="ord-med-actions">
        <button className="ord-move-btn" onClick={() => onMove(-1)} disabled={idx === 0} title={t("ordModal.moveUp")}>▲</button>
        <button className="ord-move-btn" onClick={() => onMove(1)}  disabled={idx === total - 1} title={t("ordModal.moveDown")}>▼</button>
        <button className="ord-del-btn" onClick={onDelete} title={t("common.delete")}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M2 3h10M5 3V2h4v1M4 3v9h6V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  patientName:   string;
  date:          string;             // ISO "YYYY-MM-DD"
  doctorProfile: CabinetDoctorProfile;
  allergies?:    string;             // patient's recorded allergies (free text)
  lastOrdonnance?: OrdonnanceLine[];  // this patient's most recent prior prescription
  initialLines?: OrdonnanceLine[];   // pre-loaded from appointment
  onSave:        (lines: OrdonnanceLine[]) => void;
  onClose:       () => void;
}

export function OrdonnanceModal({
  patientName, date, doctorProfile, allergies, lastOrdonnance, initialLines, onSave, onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const { prescriptionTemplates, addPrescriptionTemplate, deletePrescriptionTemplate } = useCabinet();
  const allDrugs = [...COMMON_DRUGS, ...(doctorProfile.customDrugs ?? [])]
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => a.localeCompare(b));

  const locale =
    i18n.language?.slice(0, 2) === "ar" ? "ar-MA" :
    i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const [lines, setLines] = useState<LineWithKey[]>(() =>
    initialLines && initialLines.length > 0
      ? initialLines.map(l => ({ ...l, _key: uid() }))
      : [blankLine()]
  );

  // ── Template panel state ──────────────────────────────────────────────────
  const [showTpl,  setShowTpl]  = useState(false);
  const [tplName,  setTplName]  = useState("");
  const [showSave, setShowSave] = useState(false);

  // ── Line operations ───────────────────────────────────────────────────────
  const updateLine = (idx: number, patch: Partial<OrdonnanceLine>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const deleteLine = (idx: number) => {
    setLines(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [blankLine()] : next;
    });
  };

  const moveLine = (idx: number, dir: -1 | 1) => {
    setLines(prev => {
      const next = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= next.length) return next;
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  // ── Template operations ───────────────────────────────────────────────────
  const loadTemplate = (tpl: { lines: OrdonnanceLine[] }) => {
    const hasContent = lines.some(l => l.drug.trim());
    if (hasContent && !window.confirm(t("ordModal.loadConfirm"))) return;
    setLines(tpl.lines.map(l => ({ ...l, _key: uid() })));
    setShowTpl(false);
  };

  const repeatLast = () => {
    if (!lastOrdonnance || lastOrdonnance.length === 0) return;
    const hasContent = lines.some(l => l.drug.trim());
    if (hasContent && !window.confirm(t("ordModal.loadConfirm"))) return;
    setLines(lastOrdonnance.map(l => ({ ...l, _key: uid() })));
  };

  const saveAsTemplate = () => {
    const name = tplName.trim();
    if (!name) return;
    const clean = lines.filter(l => l.drug.trim());
    if (clean.length === 0) return;
    addPrescriptionTemplate({ name, lines: clean });
    setTplName("");
    setShowSave(false);
  };

  // ── Submit handlers ───────────────────────────────────────────────────────
  const handlePrint = () => {
    const clean = lines.filter(l => l.drug.trim());
    track("action:print_ordonnance");
    printOrdonnance({ lines: clean, patientName, date, doctorProfile });
    onSave(clean);
    onClose();
  };

  const handleSaveOnly = () => {
    const clean = lines.filter(l => l.drug.trim());
    onSave(clean);
    onClose();
  };

  const isProfileEmpty = !doctorProfile.fullName;
  const hasLines       = lines.some(l => l.drug.trim());

  // ── Allergy safety ──────────────────────────────────────────────────────────
  const allergyRaw      = (allergies ?? "").trim();
  const showAllergyInfo = allergyRaw !== "" && !NONE_ALLERGY.has(normalizeTxt(allergyRaw));
  const allergyTerms    = parseAllergyTerms(allergyRaw);
  const conflictDrugs   = [...new Set(
    lines.filter(l => drugConflicts(l.drug, allergyTerms)).map(l => l.drug.trim()),
  )];

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal ord-modal" style={{ maxWidth: 640, maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginRight: 7, verticalAlign: "middle" }}>
                <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 5h4M5 7.5h4M5 10h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M11 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {t("ordModal.title", { name: patientName })}
            </h2>
            {isProfileEmpty && (
              <div className="ord-profile-warn">
                {t("ordModal.profileWarn")}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Repeat last prescription — chronic-patient one-click */}
            {lastOrdonnance && lastOrdonnance.length > 0 && (
              <button className="btn btn-ghost" onClick={repeatLast} title={t("ordModal.repeatLastHint")}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}>
                  <path d="M2 7a5 5 0 1 1 1.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M2 10.5V7.8h2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("ordModal.repeatLast")}
              </button>
            )}
            {/* Templates toggle */}
            <button
              className={`btn btn-ghost tpl-toggle-btn${showTpl ? " active" : ""}`}
              onClick={() => setShowTpl(v => !v)}
              title={t("ordModal.tplToggle")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}>
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              {t("ordModal.tplToggle")} {prescriptionTemplates.length > 0 && (
                <span className="tpl-count-badge">{prescriptionTemplates.length}</span>
              )}
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          {/* Patient / date info strip */}
          <div className="ord-info-strip">
            <div className="ord-info-item">
              <span className="ord-info-label">{t("ordModal.patientLabel")}</span>
              <span className="ord-info-value">{patientName}</span>
            </div>
            <div className="ord-info-item">
              <span className="ord-info-label">{t("ordModal.dateLabel")}</span>
              <span className="ord-info-value">
                {new Date(date + "T12:00:00").toLocaleDateString(locale, {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
            <div className="ord-info-item">
              <span className="ord-info-label">{t("ordModal.doctorLabel")}</span>
              <span className="ord-info-value">{doctorProfile.fullName || "—"}</span>
            </div>
          </div>

          {/* Allergy safety banner — surfaced when the patient has recorded allergies */}
          {showAllergyInfo && (
            <div className={`ord-allergy-banner${conflictDrugs.length > 0 ? " conflict" : ""}`}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M8 1.5L15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M8 6v3.5M8 11.4v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <div style={{ minWidth: 0 }}>
                <div className="ord-allergy-title">{t("ordModal.allergyKnown")} : {allergyRaw}</div>
                {conflictDrugs.length > 0 && (
                  <div className="ord-allergy-conflict">
                    {t("ordModal.allergyConflict", { drugs: conflictDrugs.join(", ") })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Templates panel ── */}
          {showTpl && (
            <div className="tpl-panel">
              <div className="tpl-panel-hdr">
                <span className="tpl-panel-title">
                  {t("ordModal.tplPanelTitle")}
                </span>
                <span className="tpl-panel-hint">
                  {t("ordModal.tplHint")}
                </span>
              </div>

              {prescriptionTemplates.length === 0 ? (
                <div className="tpl-empty">
                  {t("ordModal.tplEmpty")}
                </div>
              ) : (
                <div className="tpl-list">
                  {prescriptionTemplates.map(tpl => (
                    <div key={tpl.id} className="tpl-card">
                      <div className="tpl-card-info">
                        <div className="tpl-card-name">{tpl.name}</div>
                        <div className="tpl-card-preview">
                          {tpl.lines.slice(0, 3).map(l => l.drug).join(" · ")}
                          {tpl.lines.length > 3 && ` · +${tpl.lines.length - 3}`}
                        </div>
                      </div>
                      <div className="tpl-card-actions">
                        <span className="tpl-drug-count">{t("ordModal.medCount", { n: tpl.lines.length })}</span>
                        <button className="tpl-load-btn" onClick={() => loadTemplate(tpl)}>
                          {t("ordModal.load")}
                        </button>
                        <button
                          className="tpl-del-btn"
                          onClick={() => {
                            if (window.confirm(t("ordModal.tplDeleteConfirm", { name: tpl.name })))
                              deletePrescriptionTemplate(tpl.id);
                          }}
                          title={t("common.delete")}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Save current as template */}
              <div className="tpl-save-row">
                {showSave ? (
                  <div className="tpl-save-form">
                    <input
                      className="form-input tpl-name-input"
                      placeholder={t("ordModal.tplNamePlaceholder")}
                      value={tplName}
                      onChange={e => setTplName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveAsTemplate()}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: "5px 12px" }}
                      onClick={saveAsTemplate}
                      disabled={!tplName.trim() || !hasLines}
                    >
                      {t("common.save")}
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "5px 10px" }}
                      onClick={() => { setShowSave(false); setTplName(""); }}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    className="tpl-save-trigger"
                    onClick={() => setShowSave(true)}
                    disabled={!hasLines}
                    title={hasLines ? t("ordModal.tplSaveTooltip") : t("ordModal.tplSaveDisabled")}
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                      <path d="M2 2h8l2 2v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5 2v4h4V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M4 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    {t("ordModal.saveAsTpl")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Column headers */}
          <div className="ord-col-headers">
            <span style={{ flex: 2 }}>{t("ordModal.colDrug")}</span>
            <span style={{ flex: 1 }}>{t("ordModal.colDosage")}</span>
            <span style={{ flex: 1.5 }}>{t("ordModal.colFreq")}</span>
            <span style={{ flex: 1 }}>{t("ordModal.colDuration")}</span>
          </div>

          {/* Medication lines */}
          <div className="ord-med-list">
            {lines.map((l, i) => (
              <MedRow
                key={l._key}
                line={l}
                idx={i}
                total={lines.length}
                allDrugs={allDrugs}
                conflict={drugConflicts(l.drug, allergyTerms)}
                onChange={patch => updateLine(i, patch)}
                onDelete={() => deleteLine(i)}
                onMove={dir => moveLine(i, dir)}
              />
            ))}
          </div>

          {/* Add medication */}
          <button
            className="ord-add-btn"
            onClick={() => setLines(prev => [...prev, blankLine()])}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {t("ordModal.addDrug")}
          </button>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-ghost" onClick={handleSaveOnly}>
            {t("ordModal.saveOnly")}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={!hasLines}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
              </svg>
              {t("ordModal.printBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
