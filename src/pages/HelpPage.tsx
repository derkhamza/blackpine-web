import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { openWelcomeTour } from "../components/WelcomeTour";
import { PRICING } from "../lib/pricing";

// In-app help centre: a searchable list of collapsible topics, a button to
// replay the first-time walkthrough, subscription pricing (so nobody is
// surprised) and a contact link. Content lives in i18n under `help.*`.

// Topic keys map to help.topics.<key>.q (title) and .a (answer body).
const TOPIC_KEYS = [
  "gettingStarted",
  "agenda",
  "waitingRoom",
  "patients",
  "consultation",
  "bilans",
  "documents",
  "billing",
  "secretary",
  "sync",
  "languages",
  "subscription",
] as const;

export function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("gettingStarted");
  const supportEmail = t("trial.supportEmail");

  const topics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOPIC_KEYS.map((key) => ({
      key,
      title: t(`help.topics.${key}.q`),
      body: t(`help.topics.${key}.a`),
    })).filter((topic) =>
      !q || topic.title.toLowerCase().includes(q) || topic.body.toLowerCase().includes(q)
    );
  }, [query, t]);

  return (
    <Layout title={t("help.title")} subtitle={t("help.subtitle")}>
      {/* Quick actions */}
      <div className="help-actions">
        <button className="help-action-card" onClick={openWelcomeTour}>
          <span className="help-action-emoji" aria-hidden>🧭</span>
          <span>
            <span className="help-action-title">{t("help.replayTour")}</span>
            <span className="help-action-sub">{t("help.replayTourSub")}</span>
          </span>
        </button>
        <a className="help-action-card" href={`mailto:${supportEmail}?subject=${encodeURIComponent(t("help.mailSubject"))}`}>
          <span className="help-action-emoji" aria-hidden>💬</span>
          <span>
            <span className="help-action-title">{t("help.contact")}</span>
            <span className="help-action-sub">{supportEmail}</span>
          </span>
        </a>
      </div>

      {/* Search */}
      <input
        className="form-input help-search"
        placeholder={t("help.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Topics — collapsible */}
      <div className="help-topics">
        {topics.length === 0 && <div className="help-empty">{t("help.noResults")}</div>}
        {topics.map((topic) => {
          const isOpen = open === topic.key;
          return (
            <div key={topic.key} className={`help-topic${isOpen ? " open" : ""}`}>
              <button className="help-topic-q" onClick={() => setOpen(isOpen ? null : topic.key)}>
                <span>{topic.title}</span>
                <span className="help-topic-chev" aria-hidden>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && <div className="help-topic-a">{topic.body}</div>}
            </div>
          );
        })}
      </div>

      {/* Pricing reminder */}
      <div className="help-pricing">
        <div className="help-pricing-title">{t("help.pricingTitle")}</div>
        <div className="help-pricing-row">
          <span>{t("trial.planMonthly")}</span>
          <b>{PRICING.monthly.amount} {PRICING.currency}<small>{t("trial.perMonth")}</small></b>
        </div>
        <div className="help-pricing-row">
          <span>{t("trial.planYearly")}</span>
          <b>{PRICING.yearly.amount} {PRICING.currency}<small>{t("trial.perYear")}</small></b>
        </div>
        <div className="help-pricing-foot">
          {t("help.pricingFoot", { days: PRICING.trialDays })}
        </div>
      </div>
    </Layout>
  );
}
