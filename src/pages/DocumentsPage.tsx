import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { OrdonancesPage } from "./OrdonancesPage";
import { CertificatsPage } from "./CertificatsPage";

type DTab = "ordonnances" | "certificats";

export function DocumentsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DTab>("ordonnances");

  return (
    <Layout title={t("documents.title")} subtitle={t("documents.subtitle")}>
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "ordonnances" ? " active" : ""}`}
          onClick={() => setTab("ordonnances")}
        >
          {t("documents.tabOrd")}
        </button>
        <button
          className={`tab-btn${tab === "certificats" ? " active" : ""}`}
          onClick={() => setTab("certificats")}
        >
          {t("documents.tabCert")}
        </button>
      </div>

      {tab === "ordonnances" && <OrdonancesPage noLayout />}
      {tab === "certificats" && <CertificatsPage noLayout />}
    </Layout>
  );
}
