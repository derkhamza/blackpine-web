import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type {
  Appointment, AppointmentType, AppointmentStatus, Patient,
} from "../lib/cabinetTypes";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS,
} from "../lib/cabinetTypes";
import { todayIso } from "../lib/format";

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekdayMon(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TYPE_OPTS: AppointmentType[] = ["consultation", "suivi", "procedure", "urgence", "autre"];
const STATUS_OPTS: AppointmentStatus[] = ["scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show"];

// ── WhatsApp helper ────────────────────────────────────────────────────────────

function buildWaUrl(phone: string, appt: Appointment): string {
  const clean = phone.replace(/\D/g, "");
  const d = new Date(appt.date + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const msg = `Bonjour ${appt.patientName}, nous vous rappelons votre rendez-vous le ${d} à ${appt.startTime}. Merci.`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

// ── Appointment modal ─────────────────────────────────────────────────────────

interface ApptModalProps {
  initial?: Partial<Appointment>;
  defaultDate: string;
  isEdit: boolean;
  patients: Patient[];
  onSave: (a: Omit<Appointment, "id">) => void;
  onClose: () => void;
}

function ApptModal({ initial, defaultDate, isEdit, patients, onSave, onClose }: ApptModalProps) {
  const [patientName, setName]  = useState(initial?.patientName ?? "");
  const [linkedPid,   setPid]   = useState(initial?.patientId   ?? "");
  const [date,   setDate]       = useState(initial?.date ?? defaultDate);
  const [start,  setStart]      = useState(initial?.startTime ?? "09:00");
  const [end,    setEnd]        = useState(initial?.endTime ?? "09:30");
  const [type,   setType]       = useState<AppointmentType>(initial?.type ?? "consultation");
  const [status, setStatus]     = useState<AppointmentStatus>(initial?.status ?? "scheduled");
  const [notes,  setNotes]      = useState(initial?.notes ?? "");

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
    onSave({
      patientName: patientName.trim(),
      patientId: linkedPid || undefined,
      date, startTime: start, endTime: end, type, status,
      notes: notes || undefined,
    });
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
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" style={{ background: APPT_TYPE_COLORS[type] }}>
              Enregistrer
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
  appt, patientPhone, onDetail, onEdit, onToggle, onBill, onDelete,
}: {
  appt: Appointment;
  patientPhone?: string;
  onDetail: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onBill: () => void;
  onDelete: () => void;
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
        {/* WhatsApp reminder */}
        {patientPhone && (
          <a
            href={buildWaUrl(patientPhone, appt)}
            target="_blank"
            rel="noopener noreferrer"
            className="appt-wa-btn"
            title="Envoyer un rappel WhatsApp"
            onClick={e => e.stopPropagation()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
          </a>
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

// ── Main page ──────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const today    = todayIso();
  const navigate = useNavigate();
  const { appointments, patients, addAppointment, updateAppointment, deleteAppointment } = useCabinet();
  const { addTransaction } = useApp();

  const [selDate,   setSelDate]   = useState(today);
  const [calYear,   setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth());
  const [modal,     setModal]     = useState<{ appt?: Appointment; prefill?: Partial<Appointment> } | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [billModal, setBillModal] = useState<{ appt: Appointment } | null>(null);
  const [billAmt,   setBillAmt]   = useState("200");
  const [bulkItems, setBulkItems] = useState<BulkBillItem[]>([]);
  const [showBulk,  setShowBulk]  = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

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
    updateAppointment({ ...billModal.appt, billedAt: new Date().toISOString() });
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
      updateAppointment({ ...appt, billedAt: new Date().toISOString() });
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
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nouveau RDV
        </button>
      }
    >
      {/* ── Follow-up strip ── */}
      <FollowUpStrip
        followUps={followUps}
        onNavigate={appt => navigate(`/agenda/${appt.id}`)}
        onProgram={handleProgramFollowUp}
      />

      <div className="agenda-layout">
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
                  patientPhone={appt.patientId ? patientPhoneMap.get(appt.patientId) : undefined}
                  onDetail={() => navigate(`/agenda/${appt.id}`)}
                  onEdit={() => setModal({ appt })}
                  onToggle={() => updateAppointment({
                    ...appt,
                    status: appt.status === "completed" ? "scheduled" : "completed",
                  })}
                  onBill={() => { setBillModal({ appt }); setBillAmt("200"); }}
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
      </div>

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

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
