import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { requestPasswordReset, verifyPasswordReset } from "../api/client";

type AuthMode = "login" | "signup" | "forgot" | "reset-verify";

// ── Brand panel features ───────────────────────────────────────────────────────

const FEATURES = [
  "Agenda, dossiers patients & consultations",
  "Ordonnances, examens & certificats",
  "Analytiques cliniques & rapports fiscaux",
  "Synchronisé Android · Web · Hors-ligne",
];

function BrandPanel() {
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-inner">
        {/* Logo */}
        <div className="auth-brand-logo-row">
          <img src="/icon.png" width="52" height="52" alt="Blackpine" style={{ borderRadius: 14, display: "block", flexShrink: 0 }} />
          <div>
            <div className="auth-brand-name">Blackpine</div>
            <div className="auth-brand-tagline">Cabinet médical</div>
          </div>
        </div>

        {/* Headline */}
        <h2 className="auth-brand-headline">
          La gestion de cabinet<br/>médicale, simplifiée.
        </h2>

        {/* Feature list */}
        <div className="auth-brand-feats">
          {FEATURES.map(f => (
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

        {/* Footer */}
        <div className="auth-brand-footer">
          © 2026 Blackpine — Fait pour les médecins au Maroc
        </div>
      </div>
    </div>
  );
}

// ── Main auth page ─────────────────────────────────────────────────────────────

export function AuthPage() {
  const { login, signup } = useApp();
  const navigate = useNavigate();

  const [mode, setMode]         = useState<AuthMode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPass]     = useState("");
  const [code, setCode]         = useState("");
  const [newPass, setNewPass]   = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

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

      } else if (mode === "forgot") {
        await requestPasswordReset(email);
        setSuccess("Un code à 6 chiffres a été envoyé à votre adresse email.");
        switchMode("reset-verify");

      } else if (mode === "reset-verify") {
        if (newPass !== newPass2) {
          setError("Les mots de passe ne correspondent pas.");
          return;
        }
        await verifyPasswordReset(email, code.trim(), newPass);
        setSuccess("Mot de passe réinitialisé. Vous pouvez vous connecter.");
        switchMode("login");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, string> = {
    login:          "Connexion",
    signup:         "Créer un compte",
    forgot:         "Mot de passe oublié",
    "reset-verify": "Nouveau mot de passe",
  };
  const subs: Record<AuthMode, string> = {
    login:          "Accédez à votre tableau de bord.",
    signup:         "Commencez votre essai gratuit de 30 jours.",
    forgot:         "Entrez votre email pour recevoir un code de réinitialisation.",
    "reset-verify": "Entrez le code reçu par email et choisissez un nouveau mot de passe.",
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
            <img src="/icon.png" width="40" height="40" alt="Blackpine" style={{ borderRadius: 10, display: "block" }} />
            <span className="auth-logo-text">Blackpine Cabinet</span>
          </div>

          <h1 className="auth-title">{titles[mode]}</h1>
          <p className="auth-sub">{subs[mode]}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            {/* Email — all modes */}
            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Adresse email</label>
              <input
                id="auth-email" type="email" className="form-input"
                placeholder="docteur@exemple.ma"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                readOnly={mode === "reset-verify"}
                style={mode === "reset-verify" ? { opacity: 0.6 } : undefined}
              />
            </div>

            {/* Password — login & signup */}
            {(mode === "login" || mode === "signup") && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">Mot de passe</label>
                <input
                  id="auth-password" type="password" className="form-input"
                  placeholder="••••••••"
                  value={password} onChange={e => setPass(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                />
              </div>
            )}

            {/* Reset code */}
            {mode === "reset-verify" && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-code">Code de vérification (6 chiffres)</label>
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
                  <label className="form-label" htmlFor="auth-newpass">Nouveau mot de passe</label>
                  <input
                    id="auth-newpass" type="password" className="form-input"
                    placeholder="••••••••"
                    value={newPass} onChange={e => setNewPass(e.target.value)}
                    required minLength={6} autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-newpass2">Confirmer le mot de passe</label>
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
                ? <><span className="auth-spinner" />Chargement…</>
                : { login: "Se connecter", signup: "Créer mon compte",
                    forgot: "Envoyer le code", "reset-verify": "Réinitialiser le mot de passe" }[mode]
              }
            </button>
          </form>

          {/* Footer links */}
          <div className="auth-switch">
            {mode === "login" && (
              <>
                <button className="auth-link" onClick={() => switchMode("forgot")}>
                  Mot de passe oublié ?
                </button>
                <span className="auth-switch-sep">·</span>
                Pas de compte ?{" "}
                <button className="auth-link" onClick={() => switchMode("signup")}>S'inscrire</button>
              </>
            )}
            {mode === "signup" && (
              <>Déjà un compte ?{" "}
                <button className="auth-link" onClick={() => switchMode("login")}>Se connecter</button>
              </>
            )}
            {(mode === "forgot" || mode === "reset-verify") && (
              <button className="auth-link" onClick={() => switchMode("login")}>← Retour à la connexion</button>
            )}
          </div>

          {mode === "reset-verify" && (
            <p className="auth-resend-hint">
              Vous n'avez pas reçu le code ?{" "}
              <button className="auth-link" onClick={() => switchMode("forgot")}>Renvoyer</button>
            </p>
          )}

          <p className="auth-footer-note">
            Données synchronisées avec l'application Android
          </p>
        </div>
      </div>
    </div>
  );
}
