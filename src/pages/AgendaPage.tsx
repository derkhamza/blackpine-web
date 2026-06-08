import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type {
  Appointment, AppointmentType, AppointmentStatus, Patient, WaTemplate,
} from "../lib/cabinetTypes";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS,
  WA_TEMPLATE_CATEGORY_LABELS, WA_TEMPLATE_CATEGORY_COLORS,
} from "../lib/cabinetTypes";
import { todayIso } from "../lib/format";
import { printReceipt } from "../lib/receiptPrinter";
import { exportAgendaIcal } from "../lib/icalExport";

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekdayMon(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getMondayOfWeek(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;  // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

type RecurrFreq = "weekly" | "biweekly" | "monthly";

function generateRecurringDates(start: string, freq: RecurrFreq, count: number): string[] {
  const dates: string[] = [start];
  for (let i = 1; i < count; i++) {
    const prev = dates[i - 1];
    dates.push(
      freq === "weekly"   ? addDays(prev, 7)
      : freq === "biweekly" ? addDays(prev, 14)
      :                       addMonths(prev, 1),
    );
  }
  return dates;
}

type AgendaView = "day" | "week" | "month";

function colour(hex: string, muted = false) { return muted ? "var(--border)" : hex; }

// ── Time-grid constants ────────────────────────────────────────────────────────
const TG_START  = 7;    // 07:00
const TG_END    = 20;   // 20:00
const TG_PX_H   = 64;   // pixels per hour
const TG_TOTAL  = (TG_END - TG_START) * TG_PX_H;        // 832 px
const TG_HLIST  = Array.from({ length: TG_END - TG_START }, (_, i) => TG_START + i);

function tTop(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return Math.max(0, Math.min(TG_TOTAL, ((h - TG_START) * 60 + m) / 60 * TG_PX_H));
}
function tHeight(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(26, ((eh * 60 + em) - (sh * 60 + sm)) / 60 * TG_PX_H);
}
function snapTime(yPx: number): string {
  const totalMins = (TG_END - TG_START) * 60;
  const raw = Math.round((yPx / TG_TOTAL) * totalMins / 30) * 30;
  const clipped = Math.max(0, Math.min(totalMins - 30, raw));
  const h = TG_START + Math.floor(clipped / 60);
  const m = clipped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TYPE_OPTS: AppointmentType[] = ["consultation", "suivi", "procedure", "urgence", "autre"];
const STATUS_OPTS: AppointmentStatus[] = ["scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show"];

// ── WhatsApp helpers ───────────────────────────────────────────────────────────

function renderWaBody(
  body: string,
  appt: Appointment,
  doctorFullName?: string,
): string {
  const d = new Date(appt.date + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  return body
    .replace(/\{patient\}/g, appt.patientName)
    .replace(/\{date\}/g,    d)
    .replace(/\{heure\}/g,   appt.startTime)
    .replace(/\{docteur\}/g, doctorFullName ? `Dr. ${doctorFullName}` : "le médecin")
    .replace(/\{cabinet\}/g, doctorFullName ? `Cabinet Dr. ${doctorFullName}` : "le cabinet");
}

// ── WhatsApp template picker ──────────────────────────────────────────────────

function WaPickerModal({
  appt, phone, templates, doctorFullName, onClose,
}: {
  appt:           Appointment;
  phone:          string;
  templates:      WaTemplate[];
  doctorFullName?: string;
  onClose:        () => void;
}) {
  const d = new Date(appt.date + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const clean = phone.replace(/\D/g, "");
  const buildUrl = (body: string) =>
    `https://wa.me/${clean}?text=${encodeURIComponent(renderWaBody(body, appt, doctorFullName))}`;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wa-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366" style={{ marginRight: 8, flexShrink: 0 }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
            Envoyer via WhatsApp
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="wa-picker-appt-info">
            <strong>{appt.patientName}</strong>
            <span className="wa-picker-appt-meta">· {d} à {appt.startTime}</span>
          </div>
          <div className="wa-picker-label">Choisissez un modèle de message :</div>
          {templates.length === 0 ? (
            <div className="wa-picker-empty">
              Aucun modèle configuré.{" "}
              <a href="/messages" style={{ color: "var(--blue)" }}>
                Créer des modèles →
              </a>
            </div>
          ) : (
            <div className="wa-picker-list">
              {templates.map(t => (
                <a
                  key={t.id}
                  href={buildUrl(t.body)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wa-picker-card"
                  onClick={onClose}
                >
                  <div className="wa-picker-card-header">
                    <div
                      className="wa-picker-card-dot"
                      style={{ background: WA_TEMPLATE_CATEGORY_COLORS[t.category] }}
                    />
                    <span className="wa-picker-card-name">{t.name}</span>
                    <span
                      className="wa-picker-card-cat"
                      style={{
                        background: WA_TEMPLATE_CATEGORY_COLORS[t.category] + "22",
                        color: WA_TEMPLATE_CATEGORY_COLORS[t.category],
                      }}
                    >
                      {WA_TEMPLATE_CATEGORY_LABELS[t.category]}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" style={{ marginLeft: "auto", flexShrink: 0 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <div className="wa-picker-card-body">
                    {renderWaBody(t.body, appt, doctorFullName)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Appointment modal ─────────────────────────────────────────────────────────

interface ApptModalProps {
  initial?: Partial<Appointment>;
  defaultDate: string;
  isEdit: boolean;
  patients: Patient[];
  onSave:      (a: Omit<Appointment, "id">) => void;
  onSaveBatch?: (appts: Omit<Appointment, "id">[]) => void;
  onClose: () => void;
}

function ApptModal({ initial, defaultDate, isEdit, patients, onSave, onSaveBatch, onClose }: ApptModalProps) {
  const [patientName, setName]  = useState(initial?.patientName ?? "");
  const [linkedPid,   setPid]   = useState(initial?.patientId   ?? "");
  const [date,   setDate]       = useState(initial?.date ?? defaultDate);
  const [start,  setStart]      = useState(initial?.startTime ?? "09:00");
  const [end,    setEnd]        = useState(initial?.endTime ?? "09:30");
  const [type,   setType]       = useState<AppointmentType>(initial?.type ?? "consultation");
  const [status, setStatus]     = useState<AppointmentStatus>(initial?.status ?? "scheduled");
  const [notes,  setNotes]      = useState(initial?.notes ?? "");
  // Recurrence (new appointments only)
  const [recurring,   setRecurring]   = useState(false);
  const [recurrFreq,  setRecurrFreq]  = useState<RecurrFreq>("weekly");
  const [recurrCount, setRecurrCount] = useState(4);

  const handleNameChange = (val: string) => {
    setName(val);
    const match = patients.find(
      p => `${p.firstName} ${p.lastName}`.toLowerCase() === val.trim().toLowerCase()
    );
    setPid(match?.id ?? "");
  };

  const linkedPatient = patients.find(p => p.id === linkedPid);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    const base = {
      patientName: patientName.trim(),
      patientId:   linkedPid || undefined,
      startTime: start, endTime: end, type, status,
      notes: notes || undefined,
    };
    if (!isEdit && recurring && onSaveBatch) {
      const dates = generateRecurringDates(date, recurrFreq, recurrCount);
      onSaveBatch(dates.map(d => ({ ...base, date: d })));
    } else {
      onSave({ ...base, date });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? "Modifier" : "Nouveau"} rendez-vous</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nom du patient</label>
              <input
                className="form-input"
                value={patientName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Nom du patient"
                list="appt-patient-list"
                required autoFocus
              />
              <datalist id="appt-patient-list">
                {patients.map(p => (
                  <option key={p.id} value={`${p.firstName} ${p.lastName}`} />
                ))}
              </datalist>
              {linkedPatient && (
                <div className="appt-linked-patient">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Fiche patient liée · {linkedPatient.phone ?? "Pas de téléphone"}
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Début</label>
                <input className="form-input" type="time" value={start} onChange={e => setStart(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fin</label>
                <input className="form-input" type="time" value={end} onChange={e => setEnd(e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={type} onChange={e => setType(e.target.value as AppointmentType)}>
                  {TYPE_OPTS.map(t => <option key={t} value={t}>{APPT_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Statut</label>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value as AppointmentStatus)}>
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{APPT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optionnel)</label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Motif, remarques…" />
            </div>

            {/* ── Recurrence — new appointments only ── */}
            {!isEdit && (
              <div className="recurrence-section">
                <label className="recurrence-toggle">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={e => setRecurring(e.target.checked)}
                  />
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M7 3V7l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M2 7l-2-2M2 7l2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Répéter ce rendez-vous</span>
                </label>

                {recurring && (
                  <div className="recurrence-options">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Fréquence</label>
                        <select
                          className="form-select"
                          value={recurrFreq}
                          onChange={e => setRecurrFreq(e.target.value as RecurrFreq)}
                        >
                          <option value="weekly">Chaque semaine</option>
                          <option value="biweekly">Toutes les 2 semaines</option>
                          <option value="monthly">Chaque mois</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Séances</label>
                        <input
                          type="number"
                          className="form-input"
                          min={2} max={52}
                          value={recurrCount}
                          onChange={e =>
                            setRecurrCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                        />
                      </div>
                    </div>

                    {date && (
                      <div className="recurrence-preview">
                        <div className="recurrence-preview-summary">
                          Créera <strong>{recurrCount} rendez-vous</strong>
                          {" · "}
                          <span style={{ color: "var(--muted)" }}>
                            {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            {" → "}
                            {new Date(
                              generateRecurringDates(date, recurrFreq, recurrCount).slice(-1)[0] + "T12:00:00"
                            ).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="recurrence-chips">
                          {generateRecurringDates(date, recurrFreq, recurrCount).slice(0, 5).map((d, i) => (
                            <span key={d} className="recurrence-chip">
                              {i + 1}. {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                            </span>
                          ))}
                          {recurrCount > 5 && (
                            <span className="recurrence-chip recurrence-chip-more">
                              +{recurrCount - 5} autres
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" style={{ background: APPT_TYPE_COLORS[type] }}>
              {!isEdit && recurring ? `Créer ${recurrCount} RDV` : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Follow-up strip ────────────────────────────────────────────────────────────

interface FollowUpStripProps {
  followUps: Appointment[];
  onNavigate: (appt: Appointment) => void;
  onProgram: (appt: Appointment) => void;
}

function FollowUpStrip({ followUps, onNavigate, onProgram }: FollowUpStripProps) {
  if (followUps.length === 0) return null;
  return (
    <div className="followup-strip">
      <div className="followup-strip-header">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <strong>Suivis à prévoir</strong>
        <span className="followup-count">{followUps.length} patient{followUps.length > 1 ? "s" : ""} dans les 14 prochains jours</span>
      </div>
      <div className="followup-list">
        {followUps.map(appt => {
          const fDate = new Date(appt.followUpDate! + "T12:00:00").toLocaleDateString("fr-FR", {
            weekday: "short", day: "numeric", month: "short",
          });
          const ms       = new Date(appt.followUpDate!).getTime() - new Date(todayIso()).getTime();
          const daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24));
          const urgent   = daysLeft <= 3;
          return (
            <div key={appt.id} className="followup-item">
              <div className="followup-avatar">{appt.patientName[0]?.toUpperCase() ?? "?"}</div>
              <div className="followup-info">
                <div className="followup-name">{appt.patientName}</div>
                <div className="followup-date">
                  Suivi prévu le {fDate}
                  <span className="followup-days" style={{ color: urgent ? "var(--danger)" : "var(--gold)" }}>
                    {daysLeft <= 0 ? "Aujourd'hui" : `J-${daysLeft}`}
                  </span>
                </div>
              </div>
              <div className="followup-btns">
                <button
                  className="btn btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => onNavigate(appt)}
                  title="Voir le RDV original"
                >
                  Voir →
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => onProgram(appt)}
                  title="Programmer un nouveau suivi"
                >
                  + Programmer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Appointment card ───────────────────────────────────────────────────────────

function ApptCard({
  appt, onDetail, onEdit, onToggle, onBill, onPrintReceipt, onDelete, onWaClick,
}: {
  appt: Appointment;
  onDetail:       () => void;
  onEdit:         () => void;
  onToggle:       () => void;
  onBill:         () => void;
  onPrintReceipt: () => void;
  onDelete:       () => void;
  onWaClick?:     () => void;
}) {
  const isDone = appt.status === "completed";
  const color  = APPT_TYPE_COLORS[appt.type];
  const hasNotes = !!(appt.consultationNote?.motif || appt.consultationNote?.diagnosis || appt.vitalSigns);

  return (
    <div className="appt-card" style={{ opacity: isDone ? 0.75 : 1 }} onClick={onDetail}>
      <div className="appt-accent" style={{ background: isDone ? "var(--border)" : color }} />
      <div className="appt-body">
        <div className="appt-time">{appt.startTime} – {appt.endTime}</div>
        <div className="appt-name">{appt.patientName}</div>
        <div className="appt-badges">
          <span className="appt-badge" style={{ background: color + "22", color }}>
            {APPT_TYPE_LABELS[appt.type]}
          </span>
          <span className="appt-badge" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
            {APPT_STATUS_LABELS[appt.status]}
          </span>
          {appt.billedAt && (
            <span className="appt-badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
              ✓ Facturé
            </span>
          )}
          {hasNotes && (
            <span className="appt-badge" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              📋 Notes
            </span>
          )}
          {appt.followUpDate && (
            <span className="appt-badge" style={{ background: "#FFF8E1", color: "var(--gold)" }}>
              🔁 {new Date(appt.followUpDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        {appt.notes && <div className="appt-notes">{appt.notes}</div>}
      </div>
      <div className="appt-actions" onClick={e => e.stopPropagation()}>
        {/* WhatsApp — opens template picker */}
        {onWaClick && (
          <button
            className="appt-wa-btn"
            title="Envoyer un message WhatsApp"
            onClick={(e) => { e.stopPropagation(); onWaClick(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
          </button>
        )}
        {/* Edit shortcut */}
        <button
          className="appt-edit-btn"
          title="Modifier le RDV"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Toggle done */}
        <button
          className={`appt-done-btn${isDone ? " active" : ""}`}
          title={isDone ? "Marquer non terminé" : "Marquer terminé"}
          onClick={onToggle}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Print receipt */}
        {appt.billedAt && (
          <button
            className="appt-receipt-btn"
            title="Imprimer le reçu"
            onClick={onPrintReceipt}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4 9h6M4 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Bill */}
        {isDone && !appt.billedAt && (
          <button className="appt-bill-btn" title="Ajouter recette" onClick={onBill}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 3v6M4 5h3.5a1.5 1.5 0 0 1 0 3H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Delete */}
        <button className="tx-delete" title="Supprimer" onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Bulk billing modal ─────────────────────────────────────────────────────────

interface BulkBillItem {
  appt: Appointment;
  amount: string;
}

interface BulkBillModalProps {
  items: BulkBillItem[];
  onChange: (id: string, amount: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function BulkBillModal({ items, onChange, onConfirm, onClose }: BulkBillModalProps) {
  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Facturation groupée</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {items.length} rendez-vous terminés · non facturés — ajustez les montants si nécessaire
          </div>
          <div className="bulk-bill-list">
            {items.map(({ appt, amount }) => (
              <div key={appt.id} className="bulk-bill-row">
                <div className="bulk-bill-info">
                  <div className="bulk-bill-name">{appt.patientName}</div>
                  <div className="bulk-bill-sub">
                    <span style={{ background: APPT_TYPE_COLORS[appt.type] + "22", color: APPT_TYPE_COLORS[appt.type], padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>
                      {APPT_TYPE_LABELS[appt.type]}
                    </span>
                    · {appt.startTime}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    className="form-input"
                    type="number" min="1" step="0.01"
                    value={amount}
                    onChange={e => onChange(appt.id, e.target.value)}
                    style={{ width: 90, textAlign: "right", fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>MAD</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bulk-bill-total">
            Total : <strong>{total.toLocaleString("fr-MA")} MAD</strong>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn btn-primary"
            style={{ background: "var(--green)" }}
            onClick={onConfirm}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ marginRight: 6 }}>
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 3v6M4 5h3.5a1.5 1.5 0 0 1 0 3H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Facturer tout ({items.length})
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Time-slot grid body ────────────────────────────────────────────────────────

function TGSlotGrid({
  appts, isToday, nowTop, onSlotClick, onApptClick,
}: {
  appts:       Appointment[];
  isToday:     boolean;
  nowTop:      number;
  onSlotClick: (startTime: string, endTime: string) => void;
  onApptClick: (appt: Appointment) => void;
}) {
  return (
    <div
      className="tgrid-body"
      style={{ height: TG_TOTAL }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".tgrid-event")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y    = e.clientY - rect.top;
        const t    = snapTime(y);
        onSlotClick(t, addMinutes(t, 30));
      }}
    >
      {/* Grid lines */}
      {TG_HLIST.map((h, idx) => (
        <span key={h}>
          <div className="tgrid-hour-line" style={{ top: idx * TG_PX_H }} />
          <div className="tgrid-half-line" style={{ top: idx * TG_PX_H + TG_PX_H / 2 }} />
        </span>
      ))}
      <div className="tgrid-hour-line" style={{ top: TG_TOTAL }} />

      {/* Now indicator */}
      {isToday && nowTop >= 0 && nowTop <= TG_TOTAL && (
        <div className="tgrid-now-line" style={{ top: nowTop }} />
      )}

      {/* Appointments */}
      {appts.map(appt => {
        const color  = APPT_TYPE_COLORS[appt.type];
        const done   = appt.status === "completed";
        const canc   = appt.status === "cancelled" || appt.status === "no_show";
        const top    = tTop(appt.startTime);
        const height = tHeight(appt.startTime, appt.endTime);
        return (
          <div
            key={appt.id}
            className={`tgrid-event${done ? " done" : ""}${canc ? " cancelled" : ""}`}
            style={{
              top, height,
              background:      canc ? "var(--surface-alt)" : color + "1a",
              borderLeftColor: canc ? "var(--border)"      : color,
              color:           canc ? "var(--muted)"       : color,
            }}
            onClick={(e) => { e.stopPropagation(); onApptClick(appt); }}
            title={`${appt.patientName} · ${appt.startTime}–${appt.endTime}`}
          >
            <div className="tgrid-event-time">{appt.startTime}</div>
            <div className="tgrid-event-name">{appt.patientName}</div>
            {appt.billedAt        && <span className="tgrid-badge green">✓</span>}
            {appt.savedOrdonnance && <span className="tgrid-badge blue">℞</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const today    = todayIso();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    appointments, patients, doctorProfile,
    addAppointment, updateAppointment, deleteAppointment,
    waTemplates,
  } = useCabinet();
  const { addTransaction } = useApp();

  const [selDate,   setSelDate]   = useState(today);
  const [view,      setView]      = useState<AgendaView>("week");
  const [calYear,   setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth());
  const [modal,          setModal]          = useState<{ appt?: Appointment; prefill?: Partial<Appointment> } | null>(null);
  const [toast,          setToast]          = useState<string | null>(null);
  const [billModal,      setBillModal]      = useState<{ appt: Appointment } | null>(null);
  const [waPickerTarget, setWaPickerTarget] = useState<{ appt: Appointment; phone: string } | null>(null);
  const [billAmt,   setBillAmt]   = useState("200");
  const [bulkItems, setBulkItems] = useState<BulkBillItem[]>([]);
  const [showBulk,  setShowBulk]  = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Current-time indicator (updates every minute)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const nowTop = ((nowMinutes - TG_START * 60) / 60) * TG_PX_H;

  // Auto-open new-appointment modal when navigated from a patient page
  useEffect(() => {
    const pid = searchParams.get("newAppt");
    if (!pid) return;
    const p = patients.find(x => x.id === pid);
    if (p) {
      setModal({
        prefill: {
          patientName: `${p.firstName} ${p.lastName}`,
          patientId:   p.id,
          date:        today,
          startTime:   "09:00",
          endTime:     "09:30",
          type:        "consultation",
          status:      "scheduled",
        },
      });
    }
    setSearchParams({}, { replace: true });   // remove param from URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Patient phone lookup map
  const patientPhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      if (p.phone) map.set(p.id, p.phone);
    }
    return map;
  }, [patients]);

  // Follow-ups in next 14 days
  const followUps = useMemo(() => {
    const future = new Date(today);
    future.setDate(future.getDate() + 14);
    const t14Iso = future.toISOString().slice(0, 10);
    return appointments
      .filter(a => a.followUpDate && a.followUpDate >= today && a.followUpDate <= t14Iso)
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  }, [appointments, today]);

  // Calendar grid
  const nDays   = daysInMonth(calYear, calMonth);
  const leading = firstWeekdayMon(calYear, calMonth);
  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: nDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const apptsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    appointments
      .filter(a => a.date.startsWith(monthPrefix))
      .forEach(a => {
        const day = parseInt(a.date.split("-")[2], 10);
        const list = map.get(day) ?? [];
        list.push(a);
        map.set(day, list);
      });
    return map;
  }, [appointments, monthPrefix]);

  const dayAppts = useMemo(() =>
    appointments
      .filter(a => a.date === selDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, selDate]);

  const todayAppts = useMemo(() =>
    appointments.filter(a => a.date === today),
    [appointments, today]);

  const stats = useMemo(() => ({
    total:   todayAppts.length,
    done:    todayAppts.filter(a => a.status === "completed").length,
    waiting: todayAppts.filter(a => a.status === "scheduled").length,
  }), [todayAppts]);

  // Unbilled completed RDVs for the selected day
  const unbilledCompleted = useMemo(() =>
    dayAppts.filter(a => a.status === "completed" && !a.billedAt),
    [dayAppts]);

  const prevMonth = () => {
    let m = calMonth - 1, y = calYear;
    if (m < 0) { m = 11; y--; }
    setCalYear(y); setCalMonth(m);
  };
  const nextMonth = () => {
    let m = calMonth + 1, y = calYear;
    if (m > 11) { m = 0; y++; }
    setCalYear(y); setCalMonth(m);
  };

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString("fr-FR", {
    month: "long", year: "numeric",
  });

  // ── Week view ─────────────────────────────────────────────────────────────
  const weekStart = getMondayOfWeek(selDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = (() => {
    const s = new Date(weekDays[0] + "T12:00:00");
    const e = new Date(weekDays[6] + "T12:00:00");
    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      d.toLocaleDateString("fr-FR", opts);
    return `${fmt(s, { day: "numeric", month: "short" })} – ${fmt(e, { day: "numeric", month: "short", year: "numeric" })}`;
  })();
  const prevWeek = () => setSelDate(addDays(selDate, -7));
  const nextWeek = () => setSelDate(addDays(selDate, +7));
  const jumpToToday = () => {
    setSelDate(today);
    const d = new Date(today + "T12:00:00");
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const weekApptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const iso of weekDays) {
      map.set(iso, appointments
        .filter(a => a.date === iso)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, weekStart]);

  // Single bill handler
  const handleBill = () => {
    if (!billModal) return;
    const amt = parseFloat(billAmt);
    if (isNaN(amt) || amt <= 0) return;
    addTransaction({
      type: "RECETTE", amount: amt,
      date: billModal.appt.date,
      category: "consultation",
      description: `${APPT_TYPE_LABELS[billModal.appt.type]} – ${billModal.appt.patientName}`,
      deductibilityStatus: "FULLY_DEDUCTIBLE",
      professionalUseRatio: 1,
    });
    updateAppointment({ ...billModal.appt, billedAt: new Date().toISOString(), billedAmount: amt });
    setBillModal(null);
    showToast(`Recette de ${amt.toLocaleString("fr-MA")} MAD ajoutée`);
  };

  // Bulk bill handlers
  const openBulkBill = () => {
    setBulkItems(unbilledCompleted.map(a => ({ appt: a, amount: "200" })));
    setShowBulk(true);
  };

  const handleBulkConfirm = () => {
    let grandTotal = 0;
    for (const { appt, amount } of bulkItems) {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) continue;
      addTransaction({
        type: "RECETTE", amount: amt,
        date: appt.date,
        category: "consultation",
        description: `${APPT_TYPE_LABELS[appt.type]} – ${appt.patientName}`,
        deductibilityStatus: "FULLY_DEDUCTIBLE",
        professionalUseRatio: 1,
      });
      updateAppointment({ ...appt, billedAt: new Date().toISOString(), billedAmount: amt });
      grandTotal += amt;
    }
    setShowBulk(false);
    showToast(`${bulkItems.length} recettes ajoutées · ${grandTotal.toLocaleString("fr-MA")} MAD`);
  };

  // Follow-up "Programmer" handler: jump to that date + open pre-filled new modal
  const handleProgramFollowUp = (appt: Appointment) => {
    if (!appt.followUpDate) return;
    const parts = appt.followUpDate.split("-").map(Number);
    setCalYear(parts[0]);
    setCalMonth(parts[1] - 1);
    setSelDate(appt.followUpDate);
    setModal({
      prefill: {
        patientName: appt.patientName,
        patientId:   appt.patientId,
        date:        appt.followUpDate,
        startTime:   "09:00",
        endTime:     "09:30",
        type:        "suivi",
        status:      "scheduled",
      },
    });
  };

  return (
    <Layout
      title="Agenda"
      subtitle={`${appointments.length} rendez-vous au total`}
      actions={
        <>
          <div className="agenda-view-toggle">
            <button
              className={`agenda-view-btn${view === "day" ? " active" : ""}`}
              onClick={() => setView("day")}
              title="Vue journée"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M4 5h6M4 7.5h6M4 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Jour
            </button>
            <button
              className={`agenda-view-btn${view === "week" ? " active" : ""}`}
              onClick={() => setView("week")}
              title="Vue semaine"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.5"/>
                <rect x="4" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.7"/>
                <rect x="7" y="3" width="2" height="8" rx="0.5" fill="currentColor"/>
                <rect x="10" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.7"/>
              </svg>
              Semaine
            </button>
            <button
              className={`agenda-view-btn${view === "month" ? " active" : ""}`}
              onClick={() => setView("month")}
              title="Vue mois"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 2V1M10 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <rect x="3" y="7" width="2" height="2" rx="0.4" fill="currentColor" opacity="0.7"/>
                <rect x="6" y="7" width="2" height="2" rx="0.4" fill="currentColor"/>
                <rect x="9" y="7" width="2" height="2" rx="0.4" fill="currentColor" opacity="0.5"/>
              </svg>
              Mois
            </button>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const monthAppts = appointments.filter(a => a.date.startsWith(monthPrefix));
              const calName = doctorProfile?.fullName
                ? `Cabinet Dr. ${doctorProfile.fullName}`
                : "Blackpine Cabinet";
              exportAgendaIcal(monthAppts, calName, `agenda-${monthPrefix}.ics`);
              showToast(`${monthAppts.length} RDV exportés en iCal`);
            }}
            disabled={!appointments.some(a => a.date.startsWith(monthPrefix))}
            title={`Exporter les RDV de ${monthLabel} vers Google Calendar / Outlook`}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
              <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 2V1M10 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M7 9V7M5.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            iCal
          </button>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Nouveau RDV
          </button>
        </>
      }
    >
      {/* ── Follow-up strip ── */}
      <FollowUpStrip
        followUps={followUps}
        onNavigate={appt => navigate(`/agenda/${appt.id}`)}
        onProgram={handleProgramFollowUp}
      />

      {/* ── Month view ── */}
      {view === "month" && (
        <div className="agenda-month-view">
          {/* Nav */}
          <div className="agenda-month-nav">
            <button className="agenda-week-arrow" onClick={prevMonth} title="Mois précédent">‹</button>
            <span className="agenda-month-label">{monthLabel}</span>
            <button className="agenda-week-arrow" onClick={nextMonth} title="Mois suivant">›</button>
            {!(calYear === new Date(today + "T12:00:00").getFullYear() &&
               calMonth === new Date(today + "T12:00:00").getMonth()) && (
              <button className="agenda-week-today-btn" onClick={jumpToToday}>Aujourd'hui</button>
            )}
          </div>

          {/* Grid */}
          <div className="agenda-month-grid">
            {/* Weekday headers */}
            <div className="agenda-month-weekdays">
              {DAY_HEADERS.map(d => (
                <div key={d} className="agenda-month-wday">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="agenda-month-days">
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="agenda-month-cell agenda-month-empty" />;
                const iso       = isoFromParts(calYear, calMonth, day);
                const isToday   = iso === today;
                const isSel     = iso === selDate;
                const cellAppts = [...(apptsByDay.get(day) ?? [])]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const shown = cellAppts.slice(0, 3);
                const more  = cellAppts.length - shown.length;
                return (
                  <div
                    key={i}
                    className={`agenda-month-cell${isToday ? " am-today" : ""}${isSel ? " am-sel" : ""}`}
                    onClick={() => { setSelDate(iso); setView("day"); }}
                    title={`Voir le ${day} — ${cellAppts.length} RDV`}
                  >
                    <div className={`agenda-month-day-num${isToday ? " am-today-ring" : ""}`}>
                      {day}
                    </div>
                    <div className="agenda-month-chips">
                      {shown.map(a => {
                        const cancelled = a.status === "cancelled" || a.status === "no_show";
                        return (
                          <div
                            key={a.id}
                            className={`agenda-month-chip${a.status === "completed" ? " am-done" : ""}${cancelled ? " am-cancel" : ""}`}
                            style={{ borderLeftColor: APPT_TYPE_COLORS[a.type] }}
                            onClick={e => { e.stopPropagation(); navigate(`/agenda/${a.id}`); }}
                            title={`${a.startTime} · ${a.patientName}`}
                          >
                            <span className="am-chip-time">{a.startTime}</span>
                            <span className="am-chip-name">{a.patientName}</span>
                          </div>
                        );
                      })}
                      {more > 0 && (
                        <div className="agenda-month-more">+{more} autre{more > 1 ? "s" : ""}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Week view (time-grid) ── */}
      {view === "week" && (
        <div className="agenda-week-view">
          {/* Nav bar */}
          <div className="agenda-week-nav">
            <button className="agenda-week-arrow" onClick={prevWeek} title="Semaine précédente">‹</button>
            <span className="agenda-week-label">{weekLabel}</span>
            <button className="agenda-week-arrow" onClick={nextWeek} title="Semaine suivante">›</button>
            {!weekDays.includes(today) && (
              <button className="agenda-week-today-btn" onClick={jumpToToday}>Aujourd'hui</button>
            )}
          </div>

          {/* Time-grid */}
          <div className="tgrid-scroll">
            <div className="tgrid-inner">
              {/* Column headers row */}
              <div className="tgrid-hdr-row">
                <div className="tgrid-time-gutter" />
                {weekDays.map(iso => {
                  const isToday = iso === today;
                  const d       = new Date(iso + "T12:00:00");
                  const dayName = d.toLocaleDateString("fr-FR", { weekday: "short" });
                  const dayNum  = d.getDate();
                  const appts   = weekApptsByDay.get(iso) ?? [];
                  return (
                    <div key={iso} className={`tgrid-col-hdr${isToday ? " tgrid-col-hdr-today" : ""}`}>
                      <button
                        className="tgrid-hdr-btn"
                        onClick={() => { setSelDate(iso); setView("day"); }}
                      >
                        <span className="tgrid-hdr-day">{dayName}</span>
                        <span className={`tgrid-hdr-num${isToday ? " tgrid-today-ring" : ""}`}>{dayNum}</span>
                        {appts.length > 0 && (
                          <span className="tgrid-hdr-badge">{appts.length}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Grid body */}
              <div className="tgrid-body-row">
                {/* Time labels */}
                <div className="tgrid-time-gutter">
                  {TG_HLIST.map(h => (
                    <div key={h} className="tgrid-time-cell">
                      <span className="tgrid-time-lbl">{String(h).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map(iso => {
                  const isToday = iso === today;
                  const appts   = weekApptsByDay.get(iso) ?? [];
                  return (
                    <div key={iso} className={`tgrid-col${isToday ? " tgrid-col-today" : ""}`}>
                      <TGSlotGrid
                        appts={appts}
                        isToday={isToday}
                        nowTop={nowTop}
                        onSlotClick={(start, end) => {
                          setSelDate(iso);
                          setModal({ prefill: { date: iso, startTime: start, endTime: end } });
                        }}
                        onApptClick={appt => navigate(`/agenda/${appt.id}`)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Day view ── */}
      {view === "day" && <div className="agenda-layout">
        {/* ── Calendar panel ── */}
        <div className="agenda-cal">
          <div className="cal-month-nav">
            <button className="cal-arrow" onClick={prevMonth}>‹</button>
            <span className="cal-month-label">{monthLabel}</span>
            <button className="cal-arrow" onClick={nextMonth}>›</button>
          </div>

          <div className="cal-day-headers">
            {DAY_HEADERS.map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
          </div>

          <div className="cal-grid">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell cal-cell-empty" />;
              const iso       = isoFromParts(calYear, calMonth, day);
              const isToday   = iso === today;
              const isSel     = iso === selDate;
              const dayAppts2 = apptsByDay.get(day) ?? [];
              return (
                <button
                  key={i}
                  className={`cal-cell${isToday ? " cal-today" : ""}${isSel ? " cal-selected" : ""}`}
                  onClick={() => setSelDate(iso)}
                >
                  <span className="cal-num">{day}</span>
                  {dayAppts2.length > 0 && (
                    <div className="cal-dots">
                      {dayAppts2.slice(0, 3).map((a, j) => (
                        <span key={j} className="cal-dot" style={{ background: APPT_TYPE_COLORS[a.type] }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {stats.total > 0 && (
            <div className="agenda-stats">
              <div className="agenda-stat" style={{ color: "var(--blue)" }}>
                <span className="agenda-stat-val">{stats.total}</span>
                <span className="agenda-stat-lbl">Total</span>
              </div>
              <div className="agenda-stat" style={{ color: "var(--green)" }}>
                <span className="agenda-stat-val">{stats.done}</span>
                <span className="agenda-stat-lbl">Terminés</span>
              </div>
              <div className="agenda-stat" style={{ color: "var(--gold)" }}>
                <span className="agenda-stat-val">{stats.waiting}</span>
                <span className="agenda-stat-lbl">En attente</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Day panel ── */}
        <div className="agenda-day">
          <div className="agenda-day-header">
            <div>
              <div className="agenda-day-date">
                {new Date(selDate + "T12:00:00").toLocaleDateString("fr-FR", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </div>
              <span className="agenda-day-count">{dayAppts.length} RDV</span>
            </div>
            {unbilledCompleted.length > 1 && (
              <button
                className="btn btn-ghost agenda-bulk-btn"
                onClick={openBulkBill}
                title="Facturer tous les RDV terminés non facturés"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M6 3v6M4 5h3.5a1.5 1.5 0 0 1 0 3H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Facturer tout ({unbilledCompleted.length})
              </button>
            )}
          </div>

          {dayAppts.length === 0 ? (
            <div className="agenda-empty">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucun rendez-vous</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                Cliquez sur le bouton pour en ajouter un.
              </div>
              <button className="btn btn-primary" onClick={() => setModal({})}>Ajouter un RDV</button>
            </div>
          ) : (
            <div className="agenda-list">
              {dayAppts.map(appt => (
                <ApptCard
                  key={appt.id}
                  appt={appt}
                  onDetail={() => navigate(`/agenda/${appt.id}`)}
                  onWaClick={(() => {
                    const phone = appt.patientId ? patientPhoneMap.get(appt.patientId) : undefined;
                    if (!phone) return undefined;
                    return () => setWaPickerTarget({ appt, phone });
                  })()}
                  onEdit={() => setModal({ appt })}
                  onToggle={() => updateAppointment({
                    ...appt,
                    status: appt.status === "completed" ? "scheduled" : "completed",
                  })}
                  onBill={() => { setBillModal({ appt }); setBillAmt("200"); }}
                  onPrintReceipt={() => printReceipt({
                    patientName:      appt.patientName,
                    consultationType: APPT_TYPE_LABELS[appt.type],
                    appointmentDate:  appt.date,
                    appointmentTime:  appt.startTime,
                    amount:           appt.billedAmount ?? 0,
                    doctorProfile,
                  })}
                  onDelete={() => {
                    if (confirm("Supprimer ce rendez-vous ?")) {
                      deleteAppointment(appt.id);
                      showToast("Rendez-vous supprimé");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>}

      {/* ── Add/Edit modal ── */}
      {modal !== null && (
        <ApptModal
          initial={modal.appt ?? modal.prefill}
          isEdit={!!modal.appt}
          defaultDate={selDate}
          patients={patients}
          onSave={a => {
            if (modal.appt) updateAppointment({ ...a, id: modal.appt.id });
            else addAppointment(a);
            showToast(modal.appt ? "Rendez-vous modifié" : "Rendez-vous ajouté");
          }}
          onSaveBatch={appts => {
            appts.forEach(a => addAppointment(a));
            showToast(`${appts.length} rendez-vous créés`);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Single bill modal ── */}
      {billModal && (
        <div className="modal-overlay" onClick={() => setBillModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Enregistrer le paiement</h2>
              <button className="modal-close" onClick={() => setBillModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{billModal.appt.patientName}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                {APPT_TYPE_LABELS[billModal.appt.type]} · {billModal.appt.startTime}
              </div>
              <div className="form-group">
                <label className="form-label">Montant (MAD)</label>
                <input
                  className="form-input" type="number" min="1" step="0.01"
                  value={billAmt} onChange={e => setBillAmt(e.target.value)}
                  style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBillModal(null)}>Annuler</button>
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={handleBill}
              >
                Ajouter la recette
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk billing modal ── */}
      {showBulk && (
        <BulkBillModal
          items={bulkItems}
          onChange={(id, amount) =>
            setBulkItems(prev => prev.map(i => i.appt.id === id ? { ...i, amount } : i))
          }
          onConfirm={handleBulkConfirm}
          onClose={() => setShowBulk(false)}
        />
      )}

      {/* ── WhatsApp template picker ── */}
      {waPickerTarget && (
        <WaPickerModal
          appt={waPickerTarget.appt}
          phone={waPickerTarget.phone}
          templates={waTemplates}
          doctorFullName={doctorProfile?.fullName}
          onClose={() => setWaPickerTarget(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
