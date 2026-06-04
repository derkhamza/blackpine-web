import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { MonthlyChart } from "../components/MonthlyChart";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD } from "../lib/format";
import { getActiveMonths, getMonthlyData, getCategoryBreakdown } from "../lib/chartHelpers";

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

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    result, transactions, fiscalYear, setFiscalYear,
    FISCAL_MIN, FISCAL_MAX,
  } = useApp();
  const { appointments, patients } = useCabinet();

  const yearTx      = useMemo(() => transactions.filter((t) => t.date.startsWith(String(fiscalYear))), [transactions, fiscalYear]);
  const monthlyData = useMemo(() => getActiveMonths(getMonthlyData(yearTx, fiscalYear)), [yearTx, fiscalYear]);
  const netResult   = result.breakdown.totalRecettes - result.breakdown.totalCharges;
  const isNeg       = netResult < 0;

  // Previous year
  const prevYear   = fiscalYear - 1;
  const prevYearTx = useMemo(() => transactions.filter((t) => t.date.startsWith(String(prevYear))), [transactions, prevYear]);
  const prevRec    = useMemo(() => prevYearTx.filter((t) => t.type === "RECETTE").reduce((s, t) => s + t.amount, 0), [prevYearTx]);
  const prevChg    = useMemo(() => prevYearTx.filter((t) => t.type === "CHARGE").reduce((s, t)  => s + t.amount, 0), [prevYearTx]);
  const hasPrev    = prevYearTx.length > 0;

  // Category breakdown
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
      const name = tx.description.replace(/^[^–]+ – /, ""); // strip "Consultation – " prefix
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 };
      map[name].revenue += tx.amount;
      map[name].count++;
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [yearTx]);

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
      </div>

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
          {/* Progress bar */}
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

      {/* ── Two-column layout ── */}
      <div className="dash-2col">

        {/* Left */}
        <div className="dash-col">

          {/* KPI cards */}
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

          {/* Monthly chart */}
          <div className="card">
            <div className="card-title">Activité mensuelle · {fiscalYear}</div>
            <MonthlyChart data={monthlyData} fiscalYear={fiscalYear} />
          </div>

          {/* Performance breakdown */}
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

          {/* Year-over-year */}
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

          {/* Category breakdown */}
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

          {/* Top patients by revenue */}
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

          {/* Actions */}
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
