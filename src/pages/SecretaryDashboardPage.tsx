import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import { DEFAULT_SECRETARY_PERMISSIONS, APPT_STATUS_LABELS } from "../lib/cabinetTypes";
import type { SecretaryPermissions } from "../lib/cabinetTypes";

// Landing dashboard for a real secretary session — a focused overview of the
// desk's day plus one-tap access to exactly the areas the doctor has granted.
// The doctor keeps the richer DashboardPage; this shows only what a secretary
// can see and do (no finances/alerts unless permitted).
export function SecretaryDashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { appointments, patients, doctorProfile, secretaryOwnerName } = useCabinet();
  const perms: SecretaryPermissions = doctorProfile.secretaryPermissions ?? DEFAULT_SECRETARY_PERMISSIONS;
  const today = todayIso();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA" : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const todayLabel = new Date(today + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const stats = useMemo(() => {
    const todayAppts = appointments.filter(a => a.date === today && a.status !== "cancelled" && a.status !== "no_show");
    return {
      todayTotal: todayAppts.length,
      inWaiting:  appointments.filter(a => a.date === today && a.status === "arrived").length,
      completed:  appointments.filter(a => a.date === today && a.status === "completed").length,
      patients:   patients.length,
    };
  }, [appointments, patients, today]);

  const upcoming = useMemo(() =>
    appointments
      .filter(a => a.date === today && a.status !== "cancelled" && a.status !== "no_show")
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 8),
    [appointments, today]);

  // Quick actions: always-available desk pages + the permission-gated ones.
  const actions: { to: string; label: string; emoji: string; on: boolean }[] = [
    { to: "/agenda",        label: t("nav.agenda"),        emoji: "📅", on: true },
    { to: "/salle-attente", label: t("nav.waiting"),       emoji: "⏳", on: true },
    { to: "/patients",      label: t("nav.patients"),      emoji: "👥", on: true },
    { to: "/facturation",   label: t("nav.billing"),       emoji: "💰", on: !!perms.handleBilling },
    { to: "/communication", label: t("nav.communication"), emoji: "💬", on: !!perms.useCommunication },
    { to: "/documents",     label: t("nav.documents"),     emoji: "📄", on: !!perms.viewClinical },
    { to: "/calculateurs",  label: t("nav.calculators"),   emoji: "🧮", on: !!perms.useCalculators },
    { to: "/notes",         label: t("nav.notes"),         emoji: "📝", on: !!perms.useNotes },
    { to: "/stocks",        label: t("nav.stocks"),        emoji: "📦", on: !!perms.manageStock },
  ].filter(a => a.on);

  const patientName = (a: typeof upcoming[number]) => a.patientName || t("secDash.noName");

  return (
    <Layout title={t("secDash.title")} subtitle={secretaryOwnerName ? `${todayLabel} · ${secretaryOwnerName}` : todayLabel}>
      {/* Today at a glance */}
      <div className="dash-hero-grid rv-stagger">
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/agenda")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: "var(--blue)" }}>{stats.todayTotal}</div>
          <div className="dash-hero-lbl">{t("dashboard.apptToday")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/salle-attente")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: stats.inWaiting > 0 ? "#d97706" : "var(--text)" }}>{stats.inWaiting}</div>
          <div className="dash-hero-lbl">{t("dashboard.inWaiting")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/agenda")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: "var(--green)" }}>{stats.completed}</div>
          <div className="dash-hero-lbl">{t("dashboard.completed")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/patients")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val">{stats.patients}</div>
          <div className="dash-hero-lbl">{t("dashboard.totalPatients")}</div>
        </div>
      </div>

      {/* Quick access to permitted areas */}
      <h2 className="section-title" style={{ marginTop: 22, marginBottom: 10 }}>{t("secDash.quickAccess")}</h2>
      <div className="sec-dash-actions">
        {actions.map(a => (
          <button key={a.to} className="sec-dash-action rv-press rv-lift" onClick={() => navigate(a.to)}>
            <span className="sec-dash-action-emoji" aria-hidden>{a.emoji}</span>
            <span className="sec-dash-action-label">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Today's schedule */}
      <h2 className="section-title" style={{ marginTop: 22, marginBottom: 10 }}>{t("secDash.todaySchedule")}</h2>
      {upcoming.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
          <div style={{ fontWeight: 700 }}>{t("secDash.noAppts")}</div>
        </div>
      ) : (
        <div className="sec-dash-list">
          {upcoming.map(a => (
            <button key={a.id} className="sec-dash-appt rv-press" onClick={() => navigate(`/agenda/${a.id}`)}>
              <span className="sec-dash-appt-time">{a.startTime}</span>
              <span className="sec-dash-appt-name">{patientName(a)}</span>
              <span className={`sec-dash-appt-status s-${a.status}`}>{APPT_STATUS_LABELS[a.status] ?? a.status}</span>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
