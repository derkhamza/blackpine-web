import { useState } from "react";
import { useTranslation } from "react-i18next";
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
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "factures" ? " active" : ""}`}
          onClick={() => setTab("factures")}
        >
          {t("facturation.tabFactures")}
        </button>
        <button
          className={`tab-btn${tab === "remboursements" ? " active" : ""}`}
          onClick={() => setTab("remboursements")}
        >
          {t("facturation.tabRemb")}
        </button>
        <button
          className={`tab-btn${tab === "historique" ? " active" : ""}`}
          onClick={() => setTab("historique")}
        >
          {t("facturation.tabHistorique")}
        </button>
        <button
          className={`tab-btn${tab === "transactions" ? " active" : ""}`}
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
