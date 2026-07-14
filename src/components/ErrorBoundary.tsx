import { Component, type ReactNode, type ErrorInfo } from "react";
import { useTranslation } from "react-i18next";

interface Props  { children: ReactNode; }
interface State  { error: Error | null; }

function ErrorFallback({ error }: { error: Error }) {
  const { t } = useTranslation();
  // Theme-token colours (not hardcoded light) so a crash in dark mode doesn't flash
  // a bright-white card. The raw error is tucked behind a collapsed <details> —
  // available for a support screenshot, but not dumped at the doctor by default.
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg, #EFF6FB)", padding: 32,
    }}>
      <div style={{
        background: "var(--surface, #fff)", borderRadius: 16, padding: 32,
        maxWidth: 520, boxShadow: "var(--shadow-card, 0 4px 24px rgba(10,78,126,0.12))",
        border: "1px solid var(--border, #C8DFF0)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: "var(--text, #122B42)", marginBottom: 8 }}>{t("error.title")}</h2>
        <p style={{ color: "var(--muted, #4A6C84)", marginBottom: 20, fontSize: 14 }}>
          {t("error.body")}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "var(--navy, #0A4E7E)", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 20px", cursor: "pointer",
            fontSize: 14, fontWeight: 600, marginBottom: 20,
          }}
        >
          {t("error.reload")}
        </button>
        <details style={{ fontSize: 12 }}>
          <summary style={{ color: "var(--muted, #4A6C84)", cursor: "pointer" }}>
            {t("error.details", { defaultValue: "Détails techniques" })}
          </summary>
          <pre style={{
            background: "var(--surface-alt, #f5f5f5)", borderRadius: 8, padding: 12,
            fontSize: 12, color: "var(--coral, #E85B5B)", overflow: "auto",
            maxHeight: 200, marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {error.message}
          </pre>
        </details>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
