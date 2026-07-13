import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD } from "../lib/format";
import { getMonthlyData, getCategoryBreakdown } from "../lib/chartHelpers";
import { printFiscalReport } from "../lib/fiscalReportPrinter";

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ReportPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const {
    transactions, result, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX,
  } = useApp();
  const { doctorProfile } = useCabinet();

  const monthNames = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })
    ), [locale]);

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

  const deducLabel = (tx: typeof yearTx[0]) => {
    if (tx.deductibilityStatus === "FULLY_DEDUCTIBLE")     return t("report.deductFully");
    if (tx.deductibilityStatus === "PARTIALLY_DEDUCTIBLE") return t("report.deductPartial");
    if (tx.deductibilityStatus === "NOT_DEDUCTIBLE")       return t("report.deductNo");
    return "";
  };

  // Printed documents are always in French, regardless of the UI language, so
  // build a standalone French document instead of window.print()-ing the live,
  // localized DOM.
  const handlePrint = () => {
    printFiscalReport({
      doctorProfile,
      fiscalYear,
      totals: rawTotals,
      breakdown: {
        totalRecettes: result.breakdown.totalRecettes,
        totalChargesDeductibles: result.breakdown.totalChargesDeductibles,
        totalReintegrations: result.breakdown.totalReintegrations,
        resultatFiscal: result.breakdown.resultatFiscal,
      },
      tax: {
        grossIR: result.tax.ir.grossIR,
        familyDeduction: result.tax.familyDeduction,
        irNet,
        cmDue: result.tax.cm.cmDue,
        taxDue: result.tax.taxDue,
        regime: String(result.tax.regime),
        payableRule: String(result.tax.payableRule),
      },
      monthly,
      categories,
    });
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ["Date", t("report.colRec"), "Catégorie", "Description", "Montant MAD", "Déductibilité", "Usage pro %"],
      ...yearTx
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(tx => [
          tx.date,
          tx.type === "RECETTE" ? t("report.colRec") : t("report.colChg"),
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
      <button className="btn btn-ghost" onClick={handleExportCSV} title={t("report.exportCsvTitle")}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t("report.exportCsvBtn")}
      </button>
      <button className="btn btn-primary" onClick={handlePrint}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {t("report.printBtn")}
      </button>
    </div>
  );

  const inlineReportActions = (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn btn-ghost" onClick={handleExportCSV}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <path d="M7 2v8M4 7l3 3 3-3M2 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t("report.exportCsvBtn")}
      </button>
      <button className="btn btn-primary" onClick={handlePrint}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
          <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {t("report.printBtn")}
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
        <div className="rpt-letterhead-title">{t("report.letterheadTitle", { year: fiscalYear })}</div>
        <div className="rpt-letterhead-date">
          {t("report.letterheadDate", {
            date: new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
          })}
        </div>
      </div>

      {/* ── 4-KPI row ── */}
      <div className="rpt-kpi-grid">
        <div className="rpt-kpi">
          <div className="rpt-kpi-lbl">{t("report.kpiGrossRec")}</div>
          <div className="rpt-kpi-val rpt-green">{formatMAD(rawTotals.rec)}</div>
          <div className="rpt-kpi-sub">{t("report.kpiTxCount", { n: yearTx.filter(tx => tx.type === "RECETTE").length })}</div>
        </div>
        <div className="rpt-kpi">
          <div className="rpt-kpi-lbl">{t("report.kpiTotalChg")}</div>
          <div className="rpt-kpi-val rpt-coral">{formatMAD(rawTotals.chg)}</div>
          <div className="rpt-kpi-sub">{t("report.kpiTxCount", { n: yearTx.filter(tx => tx.type === "CHARGE").length })}</div>
        </div>
        <div className="rpt-kpi rpt-kpi-net">
          <div className="rpt-kpi-lbl">{t("report.kpiNet")}</div>
          <div
            className="rpt-kpi-val"
            style={{ color: rawTotals.net >= 0 ? "var(--green)" : "var(--coral)" }}
          >
            {rawTotals.net >= 0 ? "+" : ""}{formatMAD(rawTotals.net)}
          </div>
          <div className="rpt-kpi-sub">
            {t("report.kpiTxRate")}{" "}
            {rawTotals.rec > 0 ? ((rawTotals.chg / rawTotals.rec) * 100).toFixed(1) : 0}%
          </div>
        </div>
        <div className="rpt-kpi rpt-kpi-tax">
          <div className="rpt-kpi-lbl">{t("report.kpiTax")}</div>
          <div className="rpt-kpi-val rpt-navy">{formatMAD(result.tax.taxDue)}</div>
          <div className="rpt-kpi-sub">{result.tax.regime}</div>
        </div>
      </div>

      {/* ── Fiscal breakdown banner ── */}
      <div className="rpt-fiscal">
        <div className="rpt-fiscal-title">{t("report.fiscalTitle", { year: fiscalYear })}</div>
        <div className="rpt-fiscal-rows">
          <div className="rpt-fiscal-row">
            <span>{t("report.rowDeclarRec")}</span>
            <span className="rpt-green">{formatMAD(result.breakdown.totalRecettes)}</span>
          </div>
          <div className="rpt-fiscal-row">
            <span>{t("report.rowDeducChg")}</span>
            <span className="rpt-coral">− {formatMAD(result.breakdown.totalChargesDeductibles)}</span>
          </div>
          {result.breakdown.totalReintegrations > 0 && (
            <div className="rpt-fiscal-row">
              <span>{t("report.rowReintegrations")}</span>
              <span style={{ color: "var(--gold)" }}>+ {formatMAD(result.breakdown.totalReintegrations)}</span>
            </div>
          )}
          <div className="rpt-fiscal-row rpt-fiscal-subtotal">
            <span>{t("report.rowFiscal")}</span>
            <strong>{formatMAD(result.breakdown.resultatFiscal)}</strong>
          </div>
          <div className="rpt-fiscal-row">
            <span>{t("report.rowIrBrut")}</span>
            <span>{formatMAD(result.tax.ir.grossIR)}</span>
          </div>
          {result.tax.familyDeduction > 0 && (
            <div className="rpt-fiscal-row">
              <span>{t("report.rowFamilial")}</span>
              <span className="rpt-blue">− {formatMAD(result.tax.familyDeduction)}</span>
            </div>
          )}
          <div className="rpt-fiscal-row">
            <span>{t("report.rowIrNet")}</span>
            <span>{formatMAD(irNet)}</span>
          </div>
          <div className="rpt-fiscal-row">
            <span>{t("report.rowCM")}</span>
            <span>{formatMAD(result.tax.cm.cmDue)}</span>
          </div>
          <div className="rpt-fiscal-row rpt-fiscal-total">
            <span>{t("report.rowTaxDue", { rule: result.tax.payableRule })}</span>
            <strong className="rpt-navy" style={{ fontSize: 16 }}>{formatMAD(result.tax.taxDue)}</strong>
          </div>
        </div>
      </div>

      {/* ── Two-column: monthly table + category breakdown ── */}
      <div className="rpt-2col">

        {/* Monthly table */}
        <div className="rpt-section">
          <div className="rpt-section-title">{t("report.monthlyTitle")}</div>
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>{t("report.colMonth")}</th>
                  <th>{t("report.colRec")}</th>
                  <th>{t("report.colChg")}</th>
                  <th>{t("report.colNet")}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => {
                  const active = m.recettes > 0 || m.charges > 0;
                  return (
                    <tr key={i} className={active ? "" : "rpt-row-inactive"}>
                      <td>{monthNames[m.month - 1]}</td>
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
                  <td>{t("report.colTotal")}</td>
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
          <div className="rpt-section-title">{t("report.catsTitle")}</div>
          {categories.length === 0 ? (
            <div className="rpt-empty">{t("report.catsEmpty", { year: fiscalYear })}</div>
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
                <span>{t("report.catsTotal")}</span>
                <strong>{formatMAD(rawTotals.chg)}</strong>
              </div>
            </div>
          )}

          {/* Quarterly mini-summary */}
          <div className="rpt-section-title" style={{ marginTop: 24 }}>{t("report.quartersTitle")}</div>
          <div className="rpt-quarters">
            {[0, 1, 2, 3].map(q => {
              const qMonths = monthly.slice(q * 3, q * 3 + 3);
              const qRec = qMonths.reduce((s, m) => s + m.recettes, 0);
              const qChg = qMonths.reduce((s, m) => s + m.charges, 0);
              const qNet = qRec - qChg;
              return (
                <div key={q} className="rpt-quarter">
                  <div className="rpt-quarter-label">{t("report.quarter", { n: q + 1 })}</div>
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
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("report.emptyTitle", { year: fiscalYear })}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("report.emptyHint")}</div>
        </div>
      )}
    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title={t("report.title")}
      subtitle={t("report.subtitle", { year: fiscalYear })}
      actions={reportActions}
    >
      {body}
    </Layout>
  );
}
