import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { verifyPin, markUnlocked, clearAppLock } from "../lib/appLock";
import { useApp } from "../context/AppContext";
import { BlackpineLogo } from "./Logo";

// Shown by App when an app-lock PIN is set and the session isn't unlocked yet.
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const { logout } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || pin.length < 4) return;
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) { markUnlocked(); onUnlock(); }
    else { setError(true); setPin(""); }
  };

  // Forgot PIN → drop the lock and sign out; re-entry needs the account password.
  const forgot = () => { clearAppLock(); logout(); };

  return (
    <div className="lock-root">
      <form className="lock-card" onSubmit={submit}>
        <BlackpineLogo size={44} radius={10} />
        <div className="lock-title">{t("lock.title")}</div>
        <div className="lock-sub">{t("lock.sub")}</div>
        <input
          className={`lock-input${error ? " error" : ""}`}
          type="password" inputMode="numeric" autoFocus
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(false); }}
          placeholder="••••" aria-label={t("lock.pinLabel")}
        />
        {error && <div className="lock-error">{t("lock.wrong")}</div>}
        <button type="submit" className="btn btn-navy" disabled={busy || pin.length < 4}>{t("lock.unlock")}</button>
        <button type="button" className="auth-link" onClick={forgot}>{t("lock.forgot")}</button>
      </form>
    </div>
  );
}
