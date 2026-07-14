import { useState } from "react";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
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
      <div className="tab-bar" role="tablist" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "messages" ? " active" : ""}`} {...tabProps(tab === "messages")}
          onClick={() => setTab("messages")}
        >
          {t("communication.tabMessages")}
        </button>
        <button
          className={`tab-btn${tab === "teleconsult" ? " active" : ""}`} {...tabProps(tab === "teleconsult")}
          onClick={() => setTab("teleconsult")}
        >
          {t("communication.tabTeleconsult")}
        </button>
        <button
          className={`tab-btn${tab === "rappels" ? " active" : ""}`} {...tabProps(tab === "rappels")}
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
