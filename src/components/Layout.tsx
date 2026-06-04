import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { CommandPalette } from "./CommandPalette";

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
    stats: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12l3.5-4 3 2.5L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
        <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    report: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 5h4M5 7.5h4M5 10h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M11 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="11" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
    comptabilite: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 8h14" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 4V2M11 4V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M4 11h2M7 11h2M10 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    agenda: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="5" y="9" width="2" height="2" rx="0.5" fill="currentColor"/>
        <rect x="9" y="9" width="2" height="2" rx="0.5" fill="currentColor"/>
      </svg>
    ),
    patients: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 7v4M14 9h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    payroll: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 7v4M6 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.5"/>
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
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = () => { logout(); navigate("/login"); };

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navItems = [
    { to: "/",             label: "Tableau de bord", icon: "dashboard",    group: "Finances" },
    { to: "/transactions", label: "Transactions",    icon: "transactions", group: "Finances" },
    { to: "/expliquer",    label: "Calcul fiscal",   icon: "explain",      group: "Finances" },
    { to: "/rapport",      label: "Rapport",          icon: "report",       group: "Finances" },
    { to: "/comptabilite", label: "Comptabilité",    icon: "comptabilite", group: "Finances" },
    { to: "/activite",     label: "Activité",        icon: "stats",        group: "Cabinet" },
    { to: "/agenda",       label: "Agenda",          icon: "agenda",       group: "Cabinet" },
    { to: "/patients",     label: "Patients",        icon: "patients",     group: "Cabinet" },
    { to: "/salaires",     label: "Salaires",        icon: "payroll",      group: "Cabinet" },
    { to: "/profil",       label: "Mon profil",      icon: "profile",      group: "Paramètres" },
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

        {/* Search */}
        <button className="sidebar-search" onClick={() => setSearchOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>Rechercher…</span>
          <kbd className="sidebar-search-kbd">⌘K</kbd>
        </button>

        {/* Nav — grouped */}
        <div className="sidebar-nav">
          {(["Finances", "Cabinet", "Paramètres"] as const).map(group => {
            const items = navItems.filter(n => n.group === group);
            return (
              <div key={group}>
                <div className="sidebar-section-label">{group}</div>
                {items.map(({ to, label, icon }) => (
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
            );
          })}
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

      {/* ── Command Palette ── */}
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
