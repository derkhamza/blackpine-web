import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { MessagesPage } from "./MessagesPage";
import { TeleconsultPage } from "./TeleconsultPage";
import { RappelsPage } from "./RappelsPage";

type CTab = "messages" | "teleconsult" | "rappels";

export function CommunicationPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CTab>("messages");

  return (
    <Layout title={t("communication.title")} subtitle={t("communication.subtitle")}>
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "messages" ? " active" : ""}`}
          onClick={() => setTab("messages")}
        >
          {t("communication.tabMessages")}
        </button>
        <button
          className={`tab-btn${tab === "teleconsult" ? " active" : ""}`}
          onClick={() => setTab("teleconsult")}
        >
          {t("communication.tabTeleconsult")}
        </button>
        <button
          className={`tab-btn${tab === "rappels" ? " active" : ""}`}
          onClick={() => setTab("rappels")}
        >
          {t("communication.tabRappels")}
        </button>
      </div>

      {tab === "messages"    && <MessagesPage    noLayout />}
      {tab === "teleconsult" && <TeleconsultPage noLayout />}
      {tab === "rappels"     && <RappelsPage     noLayout />}
    </Layout>
  );
}
