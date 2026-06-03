import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

// ── Icons ──────────────────────────────────────────────────────────────────
function Icon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    dashboard: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    transactions: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h12M2 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    explain: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 4v4M8 11v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    profile: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    logout: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6M11 5l3 3-3 3M7 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? null;
}

// ── Sync indicator ─────────────────────────────────────────────────────────
function SyncPill() {
  const { syncStatus, lastSyncedAt } = useApp();
  const label =
    syncStatus === "syncing" ? "Sync…"
    : syncStatus === "error"   ? "Sync échoué"
    : syncStatus === "offline" ? "Hors ligne"
    : lastSyncedAt ? `Sync ${new Date(lastSyncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Prêt";

  return (
    <div className="sync-bar" style={{ padding: "6px 10px" }}>
      <div className={`sync-dot ${syncStatus === "syncing" ? "syncing" : syncStatus === "synced" ? "synced" : syncStatus === "error" || syncStatus === "offline" ? "error" : ""}`} />
      <span>{label}</span>
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────
interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Layout({ title, subtitle, actions, children }: Props) {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  const navItems = [
    { to: "/",             label: "Tableau de bord", icon: "dashboard" },
    { to: "/transactions", label: "Transactions",    icon: "transactions" },
    { to: "/expliquer",    label: "Calcul fiscal",   icon: "explain" },
    { to: "/profil",       label: "Mon profil",      icon: "profile" },
  ];

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <nav className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4h5.5a3.5 3.5 0 0 1 0 7H4V4Z" fill="white" fillOpacity="0.9"/>
              <path d="M4 11h6a4 4 0 0 1 0 8H4v-8Z" fill="white" fillOpacity="0.6"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-logo-text">Blackpine</div>
            <div className="sidebar-logo-sub">Cabinet Web</div>
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
            >
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <SyncPill />
          {user && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">{user.email[0].toUpperCase()}</div>
              <span className="sidebar-email">{user.email}</span>
            </div>
          )}
          <button className="sidebar-logout" onClick={handleLogout}>
            <Icon name="logout" />
            Déconnexion
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="page-title">{title}</div>
            {subtitle && <div className="page-sub">{subtitle}</div>}
          </div>
          {actions && <div style={{ display: "flex", gap: 10 }}>{actions}</div>}
        </div>
        <div className="page-body">{children}</div>
      </main>
    </div>
  );
}
