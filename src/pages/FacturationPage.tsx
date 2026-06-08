import { useState } from "react";
import { Layout } from "../components/Layout";
import { FacturesPage } from "./FacturesPage";
import { RemboursementsPage } from "./RemboursementsPage";

type FTab = "factures" | "remboursements";

export function FacturationPage() {
  const [tab, setTab] = useState<FTab>("factures");

  return (
    <Layout title="Facturation" subtitle="Factures & remboursements AMO/CNOPS">
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "factures" ? " active" : ""}`}
          onClick={() => setTab("factures")}
        >
          Factures
        </button>
        <button
          className={`tab-btn${tab === "remboursements" ? " active" : ""}`}
          onClick={() => setTab("remboursements")}
        >
          Remboursements AMO/CNOPS
        </button>
      </div>

      {tab === "factures"        && <FacturesPage        noLayout />}
      {tab === "remboursements"  && <RemboursementsPage  noLayout />}
    </Layout>
  );
}
