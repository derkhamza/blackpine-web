import { useState } from "react";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
import { Layout } from "../components/Layout";
import { FacturesPage } from "./FacturesPage";
import { RemboursementsPage } from "./RemboursementsPage";
import { InvoiceHistorySection } from "./InvoiceHistorySection";
import { TransactionsPage } from "./TransactionsPage";

type FTab = "factures" | "remboursements" | "historique" | "transactions";

export function FacturationPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FTab>("factures");

  return (
    <Layout title={t("facturation.title")} subtitle={t("facturation.subtitle")}>
      {/* ── Tab bar ── */}
      <div className="tab-bar" role="tablist" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "factures" ? " active" : ""}`}
          {...tabProps(tab === "factures")}
          onClick={() => setTab("factures")}
        >
          {t("facturation.tabFactures")}
        </button>
        <button
          className={`tab-btn${tab === "remboursements" ? " active" : ""}`}
          {...tabProps(tab === "remboursements")}
          onClick={() => setTab("remboursements")}
        >
          {t("facturation.tabRemb")}
        </button>
        <button
          className={`tab-btn${tab === "historique" ? " active" : ""}`}
          {...tabProps(tab === "historique")}
          onClick={() => setTab("historique")}
        >
          {t("facturation.tabHistorique")}
        </button>
        <button
          className={`tab-btn${tab === "transactions" ? " active" : ""}`}
          {...tabProps(tab === "transactions")}
          onClick={() => setTab("transactions")}
        >
          {t("facturation.tabTransactions")}
        </button>
      </div>

      {tab === "factures"       && <FacturesPage       noLayout />}
      {tab === "remboursements" && <RemboursementsPage noLayout />}
      {tab === "historique"     && <InvoiceHistorySection />}
      {tab === "transactions"   && <TransactionsPage   noLayout />}
    </Layout>
  );
}
