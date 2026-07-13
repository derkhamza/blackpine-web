import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CHANGELOG, CURRENT_VERSION, releasesSince, type Release } from "../lib/changelog";

// "Nouveautés" panel. Shows the release notes automatically ONCE after the app
// updates to a new version (for users who have used a prior version), and can be
// reopened any time via the sidebar version chip (window event "bp:open-whatsnew").
// Brand-new users don't see it — their last-seen version is set silently on first
// run so onboarding/tour aren't interrupted by a changelog for versions they never
// had.
const SEEN_KEY = "bp.lastSeenVersion";

export function WhatsNew() {
  const { t } = useTranslation();
  const [open, setOpen]         = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === CURRENT_VERSION) return;                 // already up to date
    // Only surface once onboarding is done, so it never competes with it.
    const onboarded = !!localStorage.getItem("bp.onboarded");
    if (seen) {
      // Returning user who was on an older version → show what changed since.
      const fresh = releasesSince(seen);
      if (onboarded && fresh.length) { setReleases(fresh); setOpen(true); }
      else localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
      return;
    }
    // No recorded version yet. An already-onboarded user is an EXISTING user
    // meeting this panel for the first time (first rollout) → show the latest
    // release once. A brand-new user records the version silently.
    if (onboarded) { setReleases(CHANGELOG.slice(0, 1)); setOpen(true); }
    else localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
  }, []);

  useEffect(() => {
    const reopen = () => { setReleases(CHANGELOG.slice(0, 3)); setOpen(true); };
    window.addEventListener("bp:open-whatsnew", reopen);
    return () => window.removeEventListener("bp:open-whatsnew", reopen);
  }, []);

  const close = () => {
    localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  if (!open || releases.length === 0) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal whatsnew" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <span className="whatsnew-spark">✨</span> {t("whatsNew.title")}
          </h2>
          <button className="modal-close" onClick={close} aria-label={t("common.close")}>×</button>
        </div>
        <div className="modal-body whatsnew-body">
          {releases.map(r => (
            <div key={r.version} className="whatsnew-release">
              <div className="whatsnew-release-head">
                <span className="whatsnew-badge">v{r.version}</span>
                <span className="whatsnew-release-title">{r.title}</span>
              </div>
              <ul className="whatsnew-list">
                {r.items.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={close}>{t("whatsNew.gotIt")}</button>
        </div>
      </div>
    </div>
  );
}
