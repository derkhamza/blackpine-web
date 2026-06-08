import { useState } from "react";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { ReportPage } from "./ReportPage";
import { ExplainPage } from "./ExplainPage";
import { OptimisationPage } from "./OptimisationPage";

type RTab = "rapport" | "calcul" | "optimisation";

const TABS: { id: RTab; label: string }[] = [
  { id: "rapport",       label: "Rapport financier" },
  { id: "calcul",        label: "Calcul fiscal" },
  { id: "optimisation",  label: "Optimisation" },
];

export function RapportsPage() {
  const [tab, setTab] = useState<RTab>("rapport");
  const { fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX } = useApp();

  const yearOptions = Array.from(
    { length: FISCAL_MAX - FISCAL_MIN + 1 },
    (_, i) => FISCAL_MIN + i,
  ).reverse();

  return (
    <Layout
      title="Rapports & Fiscalité"
      subtitle={`Exercice ${fiscalYear}`}
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
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rapport"      && <ReportPage      noLayout />}
      {tab === "calcul"       && <ExplainPage      noLayout />}
      {tab === "optimisation" && <OptimisationPage noLayout />}
    </Layout>
  );
}
