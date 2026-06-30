import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { StockPage } from "./StockPage";
import { FournisseursPage } from "./FournisseursPage";

type STab = "stocks" | "fournisseurs";

export function StocksSupplyPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<STab>("stocks");

  return (
    <Layout title={t("stocksSupply.title")} subtitle={t("stocksSupply.subtitle")}>
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "stocks" ? " active" : ""}`}
          onClick={() => setTab("stocks")}
        >
          {t("stocksSupply.tabStock")}
        </button>
        <button
          className={`tab-btn${tab === "fournisseurs" ? " active" : ""}`}
          onClick={() => setTab("fournisseurs")}
        >
          {t("stocksSupply.tabFournisseurs")}
        </button>
      </div>

      {tab === "stocks"       && <StockPage        noLayout />}
      {tab === "fournisseurs" && <FournisseursPage  noLayout />}
    </Layout>
  );
}
