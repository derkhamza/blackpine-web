import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import type { Appointment } from "../lib/cabinetTypes";
import { APPT_TYPE_LABELS, APPT_TYPE_COLORS } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitMins(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
}

function fmtMins(m: number): string {
  if (m < 1)  return "< 1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${String(r).padStart(2, "0")}`;
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  appt:     Appointment;
  now:      Date;
  onArrive: () => void;
  onCall:   () => void;
  onDone:   () => void;
  onNoShow: () => void;
}

function WaitCard({ appt, now, onArrive, onCall, onDone, onNoShow }: CardProps) {
  const color = (APPT_TYPE_COLORS as Record<string, string>)[appt.type] ?? "#888";
  const typeLabel = (APPT_TYPE_LABELS as Record<string, string>)[appt.type] ?? appt.type;

  const waitLabel =
    appt.status === "arrived" && appt.checkedInAt
      ? `⏱ Attend depuis ${fmtMins(waitMins(appt.checkedInAt, now))}`
      : appt.status === "in_consultation" && appt.inConsultationAt
      ? `🩺 En consul. depuis ${fmtMins(waitMins(appt.inConsultationAt, now))}`
      : null;

  return (
    <div className={`wr-card wr-s-${appt.status}`}>
      <div className="wr-card-top">
        <span className="wr-card-time">{appt.startTime} – {appt.endTime}</span>
        <span className="wr-type-chip" style={{ background: color + "22", color }}>
          {typeLabel}
        </span>
      </div>

      <div className="wr-card-name">
        {appt.patientId
          ? <Link to={`/patients/${appt.patientId}`} className="wr-patient-link">{appt.patientName}</Link>
          : <span>{appt.patientName}</span>
        }
      </div>

      {waitLabel && <div className="wr-wait-label">{waitLabel}</div>}

      <div className="wr-card-actions">
        {appt.status === "scheduled" && <>
          <button className="wr-btn wr-arrive" onClick={onArrive}>✓ Arrivé</button>
          <button className="wr-btn wr-absent" onClick={onNoShow}>Absent</button>
        </>}
        {appt.status === "arrived" && <>
          <button className="wr-btn wr-call" onClick={onCall}>▶ Appeler</button>
          <button className="wr-btn wr-absent" onClick={onNoShow}>Absent</button>
        </>}
        {appt.status === "in_consultation" && (
          <button className="wr-btn wr-done" onClick={onDone}>✓ Terminer</button>
        )}
        {appt.status === "completed" && (
          <span className="wr-done-chip wr-ok">✓ Terminé</span>
        )}
        {appt.status === "no_show" && (
          <span className="wr-done-chip wr-absent-chip">✕ Absent</span>
        )}
        {appt.status === "cancelled" && (
          <span className="wr-done-chip wr-absent-chip">✕ Annulé</span>
        )}
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Col({ title, accent, count, children }: {
  title:    string;
  accent:   string;
  count:    number;
  children: ReactNode;
}) {
  return (
    <div className="wr-col">
      <div className="wr-col-hdr" style={{ borderTopColor: accent }}>
        <span className="wr-col-title">{title}</span>
        <span className="wr-col-count" style={{ background: accent + "22", color: accent }}>{count}</span>
      </div>
      <div className="wr-col-body">
        {count === 0
          ? <div className="wr-col-empty">—</div>
          : children
        }
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WaitingRoomPage() {
  const { appointments, updateAppointment } = useCabinet();
  const today = todayIso();

  // Live clock — refreshes every 30 s
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Today's appointments sorted by startTime
  const todayAppts = useMemo(
    () => [...appointments]
      .filter(a => a.date === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, today],
  );

  const cols = useMemo(() => ({
    scheduled:       todayAppts.filter(a => a.status === "scheduled"),
    arrived:         todayAppts.filter(a => a.status === "arrived"),
    in_consultation: todayAppts.filter(a => a.status === "in_consultation"),
    done:            todayAppts.filter(a => a.status === "completed" || a.status === "no_show" || a.status === "cancelled"),
  }), [todayAppts]);

  // Actions
  const arrive = useCallback((appt: Appointment) =>
    updateAppointment({ ...appt, status: "arrived",         checkedInAt:      new Date().toISOString() }), [updateAppointment]);
  const call   = useCallback((appt: Appointment) =>
    updateAppointment({ ...appt, status: "in_consultation", inConsultationAt: new Date().toISOString() }), [updateAppointment]);
  const done   = useCallback((appt: Appointment) =>
    updateAppointment({ ...appt, status: "completed" }), [updateAppointment]);
  const noShow = useCallback((appt: Appointment) =>
    updateAppointment({ ...appt, status: "no_show" }), [updateAppointment]);

  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const kpis = [
    { label: "À venir",        count: cols.scheduled.length,       accent: "#6b7280" },
    { label: "En attente",      count: cols.arrived.length,         accent: "#d97706" },
    { label: "En consultation", count: cols.in_consultation.length, accent: "#1890C5" },
    { label: "Terminés",        count: cols.done.length,            accent: "#15a876" },
  ];

  return (
    <Layout
      title="Salle d'attente"
      subtitle={`${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · ${timeStr}`}
    >
      {/* KPI strip */}
      <div className="wr-kpi-strip">
        {kpis.map(({ label, count, accent }) => (
          <div key={label} className="wr-kpi" style={{ borderTopColor: accent }}>
            <div className="wr-kpi-val" style={{ color: accent }}>{count}</div>
            <div className="wr-kpi-lbl">{label}</div>
          </div>
        ))}
      </div>

      {todayAppts.length === 0 ? (
        <div className="wr-empty">
          <div className="wr-empty-icon">🗓</div>
          <div className="wr-empty-title">Aucun rendez-vous aujourd'hui</div>
          <div className="wr-empty-sub">
            <Link to="/agenda" className="wr-empty-link">Voir l'agenda →</Link>
          </div>
        </div>
      ) : (
        <div className="wr-board">
          <Col title="À venir" accent="#6b7280" count={cols.scheduled.length}>
            {cols.scheduled.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>

          <Col title="En attente" accent="#d97706" count={cols.arrived.length}>
            {cols.arrived.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>

          <Col title="En consultation" accent="#1890C5" count={cols.in_consultation.length}>
            {cols.in_consultation.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>

          <Col title="Terminé / Absent" accent="#15a876" count={cols.done.length}>
            {cols.done.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>
        </div>
      )}
    </Layout>
  );
}
