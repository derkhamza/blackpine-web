import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Appointment } from "../lib/cabinetTypes";
import { APPT_TYPE_LABELS } from "../lib/cabinetTypes";
import { formatMAD, todayIso } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "pending" | "received" | "rejected" | "to_declare";

const STATUS_LABELS: Record<Appointment["reimbursementStatus"] & string, string> = {
  pending:  "En attente",
  received: "Encaissé",
  rejected: "Refusé",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "var(--gold-soft)",  color: "var(--gold)"  },
  received: { bg: "var(--green-soft)", color: "var(--green)" },
  rejected: { bg: "var(--coral-soft)", color: "var(--coral)" },
};

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Update modal ──────────────────────────────────────────────────────────────

function UpdateModal({
  appt, onSave, onClose,
}: {
  appt:    Appointment;
  onSave:  (patch: Partial<Appointment>) => void;
  onClose: () => void;
}) {
  const [status, setStatus]   = useState<string>(appt.reimbursementStatus ?? "pending");
  const [amount, setAmount]   = useState(appt.reimbursementAmount != null ? String(appt.reimbursementAmount) : "");
  const [date,   setDate]     = useState(appt.reimbursementDate ?? "");

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
          <h2 className="modal-title">Mise à jour AMO/CNOPS</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{appt.patientName}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {fmtDate(appt.date)} · {APPT_TYPE_LABELS[appt.type]}
            </div>
            <div className="form-group">
              <label className="form-label">Statut de remboursement</label>
              <select className="form-select" value={status}
                onChange={e => setStatus(e.target.value)}>
                <option value="pending">En attente</option>
                <option value="received">Encaissé</option>
                <option value="rejected">Refusé</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Montant AMO (MAD)</label>
              <input className="form-input" type="number" min="0" step="0.01"
                placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Date encaissement</label>
              <input className="form-input" type="date" value={date}
                onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
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
  const patientCnops = appt.patientId
    ? patients.find(p => p.id === appt.patientId)?.cnopsNumber
    : null;

  const st = appt.reimbursementStatus ?? "to_declare";
  const style = st !== "to_declare" ? STATUS_COLORS[st] : { bg: "var(--surface-alt)", color: "var(--muted)" };

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
          {st !== "to_declare" ? STATUS_LABELS[st] : "À déclarer"}
        </span>
      </td>
      <td style={{ color: "var(--muted)", fontSize: 12 }}>
        {appt.reimbursementDate ? fmtDate(appt.reimbursementDate) : "—"}
      </td>
      <td>
        <button className="rmb-update-btn" onClick={onUpdate}>
          Mettre à jour
        </button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RemboursementsPage() {
  const { appointments, patients, updateAppointment } = useCabinet();
  const { fiscalYear } = useApp();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [yearFilter,   setYearFilter]   = useState(fiscalYear);
  const [search,       setSearch]       = useState("");
  const [updateModal,  setUpdateModal]  = useState<Appointment | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

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
          // Billed/completed with no claim yet
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

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all",        label: "Tous",          count: kpis.total + kpis.toDeclare },
    { key: "pending",    label: "En attente",     count: kpis.pending },
    { key: "received",   label: "Encaissés",      count: kpis.received },
    { key: "rejected",   label: "Refusés",        count: kpis.rejected },
    { key: "to_declare", label: "À déclarer",     count: kpis.toDeclare },
  ];

  return (
    <Layout
      title="Remboursements AMO/CNOPS"
      subtitle={`${kpis.pending} dossier${kpis.pending !== 1 ? "s" : ""} en attente · ${yearFilter}`}
    >
      {/* ── KPI cards ── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">En attente</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>
            {kpis.pendingAmt > 0 ? formatMAD(kpis.pendingAmt) : `${kpis.pending}`}
          </div>
          <div className="stat-sub">{kpis.pending} dossier{kpis.pending !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Encaissé {yearFilter}</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>
            {kpis.receivedAmt > 0 ? formatMAD(kpis.receivedAmt) : `${kpis.received}`}
          </div>
          <div className="stat-sub">{kpis.received} dossier{kpis.received !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Refusés</div>
          <div className="stat-value" style={{ color: "var(--coral)" }}>{kpis.rejected}</div>
          <div className="stat-sub">
            {kpis.total > 0
              ? `${Math.round((kpis.rejected / kpis.total) * 100)}% de taux de refus`
              : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taux d'encaissement</div>
          <div className="stat-value" style={{ color: "var(--blue)" }}>
            {kpis.total > 0 ? `${kpis.rate}%` : "—"}
          </div>
          <div className="stat-sub">
            {kpis.toDeclare > 0 && (
              <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                {kpis.toDeclare} à déclarer
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
                title={`Encaissés: ${kpis.received}`}
              />
            )}
            {kpis.rejected > 0 && (
              <div
                className="rmb-progress-seg rejected"
                style={{ width: `${Math.round((kpis.rejected / kpis.total) * 100)}%` }}
                title={`Refusés: ${kpis.rejected}`}
              />
            )}
          </div>
          <div className="rmb-progress-legend">
            <span style={{ color: "var(--green)" }}>■ Encaissé ({kpis.received})</span>
            <span style={{ color: "var(--gold)" }}>■ En attente ({kpis.pending})</span>
            <span style={{ color: "var(--coral)" }}>■ Refusé ({kpis.rejected})</span>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="rmb-filter-bar">
        {/* Status tabs */}
        <div className="rmb-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`rmb-tab${statusFilter === t.key ? " active" : ""}`}
              onClick={() => setStatusFilter(t.key)}
            >
              {t.label}
              {t.count > 0 && (
                <span className="rmb-tab-badge">{t.count}</span>
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
              placeholder="Chercher un patient…"
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
              ? "Aucun dossier à déclarer"
              : "Aucun remboursement trouvé"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {statusFilter === "all"
              ? "Ajoutez un statut AMO/CNOPS depuis la fiche d'un rendez-vous (onglet Suivi & AMO)."
              : "Changez le filtre pour voir d'autres dossiers."}
          </div>
        </div>
      ) : (
        <div className="rmb-table-wrap">
          <div className="rmb-table-count">{rows.length} dossier{rows.length !== 1 ? "s" : ""}</div>
          <div style={{ overflowX: "auto" }}>
            <table className="rmb-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date RDV</th>
                  <th>Type</th>
                  <th>Montant facturé</th>
                  <th>Montant AMO</th>
                  <th>Statut</th>
                  <th>Date encaissement</th>
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
                    <td colSpan={4} style={{ fontWeight: 700, paddingLeft: 14 }}>Total affiché</td>
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
            showToast("Statut mis à jour");
          }}
          onClose={() => setUpdateModal(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
