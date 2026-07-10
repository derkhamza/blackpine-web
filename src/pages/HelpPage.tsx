import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { openWelcomeTour } from "../components/WelcomeTour";
import { PRICING } from "../lib/pricing";

// In-app help centre: quick actions, a searchable set of topics grouped into
// clear categories, a short "getting started in 4 steps" guide, subscription
// pricing (so nobody is surprised) and contact. Content lives in i18n (help.*).

// Topics grouped by theme. Each key maps to help.topics.<key>.{q,a};
// each category to help.cat.<id>.
const CATEGORIES: { id: string; emoji: string; topics: string[] }[] = [
  { id: "start",    emoji: "🚀", topics: ["gettingStarted"] },
  { id: "daily",    emoji: "📅", topics: ["agenda", "waitingRoom", "patients"] },
  { id: "clinical", emoji: "🩺", topics: ["consultation", "bilans", "documents"] },
  { id: "money",    emoji: "🧾", topics: ["billing"] },
  { id: "team",     emoji: "🤝", topics: ["secretary"] },
  { id: "app",      emoji: "⚙️", topics: ["sync", "languages", "subscription"] },
];

// The 4-step first-run checklist (help.steps.<n>).
const STEPS = [1, 2, 3, 4];

export function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("gettingStarted");
  const supportEmail = t("trial.supportEmail");

  const q = query.trim().toLowerCase();
  const matches = (key: string) => {
    if (!q) return true;
    return (
      t(`help.topics.${key}.q`).toLowerCase().includes(q) ||
      t(`help.topics.${key}.a`).toLowerCase().includes(q)
    );
  };

  // Categories with their matching topics (drop empty categories while searching).
  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({ ...c, topics: c.topics.filter(matches) }))
        .filter((c) => c.topics.length > 0),
    [q, t],
  );
  const anyResults = groups.length > 0;

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

      {/* Getting started in 4 steps (hidden while searching) */}
      {!q && (
        <div className="help-steps">
          <div className="help-steps-title">{t("help.stepsTitle")}</div>
          <ol className="help-steps-list">
            {STEPS.map((n) => (
              <li key={n}>
                <span className="help-step-n">{n}</span>
                <span>{t(`help.steps.${n}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Search */}
      <input
        className="form-input help-search"
        placeholder={t("help.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Topics grouped by category */}
      {!anyResults && <div className="help-empty">{t("help.noResults")}</div>}
      {groups.map((cat) => (
        <div key={cat.id} className="help-cat">
          <div className="help-cat-head">
            <span className="help-cat-emoji" aria-hidden>{cat.emoji}</span>
            <span className="help-cat-title">{t(`help.cat.${cat.id}`)}</span>
          </div>
          <div className="help-topics">
            {cat.topics.map((key) => {
              const isOpen = open === key;
              return (
                <div key={key} className={`help-topic${isOpen ? " open" : ""}`}>
                  <button className="help-topic-q" onClick={() => setOpen(isOpen ? null : key)}>
                    <span>{t(`help.topics.${key}.q`)}</span>
                    <span className="help-topic-chev" aria-hidden>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && <div className="help-topic-a">{t(`help.topics.${key}.a`)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

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
