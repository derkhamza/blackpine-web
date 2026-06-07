import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { MonthlyChart } from "../components/MonthlyChart";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD, todayIso } from "../lib/format";
import { getActiveMonths, getMonthlyData, getCategoryBreakdown } from "../lib/chartHelpers";
import { NOTE_COLOR_VALUES } from "../lib/cabinetTypes";

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({
  curr, prev, higherIsBetter = true,
}: { curr: number; prev: number; higherIsBetter?: boolean }) {
  if (prev === 0) return null;
  const pctRaw = ((curr - prev) / Math.abs(prev)) * 100;
  const pct = Math.round(pctRaw);
  const up  = pct >= 0;
  const good = higherIsBetter ? up : !up;
  return (
    <span
      className="delta-badge"
      style={{
        background: good ? "var(--green-soft)" : "var(--coral-soft)",
        color:      good ? "var(--green)"      : "var(--coral)",
      }}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ── Alert item ────────────────────────────────────────────────────────────────

interface Alert {
  id:      string;
  level:   "critical" | "warning" | "info";
  icon:    JSX.Element;
  text:    string;
  subtext?: string;
  route:   string;
}

function AlertPill({ alert, navigate }: { alert: Alert; navigate: (r: string) => void }) {
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
    </div>
  );
}

// ── Appt status colors ────────────────────────────────────────────────────────

const APPT_STATUS_COLORS: Record<string, string> = {
  scheduled:       "var(--blue)",
  arrived:         "#d97706",
  in_consultation: "var(--blue)",
  completed:       "var(--green)",
  cancelled:       "var(--muted)",
  no_show:         "var(--coral)",
};

const APPT_STATUS_LABELS: Record<string, string> = {
  scheduled:       "Planifié",
  arrived:         "Arrivé",
  in_consultation: "En consultation",
  completed:       "Terminé",
  cancelled:       "Annulé",
  no_show:         "Non présenté",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const today = todayIso();

  const {
    result, transactions, fiscalYear, setFiscalYear,
    FISCAL_MIN, FISCAL_MAX,
  } = useApp();

  const {
    appointments,
    stockItems,
    purchaseOrders,
    examResults,
    notes,
    teleSessions,
  } = useCabinet();

  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  const yearTx      = useMemo(() => transactions.filter((t) => t.date.startsWith(String(fiscalYear))), [transactions, fiscalYear]);
  const monthlyData = useMemo(() => getActiveMonths(getMonthlyData(yearTx, fiscalYear)), [yearTx, fiscalYear]);
  const netResult   = result.breakdown.totalRecettes - result.breakdown.totalCharges;
  const isNeg       = netResult < 0;

  const prevYear   = fiscalYear - 1;
  const prevYearTx = useMemo(() => transactions.filter((t) => t.date.startsWith(String(prevYear))), [transactions, prevYear]);
  const prevRec    = useMemo(() => prevYearTx.filter((t) => t.type === "RECETTE").reduce((s, t) => s + t.amount, 0), [prevYearTx]);
  const prevChg    = useMemo(() => prevYearTx.filter((t) => t.type === "CHARGE").reduce((s, t)  => s + t.amount, 0), [prevYearTx]);
  const hasPrev    = prevYearTx.length > 0;

  const categorySlices = useMemo(() => getCategoryBreakdown(yearTx), [yearTx]);

  // CNOPS / AMO spotlight
  const yearAppts = useMemo(
    () => appointments.filter((a) => a.date.startsWith(String(fiscalYear))),
    [appointments, fiscalYear],
  );
  const cnopsStats = useMemo(() => {
    let pendingTotal = 0, receivedTotal = 0;
    let pendingCount = 0, receivedCount = 0, rejectedCount = 0;
    for (const a of yearAppts) {
      if (!a.reimbursementStatus) continue;
      const amt = a.reimbursementAmount ?? 0;
      if      (a.reimbursementStatus === "pending")  { pendingCount++;  pendingTotal  += amt; }
      else if (a.reimbursementStatus === "received") { receivedCount++; receivedTotal += amt; }
      else if (a.reimbursementStatus === "rejected") { rejectedCount++; }
    }
    return { pendingTotal, receivedTotal, pendingCount, receivedCount, rejectedCount };
  }, [yearAppts]);
  const hasCnops = cnopsStats.pendingCount + cnopsStats.receivedCount + cnopsStats.rejectedCount > 0;

  // Top patients by revenue
  const topPatients = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const tx of yearTx) {
      if (tx.type !== "RECETTE" || !tx.description) continue;
      const name = tx.description.replace(/^[^–]+ – /, "");
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 };
      map[name].revenue += tx.amount;
      map[name].count++;
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [yearTx]);

  // ── Clinical alerts ────────────────────────────────────────────────────────
  const alerts = useMemo((): Alert[] => {
    const list: Alert[] = [];

    // Low / out-of-stock items
    const outOfStock = stockItems.filter(s => s.quantity === 0);
    const lowStock   = stockItems.filter(s => s.quantity > 0 && s.quantity <= s.minThreshold);
    if (outOfStock.length > 0) {
      list.push({
        id: "out-stock", level: "critical",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 5l5-3 5 3v4l-5 3-5-3V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
        text: `${outOfStock.length} article${outOfStock.length > 1 ? "s" : ""} en rupture de stock`,
        subtext: outOfStock.slice(0, 3).map(s => s.name).join(", "),
        route: "/stocks",
      });
    } else if (lowStock.length > 0) {
      list.push({
        id: "low-stock", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 5l5-3 5 3v4l-5 3-5-3V5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
        text: `${lowStock.length} article${lowStock.length > 1 ? "s" : ""} en stock faible`,
        subtext: lowStock.slice(0, 3).map(s => s.name).join(", "),
        route: "/stocks",
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
        text: `${overduePO.length} commande${overduePO.length > 1 ? "s" : ""} en retard de livraison`,
        subtext: overduePO.slice(0, 2).map(o => o.supplierName ?? "Fournisseur").join(", "),
        route: "/fournisseurs",
      });
    }

    // Pending purchase orders (not yet overdue)
    const pendingPO = purchaseOrders.filter(o =>
      (o.status === "ordered" || o.status === "draft") &&
      (!o.expectedAt || o.expectedAt >= today)
    );
    if (pendingPO.length > 0 && overduePO.length === 0) {
      list.push({
        id: "pending-po", level: "info",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6h6M4 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
        text: `${pendingPO.length} commande${pendingPO.length > 1 ? "s" : ""} en attente`,
        route: "/fournisseurs",
      });
    }

    // Recent abnormal exam results (last 30 days)
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
        text: `${abnExams.length} examen${abnExams.length > 1 ? "s" : ""} avec résultats anormaux (30 j)`,
        subtext: abnExams.slice(0, 2).map(e => e.patientName + " – " + e.title).join(" | "),
        route: "/examens",
      });
    }

    // Unbilled completed appointments today
    const unbilledToday = appointments.filter(
      a => a.date === today && a.status === "completed" && !a.billedAt
    );
    if (unbilledToday.length > 0) {
      list.push({
        id: "unbilled", level: "warning",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 2h6l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5 8h4M5 10h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
        text: `${unbilledToday.length} consultation${unbilledToday.length > 1 ? "s" : ""} non facturée${unbilledToday.length > 1 ? "s" : ""} aujourd'hui`,
        route: "/agenda",
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
        text: `${overdueTasks.length} tâche${overdueTasks.length > 1 ? "s" : ""} en retard`,
        subtext: overdueTasks.slice(0, 2).map(n => n.title).join(", "),
        route: "/notes",
      });
    }

    // CNOPS pending
    if (cnopsStats.pendingCount > 0) {
      list.push({
        id: "cnops", level: "info",
        icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L2 4v4c0 3 2 4.5 5 5 3-.5 5-2 5-5V4L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
        text: `${cnopsStats.pendingCount} dossier${cnopsStats.pendingCount > 1 ? "s" : ""} AMO/CNOPS en attente`,
        subtext: cnopsStats.pendingTotal > 0 ? formatMAD(cnopsStats.pendingTotal) : undefined,
        route: "/remboursements",
      });
    }

    return list;
  }, [stockItems, purchaseOrders, examResults, notes, appointments, cnopsStats, today]);

  const criticalAlerts = alerts.filter(a => a.level === "critical");
  const hasAlerts      = alerts.length > 0;

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

  // ── Cabinet activity strip ────────────────────────────────────────────────
  const cabinetActivity = useMemo(() => {
    const thisMonth = today.slice(0, 7);
    return {
      todayAppts:   todayAppts.length,
      completedToday: todayAppts.filter(a => a.status === "completed").length,
      monthAppts:   appointments.filter(a => a.date.startsWith(thisMonth)).length,
      lowStockCount: stockItems.filter(s => s.quantity <= s.minThreshold).length,
      pendingOrders: purchaseOrders.filter(o => o.status === "ordered" || o.status === "partial" || o.status === "draft").length,
      todayTele:    todayTele.length,
      pendingTasks: notes.filter(n => n.type === "task" && !n.isDone).length,
      recentExams:  examResults.filter(e => e.date >= today.slice(0, 7) + "-01").length,
    };
  }, [todayAppts, appointments, stockItems, purchaseOrders, todayTele, notes, examResults, today]);

  return (
    <Layout title="Tableau de bord" subtitle={String(fiscalYear)}>

      {/* ── Year picker ── */}
      <div className="year-picker">
        <button className="year-btn" disabled={fiscalYear <= FISCAL_MIN}
          onClick={() => setFiscalYear(fiscalYear - 1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <div className="year-label">{fiscalYear}</div>
          <div className="year-sub">Exercice fiscal</div>
        </div>
        <button className="year-btn" disabled={fiscalYear >= FISCAL_MAX}
          onClick={() => setFiscalYear(fiscalYear + 1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Hero result card ── */}
      <div className="hero-card" style={{ marginBottom: 16 }}>
        <div className="hero-card-header">
          <div className="hero-card-label">Résultat net</div>
          <div className="hero-card-regime">{result.tax.regime}</div>
        </div>
        <div className={`hero-amount${isNeg ? " negative" : ""}`}>
          {formatMAD(netResult)}
        </div>
        <div className="hero-sub">Recettes − Charges · {fiscalYear}</div>
        <div className="hero-metrics">
          <div className="hero-metric" onClick={() => navigate("/transactions?filter=RECETTE")} style={{ cursor: "pointer" }}>
            <div className="hero-metric-label">Recettes</div>
            <div className="hero-metric-value" style={{ color: "#6DEDB5" }}>
              {formatMAD(result.breakdown.totalRecettes)}
            </div>
          </div>
          <div className="hero-metric" onClick={() => navigate("/transactions?filter=CHARGE")} style={{ cursor: "pointer" }}>
            <div className="hero-metric-label">Charges</div>
            <div className="hero-metric-value" style={{ color: "#FF8087" }}>
              {formatMAD(result.breakdown.totalCharges)}
            </div>
          </div>
          <div className="hero-metric" onClick={() => navigate("/expliquer")} style={{ cursor: "pointer" }}>
            <div className="hero-metric-label">IR estimé</div>
            <div className="hero-metric-value">{formatMAD(result.tax.taxDue)}</div>
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="dash-quick-actions">
        <button
          className="dash-quick-btn dash-quick-recette"
          onClick={() => navigate("/transactions?openAdd=RECETTE")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Ajouter une recette
        </button>
        <button
          className="dash-quick-btn dash-quick-charge"
          onClick={() => navigate("/transactions?openAdd=CHARGE")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Ajouter une charge
        </button>
        <button className="dash-quick-btn" style={{ flex: "0 0 auto" }}
          onClick={() => navigate("/agenda")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 1v2M10 1v2M1 6h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Agenda
        </button>
        <button className="dash-quick-btn" style={{ flex: "0 0 auto" }}
          onClick={() => navigate("/patients")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 12c0-2.5 2-4.5 4.5-4.5S10 9.5 10 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M11 6v4M13 8h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Patients
        </button>
      </div>

      {/* ════════════════════════════════════════════════
          CABINET ACTIVITY STRIP — new in item 39
      ════════════════════════════════════════════════ */}
      <div className="dash-activity-strip">
        <div className="dash-act-item" onClick={() => navigate("/agenda")} title="Voir l'agenda">
          <div className="dash-act-val" style={{ color: "var(--blue)" }}>{cabinetActivity.todayAppts}</div>
          <div className="dash-act-lbl">RDV aujourd'hui</div>
        </div>
        <div className="dash-act-item" onClick={() => navigate("/agenda")} title="Consultations terminées">
          <div className="dash-act-val" style={{ color: "var(--green)" }}>{cabinetActivity.completedToday}</div>
          <div className="dash-act-lbl">Terminées</div>
        </div>
        <div className="dash-act-item" onClick={() => navigate("/teleconsult")} title="Téléconsultations aujourd'hui">
          <div className="dash-act-val" style={{ color: "#2D8CFF" }}>{cabinetActivity.todayTele}</div>
          <div className="dash-act-lbl">Téléconsult</div>
        </div>
        <div className="dash-act-item"
          onClick={() => navigate("/stocks")}
          title="Articles en stock faible ou rupture"
          style={{ cursor: cabinetActivity.lowStockCount > 0 ? "pointer" : "default" }}
        >
          <div className="dash-act-val" style={{ color: cabinetActivity.lowStockCount > 0 ? "var(--coral)" : "var(--text)" }}>
            {cabinetActivity.lowStockCount}
          </div>
          <div className="dash-act-lbl">Stock faible</div>
        </div>
        <div className="dash-act-item" onClick={() => navigate("/fournisseurs")} title="Commandes en attente">
          <div className="dash-act-val" style={{ color: cabinetActivity.pendingOrders > 0 ? "var(--gold)" : "var(--text)" }}>
            {cabinetActivity.pendingOrders}
          </div>
          <div className="dash-act-lbl">Commandes</div>
        </div>
        <div className="dash-act-item" onClick={() => navigate("/notes")} title="Tâches en attente">
          <div className="dash-act-val" style={{ color: cabinetActivity.pendingTasks > 0 ? "var(--gold)" : "var(--text)" }}>
            {cabinetActivity.pendingTasks}
          </div>
          <div className="dash-act-lbl">Tâches</div>
        </div>
        <div className="dash-act-item" onClick={() => navigate("/examens")} title="Examens ce mois">
          <div className="dash-act-val" style={{ color: "var(--blue)" }}>{cabinetActivity.recentExams}</div>
          <div className="dash-act-lbl">Examens (mois)</div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          ALERTS — new in item 39
      ════════════════════════════════════════════════ */}
      {hasAlerts && (
        <div className="dash-alerts-section">
          <div
            className="dash-alerts-header"
            onClick={() => setAlertsCollapsed(o => !o)}
          >
            <div className="dash-alerts-title">
              {criticalAlerts.length > 0 && (
                <span className="dash-alerts-critical-dot" />
              )}
              Alertes du cabinet
              <span className="dash-alerts-count">{alerts.length}</span>
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
              {alerts.map(a => (
                <AlertPill key={a.id} alert={a} navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TODAY's AGENDA + TELE — new in item 39
      ════════════════════════════════════════════════ */}
      {(todayAppts.length > 0 || todayTele.length > 0) && (
        <div className="dash-today-row">

          {/* Agenda du jour */}
          {todayAppts.length > 0 && (
            <div className="card dash-today-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="dash-section-header">
                <div className="card-title" style={{ margin: 0 }}>Agenda du jour</div>
                <button className="dash-see-all" onClick={() => navigate("/agenda")}>Voir tout →</button>
              </div>
              <div className="dash-today-list">
                {todayAppts.slice(0, 5).map(a => (
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
                          {APPT_STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {todayAppts.length > 5 && (
                  <div className="dash-today-more" onClick={() => navigate("/agenda")}>
                    +{todayAppts.length - 5} autre{todayAppts.length - 5 > 1 ? "s" : ""} →
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Téléconsultations du jour */}
          {todayTele.length > 0 && (
            <div className="card dash-today-card" style={{ flex: "0 0 240px" }}>
              <div className="dash-section-header">
                <div className="card-title" style={{ margin: 0 }}>Téléconsultations</div>
                <button className="dash-see-all" onClick={() => navigate("/teleconsult")}>Voir →</button>
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
                        title="Rejoindre"
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

      {/* ════════════════════════════════════════════════
          PINNED NOTES — new in item 39
      ════════════════════════════════════════════════ */}
      {pinnedItems.length > 0 && (
        <div className="dash-pinned-section">
          <div className="dash-section-header">
            <div className="dash-pinned-title">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9l-3 1.5.5-3.5L2 4.5 5.5 4 7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Notes & tâches urgentes
            </div>
            <button className="dash-see-all" onClick={() => navigate("/notes")}>Voir tout →</button>
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
                        {isOverdue ? "En retard" : "Tâche"}
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
                      {isOverdue ? "⚠ " : ""}Échéance : {new Date(n.dueDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CNOPS / AMO spotlight ── */}
      {hasCnops && (
        <div className="cnops-spotlight">
          <div className="cnops-header">
            <span className="cnops-title">AMO / CNOPS · {fiscalYear}</span>
            {cnopsStats.pendingCount > 0 && (
              <button
                className="cnops-resolve-btn"
                onClick={() => navigate("/remboursements")}
              >
                Voir tout →
              </button>
            )}
          </div>
          <div className="cnops-kpi-row">
            <div className="cnops-kpi">
              <div className="cnops-kpi-value" style={{ color: cnopsStats.receivedTotal > 0 ? "var(--green)" : undefined }}>
                {cnopsStats.receivedTotal > 0 ? formatMAD(cnopsStats.receivedTotal) : "—"}
              </div>
              <div className="cnops-kpi-label">Encaissé</div>
              {cnopsStats.receivedCount > 0 && (
                <div className="cnops-kpi-count">{cnopsStats.receivedCount} dossier{cnopsStats.receivedCount > 1 ? "s" : ""}</div>
              )}
            </div>
            <div className="cnops-kpi-sep" />
            <div className="cnops-kpi">
              <div className="cnops-kpi-value" style={{ color: cnopsStats.pendingTotal > 0 ? "var(--gold)" : undefined }}>
                {cnopsStats.pendingTotal > 0 ? formatMAD(cnopsStats.pendingTotal) : "—"}
              </div>
              <div className="cnops-kpi-label">En attente</div>
              {cnopsStats.pendingCount > 0 && (
                <div className="cnops-kpi-count">{cnopsStats.pendingCount} dossier{cnopsStats.pendingCount > 1 ? "s" : ""}</div>
              )}
            </div>
            <div className="cnops-kpi-sep" />
            <div className="cnops-kpi">
              <div className="cnops-kpi-value" style={{ color: cnopsStats.rejectedCount > 0 ? "var(--coral)" : undefined }}>
                {cnopsStats.rejectedCount > 0 ? String(cnopsStats.rejectedCount) : "—"}
              </div>
              <div className="cnops-kpi-label">Refusé</div>
            </div>
          </div>
          {cnopsStats.receivedTotal > 0 && cnopsStats.pendingTotal > 0 && (() => {
            const pct = Math.round(
              (cnopsStats.receivedTotal / (cnopsStats.receivedTotal + cnopsStats.pendingTotal)) * 100,
            );
            return (
              <div className="cnops-progress-row">
                <div className="cnops-progress-track">
                  <div className="cnops-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="cnops-progress-label">{pct}% encaissé</span>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Two-column financial layout ── */}
      <div className="dash-2col">

        {/* Left */}
        <div className="dash-col">
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card" style={{ borderLeftColor: "var(--green)" }}>
              <div className="stat-label">Total recettes</div>
              <div className="stat-value" style={{ color: "var(--green)" }}>{formatMAD(result.breakdown.totalRecettes)}</div>
              {hasPrev && <DeltaBadge curr={result.breakdown.totalRecettes} prev={prevRec} higherIsBetter />}
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--coral)" }}>
              <div className="stat-label">Total charges</div>
              <div className="stat-value" style={{ color: "var(--coral)" }}>{formatMAD(result.breakdown.totalCharges)}</div>
              {hasPrev && <DeltaBadge curr={result.breakdown.totalCharges} prev={prevChg} higherIsBetter={false} />}
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--gold)" }}>
              <div className="stat-label">IR / CM estimé</div>
              <div className="stat-value" style={{ color: "var(--gold)" }}>{formatMAD(result.tax.taxDue)}</div>
              <div className="stat-sub">{result.tax.payableRule}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Activité mensuelle · {fiscalYear}</div>
            <MonthlyChart data={monthlyData} fiscalYear={fiscalYear} />
          </div>

          <div className="card">
            <div className="card-title">Performance cabinet</div>
            <div className="breakdown-row">
              <span>Total recettes</span>
              <span className="val-green">{formatMAD(result.breakdown.totalRecettes)}</span>
            </div>
            <div className="breakdown-row">
              <span>Charges déductibles</span>
              <span style={{ color: "var(--muted)" }}>− {formatMAD(result.breakdown.totalChargesDeductibles)}</span>
            </div>
            {result.breakdown.totalReintegrations > 0 && (
              <div className="breakdown-row">
                <span>Réintégrations fiscales</span>
                <span style={{ color: "var(--gold)" }}>+ {formatMAD(result.breakdown.totalReintegrations)}</span>
              </div>
            )}
            <div className="breakdown-row bold">
              <span>Résultat fiscal</span>
              <span>{formatMAD(result.breakdown.resultatFiscal)}</span>
            </div>
            <div className="breakdown-row bold">
              <span>IR / CM estimé ({result.tax.payableRule})</span>
              <span style={{ color: "var(--gold)" }}>{formatMAD(result.tax.taxDue)}</span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="dash-col">

          {hasPrev && (
            <div className="card yoy-card">
              <div className="card-title">Comparaison année précédente</div>
              <div className="yoy-row">
                <div className="yoy-metric">
                  <div className="yoy-metric-label">Recettes {fiscalYear}</div>
                  <div className="yoy-metric-value" style={{ color: "var(--green)" }}>
                    {formatMAD(result.breakdown.totalRecettes)}
                  </div>
                  <DeltaBadge curr={result.breakdown.totalRecettes} prev={prevRec} higherIsBetter />
                </div>
                <div className="yoy-sep" />
                <div className="yoy-metric">
                  <div className="yoy-metric-label">Recettes {prevYear}</div>
                  <div className="yoy-metric-value" style={{ color: "var(--muted)" }}>
                    {formatMAD(prevRec)}
                  </div>
                </div>
              </div>
              <div className="yoy-row" style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
                <div className="yoy-metric">
                  <div className="yoy-metric-label">Charges {fiscalYear}</div>
                  <div className="yoy-metric-value" style={{ color: "var(--coral)" }}>
                    {formatMAD(result.breakdown.totalCharges)}
                  </div>
                  <DeltaBadge curr={result.breakdown.totalCharges} prev={prevChg} higherIsBetter={false} />
                </div>
                <div className="yoy-sep" />
                <div className="yoy-metric">
                  <div className="yoy-metric-label">Charges {prevYear}</div>
                  <div className="yoy-metric-value" style={{ color: "var(--muted)" }}>
                    {formatMAD(prevChg)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {categorySlices.length > 0 && (
            <div className="card">
              <div className="card-title">Répartition des charges</div>
              <div className="cat-list">
                {categorySlices.map((s) => (
                  <div key={s.id} className="cat-row">
                    <div className="cat-dot" style={{ background: s.color }} />
                    <span className="cat-label">{s.label}</span>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{ width: `${s.percentage}%`, background: s.color + "cc" }}
                      />
                    </div>
                    <span className="cat-pct">{s.percentage}%</span>
                    <span className="cat-amount">{formatMAD(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topPatients.length > 0 && (
            <div className="card">
              <div className="card-title">Top patients · {fiscalYear}</div>
              {topPatients.map((p, i) => (
                <div key={p.name} className="top-patient-row">
                  <div className="top-patient-rank">#{i + 1}</div>
                  <div className="top-patient-name">{p.name}</div>
                  <div className="top-patient-count">{p.count} consult.</div>
                  <div className="top-patient-rev" style={{ color: "var(--green)" }}>
                    {formatMAD(p.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate("/transactions")}>
              Gérer les transactions
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate("/expliquer")}>
              Voir le détail fiscal
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
