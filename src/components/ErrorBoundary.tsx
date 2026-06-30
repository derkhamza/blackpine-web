import { Component, type ReactNode, type ErrorInfo } from "react";
import { useTranslation } from "react-i18next";

interface Props  { children: ReactNode; }
interface State  { error: Error | null; }

function ErrorFallback({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#EFF6FB", padding: 32,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 32,
        maxWidth: 520, boxShadow: "0 4px 24px rgba(10,78,126,0.12)",
        border: "1px solid #C8DFF0",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: "#122B42", marginBottom: 8 }}>{t("error.title")}</h2>
        <p style={{ color: "#4A6C84", marginBottom: 16, fontSize: 14 }}>
          {t("error.body")}
        </p>
        <pre style={{
          background: "#f5f5f5", borderRadius: 8, padding: 12,
          fontSize: 12, color: "#E85B5B", overflow: "auto",
          maxHeight: 200, marginBottom: 20,
        }}>
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#0A4E7E", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 20px", cursor: "pointer",
            fontSize: 14, fontWeight: 600,
          }}
        >
          {t("error.reload")}
        </button>
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
