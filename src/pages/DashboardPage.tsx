import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { MonthlyChart } from "../components/MonthlyChart";
import { useApp } from "../context/AppContext";
import { formatMAD } from "../lib/format";
import { getActiveMonths, getMonthlyData } from "../lib/chartHelpers";

export function DashboardPage() {
  const {
    result, transactions, fiscalYear, setFiscalYear,
    FISCAL_MIN, FISCAL_MAX,
  } = useApp();
  const navigate = useNavigate();

  const yearTx       = transactions.filter((t) => t.date.startsWith(String(fiscalYear)));
  const monthlyData  = getActiveMonths(getMonthlyData(yearTx, fiscalYear));
  const netResult    = result.breakdown.totalRecettes - result.breakdown.totalCharges;
  const isNeg        = netResult < 0;

  // Year-over-year
  const prevYear   = fiscalYear - 1;
  const prevYearTx = transactions.filter((t) => t.date.startsWith(String(prevYear)));
  const prevRec    = prevYearTx.filter((t) => t.type === "RECETTE").reduce((s, t) => s + t.amount, 0);
  const prevChg    = prevYearTx.filter((t) => t.type === "CHARGE").reduce((s, t) => s + t.amount, 0);
  const hasPrev    = prevYearTx.length > 0;

  // Delta helper
  const pct = (curr: number, prev: number) =>
    prev === 0 ? null : Math.round(((curr - prev) / Math.abs(prev)) * 100);

  return (
    <Layout
      title="Tableau de bord"
      subtitle={String(fiscalYear)}
    >
      {/* ── Year picker ── */}
      <div className="year-picker">
        <button
          className="year-btn"
          disabled={fiscalYear <= FISCAL_MIN}
          onClick={() => setFiscalYear(fiscalYear - 1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <div className="year-label">{fiscalYear}</div>
          <div className="year-sub">Exercice fiscal</div>
        </div>
        <button
          className="year-btn"
          disabled={fiscalYear >= FISCAL_MAX}
          onClick={() => setFiscalYear(fiscalYear + 1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Hero result card ── */}
      <div className="hero-card" style={{ marginBottom: 20 }}>
        <div className="hero-card-header">
          <div className="hero-card-label">Résultat net</div>
          <div className="hero-card-regime">{result.tax.regime}</div>
        </div>
        <div className={`hero-amount${isNeg ? " negative" : ""}`}>
          {formatMAD(netResult)}
        </div>
        <div className="hero-sub">Recettes − Charges · {fiscalYear}</div>
        <div className="hero-metrics">
          <div className="hero-metric" onClick={() => navigate("/transactions?filter=RECETTE")}>
            <div className="hero-metric-label">Recettes</div>
            <div className="hero-metric-value" style={{ color: "#6DEDB5" }}>
              {formatMAD(result.breakdown.totalRecettes)}
            </div>
          </div>
          <div className="hero-metric" onClick={() => navigate("/transactions?filter=CHARGE")}>
            <div className="hero-metric-label">Charges</div>
            <div className="hero-metric-value" style={{ color: "#FF8087" }}>
              {formatMAD(result.breakdown.totalCharges)}
            </div>
          </div>
          <div className="hero-metric" onClick={() => navigate("/expliquer")}>
            <div className="hero-metric-label">IR estimé</div>
            <div className="hero-metric-value" style={{ color: "#fff" }}>
              {formatMAD(result.tax.taxDue)}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI grid ── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeftColor: "var(--green)" }}>
          <div className="stat-label">Total recettes</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>
            {formatMAD(result.breakdown.totalRecettes)}
          </div>
          {hasPrev && pct(result.breakdown.totalRecettes, prevRec) !== null && (
            <div className="stat-sub">
              {(pct(result.breakdown.totalRecettes, prevRec)! >= 0 ? "▲ " : "▼ ")}
              {Math.abs(pct(result.breakdown.totalRecettes, prevRec)!)}% vs {prevYear}
            </div>
          )}
        </div>
        <div className="stat-card" style={{ borderLeftColor: "var(--coral)" }}>
          <div className="stat-label">Total charges</div>
          <div className="stat-value" style={{ color: "var(--coral)" }}>
            {formatMAD(result.breakdown.totalCharges)}
          </div>
          {hasPrev && pct(result.breakdown.totalCharges, prevChg) !== null && (
            <div className="stat-sub">
              {(pct(result.breakdown.totalCharges, prevChg)! >= 0 ? "▲ " : "▼ ")}
              {Math.abs(pct(result.breakdown.totalCharges, prevChg)!)}% vs {prevYear}
            </div>
          )}
        </div>
        <div className="stat-card" style={{ borderLeftColor: "var(--gold)" }}>
          <div className="stat-label">IR / CM estimé</div>
          <div className="stat-value" style={{ color: "var(--gold)" }}>
            {formatMAD(result.tax.taxDue)}
          </div>
          <div className="stat-sub">{result.tax.payableRule}</div>
        </div>
      </div>

      {/* ── Monthly chart ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Activité mensuelle · {fiscalYear}</div>
        <MonthlyChart data={monthlyData} fiscalYear={fiscalYear} />
      </div>

      {/* ── Performance breakdown ── */}
      <div className="card" style={{ marginBottom: 20 }}>
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

      {/* ── Quick actions ── */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button className="btn btn-ghost" onClick={() => navigate("/transactions")}>
          Gérer les transactions
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/expliquer")}>
          Voir le détail fiscal
        </button>
      </div>
    </Layout>
  );
}
