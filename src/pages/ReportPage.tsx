import { useMemo } from "react";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD } from "../lib/format";
import { getMonthlyData, getCategoryBreakdown } from "../lib/chartHelpers";

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTH_LABELS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ReportPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const {
    transactions, result, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX,
  } = useApp();
  const { doctorProfile } = useCabinet();

  const yearTx = useMemo(
    () => transactions.filter(tx => new Date(tx.date).getFullYear() === fiscalYear),
    [transactions, fiscalYear],
  );

  const monthly    = useMemo(() => getMonthlyData(yearTx, fiscalYear), [yearTx, fiscalYear]);
  const categories = useMemo(() => getCategoryBreakdown(yearTx), [yearTx]);

  const rawTotals = useMemo(() => {
    const rec = yearTx.filter(t => t.type === "RECETTE").reduce((s, t) => s + t.amount, 0);
    const chg = yearTx.filter(t => t.type === "CHARGE").reduce((s, t) => s + t.amount, 0);
    return { rec, chg, net: rec - chg };
  }, [yearTx]);

  const irNet = Math.max(0, result.tax.ir.grossIR - result.tax.familyDeduction);

  const yearOptions = Array.from(
    { length: FISCAL_MAX - FISCAL_MIN + 1 },
    (_, i) => FISCAL_MIN + i,
  ).reverse();

  const handleExportCSV = () => {
    const deducLabel = (tx: typeof yearTx[0]) => {
      if (tx.deductibilityStatus === "FULLY_DEDUCTIBLE")   return "Entièrement déductible";
      if (tx.deductibilityStatus === "PARTIALLY_DEDUCTIBLE") return "Partiellement déductible";
      if (tx.deductibilityStatus === "NOT_DEDUCTIBLE")       return "Non déductible";
      return "";
    };
    const rows: string[][] = [
      ["Date","Type","Catégorie","Description","Montant MAD","Déductibilité","Usage pro %"],
      ...yearTx
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(tx => [
          tx.date,
          tx.type === "RECETTE" ? "Recette" : "Charge",
          tx.category ?? "",
          (tx.description ?? (tx as { notes?: string }).notes ?? ""),
          tx.amount.toString(),
          deducLabel(tx),
          tx.deductibilityStatus === "PARTIALLY_DEDUCTIBLE"
            ? Math.round((tx.professionalUseRatio ?? 1) * 100) + "%"
            : "",
        ]),
    ];
    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadCSV(csv, `blackpine-${fiscalYear}.csv`);
  };

  const reportActions = (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        className="form-select"
        value={fiscalYear}
        onChange={e => setFiscalYear(Number(e.target.value))}
        style={{ width: 90 }}
      >
        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <button className="btn btn-ghost" onClick={handleExportCSV} title="Exporter les transactions en CSV">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Exporter CSV
      </button>
      <button className="btn btn-primary" onClick={() => window.print()}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        Imprimer / PDF
      </button>
    </div>
  );

  const inlineReportActions = (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn btn-ghost" onClick={handleExportCSV}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <path d="M7 2v8M4 7l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Exporter CSV
      </button>
      <button className="btn btn-primary" onClick={() => window.print()}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        Imprimer / PDF
      </button>
    </div>
  );

  const body = (
    <>
      {noLayout && <div className="inline-actions">{inlineReportActions}</div>}
      {/* ── Print-only letterhead ── */}
      <div className="rpt-letterhead">
        <div className="rpt-letterhead-name">{doctorProfile.fullName || "Médecin"}</div>
        {doctorProfile.specialtyLabel && <div className="rpt-letterhead-sub">{doctorProfile.specialtyLabel}</div>}
        <div className="rpt-letterhead-meta">
          {doctorProfile.address && <span>{doctorProfile.address}</span>}
          {doctorProfile.inpe    && <span>INPE : {doctorProfile.inpe}</span>}
        </div>
        <div className="rpt-letterhead-title">Compte de résultat — {fiscalYear}</div>
        <div className="rpt-letterhead-date">
          Généré le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* ── 4-KPI row ── */}
      <div className="rpt-kpi-grid">
        <div className="rpt-kpi">
          <div className="rpt-kpi-lbl">Recettes brutes</div>
          <div className="rpt-kpi-val rpt-green">{formatMAD(rawTotals.rec)}</div>
          <div className="rpt-kpi-sub">{yearTx.filter(t => t.type === "RECETTE").length} transactions</div>
        </div>
        <div className="rpt-kpi">
          <div className="rpt-kpi-lbl">Charges totales</div>
          <div className="rpt-kpi-val rpt-coral">{formatMAD(rawTotals.chg)}</div>
          <div className="rpt-kpi-sub">{yearTx.filter(t => t.type === "CHARGE").length} transactions</div>
        </div>
        <div className="rpt-kpi rpt-kpi-net">
          <div className="rpt-kpi-lbl">Résultat net</div>
          <div
            className="rpt-kpi-val"
            style={{ color: rawTotals.net >= 0 ? "var(--green)" : "var(--coral)" }}
          >
            {rawTotals.net >= 0 ? "+" : ""}{formatMAD(rawTotals.net)}
          </div>
          <div className="rpt-kpi-sub">
            Taux charges :{" "}
            {rawTotals.rec > 0 ? ((rawTotals.chg / rawTotals.rec) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="rpt-kpi rpt-kpi-tax">
          <div className="rpt-kpi-lbl">Impôt estimé</div>
          <div className="rpt-kpi-val rpt-navy">{formatMAD(result.tax.taxDue)}</div>
          <div className="rpt-kpi-sub">{result.tax.regime}</div>
        </div>
      </div>

      {/* ── Fiscal breakdown banner ── */}
      <div className="rpt-fiscal">
        <div className="rpt-fiscal-title">Récapitulatif fiscal {fiscalYear}</div>
        <div className="rpt-fiscal-rows">
          <div className="rpt-fiscal-row">
            <span>Recettes déclarables</span>
            <span className="rpt-green">{formatMAD(result.breakdown.totalRecettes)}</span>
          </div>
          <div className="rpt-fiscal-row">
            <span>Charges déductibles</span>
            <span className="rpt-coral">− {formatMAD(result.breakdown.totalChargesDeductibles)}</span>
          </div>
          {result.breakdown.totalReintegrations > 0 && (
            <div className="rpt-fiscal-row">
              <span>Réintégrations fiscales</span>
              <span style={{ color: "var(--gold)" }}>+ {formatMAD(result.breakdown.totalReintegrations)}</span>
            </div>
          )}
          <div className="rpt-fiscal-row rpt-fiscal-subtotal">
            <span>Résultat fiscal</span>
            <strong>{formatMAD(result.breakdown.resultatFiscal)}</strong>
          </div>
          <div className="rpt-fiscal-row">
            <span>IR brut</span>
            <span>{formatMAD(result.tax.ir.grossIR)}</span>
          </div>
          {result.tax.familyDeduction > 0 && (
            <div className="rpt-fiscal-row">
              <span>Déduction familiale</span>
              <span className="rpt-blue">− {formatMAD(result.tax.familyDeduction)}</span>
            </div>
          )}
          <div className="rpt-fiscal-row">
            <span>IR net</span>
            <span>{formatMAD(irNet)}</span>
          </div>
          <div className="rpt-fiscal-row">
            <span>Cotisation minimale (CM)</span>
            <span>{formatMAD(result.tax.cm.cmDue)}</span>
          </div>
          <div className="rpt-fiscal-row rpt-fiscal-total">
            <span>Impôt payable ({result.tax.payableRule})</span>
            <strong className="rpt-navy" style={{ fontSize: 16 }}>{formatMAD(result.tax.taxDue)}</strong>
          </div>
        </div>
      </div>

      {/* ── Two-column: monthly table + category breakdown ── */}
      <div className="rpt-2col">

        {/* Monthly table */}
        <div className="rpt-section">
          <div className="rpt-section-title">Évolution mensuelle</div>
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th>Recettes</th>
                  <th>Charges</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => {
                  const active = m.recettes > 0 || m.charges > 0;
                  return (
                    <tr key={i} className={active ? "" : "rpt-row-inactive"}>
                      <td>{MONTH_LABELS_FR[m.month - 1]}</td>
                      <td className="ta-r rpt-green">{active ? formatMAD(m.recettes, { showCurrency: false }) : "—"}</td>
                      <td className="ta-r rpt-coral">{active ? formatMAD(m.charges,  { showCurrency: false }) : "—"}</td>
                      <td className={`ta-r ${m.net >= 0 ? "rpt-green" : "rpt-coral"}`}>
                        {active
                          ? (m.net >= 0 ? "+" : "") + formatMAD(m.net, { showCurrency: false })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="rpt-tfoot">
                  <td>Total</td>
                  <td className="ta-r rpt-green">{formatMAD(rawTotals.rec, { showCurrency: false })}</td>
                  <td className="ta-r rpt-coral">{formatMAD(rawTotals.chg, { showCurrency: false })}</td>
                  <td className={`ta-r ${rawTotals.net >= 0 ? "rpt-green" : "rpt-coral"}`}>
                    {rawTotals.net >= 0 ? "+" : ""}{formatMAD(rawTotals.net, { showCurrency: false })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Charge categories */}
        <div className="rpt-section">
          <div className="rpt-section-title">Répartition des charges</div>
          {categories.length === 0 ? (
            <div className="rpt-empty">Aucune charge enregistrée pour {fiscalYear}</div>
          ) : (
            <div className="rpt-cat-list">
              {categories.map(cat => (
                <div key={cat.id} className="rpt-cat-row">
                  <div className="rpt-cat-dot" style={{ background: cat.color }} />
                  <div className="rpt-cat-label" title={cat.label}>{cat.label}</div>
                  <div className="rpt-cat-bar-wrap">
                    <div
                      className="rpt-cat-bar"
                      style={{ width: `${cat.percentage}%`, background: cat.color + "CC" }}
                    />
                  </div>
                  <div className="rpt-cat-pct">{cat.percentage}%</div>
                  <div className="rpt-cat-amt">{formatMAD(cat.amount, { showCurrency: false })}</div>
                </div>
              ))}
              <div className="rpt-cat-total">
                <span>Total charges</span>
                <strong>{formatMAD(rawTotals.chg)}</strong>
              </div>
            </div>
          )}

          {/* Quarterly mini-summary */}
          <div className="rpt-section-title" style={{ marginTop: 24 }}>Résumé trimestriel</div>
          <div className="rpt-quarters">
            {[0, 1, 2, 3].map(q => {
              const qMonths = monthly.slice(q * 3, q * 3 + 3);
              const qRec = qMonths.reduce((s, m) => s + m.recettes, 0);
              const qChg = qMonths.reduce((s, m) => s + m.charges, 0);
              const qNet = qRec - qChg;
              return (
                <div key={q} className="rpt-quarter">
                  <div className="rpt-quarter-label">T{q + 1}</div>
                  <div className="rpt-quarter-rec rpt-green">{formatMAD(qRec, { showCurrency: false })}</div>
                  <div className="rpt-quarter-chg rpt-coral">− {formatMAD(qChg, { showCurrency: false })}</div>
                  <div
                    className="rpt-quarter-net"
                    style={{ color: qNet >= 0 ? "var(--green)" : "var(--coral)", fontWeight: 700 }}
                  >
                    {qNet >= 0 ? "+" : ""}{formatMAD(qNet, { showCurrency: false })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {yearTx.length === 0 && (
        <div className="rpt-no-data">
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucune transaction pour {fiscalYear}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Ajoutez des recettes et charges dans la section Transactions pour générer votre rapport.
          </div>
        </div>
      )}
    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title="Rapport financier"
      subtitle={`Compte de résultat · ${fiscalYear}`}
      actions={reportActions}
    >
      {body}
    </Layout>
  );
}
