import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
        <button
          className={`tab-btn${tab === "examens" ? " active" : ""}`}
          onClick={() => setTab("examens")}
        >
          {t("documents.tabExam")}
        </button>
        <button
          className={`tab-btn${tab === "comptesRendus" ? " active" : ""}`}
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
