import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../context/AppContext";
import { BlackpineLogo } from "./Logo";

// Free-trial surface: a countdown banner in the second half of the trial and a
// blocking subscribe overlay once it (or a paid plan) runs out. Conversion is
// card-free — the doctor redeems an activation code (issued after a bank
// transfer / sale) or contacts us. Rendered once from Layout.
export function TrialGate() {
  const { t } = useTranslation();
  const { trial, applyActivation, isAuthenticated, isSecretary } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Secretaries don't own the subscription; nothing to show when logged out.
  if (!isAuthenticated || isSecretary) return null;

  const expired = trial.expired;
  const showBanner = !expired && trial.active && trial.daysLeft != null &&
    ((trial.isTrial && trial.daysLeft <= 14) || (!trial.isTrial && trial.daysLeft <= 7));
  const showModal = expired || modalOpen;
  const supportEmail = t("trial.supportEmail");

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      await applyActivation(code);
      setDone(true);
      setTimeout(() => { setModalOpen(false); setDone(false); setCode(""); }, 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showBanner && (
        <div className={`trial-banner${trial.daysLeft! <= 3 ? " urgent" : ""}`}>
          <span className="trial-banner-dot" />
          <span className="trial-banner-txt">
            {trial.isTrial
              ? t("trial.bannerTrial", { n: trial.daysLeft })
              : t("trial.bannerPaid", { n: trial.daysLeft })}
          </span>
          <button className="trial-banner-btn" onClick={() => { setErr(null); setModalOpen(true); }}>
            {t("trial.activate")}
          </button>
        </div>
      )}

      {showModal && (
        <div
          className="trial-overlay"
          onClick={expired ? undefined : (e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="trial-card" role="dialog" aria-modal="true">
            <BlackpineLogo size={44} radius={11} />
            <h2 className="trial-title">{expired ? t("trial.expiredTitle") : t("trial.subscribeTitle")}</h2>
            <p className="trial-msg">{expired ? t("trial.expiredMsg") : t("trial.subscribeMsg")}</p>

            {done ? (
              <div className="trial-ok">✓ {t("trial.activated")}</div>
            ) : (
              <>
                <input
                  className="form-input trial-input"
                  value={code}
                  placeholder={t("trial.codePlaceholder")}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  autoFocus
                />
                {err && <div className="trial-err">{err}</div>}
                <button className="btn btn-primary trial-submit" disabled={busy || !code.trim()} onClick={submit}>
                  {busy ? t("trial.checking") : t("trial.activateBtn")}
                </button>
                <a
                  className="trial-contact"
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent(t("trial.mailSubject"))}`}
                >
                  {t("trial.contact", { email: supportEmail })}
                </a>
                {!expired && (
                  <button className="trial-later" onClick={() => setModalOpen(false)}>
                    {t("trial.later")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
