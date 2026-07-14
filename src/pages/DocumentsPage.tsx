import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
import { Layout } from "../components/Layout";
import { OrdonancesPage } from "./OrdonancesPage";
import { CertificatsPage } from "./CertificatsPage";
import { ExamRequestsPage } from "./ExamRequestsPage";
import { MedicalReportsPage } from "./MedicalReportsPage";

type DTab = "ordonnances" | "certificats" | "examens" | "comptesRendus";

export function DocumentsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const initial = (params.get("tab") as DTab) || "ordonnances";
  const [tab, setTab] = useState<DTab>(
    ["ordonnances", "certificats", "examens", "comptesRendus"].includes(initial) ? initial : "ordonnances",
  );

  return (
    <Layout title={t("documents.title")} subtitle={t("documents.subtitle")}>
      {/* ── Tab bar ── */}
      <div className="tab-bar" role="tablist" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "ordonnances" ? " active" : ""}`} {...tabProps(tab === "ordonnances")}
          onClick={() => setTab("ordonnances")}
        >
          {t("documents.tabOrd")}
        </button>
        <button
          className={`tab-btn${tab === "certificats" ? " active" : ""}`} {...tabProps(tab === "certificats")}
          onClick={() => setTab("certificats")}
        >
          {t("documents.tabCert")}
        </button>
        <button
          className={`tab-btn${tab === "examens" ? " active" : ""}`} {...tabProps(tab === "examens")}
          onClick={() => setTab("examens")}
        >
          {t("documents.tabExam")}
        </button>
        <button
          className={`tab-btn${tab === "comptesRendus" ? " active" : ""}`} {...tabProps(tab === "comptesRendus")}
          onClick={() => setTab("comptesRendus")}
        >
          {t("documents.tabReports")}
        </button>
      </div>

      {tab === "ordonnances"   && <OrdonancesPage noLayout />}
      {tab === "certificats"   && <CertificatsPage noLayout />}
      {tab === "examens"       && <ExamRequestsPage noLayout />}
      {tab === "comptesRendus" && <MedicalReportsPage noLayout />}
    </Layout>
  );
}
