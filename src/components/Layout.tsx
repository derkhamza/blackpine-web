import { type ReactNode, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { useToast } from "./Toast";
import { emitSignal } from "../api/client";
import { BlackpineLogo } from "./Logo";
import { CommandPalette }  from "./CommandPalette";
import { TrialGate }       from "./TrialGate";
import { ShortcutsModal } from "./ShortcutsModal";
import { todayIso } from "../lib/format";
import { isAdminEmail } from "../lib/owner";
import { CURRENT_VERSION as APP_VERSION } from "../lib/changelog";
import { DEFAULT_SECRETARY_PERMISSIONS } from "../lib/cabinetTypes";
import { useDarkMode } from "../lib/useDarkMode";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

// ── Icons ──────────────────────────────────────────────────────────────────────
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
    parametres: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M3.2 12.8l1-1M11.8 4.2l1-1"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    optimisation: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 11l3-4 3 2 3-5 3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="14" cy="6" r="1.5" fill="currentColor"/>
        <path d="M13 14H3a1 1 0 0 1-1-1V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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
    remboursements: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L3 5v4c0 3 2.5 4.5 5 5 2.5-.5 5-2 5-5V5L8 2Z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    waiting: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 8v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 12c0-1.7 1.3-3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    factures: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M5 7h6M5 9.5h4M5 12h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    rappels: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2a5 5 0 1 0 0 10A5 5 0 0 0 8 2Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5v3l2 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5.5 13.5L8 12l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    analytiques: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12l3-4 3 2.5 3-5 3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="14" cy="7" r="1.5" fill="currentColor"/>
        <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    stocks: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 5l6-3 6 3v6l-6 3-6-3V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 2v12M2 5l6 3 6-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    calculateurs: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 5h2M5 8h2M5 11h2M9 5h2M9 8h2M9 11h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    messages: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M5 7h6M5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    teleconsult: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M11 6l4-2v6l-4-2V6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      </svg>
    ),
    notes: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4 5h5M4 7.5h5M4 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="11.5" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
    fournisseurs: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4 5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <circle cx="5.5" cy="9.5" r="1.2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 8.5h4M8 10.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    examens: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 4.5v2.8l1.8 1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.5 11.5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M4 2.5V1M12 2.5V1M4 13V14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    ordonnances: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M5.5 9h5M5.5 11.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    certificats: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M5.5 8l1.5 1.5L10 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
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

// Route → header icon + accent tone. Keyed by the first path segment so detail
// pages (/agenda/:id, /patients/:id) inherit their section's icon. Tones follow
// the sidebar groups (daily=blue, clinical=sky, management=violet, finance=amber,
// settings=slate) so the header badge reinforces where you are.
const PAGE_ICONS: Record<string, { icon: string; tone: string }> = {
  "":              { icon: "dashboard",     tone: "#2563EB" },
  agenda:          { icon: "agenda",        tone: "#2563EB" },
  "salle-attente": { icon: "waiting",       tone: "#2563EB" },
  patients:        { icon: "patients",      tone: "#2563EB" },
  documents:       { icon: "ordonnances",   tone: "#0EA5E9" },
  ordonnances:     { icon: "ordonnances",   tone: "#0EA5E9" },
  certificats:     { icon: "certificats",   tone: "#0EA5E9" },
  examens:         { icon: "examens",       tone: "#0EA5E9" },
  communication:   { icon: "messages",      tone: "#0EA5E9" },
  messages:        { icon: "messages",      tone: "#0EA5E9" },
  teleconsult:     { icon: "teleconsult",   tone: "#0EA5E9" },
  calculateurs:    { icon: "calculateurs",  tone: "#0EA5E9" },
  notes:           { icon: "notes",         tone: "#8B5CF6" },
  stocks:          { icon: "stocks",        tone: "#8B5CF6" },
  fournisseurs:    { icon: "fournisseurs",  tone: "#8B5CF6" },
  facturation:     { icon: "factures",      tone: "#F59E0B" },
  factures:        { icon: "factures",      tone: "#F59E0B" },
  remboursements:  { icon: "remboursements",tone: "#F59E0B" },
  rapports:        { icon: "report",        tone: "#F59E0B" },
  rapport:         { icon: "report",        tone: "#F59E0B" },
  comptabilite:    { icon: "comptabilite",  tone: "#F59E0B" },
  optimisation:    { icon: "optimisation",  tone: "#F59E0B" },
  salaires:        { icon: "payroll",       tone: "#F59E0B" },
  parametres:      { icon: "parametres",    tone: "#64748B" },
  profil:          { icon: "profile",       tone: "#64748B" },
  admin:           { icon: "analytiques",   tone: "#64748B" },
};

// ── Language switcher ──────────────────────────────────────────────────────────
const LANGS = [
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "ar", flag: "🇲🇦", label: "ع" },
] as const;

// Compact language toggle styled like the footer's icon buttons (secretary
// preview, dark mode…). Shows the current language code and cycles to the next
// on click. Flags are avoided on purpose — Windows renders country-flag emoji as
// bare letters ("FR", "GB"), so the code is clearer and consistent everywhere.
function LangButton() {
  const { t, i18n: i } = useTranslation();
  const current = i.language?.slice(0, 2) ?? "fr";
  const idx  = Math.max(0, LANGS.findIndex(l => l.code === current));
  const next = LANGS[(idx + 1) % LANGS.length];
  return (
    <button
      className="sidebar-dark-btn sidebar-lang-btn"
      onClick={() => i18n.changeLanguage(next.code)}
      title={t("sidebar.changeLanguage")}
      aria-label={t("sidebar.changeLanguage")}
    >
      {LANGS[idx].label}
    </button>
  );
}

// ── Sync indicator ─────────────────────────────────────────────────────────────
function SyncPill() {
  const { syncStatus, lastSyncedAt } = useApp();
  const { syncState: cabinetSync, lastSynced: cabinetSyncedAt } = useCabinet();
  const { t, i18n: i } = useTranslation();
  const locale = i.language?.slice(0, 2) === "ar" ? "ar-MA" : i.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  // Combined: worst of financial sync and cabinet sync
  const combined =
    syncStatus === "syncing" || cabinetSync === "syncing" ? "syncing"
    : syncStatus === "error"   || cabinetSync === "error"   ? "error"
    : syncStatus === "offline"                              ? "offline"
    : syncStatus === "synced"  || cabinetSync === "synced"  ? "synced"
    : "idle";

  const latestAtArr = [lastSyncedAt, cabinetSyncedAt].filter((x): x is string => !!x).sort();
  const latestAt = latestAtArr.length ? latestAtArr[latestAtArr.length - 1] : null;

  const label =
    combined === "syncing" ? t("sidebar.syncing")
    : combined === "error"   ? t("sidebar.syncFailed")
    : combined === "offline" ? t("sidebar.offline")
    : latestAt
      ? `Sync ${new Date(latestAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
      : t("sidebar.syncReady");

  return (
    <div className="sync-bar" style={{ padding: "6px 10px" }}>
      <div className={`sync-dot ${
        combined === "syncing" ? "syncing"
        : combined === "synced" ? "synced"
        : combined === "error" || combined === "offline" ? "error"
        : ""
      }`} />
      <span>{label}</span>
    </div>
  );
}

// ── Notification dot ───────────────────────────────────────────────────────────
function NavDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="nav-badge">
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ── Hamburger icon ─────────────────────────────────────────────────────────────
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {open ? (
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      ) : (
        <>
          <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────
interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

// Each page renders its own <Layout>, so navigating remounts the sidebar and
// would reset its scroll to the top. We persist the nav scroll position at the
// module level (survives remounts) and restore it before paint.
let lastNavScroll = 0;

export function Layout({ title, subtitle, actions, children }: Props) {
  const { t } = useTranslation();
  const { user, logout, endSecretarySession } = useApp();
  const { appointments, stockItems, doctorProfile, secretaryMode, setSecretaryMode, role, secretaryOwnerName, storagePressure } = useCabinet();
  const toast = useToast();
  // Doctor rings the secretary (quick "come in" / patient signal). The reverse
  // direction is handled by the chat channel, not a one-shot call. Hidden in
  // secretary preview (the doctor is alone there).
  const canIntercom = role === "doctor" && !secretaryMode && !isAdminEmail(user?.email);
  const callSecretary = () => {
    emitSignal("intercom", {}, doctorProfile.fullName || undefined);
    toast(t("signals.calledSecretary"), "success");
  };
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isRealSecretary = role === "secretary";
  // Product-owner accounts run a pure admin console (see lib/owner).
  const isAdmin = !isRealSecretary && isAdminEmail(user?.email);
  // Home page differs by role (owner → admin console, secretary/preview → agenda,
  // doctor → dashboard).
  const homePath = isAdmin ? "/admin" : (isRealSecretary || secretaryMode) ? "/agenda" : "/";
  const showBack = pathname !== homePath;
  // Header icon badge, resolved from the first path segment (root → dashboard).
  const pageIcon = PAGE_ICONS[pathname.split("/")[1] ?? ""];

  // Restore the desktop sidebar's scroll position across page navigations
  // (the Layout — and thus the sidebar — remounts on every route change).
  useLayoutEffect(() => {
    const nav = document.querySelector(".sidebar:not(.sidebar-drawer) .sidebar-nav") as HTMLElement | null;
    if (!nav) return;
    nav.scrollTop = lastNavScroll;
    const onScroll = () => { lastNavScroll = nav.scrollTop; };
    nav.addEventListener("scroll", onScroll, { passive: true });
    // Save the live scroll position when this Layout unmounts (i.e. just before
    // the next page's Layout mounts) so the restore above is never stale.
    return () => {
      lastNavScroll = nav.scrollTop;
      nav.removeEventListener("scroll", onScroll);
    };
  }, []);

  const [searchOpen,    setSearchOpen]    = useState(false);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [storageWarnDismissed, setStorageWarnDismissed] = useState(() => {
    try { return sessionStorage.getItem("bp.storageWarnDismissed") === "1"; } catch { return false; }
  });
  const { dark, toggle: toggleDark } = useDarkMode();

  const handleLogout = () => {
    if (isRealSecretary) endSecretarySession();
    else logout();
    navigate("/login");
  };
  const closeDrawer  = () => setDrawerOpen(false);

  // ── Global shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const clearG = () => {
      gPending = false;
      if (gTimer) { clearTimeout(gTimer); gTimer = null; }
    };

    const handler = (e: KeyboardEvent) => {
      // Never fire inside text inputs
      const tag = (e.target as HTMLElement).tagName;
      const inInput = /^(INPUT|TEXTAREA|SELECT)$/i.test(tag) ||
        (e.target as HTMLElement).isContentEditable;

      // Ctrl/Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(o => !o);
        clearG();
        return;
      }

      if (inInput) return;

      // ? — shortcuts help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShortcutsOpen(o => !o);
        clearG();
        return;
      }

      // Escape — close any overlay
      if (e.key === "Escape") {
        setSearchOpen(false);
        setShortcutsOpen(false);
        clearG();
        return;
      }

      // G — start navigation sequence
      if ((e.key === "g" || e.key === "G") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (gPending) { clearG(); return; }   // double-G cancels
        gPending = true;
        gTimer = setTimeout(clearG, 1500);    // auto-reset after 1.5 s
        return;
      }

      // G + letter navigation
      if (gPending) {
        const key = e.key.toLowerCase();
        const routes: Record<string, string> = {
          d: "/",
          a: "/agenda",
          p: "/patients",
          w: "/salle-attente",
          r: "/rappels",
          f: "/facturation",
          s: "/stocks",
          m: "/communication",
          n: "/notes",
          e: "/examens",
          o: "/documents",
          t: "/transactions",
          c: "/calculateurs",
        };
        if (routes[key]) {
          e.preventDefault();
          navigate(routes[key]);
        }
        clearG();
      }
    };

    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); clearG(); };
  // navigate is stable from useNavigate; eslint is over-cautious here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Body scroll lock when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // ── Notification badges ───────────────────────────────────────────────────
  const today = todayIso();

  const badges = useMemo(() => {
    const unbilledToday = appointments.filter(
      a => a.date === today && a.status === "completed" && !a.billedAt,
    ).length;

    const followUpsSoon = appointments.filter(a => {
      if (!a.followUpDate) return false;
      const diff = Math.ceil(
        (new Date(a.followUpDate).getTime() - new Date(today).getTime()) / 86400000,
      );
      return diff >= 0 && diff <= 3;
    }).length;

    // Completed visits whose fee has not been collected yet — actionable billing.
    const unbilledTotal = appointments.filter(
      a => a.status === "completed" && !a.billedAt,
    ).length;

    const waitingNow = appointments.filter(
      a => a.date === today && a.status === "arrived",
    ).length;

    const lowStock = stockItems.filter(
      s => s.quantity <= s.minThreshold,
    ).length;

    const overdueFollowUps = appointments.filter(a => {
      if (!a.followUpDate) return false;
      return a.followUpDate <= today;  // today or overdue
    }).length;

    return {
      "/agenda":       unbilledToday + followUpsSoon,
      "/facturation":  unbilledTotal,
      "/salle-attente":waitingNow,
      "/rappels":      overdueFollowUps,
      "/stocks":       lowStock,
    } as Record<string, number>;
  }, [appointments, stockItems, today]);

  // ── Nav items ─────────────────────────────────────────────────────────────
  // Product-owner accounts get a pure admin console: a single Supervision entry,
  // no clinical modules. Everyone else gets the full clinical nav (filtered by
  // secretary permissions below).
  const adminNavItems = [
    { to: "/admin", label: t("nav.admin"), icon: "analytiques", group: "Administration" },
  ];
  const allNavItems = [
    // ── Quotidien — daily workflow ─────────────────────────────────────────
    { to: "/",              label: t("nav.dashboard"),    icon: "dashboard",    group: "Quotidien" },
    { to: "/agenda",        label: t("nav.agenda"),       icon: "agenda",       group: "Quotidien" },
    { to: "/salle-attente", label: t("nav.waiting"),      icon: "waiting",      group: "Quotidien" },
    { to: "/patients",      label: t("nav.patients"),     icon: "patients",     group: "Quotidien" },
    // ── Clinique — clinical tools ──────────────────────────────────────────
    { to: "/documents",     label: t("nav.documents"),    icon: "ordonnances",  group: "Clinique" },
    { to: "/examens",       label: t("nav.exams"),        icon: "examens",      group: "Clinique" },
    { to: "/communication", label: t("nav.communication"),icon: "messages",     group: "Clinique" },
    { to: "/calculateurs",  label: t("nav.calculators"),  icon: "calculateurs", group: "Clinique" },
    // ── Gestion — practice management ─────────────────────────────────────
    { to: "/notes",         label: t("nav.notes"),        icon: "notes",        group: "Gestion" },
    { to: "/stocks",        label: t("nav.stocks"),       icon: "stocks",       group: "Gestion" },
    // ── Finances — secondary ───────────────────────────────────────────────
    { to: "/facturation",   label: t("nav.billing"),      icon: "factures",     group: "Finances" },
    { to: "/rapports",      label: t("nav.reports"),      icon: "report",       group: "Finances" },
    { to: "/comptabilite",  label: t("nav.accounting"),   icon: "comptabilite", group: "Finances" },
    { to: "/salaires",      label: t("nav.payroll"),      icon: "payroll",      group: "Finances" },
    // ── Paramètres ────────────────────────────────────────────────────────
    { to: "/profil",        label: t("nav.profile"),      icon: "profile",      group: "Paramètres" },
    { to: "/parametres",    label: t("nav.settings"),     icon: "parametres",   group: "Paramètres" },
  ];

  // Secretary access: the Quotidien group by default, plus whatever extra areas
  // the doctor has granted via secretaryPermissions. A real (separate-login)
  // secretary also can't reach the dashboard ("/"), so drop it for them.
  const secPerms = doctorProfile.secretaryPermissions ?? DEFAULT_SECRETARY_PERMISSIONS;
  const secretaryCanSee = (to: string, group: string): boolean => {
    if (group === "Quotidien" && to !== "/") return true;
    if (to === "/documents" || to === "/examens") return !!secPerms.viewClinical;
    if (to === "/communication") return !!secPerms.useCommunication;
    if (to === "/calculateurs") return !!secPerms.useCalculators;
    if (to === "/notes") return !!secPerms.useNotes;
    if (to === "/stocks") return !!secPerms.manageStock;
    if (to === "/facturation") return !!secPerms.handleBilling;
    if (to === "/transactions" || to === "/comptabilite"
        || to === "/rapports" || to === "/analytiques") return !!secPerms.viewFinances;
    if (to === "/salaires") return !!secPerms.managePayroll;
    return false;
  };
  // A real secretary AND a doctor previewing "secretary mode" both see exactly
  // the areas the doctor granted via secretaryPermissions — so the preview is a
  // faithful picture of what the secretary can reach.
  const navItems = isAdmin
    ? adminNavItems
    : (isRealSecretary || secretaryMode)
    ? allNavItems.filter(i => secretaryCanSee(i.to, i.group))
    : allNavItems;

  // ── Shared sidebar content ────────────────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Logo — clicking it returns to the home page (dashboard, or agenda for secretaries) */}
      <div className="sidebar-logo">
        <button
          type="button"
          className="sidebar-logo-btn"
          onClick={() => { navigate(homePath); closeDrawer(); }}
          aria-label={t("sidebar.goHome")}
        >
          <BlackpineLogo size={32} radius={8} />
          <div>
            <div className="sidebar-logo-text">Blackpine</div>
            <div className="sidebar-logo-sub">Cabinet</div>
          </div>
        </button>
        {/* Mobile close button */}
        <button className="sidebar-close-btn" onClick={closeDrawer} aria-label={t("sidebar.closeMenu")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <button className="sidebar-search" onClick={() => { setSearchOpen(true); closeDrawer(); }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span>{t("sidebar.search")}</span>
        <kbd className="sidebar-search-kbd">⌘K</kbd>
      </button>

      {/* Nav — grouped */}
      <div className="sidebar-nav">
        {(["Administration", "Quotidien", "Clinique", "Gestion", "Finances", "Paramètres"] as const).map(group => {
          const items = navItems.filter(n => n.group === group);
          if (items.length === 0) return null;  // don't render an empty group label (secretary view)
          const groupLabel = group === "Quotidien" ? t("navGroup.daily")
            : group === "Clinique"   ? t("navGroup.clinical")
            : group === "Gestion"    ? t("navGroup.management")
            : group === "Finances"   ? t("navGroup.finances")
            : group === "Administration" ? t("navGroup.administration")
            : t("navGroup.settings");
          return (
            <div key={group}>
              <div className="sidebar-section-label">{groupLabel}</div>
              {items.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
                  onClick={closeDrawer}
                >
                  <Icon name={icon} />
                  {label}
                  <NavDot count={badges[to] ?? 0} />
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
          <>
          {/* Profile line — identity only */}
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user.email[0].toUpperCase()}</div>
            <span className="sidebar-email">{user.email}</span>
          </div>
          {/* Action buttons on their own row, separate from the profile line */}
          <div className="sidebar-actions">
            <LangButton />
            {/* Secretary preview — subtle eye icon (doctor only). Full control also
                in Paramètres → Secrétariat. Exit via the top banner while previewing. */}
            {role === "doctor" && !secretaryMode && !isAdmin && (
              <button
                className="sidebar-dark-btn"
                onClick={() => { setSecretaryMode(true); navigate("/agenda"); closeDrawer(); }}
                title={t("sidebar.secretaryEnter")}
                aria-label={t("sidebar.secretaryEnter")}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <circle cx="7" cy="7" r="1.7" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              </button>
            )}
            <button
              className="sidebar-dark-btn"
              onClick={() => { navigate("/aide"); closeDrawer(); }}
              title={t("nav.help")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 3.5C6 2.7 4.6 2.5 3 2.7v7.6c1.6-.2 3 0 4 .8 1-.8 2.4-1 4-.8V2.7c-1.6-.2-3 0-4 .8Z"
                  stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M7 3.5v7.7" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            </button>
            <button
              className="sidebar-dark-btn"
              onClick={() => setShortcutsOpen(true)}
              title={t("sidebar.shortcuts")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5.5 5.5a1.5 1.5 0 1 1 2.5 1.5c-.5.4-1 .8-1 1.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="7" cy="10.5" r="0.7" fill="currentColor"/>
              </svg>
            </button>
            <button
              className="sidebar-dark-btn"
              onClick={toggleDark}
              title={dark ? t("common.lightMode") : t("common.darkMode")}
            >
              {dark
                ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1v1M7 12v1M1 7h1M12 7h1M3.2 3.2l.7.7M10.1 10.1l.7.7M3.2 10.8l.7-.7M10.1 3.9l.7-.7"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                : <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M12 8.5A6 6 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5Z"
                      stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
              }
            </button>
          </div>
          </>
        )}
        {/* Secretary preview moved to Paramètres → Espace secrétaire (it cluttered
            the sidebar). While previewing, the exit is the top-of-page banner. */}
        {(isRealSecretary || !secretaryMode) && (
          <button className="sidebar-logout" onClick={handleLogout}>
            <Icon name="logout" />
            {isRealSecretary ? t("sidebar.secretaryLogout") : t("sidebar.logout")}
          </button>
        )}
        {/* Current version — click to reopen the "Nouveautés" release notes. */}
        <button
          className="sidebar-version"
          onClick={() => { window.dispatchEvent(new Event("bp:open-whatsnew")); closeDrawer(); }}
          title={t("whatsNew.title")}
        >
          {t("whatsNew.versionLabel", { version: APP_VERSION })}
        </button>
      </div>
    </>
  );

  // ── Total action count for mobile badge ───────────────────────────────────
  const totalActions = Object.values(badges).reduce((s, n) => s + n, 0);

  return (
    <div className="app-shell">
      {/* ── Desktop sidebar ── */}
      <nav className="sidebar">
        {sidebarContent}
      </nav>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ── */}
      <nav className={`sidebar sidebar-drawer${drawerOpen ? " open" : ""}`}>
        {sidebarContent}
      </nav>

      {/* ── Main ── */}
      <main className="main-content">
        <div className="page-header">
          {/* Hamburger (mobile only) */}
          <button
            className="hamburger-btn"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label={drawerOpen ? t("sidebar.closeMenu") : t("sidebar.openMenu")}
            aria-expanded={drawerOpen}
          >
            <HamburgerIcon open={drawerOpen} />
            {totalActions > 0 && !drawerOpen && (
              <span className="hamburger-dot" />
            )}
          </button>

          {/* Back / previous page */}
          {showBack && (
            <button
              className="page-back-btn"
              onClick={() => navigate(-1)}
              title={t("common.back")}
              aria-label={t("common.back")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {pageIcon && (
            <span
              className="page-title-icon"
              style={{ color: pageIcon.tone, background: pageIcon.tone + "1A" }}
              aria-hidden
            >
              <Icon name={pageIcon.icon} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="page-title">{title}</div>
            {subtitle && <div className="page-sub">{subtitle}</div>}
          </div>
          {canIntercom && (
            <button
              className="btn btn-ghost call-secretary-btn"
              onClick={callSecretary}
              title={t("signals.callSecretary")}
              aria-label={t("signals.callSecretary")}
              style={{ flexShrink: 0, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2a3.4 3.4 0 0 1 3.4 3.4c0 2.4 1 3.3 1.5 3.9a.4.4 0 0 1-.3.7H3.4a.4.4 0 0 1-.3-.7c.5-.6 1.5-1.5 1.5-3.9A3.4 3.4 0 0 1 8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M6.5 12.4a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {actions && <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>{actions}</div>}
        </div>
        {/* Real secretary session banner (separate login) */}
        {isRealSecretary && (
          <div className="secretary-banner">
            <span>{t("sidebar.secretarySessionBanner", { name: secretaryOwnerName ?? "" })}</span>
            <button className="secretary-banner-btn" onClick={handleLogout}>
              {t("sidebar.secretaryLogout")}
            </button>
          </div>
        )}
        {/* Secretary preview banner (doctor's own login) */}
        {!isRealSecretary && secretaryMode && (
          <div className="secretary-banner">
            <span>{t("sidebar.secretaryBanner")}</span>
            <button
              className="secretary-banner-btn"
              onClick={() => { setSecretaryMode(false); navigate("/"); }}
            >
              {t("sidebar.returnDoctor")}
            </button>
          </div>
        )}
        {/* Local-storage quota pressure — warn before data is lost, alarm once a
            write has been dropped. The warning is dismissible for the session so it
            doesn't nag; the critical alarm (a write was actually dropped) always shows. */}
        {(storagePressure === "critical" || (storagePressure === "warning" && !storageWarnDismissed)) && (
          <div className={`storage-banner storage-banner-${storagePressure}`} role="alert">
            <span>
              <strong>{t(storagePressure === "critical" ? "storage.criticalTitle" : "storage.warningTitle")}</strong>
              {" — "}
              {t(storagePressure === "critical" ? "storage.criticalBody" : "storage.warningBody")}
            </span>
            <span style={{ display: "inline-flex", gap: 8, flexShrink: 0 }}>
              <button className="storage-banner-btn" onClick={() => { navigate("/parametres"); closeDrawer(); }}>
                {t("storage.action")}
              </button>
              {storagePressure === "warning" && (
                <button
                  className="storage-banner-dismiss"
                  onClick={() => { setStorageWarnDismissed(true); try { sessionStorage.setItem("bp.storageWarnDismissed", "1"); } catch { /* ignore */ } }}
                  aria-label={t("common.close")}
                  title={t("common.close")}
                >×</button>
              )}
            </span>
          </div>
        )}
        <TrialGate />
        <div className="page-body" key={pathname}>{children}</div>
      </main>

      {/* ── Command Palette ── */}
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}

      {/* ── Shortcuts overlay ── */}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
