import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Appointment } from "../lib/cabinetTypes";
import { APPT_TYPE_LABELS } from "../lib/cabinetTypes";
import { formatMAD, todayIso } from "../lib/format";
import { AnimatedNumber } from "../components/AnimatedNumber";

// ── Helpers ───────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "pending" | "received" | "rejected" | "to_declare";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "var(--gold-soft)",  color: "var(--gold)"  },
  received: { bg: "var(--green-soft)", color: "var(--green)" },
  rejected: { bg: "var(--coral-soft)", color: "var(--coral)" },
};

// ── Update modal ──────────────────────────────────────────────────────────────

function UpdateModal({
  appt, onSave, onClose,
}: {
  appt:    Appointment;
  onSave:  (patch: Partial<Appointment>) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const [status, setStatus]   = useState<string>(appt.reimbursementStatus ?? "pending");
  const [amount, setAmount]   = useState(appt.reimbursementAmount != null ? String(appt.reimbursementAmount) : "");
  const [date,   setDate]     = useState(appt.reimbursementDate ?? "");

  function fmtDate(iso: string) {
    return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount.replace(",", "."));
    onSave({
      reimbursementStatus:  status as Appointment["reimbursementStatus"],
      reimbursementAmount:  isNaN(n) ? undefined : n,
      reimbursementDate:    date || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">{t("remboursements.modalTitle")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{appt.patientName}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {fmtDate(appt.date)} · {APPT_TYPE_LABELS[appt.type]}
            </div>
            <div className="form-group">
              <label className="form-label">{t("remboursements.statusLabel")}</label>
              <select className="form-select" value={status}
                onChange={e => setStatus(e.target.value)}>
                <option value="pending">{t("remboursements.pending")}</option>
                <option value="received">{t("remboursements.received")}</option>
                <option value="rejected">{t("remboursements.rejected")}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t("remboursements.amountLabel")}</label>
              <input className="form-input" type="number" min="0" step="0.01"
                placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t("remboursements.dateLabel")}</label>
              <input className="form-input" type="date" value={date}
                onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("common.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Claim row ─────────────────────────────────────────────────────────────────

function ClaimRow({
  appt, patients, onUpdate,
}: {
  appt:      Appointment;
  patients:  { id: string; cnopsNumber?: string }[];
  onUpdate:  () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  function fmtDate(iso: string) {
    return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  const patientCnops = appt.patientId
    ? patients.find(p => p.id === appt.patientId)?.cnopsNumber
    : null;

  const st = appt.reimbursementStatus ?? "to_declare";
  const style = st !== "to_declare" ? STATUS_COLORS[st] : { bg: "var(--surface-alt)", color: "var(--muted)" };

  const statusLabel = st === "to_declare" ? t("remboursements.toDeclare")
    : st === "pending"  ? t("remboursements.pending")
    : st === "received" ? t("remboursements.received")
    : t("remboursements.rejected");

  return (
    <tr className="rmb-row">
      <td>
        <div className="rmb-patient-name">
          <Link to={`/agenda/${appt.id}`} className="rmb-appt-link">{appt.patientName}</Link>
        </div>
        {patientCnops && (
          <div className="rmb-cnops-num">CNOPS {patientCnops}</div>
        )}
      </td>
      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(appt.date)}</td>
      <td style={{ fontSize: 12 }}>{APPT_TYPE_LABELS[appt.type]}</td>
      <td style={{ fontWeight: 600 }}>
        {appt.billedAmount != null ? formatMAD(appt.billedAmount) : "—"}
      </td>
      <td style={{ fontWeight: 600, color: appt.reimbursementAmount ? "var(--green)" : "var(--muted)" }}>
        {appt.reimbursementAmount != null ? formatMAD(appt.reimbursementAmount) : "—"}
      </td>
      <td>
        <span
          className="rmb-status-badge"
          style={{ background: style.bg, color: style.color }}
        >
          {statusLabel}
        </span>
      </td>
      <td style={{ color: "var(--muted)", fontSize: 12 }}>
        {appt.reimbursementDate ? fmtDate(appt.reimbursementDate) : "—"}
      </td>
      <td>
        <button className="rmb-update-btn" onClick={onUpdate}>
          {t("remboursements.updateBtn")}
        </button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RemboursementsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t } = useTranslation();
  const { appointments, patients, updateAppointment } = useCabinet();
  const { fiscalYear } = useApp();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [yearFilter,   setYearFilter]   = useState(fiscalYear);
  const [search,       setSearch]       = useState("");
  const [updateModal,  setUpdateModal]  = useState<Appointment | null>(null);
  // suppress unused var warning — todayIso is needed for type inference
  void todayIso;

  const showToast = useToast();

  // ── KPI computation ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const yearAppts = appointments.filter(a => a.date.startsWith(String(yearFilter)));
    let pending = 0, pendingAmt = 0, received = 0, receivedAmt = 0, rejected = 0;
    for (const a of yearAppts) {
      if (!a.reimbursementStatus) continue;
      const amt = a.reimbursementAmount ?? 0;
      if      (a.reimbursementStatus === "pending")  { pending++;  pendingAmt  += amt; }
      else if (a.reimbursementStatus === "received") { received++; receivedAmt += amt; }
      else if (a.reimbursementStatus === "rejected") { rejected++; }
    }
    const total = pending + received + rejected;
    const rate  = total > 0 ? Math.round((received / total) * 100) : 0;
    const toDeclare = yearAppts.filter(a => !a.reimbursementStatus && (a.billedAt || a.status === "completed")).length;
    return { pending, pendingAmt, received, receivedAmt, rejected, total, rate, toDeclare };
  }, [appointments, yearFilter]);

  // ── Filtered rows ─────────────────────────────────────────────────────────

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return appointments
      .filter(a => {
        if (!a.date.startsWith(String(yearFilter))) return false;
        if (statusFilter === "to_declare") {
          return !a.reimbursementStatus && (!!a.billedAt || a.status === "completed");
        }
        if (statusFilter === "all") {
          return !!a.reimbursementStatus || (!a.reimbursementStatus && (!!a.billedAt || a.status === "completed"));
        }
        return a.reimbursementStatus === statusFilter;
      })
      .filter(a => !q || a.patientName.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments, statusFilter, yearFilter, search]);

  // Year options (last 5 years)
  const yearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => yearNow - 2 + i);

  const tabs: { key: StatusFilter; labelKey: string; count: number }[] = [
    { key: "all",        labelKey: "tabAll",        count: kpis.total + kpis.toDeclare },
    { key: "pending",    labelKey: "tabPending",    count: kpis.pending },
    { key: "received",   labelKey: "tabReceived",   count: kpis.received },
    { key: "rejected",   labelKey: "tabRejected",   count: kpis.rejected },
    { key: "to_declare", labelKey: "tabToDeclare",  count: kpis.toDeclare },
  ];

  const body = (
    <>
      {/* ── KPI cards ── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">{t("remboursements.kpiPending")}</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>
            {kpis.pendingAmt > 0 ? <AnimatedNumber value={kpis.pendingAmt} format={formatMAD} /> : <AnimatedNumber value={kpis.pending} />}
          </div>
          <div className="stat-sub">{t("remboursements.dossierCount", { n: kpis.pending, s: kpis.pending !== 1 ? "s" : "" })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("remboursements.kpiReceived", { year: yearFilter })}</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>
            {kpis.receivedAmt > 0 ? <AnimatedNumber value={kpis.receivedAmt} format={formatMAD} /> : <AnimatedNumber value={kpis.received} />}
          </div>
          <div className="stat-sub">{t("remboursements.dossierCount", { n: kpis.received, s: kpis.received !== 1 ? "s" : "" })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("remboursements.kpiRejected")}</div>
          <div className="stat-value" style={{ color: "var(--coral)" }}>{kpis.rejected}</div>
          <div className="stat-sub">
            {kpis.total > 0
              ? t("remboursements.rejectionRate", { pct: Math.round((kpis.rejected / kpis.total) * 100) })
              : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("remboursements.kpiRate")}</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>
            {kpis.total > 0 ? `${kpis.rate}%` : "—"}
          </div>
          <div className="stat-sub">
            {kpis.toDeclare > 0 && (
              <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                {t("remboursements.toDeclareCount", { n: kpis.toDeclare })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {kpis.total > 0 && (
        <div className="rmb-progress-bar">
          <div className="rmb-progress-track">
            {kpis.received > 0 && (
              <div
                className="rmb-progress-seg received"
                style={{ width: `${Math.round((kpis.received / kpis.total) * 100)}%` }}
                title={t("remboursements.legendReceived", { n: kpis.received })}
              />
            )}
            {kpis.rejected > 0 && (
              <div
                className="rmb-progress-seg rejected"
                style={{ width: `${Math.round((kpis.rejected / kpis.total) * 100)}%` }}
                title={t("remboursements.legendRejected", { n: kpis.rejected })}
              />
            )}
          </div>
          <div className="rmb-progress-legend">
            <span style={{ color: "var(--green)" }}>{t("remboursements.legendReceived", { n: kpis.received })}</span>
            <span style={{ color: "var(--gold)" }}>{t("remboursements.legendPending", { n: kpis.pending })}</span>
            <span style={{ color: "var(--coral)" }}>{t("remboursements.legendRejected", { n: kpis.rejected })}</span>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="rmb-filter-bar">
        {/* Status tabs */}
        <div className="rmb-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`rmb-tab${statusFilter === tab.key ? " active" : ""}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {t(`remboursements.${tab.labelKey}`)}
              {tab.count > 0 && (
                <span className="rmb-tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Year selector */}
          <select
            className="form-select"
            style={{ padding: "6px 10px", fontSize: 13, width: "auto" }}
            value={yearFilter}
            onChange={e => setYearFilter(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Search */}
          <div className="rmb-search-wrap">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              className="rmb-search"
              placeholder={t("remboursements.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏥</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {statusFilter === "to_declare"
              ? t("remboursements.emptyToDeclare")
              : t("remboursements.emptyAll")}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {statusFilter === "all"
              ? t("remboursements.emptyHintAll")
              : t("remboursements.emptyHintFilter")}
          </div>
        </div>
      ) : (
        <div className="rmb-table-wrap">
          <div className="rmb-table-count">{t("remboursements.dossierCount", { n: rows.length, s: rows.length !== 1 ? "s" : "" })}</div>
          <div style={{ overflowX: "auto" }}>
            <table className="rmb-table">
              <thead>
                <tr>
                  <th>{t("remboursements.colPatient")}</th>
                  <th>{t("remboursements.colDate")}</th>
                  <th>{t("remboursements.colType")}</th>
                  <th>{t("remboursements.colBilled")}</th>
                  <th>{t("remboursements.colAmo")}</th>
                  <th>{t("remboursements.colStatus")}</th>
                  <th>{t("remboursements.colEncaisse")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(appt => (
                  <ClaimRow
                    key={appt.id}
                    appt={appt}
                    patients={patients}
                    onUpdate={() => setUpdateModal(appt)}
                  />
                ))}
              </tbody>
              {/* Totals footer for received / pending */}
              {statusFilter !== "to_declare" && rows.some(a => a.reimbursementAmount) && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700, paddingLeft: 14 }}>{t("remboursements.totalDisplayed")}</td>
                    <td style={{ fontWeight: 800, color: "var(--green)" }}>
                      {formatMAD(rows.reduce((s, a) => s + (a.reimbursementAmount ?? 0), 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Update modal ── */}
      {updateModal && (
        <UpdateModal
          appt={updateModal}
          onSave={patch => {
            updateAppointment({ ...updateModal, ...patch });
            showToast(t("remboursements.toastUpdated"));
          }}
          onClose={() => setUpdateModal(null)}
        />
      )}

    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title={t("remboursements.title")}
      subtitle={t("remboursements.subtitle", { n: kpis.pending, s: kpis.pending !== 1 ? "s" : "", year: yearFilter })}
    >
      {body}
    </Layout>
  );
}
