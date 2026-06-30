import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { ReportPage } from "./ReportPage";
import { ExplainPage } from "./ExplainPage";
import { OptimisationPage } from "./OptimisationPage";
import { AnalytiquesPage } from "./AnalytiquesPage";

type RTab = "rapport" | "calcul" | "optimisation" | "analytiques";

export function RapportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<RTab>("rapport");
  const { fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX } = useApp();

  const yearOptions = Array.from(
    { length: FISCAL_MAX - FISCAL_MIN + 1 },
    (_, i) => FISCAL_MIN + i,
  ).reverse();

  return (
    <Layout
      title={t("rapports.title")}
      subtitle={t("rapports.subtitle", { year: fiscalYear })}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="form-select"
            value={fiscalYear}
            onChange={e => setFiscalYear(Number(e.target.value))}
            style={{ width: 90 }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      }
    >
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "rapport" ? " active" : ""}`}
          onClick={() => setTab("rapport")}
        >
          {t("rapports.tabRapport")}
        </button>
        <button
          className={`tab-btn${tab === "calcul" ? " active" : ""}`}
          onClick={() => setTab("calcul")}
        >
          {t("rapports.tabCalc")}
        </button>
        <button
          className={`tab-btn${tab === "optimisation" ? " active" : ""}`}
          onClick={() => setTab("optimisation")}
        >
          {t("rapports.tabOptimisation")}
        </button>
        <button
          className={`tab-btn${tab === "analytiques" ? " active" : ""}`}
          onClick={() => setTab("analytiques")}
        >
          {t("rapports.tabAnalytiques")}
        </button>
      </div>

      {tab === "rapport"      && <ReportPage      noLayout />}
      {tab === "calcul"       && <ExplainPage      noLayout />}
      {tab === "optimisation" && <OptimisationPage noLayout />}
      {tab === "analytiques"  && <AnalytiquesPage  noLayout />}
    </Layout>
  );
}
