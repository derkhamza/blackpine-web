import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BlackpineLogo } from "./Logo";

// One-time feature walkthrough shown after the profile-setup OnboardingWizard.
// A simple slide carousel (not element-anchored — those break as the UI shifts)
// that introduces the main areas of the app. Persisted per browser so it only
// ever appears once; re-launchable from the Help page via openWelcomeTour().
// Two variants: the doctor tour and a shorter secretary (front-desk) tour.

export type TourVariant = "doctor" | "secretary";

const SEEN_KEY: Record<TourVariant, string> = {
  doctor:    "bp.tourSeen.v1",
  secretary: "bp.tourSeenSec.v1",
};

export function hasSeenTour(variant: TourVariant = "doctor"): boolean {
  return !!localStorage.getItem(SEEN_KEY[variant]);
}
export function markTourSeen(variant: TourVariant = "doctor"): void {
  try { localStorage.setItem(SEEN_KEY[variant], "1"); } catch { /* private mode */ }
}
// Lets the Help page force the tour open again (variant chosen by the caller).
export function openWelcomeTour(): void {
  window.dispatchEvent(new CustomEvent("bp:open-tour"));
}

// Each slide is keyed to i18n strings: doctor → tour.<key>{Title,Body};
// secretary → tour.sec.<key>{Title,Body}.
const DOCTOR_SLIDES: { key: string; emoji: string }[] = [
  { key: "welcome",   emoji: "🌲" },
  { key: "agenda",    emoji: "📅" },
  { key: "patients",  emoji: "👥" },
  { key: "consult",   emoji: "🩺" },
  { key: "billing",   emoji: "🧾" },
  { key: "secretary", emoji: "🤝" },
  { key: "help",      emoji: "💬" },
];
const SECRETARY_SLIDES: { key: string; emoji: string }[] = [
  { key: "welcome",  emoji: "🌲" },
  { key: "agenda",   emoji: "📅" },
  { key: "waiting",  emoji: "🕑" },
  { key: "patients", emoji: "👥" },
  { key: "billing",  emoji: "🧾" },
  { key: "help",     emoji: "💬" },
];

export function WelcomeTour({
  open, onClose, variant = "doctor",
}: {
  open: boolean;
  onClose: () => void;
  variant?: TourVariant;
}) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);

  if (!open) return null;
  const slides = variant === "secretary" ? SECRETARY_SLIDES : DOCTOR_SLIDES;
  const prefix = variant === "secretary" ? "tour.sec" : "tour";
  const idx = Math.min(i, slides.length - 1);
  const slide = slides[idx];
  const isLast = idx === slides.length - 1;

  const finish = () => { markTourSeen(variant); setI(0); onClose(); };

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true">
      <div className="tour-card">
        <button className="tour-skip" onClick={finish}>{t("tour.skip")}</button>

        <div className="tour-emoji" aria-hidden>{slide.key === "welcome" ? <BlackpineLogo size={52} radius={13} /> : slide.emoji}</div>
        <h2 className="tour-title">{t(`${prefix}.${slide.key}Title`)}</h2>
        <p className="tour-body">{t(`${prefix}.${slide.key}Body`)}</p>

        <div className="tour-dots">
          {slides.map((s, k) => (
            <span key={s.key} className={`tour-dot${k === idx ? " active" : ""}`} onClick={() => setI(k)} />
          ))}
        </div>

        <div className="tour-actions">
          {idx > 0 ? (
            <button className="tour-back" onClick={() => setI(idx - 1)}>{t("tour.back")}</button>
          ) : <span />}
          {isLast ? (
            <button className="btn btn-primary tour-next" onClick={finish}>{t("tour.start")}</button>
          ) : (
            <button className="btn btn-primary tour-next" onClick={() => setI(idx + 1)}>{t("tour.next")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
