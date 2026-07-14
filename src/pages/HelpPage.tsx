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
  { id: "daily",    emoji: "📅", topics: ["agenda", "waitingRoom", "patients", "notes"] },
  { id: "clinical", emoji: "🩺", topics: ["consultation", "bilans", "documents", "calculators"] },
  { id: "money",    emoji: "🧾", topics: ["billing", "accounting", "payroll", "optimisation"] },
  { id: "team",     emoji: "🤝", topics: ["secretary"] },
  { id: "app",      emoji: "⚙️", topics: ["sync", "languages", "subscription"] },
];

// The 4-step first-run checklist (help.steps.<n>).
const STEPS = [1, 2, 3, 4];

// Complete feature guide — every major capability of the app gets a one-line
// explanation (help.feat.<id>.{t,d}). Shown as its own reference section and
// included in search, so a user can look up what any feature does.
const FEATURES: { id: string; emoji: string }[] = [
  { id: "agenda",      emoji: "📅" },
  { id: "apptTypes",   emoji: "🏷️" },
  { id: "waitingRoom", emoji: "⏳" },
  { id: "patients",    emoji: "👤" },
  { id: "consultation",emoji: "🩺" },
  { id: "history",     emoji: "📚" },
  { id: "autoCalc",    emoji: "🧮" },
  { id: "growth",      emoji: "📈" },
  { id: "bilans",      emoji: "🔬" },
  { id: "documents",   emoji: "📄" },
  { id: "designer",    emoji: "🖊️" },
  { id: "billing",     emoji: "🧾" },
  { id: "finances",    emoji: "💰" },
  { id: "reminders",   emoji: "🔔" },
  { id: "booking",     emoji: "🌐" },
  { id: "tele",        emoji: "🎥" },
  { id: "stock",       emoji: "📦" },
  { id: "secretary",   emoji: "🤝" },
  { id: "stats",       emoji: "📊" },
  { id: "sync",        emoji: "🔄" },
  { id: "languages",   emoji: "🌍" },
  { id: "backup",      emoji: "💾" },
];

export function HelpPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("gettingStarted");
  const [featOpen, setFeatOpen] = useState(false);
  const supportEmail = t("trial.supportEmail");

  const jumpTo = (id: string) =>
    document.getElementById(`help-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

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

  // Feature guide filtered by the same search box.
  const featMatches = (id: string) => {
    if (!q) return true;
    return (
      t(`help.feat.${id}.t`).toLowerCase().includes(q) ||
      t(`help.feat.${id}.d`).toLowerCase().includes(q)
    );
  };
  const features = useMemo(() => FEATURES.filter((f) => featMatches(f.id)), [q, t]);

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

      {/* Jump navigation — scroll straight to a section (hidden while searching) */}
      {!q && (
        <div className="help-jumpnav">
          {CATEGORIES.map((c) => (
            <button key={c.id} className="help-jump-pill" onClick={() => jumpTo(c.id)}>
              <span aria-hidden>{c.emoji}</span> {t(`help.cat.${c.id}`)}
            </button>
          ))}
          <button className="help-jump-pill" onClick={() => { setFeatOpen(true); setTimeout(() => jumpTo("features"), 0); }}>
            <span aria-hidden>📖</span> {t("help.featuresTitle")}
          </button>
        </div>
      )}

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
        <div key={cat.id} id={`help-sec-${cat.id}`} className="help-cat">
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

      {/* Complete feature guide — collapsible (kept closed so it doesn't bury the
          topics; a search always expands it). */}
      {features.length > 0 && (
        <div id="help-sec-features" className="help-cat">
          <button
            className="help-cat-head help-cat-toggle"
            onClick={() => setFeatOpen(o => !o)}
            aria-expanded={featOpen || !!q}
          >
            <span className="help-cat-emoji" aria-hidden>📖</span>
            <span className="help-cat-title">{t("help.featuresTitle")}</span>
            <span className="help-cat-count">{features.length}</span>
            <span className="help-topic-chev" aria-hidden style={{ marginInlineStart: "auto" }}>{(featOpen || q) ? "−" : "+"}</span>
          </button>
          {(featOpen || q) && (
            <div className="help-feat-grid">
              {features.map((f) => (
                <div key={f.id} className="help-feat">
                  <span className="help-feat-emoji" aria-hidden>{f.emoji}</span>
                  <div className="help-feat-body">
                    <div className="help-feat-title">{t(`help.feat.${f.id}.t`)}</div>
                    <div className="help-feat-desc">{t(`help.feat.${f.id}.d`)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
