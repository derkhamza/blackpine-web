import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BlackpineLogo } from "./Logo";
import { TourArt } from "./TourArt";

// One-time, illustrated feature walkthrough shown after the profile-setup wizard.
// A slide carousel (not element-anchored — those break as the UI shifts) that
// introduces every main area with a picture + a short "how to" checklist.
// Persisted per browser so it only appears once; re-launchable from Help via
// openWelcomeTour(). Two variants: full doctor tour + a shorter secretary tour.

export type TourVariant = "doctor" | "secretary";

const SEEN_KEY: Record<TourVariant, string> = {
  // v2 → re-show the new illustrated tour once, even to users who saw the old one.
  doctor:    "bp.tourSeen.v2",
  secretary: "bp.tourSeenSec.v2",
};

export function hasSeenTour(variant: TourVariant = "doctor"): boolean {
  return !!localStorage.getItem(SEEN_KEY[variant]);
}
export function markTourSeen(variant: TourVariant = "doctor"): void {
  try { localStorage.setItem(SEEN_KEY[variant], "1"); } catch { /* private mode */ }
}
export function openWelcomeTour(): void {
  window.dispatchEvent(new CustomEvent("bp:open-tour"));
}

// Each slide: an illustration key (TourArt) + i18n keys
// (<prefix>.<key>{Title,Body,Steps}). Steps is an array of how-to lines.
const DOCTOR_SLIDES = [
  "welcome", "agenda", "waiting", "patients", "consult", "prescribe",
  "billing", "finances", "documents", "team", "sync", "help",
];
const SECRETARY_SLIDES = ["welcome", "agenda", "waiting", "patients", "billing", "sync", "help"];

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
  const key = slides[idx];
  const isLast = idx === slides.length - 1;
  const isFirst = idx === 0;

  const steps = t(`${prefix}.${key}Steps`, { returnObjects: true, defaultValue: [] }) as unknown;
  const stepList = Array.isArray(steps) ? (steps as string[]) : [];

  const finish = () => { markTourSeen(variant); setI(0); onClose(); };
  const go = (n: number) => setI(Math.max(0, Math.min(slides.length - 1, n)));

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label={t(`${prefix}.${key}Title`)}>
      <div className="tour-card">
        <div className="tour-progress"><span style={{ width: `${((idx + 1) / slides.length) * 100}%` }} /></div>

        <button className="tour-skip" onClick={finish}>{t("tour.skip")}</button>

        <div className="tour-illus">
          {key === "welcome" ? (
            <div className="tour-welcome-logo"><BlackpineLogo size={56} radius={14} /></div>
          ) : (
            <TourArt name={key} />
          )}
        </div>

        <div className="tour-step-badge">{t("tour.stepOf", { n: idx + 1, total: slides.length })}</div>
        <h2 className="tour-title">{t(`${prefix}.${key}Title`)}</h2>
        <p className="tour-body">{t(`${prefix}.${key}Body`)}</p>

        {stepList.length > 0 && (
          <ol className="tour-steps">
            {stepList.map((s, k) => (
              <li key={k} className="tour-step"><span className="tour-step-n">{k + 1}</span><span>{s}</span></li>
            ))}
          </ol>
        )}

        <div className="tour-dots">
          {slides.map((s, k) => (
            <span key={s} className={`tour-dot${k === idx ? " active" : ""}`} onClick={() => go(k)} role="button" aria-label={`${k + 1}`} />
          ))}
        </div>

        <div className="tour-actions">
          {!isFirst ? (
            <button className="tour-back" onClick={() => go(idx - 1)}>{t("tour.back")}</button>
          ) : <span />}
          {isLast ? (
            <button className="btn btn-primary tour-next" onClick={finish}>{t("tour.start")}</button>
          ) : (
            <button className="btn btn-primary tour-next" onClick={() => go(idx + 1)}>{t("tour.next")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
