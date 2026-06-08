import { useState } from "react";
import { Layout } from "../components/Layout";
import { StockPage } from "./StockPage";
import { FournisseursPage } from "./FournisseursPage";

type STab = "stocks" | "fournisseurs";

export function StocksSupplyPage() {
  const [tab, setTab] = useState<STab>("stocks");

  return (
    <Layout title="Stocks & Fournisseurs" subtitle="Inventaire & commandes">
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "stocks" ? " active" : ""}`}
          onClick={() => setTab("stocks")}
        >
          Stock
        </button>
        <button
          className={`tab-btn${tab === "fournisseurs" ? " active" : ""}`}
          onClick={() => setTab("fournisseurs")}
        >
          Fournisseurs & Commandes
        </button>
      </div>

      {tab === "stocks"       && <StockPage        noLayout />}
      {tab === "fournisseurs" && <FournisseursPage  noLayout />}
    </Layout>
  );
}
