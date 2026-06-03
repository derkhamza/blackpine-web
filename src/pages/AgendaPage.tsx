import { FormEvent, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type {
  Appointment, AppointmentType, AppointmentStatus,
} from "../lib/cabinetTypes";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS,
} from "../lib/cabinetTypes";
import { todayIso } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekdayMon(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function calcAge(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}
const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TYPE_OPTS: AppointmentType[] = ["consultation", "suivi", "procedure", "urgence", "autre"];
const STATUS_OPTS: AppointmentStatus[] = ["scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show"];

// ── Appointment modal ─────────────────────────────────────────────────────────

interface ApptModalProps {
  initial?: Appointment | null;
  defaultDate: string;
  onSave: (a: Omit<Appointment, "id">) => void;
  onClose: () => void;
}

function ApptModal({ initial, defaultDate, onSave, onClose }: ApptModalProps) {
  const [patientName, setName]  = useState(initial?.patientName ?? "");
  const [date,   setDate]       = useState(initial?.date ?? defaultDate);
  const [start,  setStart]      = useState(initial?.startTime ?? "09:00");
  const [end,    setEnd]        = useState(initial?.endTime ?? "09:30");
  const [type,   setType]       = useState<AppointmentType>(initial?.type ?? "consultation");
  const [status, setStatus]     = useState<AppointmentStatus>(initial?.status ?? "scheduled");
  const [notes,  setNotes]      = useState(initial?.notes ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    onSave({ patientName: patientName.trim(), date, startTime: start, endTime: end, type, status, notes: notes || undefined });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial ? "Modifier" : "Nouveau"} rendez-vous</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nom du patient</label>
              <input className="form-input" value={patientName} onChange={e => setName(e.target.value)}
                placeholder="Dr. — Patient" required autoFocus />
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

// ── Appointment card ──────────────────────────────────────────────────────────

function ApptCard({
  appt, onEdit, onToggle, onBill, onDelete,
}: {
  appt: Appointment;
  onEdit: () => void;
  onToggle: () => void;
  onBill: () => void;
  onDelete: () => void;
}) {
  const isDone = appt.status === "completed";
  const color  = APPT_TYPE_COLORS[appt.type];

  return (
    <div className="appt-card" style={{ opacity: isDone ? 0.65 : 1 }} onClick={onEdit}>
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
              Facturé
            </span>
          )}
        </div>
        {appt.notes && <div className="appt-notes">{appt.notes}</div>}
      </div>
      <div className="appt-actions" onClick={e => e.stopPropagation()}>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const today = todayIso();
  const { appointments, addAppointment, updateAppointment, deleteAppointment } = useCabinet();
  const { addTransaction } = useApp();

  const [selDate,  setSelDate]  = useState(today);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [modal,    setModal]    = useState<{ appt?: Appointment } | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);
  const [billModal, setBillModal] = useState<{ appt: Appointment } | null>(null);
  const [billAmt, setBillAmt]   = useState("200");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

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

  const handleBill = () => {
    if (!billModal) return;
    const amt = parseFloat(billAmt);
    if (isNaN(amt) || amt <= 0) return;
    addTransaction({
      type: "RECETTE", amount: amt,
      date: billModal.appt.date,
      category: "consultation",
      deductibilityStatus: "FULLY_DEDUCTIBLE",
      professionalUseRatio: 1,
    });
    updateAppointment({ ...billModal.appt, billedAt: new Date().toISOString() });
    setBillModal(null);
    showToast(`Recette de ${amt.toLocaleString("fr-MA")} MAD ajoutée`);
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
      <div className="agenda-layout">
        {/* ── Calendar panel ── */}
        <div className="agenda-cal">
          {/* Month nav */}
          <div className="cal-month-nav">
            <button className="cal-arrow" onClick={prevMonth}>‹</button>
            <span className="cal-month-label">{monthLabel}</span>
            <button className="cal-arrow" onClick={nextMonth}>›</button>
          </div>

          {/* Day headers */}
          <div className="cal-day-headers">
            {DAY_HEADERS.map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
          </div>

          {/* Grid */}
          <div className="cal-grid">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell cal-cell-empty" />;
              const iso      = isoFromParts(calYear, calMonth, day);
              const isToday  = iso === today;
              const isSel    = iso === selDate;
              const dayAppts2 = apptsByDay.get(day) ?? [];
              return (
                <button
                  key={i}
                  className={`cal-cell${isToday ? " cal-today" : ""}${isSel ? " cal-selected" : ""}`}
                  onClick={() => { setSelDate(iso); }}
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

          {/* Today stats */}
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
            <div className="agenda-day-date">
              {new Date(selDate + "T12:00:00").toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </div>
            <span className="agenda-day-count">
              {dayAppts.length} RDV
            </span>
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

      {/* Add/Edit modal */}
      {modal !== null && (
        <ApptModal
          initial={modal.appt}
          defaultDate={selDate}
          onSave={a => {
            if (modal.appt) updateAppointment({ ...a, id: modal.appt.id });
            else addAppointment(a);
            showToast(modal.appt ? "Rendez-vous modifié" : "Rendez-vous ajouté");
          }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Bill modal */}
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

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
