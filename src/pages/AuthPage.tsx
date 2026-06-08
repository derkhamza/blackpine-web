import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { requestPasswordReset, verifyPasswordReset } from "../api/client";

type AuthMode = "login" | "signup" | "forgot" | "reset-verify";

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
    } catch (err: any) {
      setError(err.message || "Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  // ── Titles & subtitles ──────────────────────────────────────────────────
  const titles: Record<AuthMode, string> = {
    login:         "Connexion",
    signup:        "Créer un compte",
    forgot:        "Mot de passe oublié",
    "reset-verify":"Nouveau mot de passe",
  };
  const subs: Record<AuthMode, string> = {
    login:         "Accédez à votre tableau de bord.",
    signup:        "Commencez votre essai gratuit de 30 jours.",
    forgot:        "Entrez votre email pour recevoir un code de réinitialisation.",
    "reset-verify":"Entrez le code reçu par email et choisissez un nouveau mot de passe.",
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img src="/icon.png" width="48" height="48" alt="Blackpine" style={{ borderRadius: 12, display: "block" }} />
          <span className="auth-logo-text">Blackpine Cabinet</span>
        </div>

        <h1 className="auth-title">{titles[mode]}</h1>
        <p className="auth-sub">{subs[mode]}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {/* Email — shown on all modes */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">Adresse email</label>
            <input
              id="email" type="email" className="form-input"
              placeholder="docteur@exemple.ma"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
              readOnly={mode === "reset-verify"}
              style={mode === "reset-verify" ? { opacity: 0.6 } : undefined}
            />
          </div>

          {/* Password — login & signup only */}
          {(mode === "login" || mode === "signup") && (
            <div className="form-group">
              <label className="form-label" htmlFor="password">Mot de passe</label>
              <input
                id="password" type="password" className="form-input"
                placeholder="••••••••"
                value={password} onChange={(e) => setPass(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
              />
            </div>
          )}

          {/* Reset code */}
          {mode === "reset-verify" && (
            <div className="form-group">
              <label className="form-label" htmlFor="code">Code de vérification (6 chiffres)</label>
              <input
                id="code" type="text" className="form-input"
                placeholder="123456"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required inputMode="numeric" autoComplete="one-time-code"
                style={{ letterSpacing: "0.25em", fontSize: 18, textAlign: "center" }}
              />
            </div>
          )}

          {/* New password fields */}
          {mode === "reset-verify" && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="newPass">Nouveau mot de passe</label>
                <input
                  id="newPass" type="password" className="form-input"
                  placeholder="••••••••"
                  value={newPass} onChange={(e) => setNewPass(e.target.value)}
                  required minLength={6} autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="newPass2">Confirmer le mot de passe</label>
                <input
                  id="newPass2" type="password" className="form-input"
                  placeholder="••••••••"
                  value={newPass2} onChange={(e) => setNewPass2(e.target.value)}
                  required minLength={6} autoComplete="new-password"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-navy"
            style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14, marginTop: 4 }}
            disabled={loading}
          >
            {loading ? "Chargement…" : {
              login:          "Se connecter",
              signup:         "Créer mon compte",
              forgot:         "Envoyer le code",
              "reset-verify": "Réinitialiser le mot de passe",
            }[mode]}
          </button>
        </form>

        {/* Footer links */}
        <div className="auth-switch">
          {mode === "login" && (
            <>
              <button onClick={() => switchMode("forgot")} style={{ color: "var(--blue)" }}>
                Mot de passe oublié ?
              </button>
              <span style={{ margin: "0 8px", color: "var(--border)" }}>·</span>
              Pas de compte ?{" "}
              <button onClick={() => switchMode("signup")}>S'inscrire</button>
            </>
          )}
          {mode === "signup" && (
            <>Déjà un compte ?{" "}
              <button onClick={() => switchMode("login")}>Se connecter</button>
            </>
          )}
          {(mode === "forgot" || mode === "reset-verify") && (
            <button onClick={() => switchMode("login")}>← Retour à la connexion</button>
          )}
        </div>

        {mode === "reset-verify" && (
          <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--tertiary)", marginTop: 12 }}>
            Vous n'avez pas reçu le code ?{" "}
            <button
              style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: 11.5 }}
              onClick={() => { switchMode("forgot"); }}
            >
              Renvoyer
            </button>
          </p>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--tertiary)", marginTop: 16 }}>
          Données synchronisées avec l'application Android
        </p>
      </div>
    </div>
  );
}
