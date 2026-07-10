import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { BlackpineLogo } from "./Logo";

// One-time feature walkthrough shown after the profile-setup OnboardingWizard.
// A simple slide carousel (not element-anchored — those break as the UI shifts)
// that introduces the main areas of the app. Persisted per browser so it only
// ever appears once; re-launchable from the Help page via openWelcomeTour().

const TOUR_SEEN_KEY = "bp.tourSeen.v1";

export function hasSeenTour(): boolean {
  return !!localStorage.getItem(TOUR_SEEN_KEY);
}
export function markTourSeen(): void {
  try { localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* private mode */ }
}
// Lets the Help page force the tour open again.
export function openWelcomeTour(): void {
  window.dispatchEvent(new CustomEvent("bp:open-tour"));
}

// Each slide is keyed to i18n strings tour.<key>Title / tour.<key>Body.
const SLIDES: { key: string; emoji: string }[] = [
  { key: "welcome",   emoji: "🌲" },
  { key: "agenda",    emoji: "📅" },
  { key: "patients",  emoji: "👥" },
  { key: "consult",   emoji: "🩺" },
  { key: "billing",   emoji: "🧾" },
  { key: "secretary", emoji: "🤝" },
  { key: "help",      emoji: "💬" },
];

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);

  if (!open) return null;
  const slide = SLIDES[i];
  const isLast = i === SLIDES.length - 1;

  const finish = () => { markTourSeen(); setI(0); onClose(); };

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true">
      <div className="tour-card">
        <button className="tour-skip" onClick={finish}>{t("tour.skip")}</button>

        <div className="tour-emoji" aria-hidden>{slide.key === "welcome" ? <BlackpineLogo size={52} radius={13} /> : slide.emoji}</div>
        <h2 className="tour-title">{t(`tour.${slide.key}Title`)}</h2>
        <p className="tour-body">{t(`tour.${slide.key}Body`)}</p>

        <div className="tour-dots">
          {SLIDES.map((s, idx) => (
            <span key={s.key} className={`tour-dot${idx === i ? " active" : ""}`} onClick={() => setI(idx)} />
          ))}
        </div>

        <div className="tour-actions">
          {i > 0 ? (
            <button className="tour-back" onClick={() => setI(i - 1)}>{t("tour.back")}</button>
          ) : <span />}
          {isLast ? (
            <button className="btn btn-primary tour-next" onClick={finish}>{t("tour.start")}</button>
          ) : (
            <button className="btn btn-primary tour-next" onClick={() => setI(i + 1)}>{t("tour.next")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
