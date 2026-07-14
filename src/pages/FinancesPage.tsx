import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { MonthlyChart } from "../components/MonthlyChart";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { getMonthlyData, getActiveMonths, getCategoryBreakdown } from "../lib/chartHelpers";
import { computePayroll } from "../lib/payrollCalc";
import { formatMAD } from "../lib/format";
import { Link } from "react-router-dom";

// Doctor-only "Finances" — the practice seen as a business: income, costs, net
// margin, monthly trend, year-end projection and cost drivers. Composes the
// existing fiscal ledger (useApp.result) with live payroll + stock commitments.
export function FinancesPage() {
  const { t } = useTranslation();
  const { result, transactions, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX } = useApp();
  const { employees, purchaseOrders } = useCabinet();

  const yearTx   = useMemo(() => transactions.filter(tx => tx.date.startsWith(String(fiscalYear))), [transactions, fiscalYear]);
  const monthly  = useMemo(() => getMonthlyData(yearTx, fiscalYear), [yearTx, fiscalYear]);
  const active   = getActiveMonths(monthly);
  const costCats = useMemo(() => getCategoryBreakdown(yearTx, 7), [yearTx]);

  const income = result.breakdown.totalRecettes;
  const costs  = result.breakdown.totalCharges;
  const net    = result.breakdown.resultatComptable;
  const tax    = result.tax.taxDue;
  const margin = income > 0 ? (net / income) * 100 : 0;

  // Projection — run-rate to year end from the months that actually had activity.
  const ytdNet         = active.reduce((s, m) => s + m.net, 0);
  const monthsElapsed  = Math.max(1, active.length);
  const monthlyRunRate = Math.round(ytdNet / monthsElapsed);
  const projectedNet   = Math.round(ytdNet * (12 / monthsElapsed));

  // Cost drivers (informational — NOT re-added to the ledger total, to avoid double count).
  const staffMonthly = employees.reduce((s, e) => {
    const p = computePayroll(e.baseSalary, e.dependents ?? 0, e.contractType ?? "cdi");
    return s + p.grossSalary + p.cnssEmployer;
  }, 0);
  const stockCommit = purchaseOrders
    .filter(o => o.status !== "cancelled" && (o.orderedAt ?? "").startsWith(String(fiscalYear)))
    .reduce((s, o) => s + (o.lines ?? []).reduce((ls, l) => ls + (l.unitPrice ?? 0) * l.quantity, 0), 0);

  const maxCat = Math.max(...costCats.map(c => c.amount), 1);

  return (
    <Layout title={t("finances.title")} subtitle={t("finances.subtitle", { year: fiscalYear })}>
      <div className="fin-page">
        <div className="fin-toolbar">
          <select className="form-select fin-year" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}>
            {Array.from({ length: FISCAL_MAX - FISCAL_MIN + 1 }, (_, i) => FISCAL_MAX - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="fin-toolbar-note">{t("finances.ledgerNote")}</span>
        </div>

        {/* ── P&L KPIs ── */}
        <div className="fin-kpis">
          <div className="fin-kpi fin-kpi-income">
            <div className="fin-kpi-lbl">{t("finances.income")}</div>
            <div className="fin-kpi-val"><AnimatedNumber value={income} format={formatMAD} /></div>
          </div>
          <div className="fin-kpi fin-kpi-cost">
            <div className="fin-kpi-lbl">{t("finances.costs")}</div>
            <div className="fin-kpi-val"><AnimatedNumber value={costs} format={formatMAD} /></div>
          </div>
          <div className="fin-kpi fin-kpi-net">
            <div className="fin-kpi-lbl">{t("finances.net")}</div>
            <div className="fin-kpi-val" style={{ color: net >= 0 ? "var(--green)" : "var(--coral)" }}>
              <AnimatedNumber value={net} format={formatMAD} />
            </div>
            <div className="fin-kpi-sub">{t("finances.margin", { pct: margin.toFixed(0) })}</div>
          </div>
          <div className="fin-kpi fin-kpi-tax">
            <div className="fin-kpi-lbl">{t("finances.tax")}</div>
            <div className="fin-kpi-val"><AnimatedNumber value={tax} format={formatMAD} /></div>
          </div>
        </div>

        {/* ── Projection ── */}
        <div className="fin-card fin-projection">
          <div className="fin-card-title">{t("finances.projectionTitle")}</div>
          <div className="fin-proj-grid">
            <div>
              <div className="fin-proj-val" style={{ color: projectedNet >= 0 ? "var(--green)" : "var(--coral)" }}>{formatMAD(projectedNet)}</div>
              <div className="fin-proj-lbl">{t("finances.projectedNet")}</div>
            </div>
            <div>
              <div className="fin-proj-val">{formatMAD(monthlyRunRate)}</div>
              <div className="fin-proj-lbl">{t("finances.runRate")}</div>
            </div>
            <div>
              <div className="fin-proj-val">{monthsElapsed}/12</div>
              <div className="fin-proj-lbl">{t("finances.monthsActive")}</div>
            </div>
          </div>
          <div className="fin-proj-note">{t("finances.projectionNote")}</div>
        </div>

        {/* ── Monthly trend ── */}
        <div className="fin-card">
          <div className="fin-card-title">{t("finances.monthlyTitle")}</div>
          <MonthlyChart data={monthly} fiscalYear={fiscalYear} />
        </div>

        {/* ── Costs by category ── */}
        <div className="fin-card">
          <div className="fin-card-title">{t("finances.costsByCat")}</div>
          {costCats.length === 0 ? (
            <div className="fin-empty">{t("finances.noCosts")}</div>
          ) : (
            <div className="fin-cats">
              {costCats.map(c => (
                <div key={c.id} className="fin-cat-row">
                  <span className="fin-cat-lbl">{c.label}</span>
                  <div className="fin-cat-bar-track"><div className="fin-cat-bar" style={{ width: `${(c.amount / maxCat) * 100}%`, background: c.color }} /></div>
                  <span className="fin-cat-amt">{formatMAD(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Cost drivers (engagements, not in the ledger total) ── */}
        <div className="fin-card">
          <div className="fin-card-title">{t("finances.driversTitle")}</div>
          <div className="fin-drivers">
            <Link to="/salaires" className="fin-driver">
              <span className="fin-driver-lbl">{t("finances.staffMonthly")}</span>
              <span className="fin-driver-val">{formatMAD(staffMonthly)}<span className="fin-driver-sub"> · {formatMAD(staffMonthly * 12)}/{t("finances.perYear")}</span></span>
            </Link>
            <Link to="/stocks" className="fin-driver">
              <span className="fin-driver-lbl">{t("finances.stockCommit")}</span>
              <span className="fin-driver-val">{formatMAD(stockCommit)}</span>
            </Link>
          </div>
          <div className="fin-proj-note">{t("finances.driversNote")}</div>
        </div>
      </div>
    </Layout>
  );
}
