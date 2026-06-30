import { FormEvent, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { requestPasswordReset, verifyPasswordReset, warmup } from "../api/client";
import { BlackpineLogo } from "../components/Logo";
import { useTranslation } from "react-i18next";

type AuthMode = "login" | "signup" | "forgot" | "reset-verify" | "secretary" | "secretary-code";

// ── Brand panel features ───────────────────────────────────────────────────────

function BrandPanel() {
  const { t } = useTranslation();
  const features = [
    t("auth.feat1"),
    t("auth.feat2"),
    t("auth.feat3"),
    t("auth.feat4"),
    t("auth.feat5"),
    t("auth.feat6"),
  ];
  const trust = [t("auth.trust1"), t("auth.trust2"), t("auth.trust3")];
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-inner">
        {/* Logo */}
        <div className="auth-brand-logo-row">
          <BlackpineLogo size={52} radius={14} />
          <div>
            <div className="auth-brand-name">Blackpine</div>
            <div className="auth-brand-tagline">{t("auth.appTagline")}</div>
          </div>
        </div>

        {/* Free-trial badge */}
        <span className="auth-brand-badge">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.5 3 3.3.3-2.5 2.2.8 3.2L6 8.3 2.9 10l.8-3.2L1.2 4.6 4.5 4.3 6 1Z"
              fill="currentColor"/>
          </svg>
          {t("auth.trialBadge")}
        </span>

        {/* Headline + value prop */}
        <h2 className="auth-brand-headline">{t("auth.headline")}</h2>
        <p className="auth-brand-subhead">{t("auth.valueProp")}</p>

        {/* Feature list */}
        <div className="auth-brand-feats">
          {features.map(f => (
            <div key={f} className="auth-brand-feat">
              <span className="auth-brand-check">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1.5 4.5l2 2L7.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Trust chips */}
        <div className="auth-brand-trust">
          {trust.map(b => <span key={b} className="auth-brand-trust-chip">{b}</span>)}
        </div>

        {/* Footer */}
        <div className="auth-brand-footer">
          {t("auth.footer")}
        </div>
      </div>
    </div>
  );
}

// ── Main auth page ─────────────────────────────────────────────────────────────

export function AuthPage() {
  const { t } = useTranslation();
  const { login, signup, startSecretarySession, startSecretaryLogin } = useApp();
  const navigate = useNavigate();

  const [mode, setMode]         = useState<AuthMode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPass]     = useState("");
  const [code, setCode]         = useState("");
  const [secUser, setSecUser]   = useState("");
  const [newPass, setNewPass]   = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  // Pre-warm the serverless backend the moment the login screen appears, so the
  // user's first submit hits an already-booted function (no "first login fails").
  useEffect(() => { void warmup(); }, []);

  function switchMode(m: AuthMode) {
    setMode(m);
    setError(null);
    setSuccess(null);
    setCode("");
    setNewPass("");
    setNewPass2("");
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/");

      } else if (mode === "signup") {
        await signup(email, password);
        navigate("/");

      } else if (mode === "secretary") {
        await startSecretaryLogin(secUser, password);
        navigate("/");

      } else if (mode === "secretary-code") {
        await startSecretarySession(code);
        navigate("/");

      } else if (mode === "forgot") {
        await requestPasswordReset(email);
        setSuccess(t("auth.codeSent"));
        switchMode("reset-verify");

      } else if (mode === "reset-verify") {
        if (newPass !== newPass2) {
          setError(t("auth.passMismatch"));
          return;
        }
        await verifyPasswordReset(email, code.trim(), newPass);
        setSuccess(t("auth.passReset"));
        switchMode("login");
      }
    } catch (err: unknown) {
      setError((err as Error).message || t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, string> = {
    login:            t("auth.loginTitle"),
    signup:           t("auth.signupTitle"),
    forgot:           t("auth.forgotTitle"),
    "reset-verify":   t("auth.resetTitle"),
    secretary:        t("auth.secretaryTitle"),
    "secretary-code": t("auth.secretaryTitle"),
  };
  const subs: Record<AuthMode, string> = {
    login:            t("auth.loginSub"),
    signup:           t("auth.signupSub"),
    forgot:           t("auth.forgotSub"),
    "reset-verify":   t("auth.resetSub"),
    secretary:        t("auth.secretaryLoginSub"),
    "secretary-code": t("auth.secretarySub"),
  };

  return (
    <div className="auth-root">
      {/* ── Left brand panel ── */}
      <BrandPanel />

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-card">

          {/* Logo — visible on mobile only */}
          <div className="auth-logo auth-logo-mobile">
            <BlackpineLogo size={40} radius={10} />
            <span className="auth-logo-text">Blackpine Cabinet</span>
          </div>

          <h1 className="auth-title">{titles[mode]}</h1>
          <p className="auth-sub">{subs[mode]}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            {/* Email — all modes except secretary login / code */}
            {mode !== "secretary" && mode !== "secretary-code" && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">{t("auth.emailLabel")}</label>
                <input
                  id="auth-email" type="email" className="form-input"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  readOnly={mode === "reset-verify"}
                  style={mode === "reset-verify" ? { opacity: 0.6 } : undefined}
                />
              </div>
            )}

            {/* Secretary account — username */}
            {mode === "secretary" && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-sec-user">{t("auth.secretaryUserLabel")}</label>
                <input
                  id="auth-sec-user" type="text" className="form-input"
                  placeholder={t("auth.secretaryUserPlaceholder")}
                  value={secUser} onChange={e => setSecUser(e.target.value)}
                  required autoCapitalize="none" autoComplete="username"
                />
              </div>
            )}

            {/* Secretary invite code (legacy / first-time bootstrap) */}
            {mode === "secretary-code" && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-sec-code">{t("auth.secretaryCodeLabel")}</label>
                <input
                  id="auth-sec-code" type="text" className="form-input auth-code-input"
                  placeholder="ABC123"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  required autoCapitalize="characters" autoComplete="off"
                  style={{ letterSpacing: "0.3em", textTransform: "uppercase" }}
                />
                <p className="auth-resend-hint" style={{ marginTop: 6 }}>{t("auth.secretaryCodeHint")}</p>
              </div>
            )}

            {/* Password — login, signup & secretary account */}
            {(mode === "login" || mode === "signup" || mode === "secretary") && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">{t("auth.passwordLabel")}</label>
                <input
                  id="auth-password" type="password" className="form-input"
                  placeholder="••••••••"
                  value={password} onChange={e => setPass(e.target.value)}
                  required
                  autoComplete={mode === "login" || mode === "secretary" ? "current-password" : "new-password"}
                  minLength={6}
                />
              </div>
            )}

            {/* Reset code */}
            {mode === "reset-verify" && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-code">{t("auth.codeLabel")}</label>
                <input
                  id="auth-code" type="text" className="form-input auth-code-input"
                  placeholder="123456"
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required inputMode="numeric" autoComplete="one-time-code"
                />
              </div>
            )}

            {/* New password fields */}
            {mode === "reset-verify" && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-newpass">{t("auth.newPassLabel")}</label>
                  <input
                    id="auth-newpass" type="password" className="form-input"
                    placeholder="••••••••"
                    value={newPass} onChange={e => setNewPass(e.target.value)}
                    required minLength={6} autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-newpass2">{t("auth.confirmPassLabel")}</label>
                  <input
                    id="auth-newpass2" type="password" className="form-input"
                    placeholder="••••••••"
                    value={newPass2} onChange={e => setNewPass2(e.target.value)}
                    required minLength={6} autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn btn-navy auth-submit-btn"
              disabled={loading}
            >
              {loading
                ? <><span className="auth-spinner" />{t("auth.loadingBtn")}</>
                : {
                    login:            t("auth.loginBtn"),
                    signup:           t("auth.signupBtn"),
                    forgot:           t("auth.sendCodeBtn"),
                    "reset-verify":   t("auth.resetBtn"),
                    secretary:        t("auth.secretaryLoginBtn"),
                    "secretary-code": t("auth.secretaryBtn"),
                  }[mode]
              }
            </button>
          </form>

          {/* Footer links */}
          <div className="auth-switch">
            {mode === "login" && (
              <>
                <button className="auth-link" onClick={() => switchMode("forgot")}>
                  {t("auth.forgotLink")}
                </button>
                <span className="auth-switch-sep">·</span>
                {t("auth.noAccount")}{" "}
                <button className="auth-link" onClick={() => switchMode("signup")}>{t("auth.signupLink")}</button>
                <span className="auth-switch-sep">·</span>
                <button className="auth-link" onClick={() => switchMode("secretary")}>{t("auth.secretaryLink")}</button>
              </>
            )}
            {mode === "signup" && (
              <>{t("auth.hasAccount")}{" "}
                <button className="auth-link" onClick={() => switchMode("login")}>{t("auth.loginLink")}</button>
              </>
            )}
            {mode === "secretary" && (
              <>
                <button className="auth-link" onClick={() => switchMode("secretary-code")}>{t("auth.secretaryUseCode")}</button>
                <span className="auth-switch-sep">·</span>
                <button className="auth-link" onClick={() => switchMode("login")}>{t("auth.backToLogin")}</button>
              </>
            )}
            {mode === "secretary-code" && (
              <>
                <button className="auth-link" onClick={() => switchMode("secretary")}>{t("auth.secretaryUseAccount")}</button>
                <span className="auth-switch-sep">·</span>
                <button className="auth-link" onClick={() => switchMode("login")}>{t("auth.backToLogin")}</button>
              </>
            )}
            {(mode === "forgot" || mode === "reset-verify") && (
              <button className="auth-link" onClick={() => switchMode("login")}>{t("auth.backToLogin")}</button>
            )}
          </div>

          {mode === "reset-verify" && (
            <p className="auth-resend-hint">
              {t("auth.noCode")}{" "}
              <button className="auth-link" onClick={() => switchMode("forgot")}>{t("auth.resend")}</button>
            </p>
          )}

          <p className="auth-footer-note">
            {t("auth.syncNote")}
          </p>
          <p className="auth-footer-note" style={{ marginTop: 6 }}>
            <Link to="/supprimer-compte" className="auth-link" style={{ fontSize: 11 }}>
              {t("auth.deleteAccountLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
