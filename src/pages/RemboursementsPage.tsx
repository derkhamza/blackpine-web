import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Appointment } from "../lib/cabinetTypes";
import { APPT_TYPE_LABELS } from "../lib/cabinetTypes";
import { todayIso } from "../lib/format";

// ── AMO / CNOPS papers log ──────────────────────────────────────────────────
// In Moroccan private practice the doctor only fills the mutuelle form and hands
// it to the patient — there is no reimbursement follow-up on the doctor's side.
// So this is a simple checklist: for each mutuelle patient's visit, was the
// paper filled and given? No amounts, no declaration status, no rejection rates.

type PaperFilter = "all" | "to_fill" | "filled";

export function RemboursementsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const { appointments, patients, updateAppointment } = useCabinet();
  const { fiscalYear } = useApp();
  const showToast = useToast();

  const [filter,     setFilter]     = useState<PaperFilter>("all");
  const [yearFilter, setYearFilter] = useState(fiscalYear);
  const [search,     setSearch]     = useState("");

  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const fmtDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

  // Patient → mutuelle info lookup.
  const patMap = useMemo(() => {
    const m = new Map<string, { mutuelle?: string; cnopsNumber?: string }>();
    for (const p of patients) m.set(p.id, { mutuelle: p.mutuelle, cnopsNumber: p.cnopsNumber });
    return m;
  }, [patients]);

  // Visits where mutuelle paperwork is relevant: a completed/billed visit whose
  // linked patient carries a mutuelle name or a CNOPS/AMO number.
  const relevant = useMemo(() => {
    return appointments.filter(a => {
      if (!a.date.startsWith(String(yearFilter))) return false;
      if (!(a.billedAt || a.status === "completed")) return false;
      if (!a.patientId) return false;
      const info = patMap.get(a.patientId);
      return !!(info && (info.mutuelle || info.cnopsNumber));
    });
  }, [appointments, patMap, yearFilter]);

  const kpis = useMemo(() => {
    let filled = 0, toFill = 0;
    for (const a of relevant) { if (a.mutuellePapersFilled) filled++; else toFill++; }
    return { filled, toFill, total: relevant.length };
  }, [relevant]);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return relevant
      .filter(a => filter === "all" ? true : filter === "filled" ? !!a.mutuellePapersFilled : !a.mutuellePapersFilled)
      .filter(a => !q || a.patientName.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [relevant, filter, search]);

  const yearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => yearNow - 2 + i);

  const toggle = (a: Appointment) => {
    const now = !a.mutuellePapersFilled;
    updateAppointment({
      ...a,
      mutuellePapersFilled: now,
      mutuellePapersDate: now ? todayIso() : undefined,
    });
    showToast(now ? t("remboursements.toastFilled") : t("remboursements.toastUnfilled"));
  };

  const tabs: { key: PaperFilter; label: string; count: number }[] = [
    { key: "all",     label: t("remboursements.tabAll"),    count: kpis.total  },
    { key: "to_fill", label: t("remboursements.tabToFill"), count: kpis.toFill },
    { key: "filled",  label: t("remboursements.tabFilled"), count: kpis.filled },
  ];

  const body = (
    <>
      {/* ── KPI cards ── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">{t("remboursements.kpiToFill")}</div>
          <div className="stat-value" style={{ color: kpis.toFill > 0 ? "var(--gold)" : "var(--green)" }}>{kpis.toFill}</div>
          <div className="stat-sub">{t("remboursements.year", { year: yearFilter })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("remboursements.kpiFilled")}</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{kpis.filled}</div>
          <div className="stat-sub">
            {kpis.total > 0 ? t("remboursements.filledPct", { pct: Math.round((kpis.filled / kpis.total) * 100) }) : "—"}
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="rmb-filter-bar">
        <div className="rmb-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`rmb-tab${filter === tab.key ? " active" : ""}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.count > 0 && <span className="rmb-tab-badge">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="form-select"
            style={{ padding: "6px 10px", fontSize: 13, width: "auto" }}
            value={yearFilter}
            onChange={e => setYearFilter(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
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
          <div style={{ fontSize: 36, marginBottom: 10 }}>🗂️</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("remboursements.emptyPapers")}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("remboursements.emptyHintPapers")}</div>
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
                  <th>{t("remboursements.colMutuelle")}</th>
                  <th>{t("remboursements.colPaper")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(appt => {
                  const info = appt.patientId ? patMap.get(appt.patientId) : undefined;
                  const mutLabel = info?.mutuelle
                    ? info.mutuelle + (info.cnopsNumber ? ` · ${info.cnopsNumber}` : "")
                    : info?.cnopsNumber ? `CNOPS ${info.cnopsNumber}` : "—";
                  return (
                    <tr key={appt.id} className="rmb-row">
                      <td>
                        <Link to={`/agenda/${appt.id}`} className="rmb-appt-link">{appt.patientName}</Link>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(appt.date)}</td>
                      <td style={{ fontSize: 12 }}>{APPT_TYPE_LABELS[appt.type]}</td>
                      <td style={{ fontSize: 12 }}>{mutLabel}</td>
                      <td>
                        {appt.mutuellePapersFilled ? (
                          <span className="rmb-status-badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                            {t("remboursements.statusFilled")}
                            {appt.mutuellePapersDate ? ` · ${fmtDate(appt.mutuellePapersDate)}` : ""}
                          </span>
                        ) : (
                          <span className="rmb-status-badge" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                            {t("remboursements.statusToFill")}
                          </span>
                        )}
                      </td>
                      <td>
                        <button className="rmb-update-btn" onClick={() => toggle(appt)}>
                          {appt.mutuellePapersFilled ? t("remboursements.markUnfilled") : t("remboursements.markFilled")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );

  if (noLayout) return body;
  return (
    <Layout title={t("remboursements.title")} subtitle={t("remboursements.papersSubtitle")}>
      {body}
    </Layout>
  );
}
