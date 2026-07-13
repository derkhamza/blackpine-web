import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { todayIso } from "../lib/format";
import { DEFAULT_SECRETARY_PERMISSIONS, APPT_STATUS_LABELS } from "../lib/cabinetTypes";
import type { SecretaryPermissions } from "../lib/cabinetTypes";

// ── Icon set ────────────────────────────────────────────────────────────────
// A compact copy of the sidebar's line-icon language so the secretary desk uses
// the same crisp glyphs as the rest of the app (no more emoji).
function Ico({ name }: { name: string }) {
  const p: Record<string, JSX.Element> = {
    agenda: <><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    waiting: <><circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 8v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M2 12c0-1.7 1.3-3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></>,
    patients: <><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 7v4M14 9h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    check: <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>,
    clock: <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    globe: <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13" stroke="currentColor" strokeWidth="1.2"/></>,
    billing: <><path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 7h6M5 9.5h4M5 12h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    messages: <><path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 7h6M5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>,
    documents: <><path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5.5 9h5M5.5 11.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    calculateurs: <><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h2M5 8h2M5 11h2M9 5h2M9 8h2M9 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    notes: <><rect x="1.5" y="1.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4 5h5M4 7.5h5M4 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="11.5" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/></>,
    stocks: <><path d="M2 5l6-3 6 3v6l-6 3-6-3V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 2v12M2 5l6 3 6-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
  };
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>{p[name] ?? null}</svg>;
}

// Landing dashboard for a real secretary session — a focused desk cockpit: the
// day at a glance, what needs doing right now, one-tap access to the areas the
// doctor granted, and today's schedule. Non-financial by default (finance tiles
// only appear when the doctor grants billing).
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
      upcoming:   todayAppts.filter(a => a.status === "scheduled").length,
      monthTotal: appointments.filter(a => a.date.startsWith(today.slice(0, 7))).length,
      patients:   patients.length,
      // Actionable desk counts
      toConfirm:  appointments.filter(a => a.bookingSource === "online" && a.date >= today && a.status !== "cancelled").length,
      toBill:     appointments.filter(a => a.status === "completed" && !a.billedAt).length,
    };
  }, [appointments, patients, today]);

  const upcoming = useMemo(() =>
    appointments
      .filter(a => a.date === today && a.status !== "cancelled" && a.status !== "no_show")
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 8),
    [appointments, today]);

  // ── Hero stat cards — desk-focused, always fills the row (auto-fit) ─────────
  const heroTiles = [
    { key: "today",    value: stats.todayTotal, label: t("dashboard.apptToday"),     tone: "#2563EB", to: "/agenda",        icon: "agenda" },
    { key: "waiting",  value: stats.inWaiting,  label: t("dashboard.inWaiting"),     tone: stats.inWaiting > 0 ? "#D97706" : "#2563EB", to: "/salle-attente", icon: "waiting" },
    { key: "done",     value: stats.completed,  label: t("dashboard.completed"),     tone: "#12946B", to: "/agenda",        icon: "check" },
    { key: "upcoming", value: stats.upcoming,   label: t("secDash.upcoming"),        tone: "#0EA5E9", to: "/agenda",        icon: "clock" },
    { key: "month",    value: stats.monthTotal, label: t("dashboard.apptMonth"),     tone: "#6366F1", to: "/agenda",        icon: "agenda" },
    { key: "patients", value: stats.patients,   label: t("dashboard.totalPatients"), tone: "#8B5CF6", to: "/patients",      icon: "patients" },
  ];

  // ── Desk focus — what needs doing now (permission-aware, only if non-empty) ─
  const focus: { key: string; level: "warn" | "info"; count: number; label: string; sub: string; to: string; icon: string }[] = [];
  if (stats.inWaiting > 0)
    focus.push({ key: "waiting", level: "warn", count: stats.inWaiting, label: t("dashboard.inWaiting"), sub: t("secDash.waitingSub"), to: "/salle-attente", icon: "waiting" });
  if (stats.toConfirm > 0)
    focus.push({ key: "confirm", level: "info", count: stats.toConfirm, label: t("secDash.toConfirm"), sub: t("secDash.toConfirmSub"), to: "/agenda", icon: "globe" });
  if (perms.handleBilling && stats.toBill > 0)
    focus.push({ key: "bill", level: "info", count: stats.toBill, label: t("secDash.toBill"), sub: t("secDash.toBillSub"), to: "/facturation", icon: "billing" });

  // ── Quick access — the areas the doctor granted ────────────────────────────
  const actions: { to: string; label: string; icon: string; tone: string; on: boolean }[] = [
    { to: "/agenda",        label: t("nav.agenda"),        icon: "agenda",       tone: "#2563EB", on: true },
    { to: "/salle-attente", label: t("nav.waiting"),       icon: "waiting",      tone: "#2563EB", on: true },
    { to: "/patients",      label: t("nav.patients"),      icon: "patients",     tone: "#2563EB", on: true },
    { to: "/facturation",   label: t("nav.billing"),       icon: "billing",      tone: "#F59E0B", on: !!perms.handleBilling },
    { to: "/communication", label: t("nav.communication"), icon: "messages",     tone: "#0EA5E9", on: !!perms.useCommunication },
    { to: "/documents",     label: t("nav.documents"),     icon: "documents",    tone: "#0EA5E9", on: !!perms.viewClinical },
    { to: "/calculateurs",  label: t("nav.calculators"),   icon: "calculateurs", tone: "#0EA5E9", on: !!perms.useCalculators },
    { to: "/notes",         label: t("nav.notes"),         icon: "notes",        tone: "#8B5CF6", on: !!perms.useNotes },
    { to: "/stocks",        label: t("nav.stocks"),        icon: "stocks",       tone: "#8B5CF6", on: !!perms.manageStock },
  ].filter(a => a.on);

  const STATUS_COLOR: Record<string, string> = {
    scheduled: "var(--blue)", arrived: "#d97706", in_consultation: "var(--blue)", completed: "var(--green)",
  };
  const patientName = (a: typeof upcoming[number]) => a.patientName || t("secDash.noName");

  return (
    <Layout title={t("secDash.title")} subtitle={secretaryOwnerName ? `${todayLabel} · ${secretaryOwnerName}` : todayLabel}>
      {/* Today at a glance */}
      <div className="sec-hero-grid rv-stagger">
        {heroTiles.map(tile => (
          <button key={tile.key} className="sec-hero-tile rv-press rv-lift" onClick={() => navigate(tile.to)}>
            <span className="sec-hero-icon" style={{ color: tile.tone, background: tile.tone + "1A" }}><Ico name={tile.icon} /></span>
            <div className="sec-hero-val" style={{ color: tile.tone }}><AnimatedNumber value={tile.value} /></div>
            <div className="sec-hero-lbl">{tile.label}</div>
          </button>
        ))}
      </div>

      {/* Desk focus — actionable, only when there's something to do */}
      {focus.length > 0 && (
        <div className="sec-focus-row rv-stagger">
          {focus.map(f => (
            <button key={f.key} className={`sec-focus-card sec-focus-${f.level} rv-press`} onClick={() => navigate(f.to)}>
              <span className="sec-focus-icon"><Ico name={f.icon} /></span>
              <span className="sec-focus-num">{f.count}</span>
              <span className="sec-focus-txt"><b>{f.label}</b><span>{f.sub}</span></span>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          ))}
        </div>
      )}

      {/* Quick access to permitted areas */}
      <h2 className="section-title" style={{ marginTop: 22, marginBottom: 10 }}>{t("secDash.quickAccess")}</h2>
      <div className="sec-dash-actions">
        {actions.map(a => (
          <button key={a.to} className="sec-dash-action rv-press rv-lift" onClick={() => navigate(a.to)}>
            <span className="sec-dash-action-ico" style={{ color: a.tone, background: a.tone + "14" }}><Ico name={a.icon} /></span>
            <span className="sec-dash-action-label">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="dash-section-header" style={{ marginTop: 22, marginBottom: 10 }}>
        <h2 className="section-title" style={{ margin: 0 }}>{t("secDash.todaySchedule")}</h2>
        <button className="dash-see-all" onClick={() => navigate("/agenda")}>{t("common.seeAll")}</button>
      </div>
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
              <span className="sec-dash-appt-dot" style={{ background: STATUS_COLOR[a.status] ?? "var(--muted)" }} />
              <span className="sec-dash-appt-name">{patientName(a)}</span>
              <span className={`sec-dash-appt-status s-${a.status}`}>{APPT_STATUS_LABELS[a.status] ?? a.status}</span>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
