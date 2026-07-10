import { FormEvent, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { requestPasswordReset, verifyPasswordReset, sendSignupCode, warmup } from "../api/client";
import { BlackpineLogo } from "../components/Logo";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

const AUTH_LANGS = [
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "ar", flag: "🇲🇦", label: "ع" },
] as const;

// Language switcher shown on the auth screens so a user can pick their language
// before signing in / up (the in-app switcher lives in the sidebar afterwards).
function AuthLangSwitcher() {
  const { i18n: i } = useTranslation();
  const current = i.language?.slice(0, 2) ?? "fr";
  return (
    <div className="auth-lang-switcher">
      {AUTH_LANGS.map(l => (
        <button
          key={l.code}
          type="button"
          className={`auth-lang-btn${current === l.code ? " active" : ""}`}
          onClick={() => i18n.changeLanguage(l.code)}
          title={l.label}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}

type AuthMode = "login" | "signup" | "signup-verify" | "forgot" | "reset-verify" | "secretary";

// ── Password field with show/hide toggle ────────────────────────────────────────

const EyeIcon = (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
    <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const EyeOffIcon = (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
    <path d="M2 10s3-6 8-6c1.4 0 2.6.4 3.7 1M18 10s-3 6-8 6c-1.4 0-2.6-.4-3.7-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 8.2A2.5 2.5 0 0 0 11.8 12M3 3l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function PwInput({
  id, value, onChange, autoComplete, minLength = 6, placeholder = "••••••••",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const label = show ? t("auth.hidePassword") : t("auth.showPassword");
  return (
    <div className="pw-field">
      <input
        id={id}
        type={show ? "text" : "password"}
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        minLength={minLength}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow(s => !s)}
        aria-label={label}
        title={label}
        tabIndex={-1}
      >
        {show ? EyeOffIcon : EyeIcon}
      </button>
    </div>
  );
}

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
  const { login, signup, startSecretaryLogin } = useApp();
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

  // Both signup steps share the "create account" identity (tab, callout, CTA).
  const isSignup = mode === "signup" || mode === "signup-verify";

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
        // Step 1 — send the email verification code, then ask for it.
        await sendSignupCode(email.trim());
        switchMode("signup-verify");
        setSuccess(t("auth.signupCodeSent"));

      } else if (mode === "signup-verify") {
        // Step 2 — create the account with the verification code.
        await signup(email.trim(), password, code.trim());
        navigate("/");

      } else if (mode === "secretary") {
        await startSecretaryLogin(secUser, password);
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
      // A dropped/slow request aborts on timeout ("The operation was aborted",
      // "Failed to fetch"…) — surface an actionable message instead of the raw
      // browser text. The backend is fine; retrying usually succeeds.
      const e = err as Error;
      const isNet = e?.name === "AbortError"
        || /abort|failed to fetch|networkerror|load failed|timeout/i.test(e?.message || "");
      setError(isNet ? t("auth.networkError") : (e.message || t("auth.genericError")));
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, string> = {
    login:            t("auth.loginTitle"),
    signup:           t("auth.signupTitle"),
    "signup-verify":  t("auth.signupVerifyTitle"),
    forgot:           t("auth.forgotTitle"),
    "reset-verify":   t("auth.resetTitle"),
    secretary:        t("auth.secretaryTitle"),
  };
  const subs: Record<AuthMode, string> = {
    login:            t("auth.loginSub"),
    signup:           t("auth.signupSub"),
    "signup-verify":  t("auth.signupVerifySub", { email }),
    forgot:           t("auth.forgotSub"),
    "reset-verify":   t("auth.resetSub"),
    secretary:        t("auth.secretaryLoginSub"),
  };

  return (
    <div className="auth-root">
      {/* ── Left brand panel ── */}
      <BrandPanel />

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <AuthLangSwitcher />
        <div className={`auth-card${isSignup ? " auth-card-signup" : ""}`}>

          {/* Logo — visible on mobile only */}
          <div className="auth-logo auth-logo-mobile">
            <BlackpineLogo size={40} radius={10} />
            <span className="auth-logo-text">Blackpine</span>
          </div>

          {/* Segmented switcher — makes "sign in" vs "create account" unmistakable.
              Hidden for the ancillary flows (secretary, password reset). */}
          {(mode === "login" || isSignup) && (
            <div className="auth-seg" role="tablist" aria-label={t("auth.segAria")}>
              <button
                type="button" role="tab" aria-selected={mode === "login"}
                className={`auth-seg-btn${mode === "login" ? " active" : ""}`}
                onClick={() => switchMode("login")}
              >
                {t("auth.segLogin")}
              </button>
              <button
                type="button" role="tab" aria-selected={isSignup}
                className={`auth-seg-btn${isSignup ? " active" : ""}`}
                onClick={() => switchMode("signup")}
              >
                {t("auth.segSignup")}
              </button>
            </div>
          )}

          <h1 className="auth-title">{titles[mode]}</h1>
          <p className="auth-sub">{subs[mode]}</p>

          {/* Signup-only trial banner — a distinct cue so the create-account
              flow never reads like the sign-in form. */}
          {isSignup && (
            <div className="auth-signup-callout">
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1l1.5 3 3.3.3-2.5 2.2.8 3.2L6 8.3 2.9 10l.8-3.2L1.2 4.6 4.5 4.3 6 1Z" fill="currentColor"/>
              </svg>
              <span>{t("auth.signupCallout")}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            {/* Email — all modes except secretary login */}
            {mode !== "secretary" && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">{t("auth.emailLabel")}</label>
                <input
                  id="auth-email" type="email" className="form-input"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  readOnly={mode === "reset-verify" || mode === "signup-verify"}
                  style={mode === "reset-verify" || mode === "signup-verify" ? { opacity: 0.6 } : undefined}
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

            {/* Password — login, signup & secretary account */}
            {(mode === "login" || mode === "signup" || mode === "secretary") && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">{t("auth.passwordLabel")}</label>
                <PwInput
                  id="auth-password"
                  value={password}
                  onChange={setPass}
                  autoComplete={mode === "login" || mode === "secretary" ? "current-password" : "new-password"}
                />
              </div>
            )}

            {/* Verification code — signup & password reset */}
            {(mode === "reset-verify" || mode === "signup-verify") && (
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
                  <PwInput
                    id="auth-newpass"
                    value={newPass}
                    onChange={setNewPass}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-newpass2">{t("auth.confirmPassLabel")}</label>
                  <PwInput
                    id="auth-newpass2"
                    value={newPass2}
                    onChange={setNewPass2}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className={`btn auth-submit-btn ${isSignup ? "btn-green" : "btn-navy"}`}
              disabled={loading}
            >
              {loading
                ? <><span className="auth-spinner" />{t("auth.loadingBtn")}</>
                : {
                    login:            t("auth.loginBtn"),
                    signup:           t("auth.signupContinueBtn"),
                    "signup-verify":  t("auth.createAccountBtn"),
                    forgot:           t("auth.sendCodeBtn"),
                    "reset-verify":   t("auth.resetBtn"),
                    secretary:        t("auth.secretaryLoginBtn"),
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
                <button className="auth-link" onClick={() => switchMode("secretary")}>{t("auth.secretaryLink")}</button>
              </>
            )}
            {mode === "secretary" && (
              <button className="auth-link" onClick={() => switchMode("login")}>{t("auth.backToLogin")}</button>
            )}
            {(mode === "forgot" || mode === "reset-verify" || mode === "signup-verify") && (
              <button className="auth-link" onClick={() => switchMode("login")}>{t("auth.backToLogin")}</button>
            )}
          </div>

          {mode === "reset-verify" && (
            <p className="auth-resend-hint">
              {t("auth.noCode")}{" "}
              <button className="auth-link" onClick={() => switchMode("forgot")}>{t("auth.resend")}</button>
            </p>
          )}

          {mode === "signup-verify" && (
            <p className="auth-resend-hint">
              {t("auth.noCode")}{" "}
              <button className="auth-link" onClick={() => switchMode("signup")}>{t("auth.resend")}</button>
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
          <p className="auth-footer-note" style={{ marginTop: 6, fontSize: 10.5, opacity: 0.75 }}>
            {t("common.productOf")}
          </p>
        </div>
      </div>
    </div>
  );
}
