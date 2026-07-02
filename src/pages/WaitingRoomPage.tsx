import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import type { Appointment } from "../lib/cabinetTypes";
import { APPT_TYPE_LABELS, APPT_TYPE_COLORS } from "../lib/cabinetTypes";
import { useTranslation } from "react-i18next";

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
  // Cards can be dragged between columns to change status.
  const { t } = useTranslation();
  const color = (APPT_TYPE_COLORS as Record<string, string>)[appt.type] ?? "#888";
  const typeLabel = (APPT_TYPE_LABELS as Record<string, string>)[appt.type] ?? appt.type;

  const waitLabel =
    appt.status === "arrived" && appt.checkedInAt
      ? t("waiting.waitSince", { time: fmtMins(waitMins(appt.checkedInAt, now)) })
      : appt.status === "in_consultation" && appt.inConsultationAt
      ? t("waiting.inConsulSince", { time: fmtMins(waitMins(appt.inConsultationAt, now)) })
      : null;

  return (
    <div
      className={`wr-card wr-s-${appt.status}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/bp-appt", appt.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="wr-card-top">
        <Link to={`/agenda/${appt.id}`} className="wr-card-time wr-card-open" title={t("waiting.openAppt")}>
          {appt.startTime} – {appt.endTime}
        </Link>
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
          <button className="wr-btn wr-arrive" onClick={onArrive}>{t("waiting.btnArrive")}</button>
          <button className="wr-btn wr-absent" onClick={onNoShow}>{t("waiting.btnNoShow")}</button>
        </>}
        {appt.status === "arrived" && <>
          <button className="wr-btn wr-call" onClick={onCall}>{t("waiting.btnCall")}</button>
          <button className="wr-btn wr-absent" onClick={onNoShow}>{t("waiting.btnNoShow")}</button>
        </>}
        {appt.status === "in_consultation" && (
          <button className="wr-btn wr-done" onClick={onDone}>{t("waiting.btnDone")}</button>
        )}
        {appt.status === "completed" && (
          <span className="wr-done-chip wr-ok">{t("waiting.chipDone")}</span>
        )}
        {appt.status === "no_show" && (
          <span className="wr-done-chip wr-absent-chip">{t("waiting.chipNoShow")}</span>
        )}
        {appt.status === "cancelled" && (
          <span className="wr-done-chip wr-absent-chip">{t("waiting.chipCancelled")}</span>
        )}
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function Col({ title, accent, count, children, onDropAppt }: {
  title:    string;
  accent:   string;
  count:    number;
  children: ReactNode;
  onDropAppt?: (apptId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`wr-col${dragOver ? " wr-col-dragover" : ""}`}
      onDragOver={onDropAppt ? (e) => {
        if (e.dataTransfer.types.includes("text/bp-appt")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }
      } : undefined}
      onDragLeave={onDropAppt ? (e) => {
        // Only clear when actually leaving the column, not moving over a child.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      } : undefined}
      onDrop={onDropAppt ? (e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/bp-appt");
        if (id) onDropAppt(id);
      } : undefined}
    >
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
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
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

  // Drag & drop between columns → status change (with check-in timestamps)
  const dropToColumn = useCallback((col: "scheduled" | "arrived" | "in_consultation" | "done") =>
    (apptId: string) => {
      const appt = todayAppts.find(a => a.id === apptId);
      if (!appt) return;
      if (col === "scheduled" && appt.status !== "scheduled") {
        updateAppointment({ ...appt, status: "scheduled" });
      } else if (col === "arrived" && appt.status !== "arrived") {
        updateAppointment({ ...appt, status: "arrived", checkedInAt: appt.checkedInAt ?? new Date().toISOString() });
      } else if (col === "in_consultation" && appt.status !== "in_consultation") {
        updateAppointment({ ...appt, status: "in_consultation", inConsultationAt: appt.inConsultationAt ?? new Date().toISOString() });
      } else if (col === "done" && appt.status !== "completed") {
        updateAppointment({ ...appt, status: "completed" });
      }
    }, [todayAppts, updateAppointment]);

  const timeStr = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const kpis = [
    { label: t("waiting.colScheduled"),      count: cols.scheduled.length,       accent: "#6b7280" },
    { label: t("waiting.colArrived"),         count: cols.arrived.length,         accent: "#d97706" },
    { label: t("waiting.colInConsultation"),  count: cols.in_consultation.length, accent: "#1890C5" },
    { label: t("waiting.colDone"),            count: cols.done.length,            accent: "#15a876" },
  ];

  return (
    <Layout
      title={t("waiting.title")}
      subtitle={`${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · ${timeStr}`}
    >
      {/* KPI strip */}
      <div className="wr-kpi-strip">
        {kpis.map(({ label, count, accent }) => (
          <div key={label} className="wr-kpi" style={{ borderTopColor: accent }}>
            <div className="wr-kpi-val" style={{ color: accent }}><AnimatedNumber value={count} /></div>
            <div className="wr-kpi-lbl">{label}</div>
          </div>
        ))}
      </div>

      {todayAppts.length === 0 ? (
        <div className="wr-empty">
          <div className="wr-empty-icon">🗓</div>
          <div className="wr-empty-title">{t("waiting.noAppts")}</div>
          <div className="wr-empty-sub">
            <Link to="/agenda" className="wr-empty-link">{t("waiting.viewAgenda")}</Link>
          </div>
        </div>
      ) : (
        <div className="wr-board">
          <Col title={t("waiting.colScheduled")} accent="#6b7280" count={cols.scheduled.length}
            onDropAppt={dropToColumn("scheduled")}>
            {cols.scheduled.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>

          <Col title={t("waiting.colArrived")} accent="#d97706" count={cols.arrived.length}
            onDropAppt={dropToColumn("arrived")}>
            {cols.arrived.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>

          <Col title={t("waiting.colInConsultation")} accent="#1890C5" count={cols.in_consultation.length}
            onDropAppt={dropToColumn("in_consultation")}>
            {cols.in_consultation.map(a => (
              <WaitCard key={a.id} appt={a} now={now}
                onArrive={() => arrive(a)} onCall={() => call(a)}
                onDone={() => done(a)}     onNoShow={() => noShow(a)} />
            ))}
          </Col>

          <Col title={t("waiting.colDoneAbsent")} accent="#15a876" count={cols.done.length}
            onDropAppt={dropToColumn("done")}>
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
