import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BlackpineLogo } from "../components/Logo";
import { isLoggedIn, getStoredUser, deleteMyAccount } from "../api/client";

/**
 * Public account-deletion page (`/supprimer-compte`).
 *
 * Reachable without the app so it can be listed in the Google Play "Data safety"
 * form and the privacy policy. A signed-in doctor can delete their own account +
 * all data here; a signed-out visitor is pointed to sign in or to e-mail support.
 */
export function DeleteAccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const email = getStoredUser()?.email ?? "";

  const [confirm, setConfirm] = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone]   = useState(false);

  const supportEmail = t("deleteAccount.supportEmail");
  const canDelete = confirm.trim().toLowerCase() === email.toLowerCase() && !!email;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true); setError(null);
    try {
      await deleteMyAccount(confirm.trim());
      setDone(true);
      setTimeout(() => navigate("/login"), 4000);
    } catch (err) {
      setError((err as Error).message || t("deleteAccount.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="delacc-root">
      <div className="delacc-card">
        <div className="delacc-logo">
          <BlackpineLogo size={40} radius={10} />
          <span>Iyadaty</span>
        </div>

        {done ? (
          <>
            <h1 className="delacc-title">{t("deleteAccount.doneTitle")}</h1>
            <p className="delacc-sub">{t("deleteAccount.doneSub")}</p>
            <Link to="/login" className="btn btn-ghost" style={{ marginTop: 8 }}>{t("deleteAccount.backToLogin")}</Link>
          </>
        ) : (
          <>
            <h1 className="delacc-title">{t("deleteAccount.title")}</h1>
            <p className="delacc-sub">{t("deleteAccount.intro")}</p>

            {/* What gets removed */}
            <div className="delacc-list">
              <div className="delacc-list-head">{t("deleteAccount.whatTitle")}</div>
              <ul>
                <li>{t("deleteAccount.item1")}</li>
                <li>{t("deleteAccount.item2")}</li>
                <li>{t("deleteAccount.item3")}</li>
                <li>{t("deleteAccount.item4")}</li>
              </ul>
            </div>

            <div className="delacc-warn">⚠️ {t("deleteAccount.irreversible")}</div>

            {loggedIn ? (
              <>
                <p className="delacc-confirm-label">{t("deleteAccount.confirmLabel", { email })}</p>
                <input
                  className="form-input"
                  type="email"
                  autoComplete="off"
                  placeholder={email}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                />
                {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}
                <button
                  className="btn"
                  style={{ background: "var(--coral)", color: "#fff", width: "100%", marginTop: 14, justifyContent: "center" }}
                  disabled={!canDelete || busy}
                  onClick={handleDelete}
                >
                  {busy ? t("deleteAccount.deleting") : t("deleteAccount.deleteBtn")}
                </button>
                <Link to="/parametres" className="delacc-cancel">{t("common.cancel")}</Link>
              </>
            ) : (
              <>
                <p className="delacc-sub" style={{ marginTop: 4 }}>{t("deleteAccount.loginPrompt")}</p>
                <Link
                  to="/login"
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
                >
                  {t("deleteAccount.signIn")}
                </Link>
                <p className="delacc-mailto">
                  {t("deleteAccount.orEmail")}{" "}
                  <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(t("deleteAccount.mailSubject"))}`}>
                    {supportEmail}
                  </a>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
