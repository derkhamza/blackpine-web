import { useState } from "react";
import { Layout } from "../components/Layout";
import { MessagesPage } from "./MessagesPage";
import { TeleconsultPage } from "./TeleconsultPage";

type CTab = "messages" | "teleconsult";

export function CommunicationPage() {
  const [tab, setTab] = useState<CTab>("messages");

  return (
    <Layout title="Communication" subtitle="Messages WhatsApp & Téléconsultations">
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${tab === "messages" ? " active" : ""}`}
          onClick={() => setTab("messages")}
        >
          Messages WhatsApp
        </button>
        <button
          className={`tab-btn${tab === "teleconsult" ? " active" : ""}`}
          onClick={() => setTab("teleconsult")}
        >
          Téléconsultation
        </button>
      </div>

      {tab === "messages"    && <MessagesPage    noLayout />}
      {tab === "teleconsult" && <TeleconsultPage noLayout />}
    </Layout>
  );
}
