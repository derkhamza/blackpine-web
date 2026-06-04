import { useState } from "react";
import type { OrdonnanceLine, CabinetDoctorProfile } from "../lib/cabinetTypes";
import {
  printOrdonnance,
  COMMON_DRUGS, COMMON_FREQUENCIES, COMMON_DURATIONS,
} from "../lib/ordonnancePrinter";

// ── Datalist helpers ──────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const BLANK_LINE: () => OrdonnanceLine & { _key: string } = () => ({
  _key: uid(), drug: "", dosage: "", frequency: "2 fois par jour", duration: "7 jours", notes: "",
});

type LineWithKey = OrdonnanceLine & { _key: string };

// ── Single medication row ─────────────────────────────────────────────────────

function MedRow({
  line, idx, total, onChange, onDelete, onMove,
}: {
  line:     LineWithKey;
  idx:      number;
  total:    number;
  onChange: (patch: Partial<OrdonnanceLine>) => void;
  onDelete: () => void;
  onMove:   (dir: -1 | 1) => void;
}) {
  const drugId = `drug-list-${line._key}`;
  const freqId = `freq-list-${line._key}`;
  const durId  = `dur-list-${line._key}`;

  return (
    <div className="ord-med-row">
      <div className="ord-med-num">{idx + 1}.</div>

      <div className="ord-med-fields">
        {/* Drug name */}
        <div className="ord-field-wide">
          <input
            className="form-input ord-input"
            placeholder="Médicament (ex: Amoxicilline cp 500 mg)"
            value={line.drug}
            onChange={e => onChange({ drug: e.target.value })}
            list={drugId}
            autoFocus={idx === 0}
          />
          <datalist id={drugId}>
            {COMMON_DRUGS.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>

        <div className="ord-field-row">
          {/* Dosage */}
          <div className="ord-field-sm">
            <input
              className="form-input ord-input"
              placeholder="Dosage (ex: 1 cp)"
              value={line.dosage ?? ""}
              onChange={e => onChange({ dosage: e.target.value })}
            />
          </div>

          {/* Frequency */}
          <div className="ord-field-md">
            <input
              className="form-input ord-input"
              placeholder="Fréquence"
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
              placeholder="Durée"
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
          placeholder="Remarque (ex: à prendre avec de la nourriture)"
          value={line.notes ?? ""}
          onChange={e => onChange({ notes: e.target.value })}
        />
      </div>

      {/* Actions */}
      <div className="ord-med-actions">
        <button className="ord-move-btn" onClick={() => onMove(-1)} disabled={idx === 0} title="Monter">▲</button>
        <button className="ord-move-btn" onClick={() => onMove(1)}  disabled={idx === total - 1} title="Descendre">▼</button>
        <button className="ord-del-btn" onClick={onDelete} title="Supprimer">
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
  initialLines?: OrdonnanceLine[];   // pre-loaded from appointment
  onSave:        (lines: OrdonnanceLine[]) => void;
  onClose:       () => void;
}

export function OrdonnanceModal({
  patientName, date, doctorProfile, initialLines, onSave, onClose,
}: Props) {
  const [lines, setLines] = useState<LineWithKey[]>(() =>
    initialLines && initialLines.length > 0
      ? initialLines.map(l => ({ ...l, _key: uid() }))
      : [BLANK_LINE()]
  );

  const updateLine = (idx: number, patch: Partial<OrdonnanceLine>) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const deleteLine = (idx: number) => {
    setLines(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [BLANK_LINE()] : next;
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

  const handlePrint = () => {
    const clean = lines.filter(l => l.drug.trim());
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
              Ordonnance — {patientName}
            </h2>
            {isProfileEmpty && (
              <div className="ord-profile-warn">
                ⚠️ En-tête incomplet — renseignez votre profil médecin pour l'imprimer correctement.
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Patient / date info strip */}
          <div className="ord-info-strip">
            <div className="ord-info-item">
              <span className="ord-info-label">Patient(e)</span>
              <span className="ord-info-value">{patientName}</span>
            </div>
            <div className="ord-info-item">
              <span className="ord-info-label">Date</span>
              <span className="ord-info-value">
                {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
            <div className="ord-info-item">
              <span className="ord-info-label">Médecin</span>
              <span className="ord-info-value">{doctorProfile.fullName || "—"}</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="ord-col-headers">
            <span style={{ flex: 2 }}>Médicament</span>
            <span style={{ flex: 1 }}>Dosage</span>
            <span style={{ flex: 1.5 }}>Fréquence</span>
            <span style={{ flex: 1 }}>Durée</span>
          </div>

          {/* Medication lines */}
          <div className="ord-med-list">
            {lines.map((l, i) => (
              <MedRow
                key={l._key}
                line={l}
                idx={i}
                total={lines.length}
                onChange={patch => updateLine(i, patch)}
                onDelete={() => deleteLine(i)}
                onMove={dir => moveLine(i, dir)}
              />
            ))}
          </div>

          {/* Add medication */}
          <button
            className="ord-add-btn"
            onClick={() => setLines(prev => [...prev, BLANK_LINE()])}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Ajouter un médicament
          </button>
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-ghost" onClick={handleSaveOnly}>
            Enregistrer sans imprimer
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={!lines.some(l => l.drug.trim())}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
              </svg>
              Imprimer l'ordonnance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
