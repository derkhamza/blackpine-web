import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { useCabinet, estimateStorageBytes } from "../context/CabinetContext";
import { formatMAD, todayIso } from "../lib/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { NOTE_COLOR_VALUES } from "../lib/cabinetTypes";
import { useTranslation } from "react-i18next";

const DISMISSED_KEY = "bp.dashDismissedAlerts";

// ── Alert item ────────────────────────────────────────────────────────────────

interface Alert {
  id:      string;
  level:   "critical" | "warning" | "info";
  icon:    JSX.Element;
  text:    string;
  subtext?: string;
  route:   string;
  // How "bad" the alert currently is (item count, MB, days…). A dismissed alert
  // stays hidden until its weight rises above the value it had when dismissed,
  // so acknowledging it silences it but a worsening situation resurfaces it.
  weight?: number;
}

function AlertPill({ alert, navigate, onDismiss, dismissLabel }: {
  alert: Alert; navigate: (r: string) => void; onDismiss: (a: Alert) => void; dismissLabel: string;
}) {
  const colors = {
    critical: { bg: "var(--coral-soft)", border: "var(--coral)", text: "var(--coral)" },
    warning:  { bg: "var(--gold-soft)",  border: "var(--gold)",  text: "#9a6e00" },
    info:     { bg: "var(--blue-soft)",  border: "var(--blue)",  text: "var(--blue)" },
  };
  const c = colors[alert.level];
  return (
    <div
      className="dash-alert-pill"
      style={{ background: c.bg, borderColor: c.border, color: c.text, cursor: "pointer" }}
      onClick={() => navigate(alert.route)}
      title={alert.subtext}
    >
      <span className="dash-alert-icon">{alert.icon}</span>
      <span className="dash-alert-text">{alert.text}</span>
      {alert.subtext && <span className="dash-alert-sub">{alert.subtext}</span>}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: .6 }}>
        <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <button
        type="button"
        className="dash-alert-dismiss"
        title={dismissLabel}
        aria-label={dismissLabel}
        onClick={e => { e.stopPropagation(); onDismiss(alert); }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Appt status helpers ───────────────────────────────────────────────────────

const APPT_STATUS_COLORS: Record<string, string> = {
  scheduled:       "var(--blue)",
  arrived:         "#d97706",
  in_consultation: "var(--blue)",
  completed:       "var(--green)",
  cancelled:       "var(--muted)",
  no_show:         "var(--coral)",
};

// Dashboard uses translated labels via t("apptStatus.*") — see below

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();

  const { result, transactions, fiscalYear, trial } = useApp();

  const {
    appointments,
    stockItems,
    purchaseOrders,
    examResults,
    notes,
    teleSessions,
    patients,
    lastBackupAt,
    doctorProfile,
    storagePrefix,
  } = useCabinet();

  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [financeOpen,     setFinanceOpen]     = useState(false);

  // Dismissed alerts: id → weight at time of dismissal. An alert reappears only
  // if its current weight exceeds that value (i.e. the situation got worse), so
  // acknowledging a nudge silences it without hiding a genuine escalation.
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}"); } catch { return {}; }
  });
  const dismissAlert = (a: Alert) => {
    setDismissed(prev => {
      const next = { ...prev, [a.id]: a.weight ?? 1 };
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  // ── Today's agenda ─────────────────────────────────────────────────────────
  const todayAppts = useMemo(() =>
    appointments
      .filter(a => a.date === today && a.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, today]);

  // ── Today's teleconsult sessions ──────────────────────────────────────────
  const todayTele = useMemo(() =>
    teleSessions
      .filter(s => s.scheduledDate === today && s.status !== "cancelled")
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [teleSessions, today]);

  // ── Pinned notes & urgent tasks ───────────────────────────────────────────
  const pinnedItems = useMemo(() => {
    const urgent = notes.filter(n => n.type === "task" && !n.isDone && n.dueDate && n.dueDate <= today);
    const pinned = notes.filter(n => n.isPinned && !urgent.some(u => u.id === n.id));
    return [...urgent, ...pinned].slice(0, 4);
  }, [notes, today]);

  // ── Clinical hero stats ───────────────────────────────────────────────────
  const heroStats = useMemo(() => {
    const inWaiting  = appointments.filter(a => a.date === today && a.status === "arrived").length;
    const completed  = appointments.filter(a => a.date === today && a.status === "completed").length;
    const thisMonth  = today.slice(0, 7);
    const monthTotal = appointments.filter(a => a.date.startsWith(thisMonth)).length;
    return {
      todayTotal:  todayAppts.length,
      inWaiting,
      completed,
      todayTele:   todayTele.length,
      monthTotal,
      totalPatients: patients.length,
    };
  }, [appointments, todayAppts, todayTele, today, patients]);

  // ── Today's caisse (end-of-day money) ──────────────────────────────────────
  const caisse = useMemo(() => {
    const billedToday = appointments.filter(a => a.billedAt && a.billedAt.slice(0, 10) === today);
    const collected   = billedToday.reduce((s, a) => s + (a.billedAmount ?? 0), 0);
    const seen        = appointments.filter(a => a.date === today && a.status === "completed");
    const unpaid      = seen.filter(a => !a.billedAt);
    const prices      = doctorProfile?.appointmentPrices ?? {};
    const unpaidEstimate = unpaid.reduce((s, a) => s + (prices[a.type] ?? 0), 0);
    return {
      collected,
      billedCount:    billedToday.length,
      seenCount:      seen.length,
      unpaidCount:    unpaid.length,
      unpaidEstimate,
      avgTicket:      billedToday.length ? collected / billedToday.length : 0,
    };
  }, [appointments, doctorProfile, today]);

  // ── Clinical alerts ────────────────────────────────────────────────────────
  const alerts = useMemo((): Alert[] => {
    const list: Alert[] = [];

    // Free-trial ending soon — an actionable nudge on the dashboard (besides the
    // TrialGate banner) so it isn't missed. Resurfaces as the deadline nears.
    if (trial.isTrial && trial.active && !trial.expired && trial.daysLeft != null && trial.daysLeft <= 7) {
      list.push({
        id: "trial-ending", level: trial.daysLeft <= 3 ? "critical" : "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v6l4 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/></svg>,
        text: t("dashboard.trialEnding", { n: trial.daysLeft }),
        subtext: t("dashboard.trialEndingSub"),
        route: "/parametres?section=subscription", weight: 30 - trial.daysLeft,
      });
    }

    // Low / out-of-stock
    const outOfStock = stockItems.filter(s => s.quantity === 0);
    const lowStock   = stockItems.filter(s => s.quantity > 0 && s.quantity <= s.minThreshold);
    if (outOfStock.length > 0) {
      list.push({
        id: "out-stock", level: "critical",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 5l5-3 5 3v4l-5 3-5-3V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
        text: t("dashboard.outOfStock", { n: outOfStock.length, s: outOfStock.length > 1 ? "s" : "" }),
        subtext: outOfStock.slice(0, 3).map(s => s.name).join(", "),
        route: "/stocks", weight: outOfStock.length,
      });
    } else if (lowStock.length > 0) {
      list.push({
        id: "low-stock", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 5l5-3 5 3v4l-5 3-5-3V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
        text: t("dashboard.lowStock", { n: lowStock.length, s: lowStock.length > 1 ? "s" : "" }),
        subtext: lowStock.slice(0, 3).map(s => s.name).join(", "),
        route: "/stocks", weight: lowStock.length,
      });
    }

    // Overdue purchase orders
    const overduePO = purchaseOrders.filter(o =>
      (o.status === "ordered" || o.status === "partial") &&
      o.expectedAt && o.expectedAt < today
    );
    if (overduePO.length > 0) {
      list.push({
        id: "overdue-po", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6h6M4 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
        text: t("dashboard.overdueOrders", { n: overduePO.length, s: overduePO.length > 1 ? "s" : "" }),
        subtext: overduePO.slice(0, 2).map(o => o.supplierName ?? "Fournisseur").join(", "),
        route: "/stocks", weight: overduePO.length,
      });
    }

    // Recent abnormal exam results (30 days)
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const abnExams = examResults.filter(e =>
      e.date >= cutoffStr &&
      e.values.some(v => {
        const num = parseFloat(v.value);
        if (v.isAbnormal) return true;
        if (isNaN(num)) return false;
        if (v.refMin !== undefined && num < v.refMin) return true;
        if (v.refMax !== undefined && num > v.refMax) return true;
        return false;
      })
    );
    if (abnExams.length > 0) {
      list.push({
        id: "abn-exam", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6.5" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10 3.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
        text: t("dashboard.abnExams", { n: abnExams.length, s: abnExams.length > 1 ? "s" : "" }),
        subtext: abnExams.slice(0, 2).map(e => e.patientName + " – " + e.title).join(" | "),
        // One abnormal result for a known patient → open their file; else the exams list.
        route: abnExams.length === 1 && abnExams[0].patientId ? `/patients/${abnExams[0].patientId}` : "/examens",
        weight: abnExams.length,
      });
    }

    // Overdue tasks
    const overdueTasks = notes.filter(n =>
      n.type === "task" && !n.isDone && n.dueDate && n.dueDate < today
    );
    if (overdueTasks.length > 0) {
      list.push({
        id: "overdue-tasks", level: "critical",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6h6M4 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
        text: t("dashboard.overdueTasks", { n: overdueTasks.length, s: overdueTasks.length > 1 ? "s" : "" }),
        subtext: overdueTasks.slice(0, 2).map(n => n.title).join(", "),
        route: "/notes", weight: overdueTasks.length,
      });
    }

    // Unbilled completed appointments today
    const unbilledToday = appointments.filter(
      a => a.date === today && a.status === "completed" && !a.billedAt
    );
    if (unbilledToday.length > 0) {
      list.push({
        id: "unbilled", level: "info",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 2h6l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5 8h4M5 10h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
        text: t("dashboard.unbilledToday", { n: unbilledToday.length, s: unbilledToday.length > 1 ? "s" : "" }),
        // One unbilled visit → open it (the Bill button lives there); many → billing list.
        route: unbilledToday.length === 1 ? `/agenda/${unbilledToday[0].id}` : "/facturation",
        weight: unbilledToday.length,
      });
    }

    // Overdue follow-ups
    const overdueFollowUps = appointments.filter(a => a.followUpDate && a.followUpDate <= today);
    if (overdueFollowUps.length > 0) {
      list.push({
        id: "overdue-followups", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 1v2M10 1v2M1 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M7 8.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="7" cy="7.5" r=".5" fill="currentColor"/></svg>,
        text: t("dashboard.overdueFollowUps", { n: overdueFollowUps.length, s: overdueFollowUps.length > 1 ? "s" : "" }),
        subtext: overdueFollowUps.slice(0, 2).map(a => a.patientName).join(", "),
        // One overdue follow-up → open that appointment; many → the reminders list.
        route: overdueFollowUps.length === 1 ? `/agenda/${overdueFollowUps[0].id}` : "/communication",
        weight: overdueFollowUps.length,
      });
    }

    // Upcoming online bookings (patient self-booked → review them)
    const onlineBookings = appointments.filter(
      a => a.bookingSource === "online" && a.date >= today && a.status !== "cancelled",
    );
    if (onlineBookings.length > 0) {
      list.push({
        id: "online-bookings", level: "info",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 7h11M7 1.5c1.6 1.5 1.6 9.5 0 11M7 1.5c-1.6 1.5-1.6 9.5 0 11" stroke="currentColor" strokeWidth="1.1"/></svg>,
        text: t("dashboard.onlineBookings", { n: onlineBookings.length, s: onlineBookings.length > 1 ? "s" : "" }),
        subtext: onlineBookings.slice(0, 2).map(a => `${a.patientName} · ${a.date.slice(5).replace("-", "/")}`).join(" | "),
        // One new online booking → open it to review/confirm; many → the agenda.
        route: onlineBookings.length === 1 ? `/agenda/${onlineBookings[0].id}` : "/agenda",
        weight: onlineBookings.length,
      });
    }

    // Storage health — this browser's local storage nears its ~10 MB cap
    // (mostly attachments). Weight = MB so a growing footprint resurfaces a
    // dismissed alert; the wording explains the concept in plain language.
    const storageBytes = estimateStorageBytes(storagePrefix); // scope to THIS account
    const storageMB = storageBytes / (1024 * 1024);
    if (storageMB > 7) {
      list.push({
        id: "storage-critical", level: "critical",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 7h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
        text: t("dashboard.storageCritical", { mb: storageMB.toFixed(1) }),
        subtext: t("dashboard.storageExplain"),
        route: "/parametres?section=backup", weight: Math.round(storageMB),
      });
    } else if (storageMB > 4) {
      list.push({
        id: "storage-warn", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 7h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
        text: t("dashboard.storageWarn", { mb: storageMB.toFixed(1) }),
        subtext: t("dashboard.storageExplain"),
        route: "/parametres?section=backup", weight: Math.round(storageMB),
      });
    }

    // Backup reminder (> 7 days without backup)
    if (lastBackupAt) {
      const daysSince = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000);
      if (daysSince >= 7) {
        list.push({
          id: "backup-remind", level: "info",
          icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M7 2V5l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
          text: t("dashboard.backupRemind", { n: daysSince }),
          route: "/parametres", weight: daysSince,
        });
      }
    } else if (patients.length > 5) {
      list.push({
        id: "backup-never", level: "info",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M7 2V5l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
        text: t("dashboard.backupNever"),
        route: "/parametres",
      });
    }

    return list;
  }, [stockItems, purchaseOrders, examResults, notes, appointments, patients, lastBackupAt, today, trial, storagePrefix]);

  // Hide alerts that were dismissed and haven't worsened since.
  const visibleAlerts = alerts.filter(a => {
    const d = dismissed[a.id];
    return d === undefined || (a.weight ?? 1) > d;
  });
  const criticalAlerts = visibleAlerts.filter(a => a.level === "critical");

  // ── Finance snapshot (compact) ────────────────────────────────────────────
  const yearTx = useMemo(
    () => transactions.filter(t => t.date.startsWith(String(fiscalYear))),
    [transactions, fiscalYear],
  );
  const netResult = result.breakdown.totalRecettes - result.breakdown.totalCharges;
  const isNeg     = netResult < 0;

  // ── Formatted today label ─────────────────────────────────────────────────
  const { i18n: i } = useTranslation();
  const locale = i.language?.slice(0, 2) === "ar" ? "ar-MA" : i.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const todayLabel = new Date(today + "T12:00:00").toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <Layout title={t("dashboard.title")} subtitle={todayLabel}>

      {/* ══════════════════════════════════════════════════
          CLINICAL HERO — today at a glance
      ══════════════════════════════════════════════════ */}
      <div className="dash-hero-grid rv-stagger">
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/agenda")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: "var(--blue)" }}><AnimatedNumber value={heroStats.todayTotal} /></div>
          <div className="dash-hero-lbl">{t("dashboard.apptToday")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/salle-attente")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: heroStats.inWaiting > 0 ? "#d97706" : "var(--text)" }}>
            <AnimatedNumber value={heroStats.inWaiting} />
          </div>
          <div className="dash-hero-lbl">{t("dashboard.inWaiting")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/agenda")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: "var(--green)" }}><AnimatedNumber value={heroStats.completed} /></div>
          <div className="dash-hero-lbl">{t("dashboard.completed")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/communication")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: "#2D8CFF" }}><AnimatedNumber value={heroStats.todayTele} /></div>
          <div className="dash-hero-lbl">{t("dashboard.teleconsults")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/agenda")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val" style={{ color: "var(--blue)" }}><AnimatedNumber value={heroStats.monthTotal} /></div>
          <div className="dash-hero-lbl">{t("dashboard.apptMonth")}</div>
        </div>
        <div className="dash-hero-tile rv-press rv-lift" onClick={() => navigate("/patients")} style={{ cursor: "pointer" }}>
          <div className="dash-hero-val"><AnimatedNumber value={heroStats.totalPatients} /></div>
          <div className="dash-hero-lbl">{t("dashboard.totalPatients")}</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          CAISSE DU JOUR — end-of-day money (the daily hook)
      ══════════════════════════════════════════════════ */}
      <div className="dash-caisse rv-sheen rv-rise">
        <div className="dash-caisse-main">
          <div className="dash-caisse-label">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 6h12" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="10" cy="9" r="1" fill="currentColor"/>
            </svg>
            {t("dashboard.caisseTitle")}
          </div>
          <div className="dash-caisse-amount"><AnimatedNumber value={caisse.collected} format={formatMAD} /></div>
          <div className="dash-caisse-sub">
            {caisse.seenCount > 0 || caisse.collected > 0
              ? <>
                  {t("dashboard.caisseSeen", { n: caisse.seenCount, s: caisse.seenCount > 1 ? "s" : "" })}
                  {caisse.billedCount > 0 && <> · {t("dashboard.caisseAvg", { amount: formatMAD(caisse.avgTicket) })}</>}
                </>
              : t("dashboard.caisseNothing")}
          </div>
        </div>
        {caisse.unpaidCount > 0 && (
          <button className="dash-caisse-unpaid" onClick={() => navigate("/facturation")}>
            <span className="dash-caisse-unpaid-count">{caisse.unpaidCount}</span>
            <span className="dash-caisse-unpaid-lbl">
              {t("dashboard.caisseUnpaid")}
              {caisse.unpaidEstimate > 0 && (
                <span className="dash-caisse-unpaid-est">≈ {formatMAD(caisse.unpaidEstimate)}</span>
              )}
            </span>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: .7 }}>
              <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          QUICK ACTIONS — clinical-first
      ══════════════════════════════════════════════════ */}
      <div className="dash-quick-actions">
        <button className="dash-quick-btn dash-quick-primary" onClick={() => navigate("/agenda")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 1v2M10 1v2M1 6h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M7 8.5v-2M6 7.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {t("dashboard.newAppt")}
        </button>
        <button className="dash-quick-btn dash-quick-primary" onClick={() => navigate("/patients")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 12c0-2.5 2-4.5 4.5-4.5S10 9.5 10 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M11 6v4M13 8h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {t("dashboard.newPatient")}
        </button>
        <button className="dash-quick-btn" onClick={() => navigate("/salle-attente")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9 7.5v2l1.2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="3.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M1 11c0-1.7 1.1-3 2.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("dashboard.waitingRoom")}
        </button>
        <button className="dash-quick-btn" onClick={() => navigate("/documents")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 1h6l3 3v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M4 7h5M4 9.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("dashboard.prescriptions")}
        </button>
        <button className="dash-quick-btn" onClick={() => navigate("/notes")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 6h6M4 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("dashboard.notesTasks")}
        </button>
        <button className="dash-quick-btn" onClick={() => navigate("/examens")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6.5" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 3.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M5.5 7h2M6.5 6v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("dashboard.examsLab")}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          ALERTS
      ══════════════════════════════════════════════════ */}
      {visibleAlerts.length > 0 && (
        <div className="dash-alerts-section">
          <div
            className="dash-alerts-header"
            onClick={() => setAlertsCollapsed(o => !o)}
          >
            <div className="dash-alerts-title">
              {criticalAlerts.length > 0 && (
                <span className="dash-alerts-critical-dot" />
              )}
              {t("dashboard.alerts")}
              <span className="dash-alerts-count">{visibleAlerts.length}</span>
            </div>
            <button className="dash-alerts-toggle">
              {alertsCollapsed
                ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 7.5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
          {!alertsCollapsed && (
            <div className="dash-alerts-list">
              {visibleAlerts.map(a => (
                <AlertPill key={a.id} alert={a} navigate={navigate} onDismiss={dismissAlert} dismissLabel={t("dashboard.dismissAlert")} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TODAY'S AGENDA + TÉLÉCONSULTATIONS
      ══════════════════════════════════════════════════ */}
      {(todayAppts.length > 0 || todayTele.length > 0) && (
        <div className="dash-today-row">

          {todayAppts.length > 0 && (
            <div className="card dash-today-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="dash-section-header">
                <div className="card-title" style={{ margin: 0 }}>{t("dashboard.todayAgenda")}</div>
                <button className="dash-see-all" onClick={() => navigate("/agenda")}>{t("common.seeAll")}</button>
              </div>
              <div className="dash-today-list">
                {todayAppts.slice(0, 6).map(a => (
                  <div key={a.id} className="dash-today-item"
                    onClick={() => navigate("/agenda/" + a.id)} style={{ cursor: "pointer" }}
                  >
                    <div className="dash-today-time">{a.startTime}</div>
                    <div
                      className="dash-today-dot"
                      style={{ background: APPT_STATUS_COLORS[a.status] ?? "var(--muted)" }}
                    />
                    <div className="dash-today-info">
                      <div className="dash-today-name">{a.patientName}</div>
                      <div className="dash-today-meta">
                        <span style={{ color: APPT_STATUS_COLORS[a.status] ?? "var(--muted)", fontSize: 11, fontWeight: 600 }}>
                          {t("apptStatus." + a.status, { defaultValue: a.status })}
                        </span>
                        {a.consultationNote?.motif && (
                          <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 6 }}>
                            · {a.consultationNote.motif}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {todayAppts.length > 6 && (
                  <div className="dash-today-more" onClick={() => navigate("/agenda")}>
                    {t("dashboard.moreItems", { n: todayAppts.length - 6, s: todayAppts.length - 6 > 1 ? "s" : "" })}
                  </div>
                )}
              </div>
            </div>
          )}

          {todayTele.length > 0 && (
            <div className="card dash-today-card" style={{ flex: "0 0 240px" }}>
              <div className="dash-section-header">
                <div className="card-title" style={{ margin: 0 }}>{t("dashboard.teleconsultations")}</div>
                <button className="dash-see-all" onClick={() => navigate("/communication")}>{t("common.see")}</button>
              </div>
              <div className="dash-today-list">
                {todayTele.slice(0, 4).map(s => (
                  <div key={s.id} className="dash-today-item">
                    <div className="dash-today-time">{s.scheduledTime}</div>
                    <div className="dash-today-dot" style={{ background: "#2D8CFF" }} />
                    <div className="dash-today-info">
                      <div className="dash-today-name">{s.patientName}</div>
                      <div className="dash-today-meta" style={{ fontSize: 11, color: "var(--muted)" }}>
                        {s.platform === "googlemeet" ? "Meet"
                          : s.platform === "zoom" ? "Zoom"
                          : s.platform === "teams" ? "Teams"
                          : s.platform === "jitsi" ? "Jitsi"
                          : "Téléconsult"}
                      </div>
                    </div>
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noreferrer"
                        className="dash-tele-join"
                        title={t("dashboard.join")}
                        onClick={e => e.stopPropagation()}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          <path d="M8 1h3v3M11 1L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PINNED NOTES & URGENT TASKS
      ══════════════════════════════════════════════════ */}
      {pinnedItems.length > 0 && (
        <div className="dash-pinned-section">
          <div className="dash-section-header">
            <div className="dash-pinned-title">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9l-3 1.5.5-3.5L2 4.5 5.5 4 7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              {t("dashboard.urgentNotes")}
            </div>
            <button className="dash-see-all" onClick={() => navigate("/notes")}>{t("common.seeAll")}</button>
          </div>
          <div className="dash-pinned-grid">
            {pinnedItems.map(n => {
              const cv = NOTE_COLOR_VALUES[n.color];
              const isOverdue = n.type === "task" && !n.isDone && n.dueDate && n.dueDate < today;
              return (
                <div
                  key={n.id}
                  className="dash-pinned-card"
                  style={{ background: cv.bg, borderColor: isOverdue ? "var(--coral)" : cv.border, color: cv.text, cursor: "pointer" }}
                  onClick={() => navigate("/notes")}
                >
                  <div className="dash-pinned-card-header">
                    {n.type === "task" && (
                      <span className="dash-pinned-task-badge" style={{ background: isOverdue ? "var(--coral)" : cv.border + "88", color: isOverdue ? "#fff" : cv.text }}>
                        {isOverdue ? t("common.overdue") : t("dashboard.task")}
                      </span>
                    )}
                    {n.isPinned && !isOverdue && (
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
                        <path d="M7 1l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9l-3 1.5.5-3.5L2 4.5 5.5 4 7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="dash-pinned-card-title">{n.title}</div>
                  {n.body && <div className="dash-pinned-card-body">{n.body.slice(0, 80)}{n.body.length > 80 ? "…" : ""}</div>}
                  {n.dueDate && (
                    <div className="dash-pinned-due" style={{ color: isOverdue ? "var(--coral)" : cv.text }}>
                      {isOverdue ? "⚠ " : ""}{t("common.deadline")} {new Date(n.dueDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          FINANCE SNAPSHOT — compact, collapsible
      ══════════════════════════════════════════════════ */}
      <div className="dash-finance-snapshot">
        <button
          className="dash-finance-header"
          onClick={() => setFinanceOpen(o => !o)}
        >
          <div className="dash-finance-header-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M4 3V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 7v2M5.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="dash-finance-title">{t("dashboard.financeTitle", { year: fiscalYear })}</span>
            <span
              className="dash-finance-net"
              style={{ color: isNeg ? "var(--coral)" : "var(--green)" }}
            >
              {formatMAD(netResult)}
            </span>
          </div>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transition: "transform 0.2s", transform: financeOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {financeOpen && (
          <div className="dash-finance-body">
            <div className="dash-finance-kpis">
              <div className="dash-finance-kpi">
                <div className="dash-finance-kpi-val" style={{ color: "var(--green)" }}>
                  {formatMAD(result.breakdown.totalRecettes)}
                </div>
                <div className="dash-finance-kpi-lbl">{t("dashboard.revenue")}</div>
              </div>
              <div className="dash-finance-kpi-sep" />
              <div className="dash-finance-kpi">
                <div className="dash-finance-kpi-val" style={{ color: "var(--coral)" }}>
                  {formatMAD(result.breakdown.totalCharges)}
                </div>
                <div className="dash-finance-kpi-lbl">{t("dashboard.expenses")}</div>
              </div>
              <div className="dash-finance-kpi-sep" />
              <div className="dash-finance-kpi">
                <div className="dash-finance-kpi-val" style={{ color: "var(--gold)" }}>
                  {formatMAD(result.tax.taxDue)}
                </div>
                <div className="dash-finance-kpi-lbl">{t("dashboard.taxEst")}</div>
              </div>
              <div className="dash-finance-kpi-sep" />
              <div className="dash-finance-kpi">
                <div className="dash-finance-kpi-val" style={{ color: isNeg ? "var(--coral)" : "var(--text)" }}>
                  {formatMAD(netResult)}
                </div>
                <div className="dash-finance-kpi-lbl">{t("dashboard.netResult")}</div>
              </div>
            </div>
            <div className="dash-finance-actions">
              <button className="btn btn-ghost" onClick={() => navigate("/facturation")}>
                {t("nav.transactions")}
              </button>
              <button className="btn btn-ghost" onClick={() => navigate("/rapports")}>
                {t("dashboard.taxReport")}
              </button>
              <button className="btn btn-ghost" onClick={() => navigate("/rapports")}>
                {t("dashboard.taxCalc")}
              </button>
            </div>
          </div>
        )}
      </div>

    </Layout>
  );
}
