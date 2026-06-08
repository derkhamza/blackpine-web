import { useState } from "react";
import { Layout } from "../components/Layout";
import { OrdonancesPage } from "./OrdonancesPage";
import { CertificatsPage } from "./CertificatsPage";

type DTab = "ordonnances" | "certificats";

export function DocumentsPage() {
  const [tab, setTab] = useState<DTab>("ordonnances");

  return (
    <Layout title="Documents médicaux" subtitle="Ordonnances & Certificats">
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "ordonnances" ? " active" : ""}`}
          onClick={() => setTab("ordonnances")}
        >
          Ordonnances
        </button>
        <button
          className={`tab-btn${tab === "certificats" ? " active" : ""}`}
          onClick={() => setTab("certificats")}
        >
          Certificats
        </button>
      </div>

      {tab === "ordonnances" && <OrdonancesPage noLayout />}
      {tab === "certificats" && <CertificatsPage noLayout />}
    </Layout>
  );
}
