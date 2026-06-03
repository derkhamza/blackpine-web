import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export function AuthPage() {
  const { login, signup } = useApp();
  const navigate = useNavigate();

  const [mode, setMode]       = useState<"login" | "signup">("login");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else                  await signup(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path d="M4 4h5.5a3.5 3.5 0 0 1 0 7H4V4Z" fill="white" fillOpacity="0.9"/>
              <path d="M4 11h6a4 4 0 0 1 0 8H4v-8Z" fill="white" fillOpacity="0.6"/>
            </svg>
          </div>
          <span className="auth-logo-text">Blackpine Cabinet</span>
        </div>

        <h1 className="auth-title">
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Accédez à votre tableau de bord financier."
            : "Commencez votre essai gratuit de 30 jours."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Adresse email</label>
            <input
              id="email" type="email" className="form-input"
              placeholder="docteur@exemple.ma"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Mot de passe</label>
            <input
              id="password" type="password" className="form-input"
              placeholder="••••••••"
              value={password} onChange={(e) => setPass(e.target.value)}
              required autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-navy"
            style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 14 }}
            disabled={loading}
          >
            {loading
              ? "Chargement…"
              : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>Pas encore de compte ?{" "}
              <button onClick={() => { setMode("signup"); setError(null); }}>S'inscrire</button>
            </>
          ) : (
            <>Déjà un compte ?{" "}
              <button onClick={() => { setMode("login"); setError(null); }}>Se connecter</button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--tertiary)", marginTop: 16 }}>
          Données synchronisées avec l'application Android
        </p>
      </div>
    </div>
  );
}
