import { useState } from "react";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
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
      <div className="tab-bar" role="tablist" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "stocks" ? " active" : ""}`} {...tabProps(tab === "stocks")}
          onClick={() => setTab("stocks")}
        >
          {t("stocksSupply.tabStock")}
        </button>
        <button
          className={`tab-btn${tab === "fournisseurs" ? " active" : ""}`} {...tabProps(tab === "fournisseurs")}
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
