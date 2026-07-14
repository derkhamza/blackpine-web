import { confirmDialog } from "../lib/confirm";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { useDarkMode } from "../lib/useDarkMode";
import { hasAppLock, setAppLock, clearAppLock } from "../lib/appLock";
import { enableWebPush, webPushPermission, webPushSupported } from "../lib/webPush";
import { exportPatientsCsv, exportAppointmentsCsv } from "../lib/csvExport";
import { exportAgendaIcal } from "../lib/icalExport";
import { useInstallPWA } from "../components/PWAPrompts";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import type { CabinetLocation, SecretaryPermissions, ActeCode, DocumentSettings, DocumentLayout, CabinetDoctorProfile, CustomApptType, ApptLabel, DocKind } from "../lib/cabinetTypes";
import { docModeForKind, docTypography } from "../lib/docDesign";
import { APPT_TYPE_LABELS, APPT_TYPE_COLORS, BUILTIN_APPT_TYPES, DEFAULT_SECRETARY_PERMISSIONS, DEFAULT_DOCUMENT_SETTINGS, DOCUMENT_LAYOUT_LABELS } from "../lib/cabinetTypes";
import { COMMON_DRUGS } from "../lib/ordonnancePrinter";
import { ActeCatalogModal } from "../components/ActeCatalogModal";
import { BlackpineLogo } from "../components/Logo";
import { PRICING } from "../lib/pricing";
import { PageDesigner } from "../components/PageDesigner";
import { generateDemoData, isDemoAccount, EMPTY_CABINET_JSON, EMPTY_FINANCES_JSON } from "../lib/demoData";
import QRCode from "qrcode";
import {
  type CabinetBackup,
  secretaryAccountList, secretaryAccountCreate, secretaryAccountRevoke, secretaryAccountPurge, type SecretaryAccount,
  bookingGetMe, bookingSave, type BookingConfig,
  smsGetConfig, smsSaveConfig, type SmsConfig,
} from "../api/client";

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Distinct icon + accent tone per settings section, for at-a-glance navigation.
// Icons are 18×18 stroke glyphs using currentColor so the tone drives both.
const SECTION_ICONS: Record<string, { tone: string; node: React.ReactNode }> = {
  security: { tone: "#2563EB", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 2l5 2v4.2c0 3.4-2.3 5.6-5 6.8-2.7-1.2-5-3.4-5-6.8V4l5-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6.7 8.6l1.6 1.6 3.1-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>) },
  appLock: { tone: "#0EA5E9", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="4" y="8" width="10" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.2 8V6.2a2.8 2.8 0 0 1 5.6 0V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9" cy="11.4" r="1" fill="currentColor"/>
    </svg>) },
  appearance: { tone: "#8B5CF6", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="5.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 3.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor"/>
    </svg>) },
  locations: { tone: "#EF4444", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 2.4c2.5 0 4.4 1.9 4.4 4.4 0 3.1-4.4 8.4-4.4 8.4S4.6 9.9 4.6 6.8C4.6 4.3 6.5 2.4 9 2.4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="9" cy="6.8" r="1.7" stroke="currentColor" strokeWidth="1.5"/>
    </svg>) },
  consultationTypes: { tone: "#10B981", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 8.7V4.2a1 1 0 0 1 1-1h4.5L15.2 9.9 10 15.1 3 8.7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="6.2" cy="6.4" r="1" fill="currentColor"/>
    </svg>) },
  customDrugs: { tone: "#06B6D4", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3" y="6.5" width="12" height="5" rx="2.5" transform="rotate(45 9 9)" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7.2 10.8 10.8 7.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>) },
  acteCodes: { tone: "#F59E0B", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M7.4 3.2 6 14.8M12 3.2l-1.4 11.6M3.4 6.7h11.4M2.8 11.3h11.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  docFormat: { tone: "#0EA5E9", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M5 2.6h5L13.6 6.2V15a.6.6 0 0 1-.6.6H5a.6.6 0 0 1-.6-.6V3.2a.6.6 0 0 1 .6-.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9.8 2.6v3.6h3.6M6.6 9.4h4.8M6.6 12h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  booking: { tone: "#6366F1", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3.3" y="4" width="11.4" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3.3 7.4h11.4M6.4 2.4v3M11.6 2.4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  daysoff: { tone: "#F59E0B", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3.3" y="4" width="11.4" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3.3 7.4h11.4M6.4 2.4v3M11.6 2.4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 11.4 11 11.4M9 9.4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 9 11.4)"/>
    </svg>) },
  sms: { tone: "#14B8A6", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3.4 8.6c0-2.6 2.5-4.4 5.6-4.4s5.6 1.8 5.6 4.4-2.5 4.4-5.6 4.4c-.8 0-1.6-.1-2.3-.35L4 14.6l.7-2.5A4.1 4.1 0 0 1 3.4 8.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>) },
  secretary: { tone: "#EC4899", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="7" cy="6.6" r="2.3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 14.2c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11.6 5.4a2.3 2.3 0 0 1 0 4.1M12.2 10.8c1.7.2 3 1.5 3 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  backup: { tone: "#64748B", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="3" y="3.4" width="12" height="3.2" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 6.6V14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6.6M7.4 9.6h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  clearData: { tone: "#DC2626", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4 5.4h10M7 5.4V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.4M5.5 5.4l.7 8.4a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.8 8v4M10.2 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  installApp: { tone: "#16A34A", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="5" y="2.4" width="8" height="13.2" rx="1.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7.7 3.6h2.6M8.4 13.4h1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
  about: { tone: "#94A3B8", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 8.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9" cy="5.9" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="0.6"/>
    </svg>) },
  subscription: { tone: "#15A876", node: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2.6" y="4.4" width="12.8" height="9.2" rx="1.6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2.6 7.4h12.8M5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>) },
};

function Section({ title, subtitle, children, defaultOpen = false, icon }: {
  title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean; icon?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = icon ? SECTION_ICONS[icon] : null;
  return (
    <div className={`settings-section${open ? " open" : ""}`}>
      <button
        type="button"
        className="settings-section-head"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <div className="settings-section-headmain">
          {meta && (
            <span className="settings-section-icon" style={{ color: meta.tone, background: meta.tone + "1A" }} aria-hidden>
              {meta.node}
            </span>
          )}
          <div>
            <div className="settings-section-title">{title}</div>
            {subtitle && <div className="settings-section-sub">{subtitle}</div>}
          </div>
        </div>
        <svg className="settings-section-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="settings-section-body">{children}</div>}
    </div>
  );
}

function SettingsRow({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <div>{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

// ── Browser notifications (web push) opt-in ────────────────────────────────────

function WebPushRow() {
  const { t } = useTranslation();
  const toast = useToast();
  const [perm, setPerm] = useState<string>(() => webPushPermission());
  const enable = async () => {
    const r = await enableWebPush(true);
    setPerm(webPushPermission());
    toast(
      t(r === "ok" ? "settings.notifEnabled"
        : r === "denied" ? "settings.notifDenied"
        : r === "unsupported" ? "settings.notifUnsupported"
        : "settings.notifError"),
      r === "ok" ? "success" : "info",
    );
  };
  return (
    <SettingsRow label={t("settings.notifTitle")} hint={t("settings.notifHint")}>
      {!webPushSupported()
        ? <span className="settings-theme-label">{t("settings.notifUnsupported")}</span>
        : perm === "granted"
          ? <span className="settings-theme-label">✓ {t("settings.notifOn")}</span>
          : <button className="btn btn-navy" onClick={enable}>{t("settings.notifEnable")}</button>}
    </SettingsRow>
  );
}

// ── Dark mode toggle ───────────────────────────────────────────────────────────

function DarkToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      className={`dark-toggle${dark ? " dark" : ""}`}
      onClick={toggle}
      aria-label={dark ? t("settings.toLight") : t("settings.toDark")}
      title={dark ? t("common.lightMode") : t("common.darkMode")}
    >
      <span className="dark-toggle-thumb">
        {dark
          ? <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v1M7 12v1M1 7h1M12 7h1M3.2 3.2l.7.7M10.1 10.1l.7.7M3.2 10.8l.7-.7M10.1 3.9l.7-.7"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          : <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M12 8.5A6 6 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5Z"
                stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
        }
      </span>
    </button>
  );
}

// ── Agenda colour palette ──────────────────────────────────────────────────────
// A single, finite, harmonious set of colours for BOTH agenda dimensions
// (consultation types + the label axis), so the calendar never turns garish and
// the two axes stay visually coherent. Editors pick from these swatches only.
export const AGENDA_PALETTE = [
  "#2563EB", "#0EA5E9", "#06B6D4", "#14B8A6", "#10B981", "#84CC16",
  "#F59E0B", "#F97316", "#EF4444", "#EC4899", "#A855F7", "#6366F1", "#64748B",
];

// Compact colour picker: a dot that opens a small popover of the palette swatches.
function ColorPalettePicker({ value, onChange, title }: { value: string; onChange: (c: string) => void; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="color-pal">
      <button type="button" className="color-pal-dot" title={title} aria-label={title}
        style={{ background: value }} onClick={() => setOpen(o => !o)} />
      {open && (
        <div className="color-pal-pop">
          {AGENDA_PALETTE.map(c => (
            <button type="button" key={c}
              className={`color-pal-swatch${value.toLowerCase() === c.toLowerCase() ? " sel" : ""}`}
              style={{ background: c }} title={c} aria-label={c}
              onClick={() => { onChange(c); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Location manager ───────────────────────────────────────────────────────────

const LOC_PALETTE = [
  "#0A4E7E", "#15A876", "#E8622A", "#D4962A", "#8B5CF6",
  "#EC4899", "#06B6D4", "#64748B", "#16A34A", "#DC2626",
];

const BLANK_LOC: Omit<CabinetLocation, "id"> = { name: "", address: "", color: LOC_PALETTE[0] };

function LocationsSection({
  locations,
  onChange,
}: {
  locations: CabinetLocation[];
  onChange: (locs: CabinetLocation[]) => void;
}) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<CabinetLocation, "id">>(BLANK_LOC);

  function uid() { return Math.random().toString(36).slice(2, 9); }

  function openAdd() {
    setDraft(BLANK_LOC);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(loc: CabinetLocation) {
    setDraft({ name: loc.name, address: loc.address ?? "", color: loc.color ?? LOC_PALETTE[0] });
    setEditId(loc.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    if (editId) {
      onChange(locations.map(l => l.id === editId ? { ...l, ...draft, name: draft.name.trim() } : l));
    } else {
      onChange([...locations, { id: uid(), ...draft, name: draft.name.trim() }]);
    }
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: string) {
    if (await confirmDialog(t("settings.locDeleteConfirm"))) {
      onChange(locations.filter(l => l.id !== id));
    }
  }

  return (
    <div>
      {locations.length > 0 && (
        <div className="loc-list">
          {locations.map(loc => (
            <div key={loc.id} className="loc-row">
              <div
                className="loc-color-dot"
                style={{ background: loc.color ?? LOC_PALETTE[0] }}
              />
              <div className="loc-info">
                <div className="loc-name">{loc.name}</div>
                {loc.address && <div className="loc-address">{loc.address}</div>}
              </div>
              <button className="loc-edit-btn" onClick={() => openEdit(loc)}>{t("settings.locEdit")}</button>
              <button className="loc-del-btn" onClick={() => handleDelete(loc.id)}>{t("settings.locDelete")}</button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="loc-form">
          <div className="form-group">
            <label className="form-label">{t("settings.locName")} <span style={{ color: "var(--coral)" }}>*</span></label>
            <input
              className="form-input"
              type="text"
              placeholder={t("settings.locNamePlaceholder")}
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("settings.locAddress")} <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("common.optional")}</span></label>
            <input
              className="form-input"
              type="text"
              placeholder={t("settings.locAddressPlaceholder")}
              value={draft.address ?? ""}
              onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t("settings.locColor")}</label>
            <div className="loc-color-picker">
              {LOC_PALETTE.map(c => (
                <button
                  key={c}
                  className={`loc-color-swatch${draft.color === c ? " selected" : ""}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => setDraft(d => ({ ...d, color: c }))}
                />
              ))}
            </div>
          </div>
          <div className="loc-form-row">
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>
              {t("common.cancel")}
            </button>
            <button
              className="btn btn-primary"
              disabled={!draft.name.trim()}
              onClick={handleSave}
            >
              {editId ? t("common.save") : t("common.add")}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" style={{ marginTop: 4 }} onClick={openAdd}>
          {t("settings.locAdd")}
        </button>
      )}
    </div>
  );
}

// ── Online booking manager ─────────────────────────────────────────────────────

const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hhmmToMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const TIME_OPTS = (() => { const o: string[] = []; for (let m = 360; m <= 1320; m += 30) o.push(minToHHMM(m)); return o; })();
// Display Mon→Sun but store JS weekday numbers (0=Sun..6=Sat)
const WEEK_DAYS: { n: number; key: string }[] = [
  { n: 1, key: "mon" }, { n: 2, key: "tue" }, { n: 3, key: "wed" }, { n: 4, key: "thu" },
  { n: 5, key: "fri" }, { n: 6, key: "sat" }, { n: 0, key: "sun" },
];

function OnlineBookingSection({
  doctorProfile, t, showToast,
}: {
  doctorProfile: CabinetDoctorProfile;
  t: (k: string, o?: Record<string, unknown>) => string;
  showToast: (m: string) => void;
}) {
  const [cfg, setCfg] = useState<BookingConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    bookingGetMe().then(setCfg).catch(() => setCfg({ slug: null })).finally(() => setLoaded(true));
  }, []);

  const link = cfg?.slug ? `${window.location.origin}/book/${cfg.slug}` : "";
  const enabled = !!cfg?.enabled && !!cfg?.slug;

  // Build a QR code (PNG data URL) for the booking link the doctor shares.
  useEffect(() => {
    if (!enabled || !link) { setQrUrl(""); return; }
    let alive = true;
    QRCode.toDataURL(link, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then(url => { if (alive) setQrUrl(url); })
      .catch(() => { if (alive) setQrUrl(""); });
    return () => { alive = false; };
  }, [enabled, link]);

  // Downloadable QR image the doctor can share on WhatsApp, print, etc.
  const downloadQr = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `qr-reservation-${cfg?.slug ?? "cabinet"}.png`;
    a.click();
  };

  // Printable poster for the waiting room: title, doctor identity, big QR, link.
  const printPoster = () => {
    if (!qrUrl) return;
    // Printed documents are always in French regardless of the UI language.
    const frT = i18n.getFixedT("fr");
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const win = window.open("", "_blank", "width=720,height=980");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
      <title>${esc(frT("settings.bookingQrPosterTitle"))}</title>
      <style>
        @page { size: A4 portrait; margin: 18mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0A2540; text-align: center; }
        .poster { display: flex; flex-direction: column; align-items: center; gap: 18px; padding-top: 10mm; }
        .kicker { font-size: 15pt; letter-spacing: 2px; text-transform: uppercase; color: #4A6FA5; }
        .title { font-size: 30pt; font-weight: 800; color: #0A4E7E; line-height: 1.15; }
        .doc { font-size: 15pt; color: #333; }
        .qr { width: 260px; height: 260px; border: 1px solid #E2E8F0; border-radius: 14px; padding: 10px; }
        .link { font-size: 12pt; color: #4A6FA5; word-break: break-all; }
        .foot { margin-top: 8px; font-size: 10pt; color: #94A3B8; }
      </style></head>
      <body>
        <div class="poster">
          <div class="kicker">${esc(frT("settings.bookingQrPosterKicker"))}</div>
          <div class="title">${esc(frT("settings.bookingQrPosterHeadline"))}</div>
          <div class="doc">${esc(doctorProfile.fullName || "")}${doctorProfile.specialtyLabel ? " · " + esc(doctorProfile.specialtyLabel) : ""}</div>
          <img class="qr" src="${qrUrl}" alt="QR"/>
          <div class="link">${esc(link)}</div>
          <div class="foot">${esc(frT("settings.bookingQrPosterFoot"))}</div>
        </div>
        <script>window.onload = function(){ window.print(); };<\/script>
      </body></html>`);
    win.document.close();
  };

  const persist = async (patch: Partial<BookingConfig>) => {
    const base: BookingConfig = {
      slug: cfg?.slug ?? null,
      enabled: cfg?.enabled ?? false,
      startMin: cfg?.startMin ?? 540, endMin: cfg?.endMin ?? 1020,
      slotMin: cfg?.slotMin ?? 30, days: cfg?.days ?? "1,2,3,4,5,6",
      ...patch,
    };
    setCfg(base);
    setBusy(true);
    try {
      const saved = await bookingSave({
        ...base,
        doctorName: doctorProfile.fullName || undefined,
        specialty: doctorProfile.specialtyLabel || undefined,
      });
      setCfg(saved);
      return saved;
    } catch { showToast(t("settings.bookingError")); }
    finally { setBusy(false); }
  };

  const toggleDay = (n: number) => {
    const set = new Set((cfg?.days ?? "1,2,3,4,5,6").split(",").filter(Boolean).map(Number));
    if (set.has(n)) set.delete(n); else set.add(n);
    if (set.size === 0) return;
    persist({ days: [...set].sort().join(",") });
  };

  const copy = () => navigator.clipboard?.writeText(link).then(() => showToast(t("settings.bookingCopied")), () => {});

  if (!loaded) return null;
  const dset = new Set((cfg?.days ?? "1,2,3,4,5,6").split(",").filter(Boolean).map(Number));

  return (
    <div>
      <div className="secretary-info-desc" style={{ marginBottom: 12 }}>{t("settings.bookingDesc")}</div>

      {!enabled ? (
        <button className="btn btn-primary" onClick={() => persist({ enabled: true })} disabled={busy}>
          {t("settings.bookingEnable")}
        </button>
      ) : (
        <>
          <div className="invite-code-box" style={{ marginBottom: 14 }}>
            <div className="invite-code-value" onClick={copy} title={t("settings.bookingCopy")} style={{ fontSize: 13, wordBreak: "break-all" }}>
              {link}
            </div>
            <div className="invite-code-hint">{t("settings.bookingShareHint")}</div>
          </div>

          {/* ── QR code — share or display for patients ── */}
          {qrUrl && (
            <div className="booking-qr-box" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
              <img
                src={qrUrl}
                alt={t("settings.bookingQrAlt")}
                width={128}
                height={128}
                style={{ width: 128, height: 128, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", flexShrink: 0 }}
              />
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("settings.bookingQrTitle")}</div>
                <div className="invite-code-hint" style={{ marginBottom: 10 }}>{t("settings.bookingQrHint")}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={downloadQr}>
                    ⬇ {t("settings.bookingQrDownload")}
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={printPoster}>
                    🖨 {t("settings.bookingQrPoster")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Custom link name (slug) ── */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">{t("settings.bookingSlugLabel")}</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>…/book/</span>
              <input
                className="form-input"
                style={{ flex: "1 1 160px", minWidth: 0 }}
                value={slugDraft}
                placeholder={cfg?.slug ?? "dr-mon-nom"}
                onChange={e => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
              <button
                className="btn btn-ghost"
                disabled={busy || !slugDraft.trim() || slugDraft.trim() === cfg?.slug}
                onClick={async () => {
                  const saved = await persist({ slug: slugDraft.trim() });
                  if (saved?.slug) {
                    setSlugDraft("");
                    showToast(t("settings.bookingSlugSaved", { slug: saved.slug }));
                  }
                }}
              >
                {t("settings.bookingSlugSave")}
              </button>
            </div>
            <div className="invite-code-hint" style={{ marginTop: 4 }}>{t("settings.bookingSlugHint")}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: "1 1 120px" }}>
              <label className="form-label">{t("settings.bookingStart")}</label>
              <select className="form-select" value={minToHHMM(cfg?.startMin ?? 540)} onChange={e => persist({ startMin: hhmmToMin(e.target.value) })}>
                {TIME_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: "1 1 120px" }}>
              <label className="form-label">{t("settings.bookingEnd")}</label>
              <select className="form-select" value={minToHHMM(cfg?.endMin ?? 1020)} onChange={e => persist({ endMin: hhmmToMin(e.target.value) })}>
                {TIME_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: "1 1 120px" }}>
              <label className="form-label">{t("settings.bookingSlot")}</label>
              <select className="form-select" value={String(cfg?.slotMin ?? 30)} onChange={e => persist({ slotMin: Number(e.target.value) })}>
                {[15, 20, 30, 45, 60].map(o => <option key={o} value={o}>{o} min</option>)}
              </select>
            </div>
          </div>

          <label className="form-label">{t("settings.bookingDays")}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: 14 }}>
            {WEEK_DAYS.map(d => (
              <button key={d.n} type="button" className={`appt-type-pill${dset.has(d.n) ? " active" : ""}`}
                style={dset.has(d.n) ? { background: "var(--blue-soft)", color: "var(--navy)", borderColor: "var(--blue)" } : undefined}
                onClick={() => toggleDay(d.n)}>
                {t(`settings.day_${d.key}`)}
              </button>
            ))}
          </div>

          <button className="btn btn-danger-ghost" onClick={() => persist({ enabled: false })} disabled={busy}>
            {t("settings.bookingDisable")}
          </button>
        </>
      )}
    </div>
  );
}

// ── Automated SMS reminders ─────────────────────────────────────────────────────

function AppLockSection({
  t, showToast,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  showToast: (m: string) => void;
}) {
  const [enabled, setEnabled] = useState(hasAppLock());
  const [pin, setPin]   = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pin.length < 4 || pin !== pin2) { showToast(t("settings.appLockMismatch")); return; }
    setBusy(true);
    await setAppLock(pin);
    setBusy(false);
    setEnabled(true); setPin(""); setPin2("");
    showToast(t("settings.appLockSet"));
  };
  const remove = () => {
    clearAppLock();
    setEnabled(false);
    showToast(t("settings.appLockRemoved"));
  };

  return (
    <div>
      <div className="secretary-info-desc" style={{ marginBottom: 12 }}>{t("settings.appLockDesc")}</div>
      {enabled ? (
        <div className="settings-secretary-info">
          <div className="settings-secretary-info-row">
            <span className="secretary-info-icon">🔒</span>
            <div>
              <div className="secretary-info-title">{t("settings.appLockActive")}</div>
              <div className="secretary-info-desc">{t("settings.appLockActiveHint")}</div>
            </div>
          </div>
          <button className="btn btn-danger-ghost" style={{ marginTop: 12 }} onClick={remove}>{t("settings.appLockDisable")}</button>
        </div>
      ) : (
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <div className="form-group">
            <label className="form-label">{t("settings.appLockPin")}</label>
            <input className="form-input" type="password" inputMode="numeric" placeholder="••••"
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("settings.appLockConfirm")}</label>
            <input className="form-input" type="password" inputMode="numeric" placeholder="••••"
              value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={busy || pin.length < 4 || pin !== pin2}>
            {t("settings.appLockEnable")}
          </button>
        </div>
      )}
    </div>
  );
}

function SmsRemindersSection({
  t, showToast,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  showToast: (m: string) => void;
}) {
  const [cfg, setCfg] = useState<SmsConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    smsGetConfig().then(setCfg).catch(() => setCfg(null)).finally(() => setLoaded(true));
  }, []);

  const save = async (patch: Partial<SmsConfig>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    setCfg(next);
    setBusy(true);
    try {
      const saved = await smsSaveConfig({ enabled: next.enabled, leadDays: next.leadDays, template: next.template });
      setCfg(c => ({ ...saved, serverConfigured: c?.serverConfigured, defaultTemplate: c?.defaultTemplate }));
    } catch { showToast(t("settings.smsError")); }
    finally { setBusy(false); }
  };

  if (!loaded) return null;

  // SMS delivery isn't live yet — the provider isn't configured on the backend, or
  // the config endpoint is unavailable. Rather than surfacing a server/technical
  // error, present a friendly "coming soon" state.
  if (!cfg || !cfg.serverConfigured) {
    return (
      <div className="sms-soon">
        <span className="sms-soon-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </span>
        <div className="sms-soon-body">
          <div className="sms-soon-title">{t("settings.smsSoonTitle")}</div>
          <div className="sms-soon-desc">{t("settings.smsSoonDesc")}</div>
        </div>
        <span className="sms-soon-badge">{t("settings.smsSoonBadge")}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="secretary-info-desc" style={{ marginBottom: 12 }}>{t("settings.smsDesc")}</div>

      {!cfg.enabled ? (
        <button className="btn btn-primary" onClick={() => save({ enabled: true })} disabled={busy}>
          {t("settings.smsEnable")}
        </button>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">{t("settings.smsTemplate")}</label>
            <textarea
              className="form-input" rows={3} value={cfg.template}
              onChange={e => setCfg({ ...cfg, template: e.target.value })}
              onBlur={() => save({ template: cfg.template })}
            />
            <div className="invite-code-hint" style={{ marginTop: 4 }}>{t("settings.smsPlaceholders")}</div>
          </div>
          <div className="form-group" style={{ maxWidth: 240, marginTop: 10 }}>
            <label className="form-label">{t("settings.smsLead")}</label>
            <select className="form-select" value={String(cfg.leadDays)} onChange={e => save({ leadDays: Number(e.target.value) })}>
              <option value="0">{t("settings.smsLead0")}</option>
              <option value="1">{t("settings.smsLead1")}</option>
              <option value="2">{t("settings.smsLead2")}</option>
            </select>
          </div>
          <button className="btn btn-danger-ghost" style={{ marginTop: 14 }} onClick={() => save({ enabled: false })} disabled={busy}>
            {t("settings.smsDisable")}
          </button>
        </>
      )}
      <div className="invite-code-hint" style={{ marginTop: 12 }}>⚠️ {t("settings.smsConsent")}</div>
    </div>
  );
}

// ── Subscription & pricing ──────────────────────────────────────────────────────
// Always-available view of the plan status and prices, so the doctor is never
// surprised by the cost (the TrialGate modal only appears near/after expiry).

function SubscriptionSection() {
  const { t } = useTranslation();
  const { trial, applyActivation } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const supportEmail = t("trial.supportEmail");

  const status = trial.expired
    ? { tone: "var(--coral)", text: t("settings.subExpired") }
    : trial.isTrial
      ? { tone: "var(--gold)", text: trial.daysLeft != null ? t("settings.subTrial", { n: trial.daysLeft }) : t("settings.subTrialActive") }
      : { tone: "var(--green)", text: trial.daysLeft != null ? t("settings.subActive", { n: trial.daysLeft }) : t("settings.subActiveLifetime") };

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setMsg(null);
    try {
      await applyActivation(code);
      setMsg({ ok: true, text: t("trial.activated") });
      setCode("");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="sub-status" style={{ borderColor: status.tone }}>
        <span className="sub-status-dot" style={{ background: status.tone }} />
        <span className="sub-status-text">{status.text}</span>
      </div>

      <div className="sub-plans">
        <div className="sub-plan">
          <span className="sub-plan-name">{t("trial.planMonthly")}</span>
          <span className="sub-plan-price"><b>{PRICING.monthly.amount}</b> {PRICING.currency}<small>{t("trial.perMonth")}</small></span>
        </div>
        <div className="sub-plan sub-plan-best">
          <span className="sub-plan-badge">{t("trial.bestValue")}</span>
          <span className="sub-plan-name">{t("trial.planYearly")}</span>
          <span className="sub-plan-price"><b>{PRICING.yearly.amount}</b> {PRICING.currency}<small>{t("trial.perYear")}</small></span>
          <span className="sub-plan-note">{t("trial.yearlyNote", { perMonth: PRICING.yearly.perMonth, currency: PRICING.currency })}</span>
        </div>
      </div>
      <p className="sub-foot">{t("trial.plansFoot")}</p>

      <div className="sub-activate">
        <input
          className="form-input"
          value={code}
          placeholder={t("trial.codePlaceholder")}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className="btn btn-primary" disabled={busy || !code.trim()} onClick={submit}>
          {busy ? t("trial.checking") : t("trial.activateBtn")}
        </button>
      </div>
      {msg && <div className={msg.ok ? "sub-msg-ok" : "sub-msg-err"}>{msg.ok ? "✓ " : ""}{msg.text}</div>}
      <a className="sub-contact" href={`mailto:${supportEmail}?subject=${encodeURIComponent(t("trial.mailSubject"))}`}>
        {t("trial.contact", { email: supportEmail })}
      </a>
    </div>
  );
}

// ── Secretary granular permissions ─────────────────────────────────────────────

function SecretaryPermissionsSection({
  perms,
  onChange,
}: {
  perms: SecretaryPermissions;
  onChange: (p: SecretaryPermissions) => void;
}) {
  const { t } = useTranslation();
  const KEYS: { key: keyof SecretaryPermissions; label: string; hint: string }[] = [
    { key: "recordVitals",  label: t("settings.permRecordVitals"),  hint: t("settings.permRecordVitalsHint") },
    { key: "handleBilling", label: t("settings.permHandleBilling"), hint: t("settings.permHandleBillingHint") },
    { key: "editPatients",  label: t("settings.permEditPatients"),  hint: t("settings.permEditPatientsHint") },
    { key: "viewClinical",  label: t("settings.permViewClinical"),  hint: t("settings.permViewClinicalHint") },
    { key: "viewFinances",  label: t("settings.permViewFinances"),  hint: t("settings.permViewFinancesHint") },
    { key: "managePayroll", label: t("settings.permManagePayroll"), hint: t("settings.permManagePayrollHint") },
    { key: "useCommunication", label: t("settings.permUseCommunication"), hint: t("settings.permUseCommunicationHint") },
    { key: "manageStock",   label: t("settings.permManageStock"),   hint: t("settings.permManageStockHint") },
    { key: "useNotes",      label: t("settings.permUseNotes"),      hint: t("settings.permUseNotesHint") },
    { key: "useCalculators", label: t("settings.permUseCalculators"), hint: t("settings.permUseCalculatorsHint") },
  ];
  return (
    <div className="secretary-perms-list" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {t("settings.permTitle")}
      </div>
      {KEYS.map(({ key, label, hint }) => (
        <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "6px 0" }}>
          <input
            type="checkbox"
            checked={!!perms[key]}
            onChange={(e) => onChange({ ...perms, [key]: e.target.checked })}
            style={{ marginTop: 2 }}
          />
          <span>
            <span style={{ fontWeight: 600 }}>{label}</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function ConsultationTypesSection({
  profile,
  onChange,
}: {
  profile: CabinetDoctorProfile;
  onChange: (p: CabinetDoctorProfile) => void;
}) {
  const { t } = useTranslation();

  const hidden    = profile.hiddenConsultationTypes ?? [];
  const prices    = profile.appointmentPrices ?? {};
  const overrides = profile.apptTypeOverrides ?? {};
  const customs   = profile.customApptTypes ?? [];

  // Resolved rows: built-ins (with any rename/recolour applied), then custom.
  const rows: { id: string; label: string; color: string; builtin: boolean }[] = [
    ...BUILTIN_APPT_TYPES.map(id => ({
      id, builtin: true,
      label: overrides[id]?.label || APPT_TYPE_LABELS[id],
      color: overrides[id]?.color || APPT_TYPE_COLORS[id],
    })),
    ...customs.map(c => ({ id: c.id, builtin: false, label: c.label, color: c.color })),
  ];
  const visibleCount = rows.filter(r => !hidden.includes(r.id)).length;

  const toggleHidden = (id: string) => {
    if (hidden.includes(id)) {
      onChange({ ...profile, hiddenConsultationTypes: hidden.filter(h => h !== id) });
    } else {
      if (visibleCount <= 1) return; // always keep at least one type visible
      onChange({ ...profile, hiddenConsultationTypes: [...hidden, id] });
    }
  };

  const setPrice = (id: string, raw: string) => {
    const n = parseFloat(raw);
    const next = { ...prices };
    // 0 is a valid fee (free contrôle) — only clear when emptied / invalid.
    if (!raw.trim() || Number.isNaN(n) || n < 0) delete next[id];
    else next[id] = n;
    onChange({ ...profile, appointmentPrices: Object.keys(next).length ? next : undefined });
  };

  // Renaming/recolouring a BUILT-IN stores an override; setting it back to the
  // default label/colour drops the override (so it stays translatable).
  const setBuiltinOverride = (id: string, patch: { label?: string; color?: string }) => {
    const cur = { ...(overrides[id] ?? {}) };
    if (patch.label !== undefined) {
      if (!patch.label.trim() || patch.label.trim() === APPT_TYPE_LABELS[id as keyof typeof APPT_TYPE_LABELS]) delete cur.label;
      else cur.label = patch.label;
    }
    if (patch.color !== undefined) {
      if (!patch.color || patch.color.toLowerCase() === APPT_TYPE_COLORS[id as keyof typeof APPT_TYPE_COLORS].toLowerCase()) delete cur.color;
      else cur.color = patch.color;
    }
    const nextOv = { ...overrides };
    if (Object.keys(cur).length) nextOv[id] = cur; else delete nextOv[id];
    onChange({ ...profile, apptTypeOverrides: Object.keys(nextOv).length ? nextOv : undefined });
  };

  const setCustom = (id: string, patch: Partial<CustomApptType>) =>
    onChange({ ...profile, customApptTypes: customs.map(c => (c.id === id ? { ...c, ...patch } : c)) });

  const addCustom = () => {
    const id = "t_" + Math.random().toString(36).slice(2, 8);
    onChange({ ...profile, customApptTypes: [...customs, { id, label: t("settings.newTypeName"), color: AGENDA_PALETTE[customs.length % AGENDA_PALETTE.length] }] });
  };

  const removeCustom = async (id: string) => {
    if (!await confirmDialog(t("settings.removeTypeConfirm"))) return;
    const nextPrices = { ...prices }; delete nextPrices[id];
    const nextHidden = hidden.filter(h => h !== id);
    onChange({
      ...profile,
      customApptTypes: customs.filter(c => c.id !== id),
      hiddenConsultationTypes: nextHidden.length ? nextHidden : undefined,
      appointmentPrices: Object.keys(nextPrices).length ? nextPrices : undefined,
    });
  };

  return (
    <div className="consult-types-list">
      {rows.map((row) => {
        const visible = !hidden.includes(row.id);
        return (
          <div key={row.id} className={`consult-type-row${visible ? " visible" : ""}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ColorPalettePicker
              value={row.color}
              title={t("settings.typeColor")}
              onChange={(c) => row.builtin ? setBuiltinOverride(row.id, { color: c }) : setCustom(row.id, { color: c })}
            />
            <input
              className="form-input"
              value={row.label}
              onChange={(e) => row.builtin ? setBuiltinOverride(row.id, { label: e.target.value }) : setCustom(row.id, { label: e.target.value })}
              style={{ flex: 1, minWidth: 0, color: visible ? "var(--text)" : "var(--tertiary)" }}
            />
            <span className="consult-type-price" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                className="form-input"
                type="number" min="0" step="10"
                style={{ width: 84, textAlign: "right" }}
                placeholder={t("settings.pricePlaceholder")}
                value={prices[row.id] ?? ""}
                onChange={(e) => setPrice(row.id, e.target.value)}
              />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>MAD</span>
            </span>
            <button
              type="button"
              onClick={() => toggleHidden(row.id)}
              title={visible ? t("settings.typeVisible") : t("settings.typeHidden")}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "var(--muted)", flexShrink: 0 }}
            >
              {visible ? t("settings.typeVisible") : t("settings.typeHidden")}
            </button>
            {!row.builtin && (
              <button
                type="button"
                onClick={() => removeCustom(row.id)}
                title={t("common.delete")}
                style={{ background: "none", border: "none", color: "var(--coral)", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn-ghost" style={{ fontSize: 13, alignSelf: "flex-start", marginTop: 4 }} onClick={addCustom}>
        + {t("settings.addType")}
      </button>
      {hidden.length > 0 && (
        <div className="consult-types-hint">
          {t("settings.typesHiddenCount", { n: hidden.length })}
        </div>
      )}
      <div className="consult-types-hint">{t("settings.priceHint")}</div>
    </div>
  );
}

// ── Agenda labels manager (second differentiation axis) ─────────────────────────

function ApptLabelsSection({
  labels,
  onChange,
}: {
  labels: ApptLabel[];
  onChange: (l: ApptLabel[]) => void;
}) {
  const { t } = useTranslation();
  const setLabel = (id: string, patch: Partial<ApptLabel>) =>
    onChange(labels.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const addLabel = () => {
    const id = "l_" + Math.random().toString(36).slice(2, 8);
    onChange([...labels, { id, label: t("settings.newLabelName"), color: AGENDA_PALETTE[labels.length % AGENDA_PALETTE.length] }]);
  };
  const removeLabel = (id: string) => onChange(labels.filter(l => l.id !== id));
  return (
    <div className="consult-types-list">
      {labels.map((lb) => (
        <div key={lb.id} className="consult-type-row visible" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ColorPalettePicker value={lb.color} title={t("settings.typeColor")} onChange={(c) => setLabel(lb.id, { color: c })} />
          <input className="form-input" value={lb.label} onChange={(e) => setLabel(lb.id, { label: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
          <button type="button" onClick={() => removeLabel(lb.id)} title={t("common.delete")}
            style={{ background: "none", border: "none", color: "var(--coral)", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ fontSize: 13, alignSelf: "flex-start", marginTop: 4 }} onClick={addLabel}>
        + {t("settings.addLabel")}
      </button>
      <div className="consult-types-hint">{t("settings.labelsHint")}</div>
    </div>
  );
}

// ── Agenda days off (weekly closures, public holidays, one-off congés) ─────────

function DaysOffSection({
  doctorProfile,
  onChange,
}: {
  doctorProfile: CabinetDoctorProfile;
  onChange: (p: CabinetDoctorProfile) => void;
}) {
  const { t } = useTranslation();
  const weekly  = doctorProfile.weeklyDaysOff ?? [];
  const custom  = doctorProfile.customDaysOff ?? [];
  const showHol = doctorProfile.showPublicHolidays !== false;
  // Monday-first row; JS getDay() numbers (Sun=0 … Sat=6).
  const DOW: { n: number; key: string }[] = [
    { n: 1, key: "mon" }, { n: 2, key: "tue" }, { n: 3, key: "wed" },
    { n: 4, key: "thu" }, { n: 5, key: "fri" }, { n: 6, key: "sat" }, { n: 0, key: "sun" },
  ];
  const toggleDow = (n: number) => {
    const next = weekly.includes(n) ? weekly.filter(x => x !== n) : [...weekly, n];
    onChange({ ...doctorProfile, weeklyDaysOff: next.length ? next : undefined });
  };
  const [newDate, setNewDate]     = useState("");
  const [newReason, setNewReason] = useState("");
  const addCustom = () => {
    if (!newDate || custom.some(c => c.date === newDate)) return;
    const next = [...custom, { date: newDate, reason: newReason.trim() || undefined }]
      .sort((a, b) => a.date.localeCompare(b.date));
    onChange({ ...doctorProfile, customDaysOff: next });
    setNewDate(""); setNewReason("");
  };
  const removeCustom = (date: string) => {
    const next = custom.filter(c => c.date !== date);
    onChange({ ...doctorProfile, customDaysOff: next.length ? next : undefined });
  };
  return (
    <div className="consult-types-list">
      <label className="form-label">{t("settings.weeklyDaysOff")}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {DOW.map(d => {
          const on = weekly.includes(d.n);
          return (
            <button
              key={d.n}
              type="button"
              className={`btn ${on ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12, padding: "5px 10px", minWidth: 44 }}
              onClick={() => toggleDow(d.n)}
            >{t(`common.dow.${d.key}`)}</button>
          );
        })}
      </div>

      <label className="settings-toggle-row" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={showHol}
          onChange={e => onChange({ ...doctorProfile, showPublicHolidays: e.target.checked ? undefined : false })}
        />
        <span>{t("settings.showHolidays")}</span>
      </label>

      <label className="form-label" style={{ marginTop: 12 }}>{t("settings.customDaysOff")}</label>
      {custom.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {custom.map(c => (
            <div key={c.date} className="consult-type-row visible" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, minWidth: 92 }}>{c.date}</span>
              <span style={{ flex: 1, minWidth: 0, color: "var(--muted)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.reason || t("settings.closed")}</span>
              <button type="button" onClick={() => removeCustom(c.date)} title={t("common.delete")}
                style={{ background: "none", border: "none", color: "var(--coral)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="form-input" type="date" style={{ maxWidth: 170 }} value={newDate} onChange={e => setNewDate(e.target.value)} />
        <input className="form-input" style={{ flex: 1, minWidth: 120 }} placeholder={t("settings.closureReasonPlaceholder")} value={newReason} onChange={e => setNewReason(e.target.value)} />
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} disabled={!newDate} onClick={addCustom}>+ {t("common.add")}</button>
      </div>
      <div className="consult-types-hint">{t("settings.daysOffHint")}</div>
    </div>
  );
}

// ── Acts codes manager ─────────────────────────────────────────────────────────

function ActeCodesSection({
  codes,
  onChange,
}: {
  codes: ActeCode[];
  onChange: (list: ActeCode[]) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode]   = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  const add = () => {
    if (!code.trim() || !label.trim()) return;
    const p = parseFloat(price);
    onChange([...codes, {
      id: `acte_${Date.now()}_${Math.round(performance.now())}`,
      code: code.trim(), label: label.trim(),
      price: Number.isFinite(p) && p > 0 ? p : undefined,
    }]);
    setCode(""); setLabel(""); setPrice("");
  };
  const remove = (id: string) => onChange(codes.filter(c => c.id !== id));

  const normLabel = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const existingLabels = new Set(codes.map(c => normLabel(c.label)));
  const addFromCatalog = (item: { code: string; label: string }) => {
    if (existingLabels.has(normLabel(item.label))) return;
    onChange([...codes, {
      id: `acte_${Date.now()}_${Math.round(performance.now())}`,
      code: item.code, label: item.label,
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" className="btn btn-ghost acte-catalog-btn" onClick={() => setShowCatalog(true)}>
        + {t("acteCatalog.importBtn")}
      </button>
      {codes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {codes.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--blue)", minWidth: 48 }}>{c.code}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <input
                className="form-input"
                type="number" min="0" step="10" placeholder="MAD"
                style={{ width: 90 }}
                value={c.price ?? ""}
                onChange={e => {
                  const p = parseFloat(e.target.value);
                  onChange(codes.map(x => x.id === c.id ? { ...x, price: Number.isFinite(p) && p > 0 ? p : undefined } : x));
                }}
              />
              <button type="button" className="btn btn-danger-ghost" style={{ padding: "2px 8px" }} onClick={() => remove(c.id)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input className="form-input" style={{ width: 90 }} placeholder={t("settings.acteCodeCol")}
          value={code} onChange={e => setCode(e.target.value)} />
        <input className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder={t("settings.acteLabelCol")}
          value={label} onChange={e => setLabel(e.target.value)} />
        <input className="form-input" style={{ width: 90 }} type="number" min="0" step="10" placeholder="MAD"
          value={price} onChange={e => setPrice(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={add}>{t("common.add")}</button>
      </div>

      {showCatalog && (
        <ActeCatalogModal
          existingLabels={existingLabels}
          onAdd={addFromCatalog}
          onClose={() => setShowCatalog(false)}
        />
      )}
    </div>
  );
}

// ── Document format settings ────────────────────────────────────────────────────

function DocumentPreview({ s, doc }: { s: DocumentSettings; doc: CabinetDoctorProfile }) {
  const { t } = useTranslation();
  const name = doc.fullName?.trim() ? `Dr. ${doc.fullName}` : t("profile.fullNamePlaceholder");
  const idChips: string[] = [];
  if (s.showInpe && doc.inpe) idChips.push(`INPE ${doc.inpe}`);
  if (s.showIce && doc.ice)   idChips.push(`ICE ${doc.ice}`);
  if (s.showRib && doc.rib)   idChips.push(`RIB ${doc.rib}`);
  const layout = s.layout ?? "classic";
  const typo = docTypography(s);
  return (
    <div className="form-group">
      <label className="form-label">{t("settings.docPreview")}</label>
      <div className={`docpv docpv-${layout}`} aria-hidden style={{ fontFamily: typo.family }}>
        {layout === "letterhead" && <div className="docpv-band" style={{ background: typo.accent }} />}
        <div className="docpv-head">
          <div className="docpv-name" style={{ color: typo.accent }}>{name}</div>
          {doc.specialtyLabel && <div className="docpv-spec">{doc.specialtyLabel}</div>}
          {(doc.address || doc.phone) && (
            <div className="docpv-contact">
              {[doc.address, doc.phone].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        {s.headerNote && <div className="docpv-note">{s.headerNote}</div>}
        <div className="docpv-body">
          <span className="docpv-line" style={{ width: "55%" }} />
          <span className="docpv-line" style={{ width: "82%" }} />
          <span className="docpv-line" style={{ width: "70%" }} />
        </div>
        {(idChips.length > 0 || s.footerNote) && (
          <div className="docpv-foot">
            {s.footerNote && <div className="docpv-footnote">{s.footerNote}</div>}
            {idChips.length > 0 && (
              <div className="docpv-ids">
                {idChips.map(c => <span key={c} className="docpv-chip">{c}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{t("settings.docPreviewHint")}</div>
    </div>
  );
}

function DocumentSettingsSection({
  settings,
  onChange,
}: {
  settings: DocumentSettings;
  onChange: (s: DocumentSettings) => void;
}) {
  const { t } = useTranslation();
  const { doctorProfile } = useCabinet();
  const s = { ...DEFAULT_DOCUMENT_SETTINGS, ...settings };
  const set = (patch: Partial<DocumentSettings>) => onChange({ ...s, ...patch });
  const LAYOUTS: DocumentLayout[] = ["classic", "compact", "letterhead"];
  // Every printable document, so the doctor can pick simple vs advanced per doc.
  const DOC_KINDS_LIST: DocKind[] = [
    "ordonnance", "facture", "certificate", "examRequest", "receipt",
    "compteRendu", "rapportMedical", "report", "payroll",
  ];
  const setMode = (kind: DocKind, mode: "simple" | "advanced") =>
    set({ docMode: { ...s.docMode, [kind]: mode } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── STEP 1 — Simple built-in style (shared by every document) ── */}
      <div>
        <div className="secretary-info-title">{t("settings.docSimpleTitle")}</div>
        <div className="secretary-info-desc" style={{ marginBottom: 10 }}>{t("settings.docSimpleDesc")}</div>
        <DocumentPreview s={s} doc={doctorProfile} />
        <div className="form-group" style={{ marginTop: 10 }}>
          <label className="form-label">{t("settings.docLayout")}</label>
          <select className="form-select" value={s.layout} onChange={e => set({ layout: e.target.value as DocumentLayout })}>
            {LAYOUTS.map(l => <option key={l} value={l}>{DOCUMENT_LAYOUT_LABELS[l]}</option>)}
          </select>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{t("settings.docLayoutHint")}</div>
        </div>
        {/* Document-wide typography — font, size, accent colour (applies to every doc). */}
        <div className="form-row" style={{ marginBottom: 8 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">{t("settings.docFont", { defaultValue: "Police" })}</label>
            <select className="form-select" value={s.fontFamily ?? "serif"} onChange={e => set({ fontFamily: e.target.value as DocumentSettings["fontFamily"] })}>
              <option value="serif">Times (classique)</option>
              <option value="sans">Arial</option>
              <option value="georgia">Georgia</option>
              <option value="condensed">Condensé</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">{t("settings.docTextSize", { defaultValue: "Taille du texte" })}</label>
            <select className="form-select" value={String(s.fontScale ?? 1)} onChange={e => set({ fontScale: Number(e.target.value) })}>
              <option value="0.9">{t("settings.docSizeCompact", { defaultValue: "Compact" })}</option>
              <option value="1">{t("settings.docSizeNormal", { defaultValue: "Normal" })}</option>
              <option value="1.1">{t("settings.docSizeLarge", { defaultValue: "Grand" })}</option>
            </select>
          </div>
          <div className="form-group" style={{ width: 84 }}>
            <label className="form-label">{t("settings.docAccent", { defaultValue: "Couleur" })}</label>
            <input type="color" className="form-input" style={{ height: 38, padding: 2, cursor: "pointer" }}
              value={s.accentColor ?? "#0A4E7E"} onChange={e => set({ accentColor: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {([["showInpe", "INPE"], ["showIce", "ICE"], ["showRib", "RIB"]] as [keyof DocumentSettings, string][]).map(([k, lbl]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={!!s[k]} onChange={e => set({ [k]: e.target.checked })} />
              <span>{t("settings.docShow", { field: lbl })}</span>
            </label>
          ))}
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label">{t("settings.docHeaderNote")}</label>
          <input className="form-input" value={s.headerNote ?? ""} onChange={e => set({ headerNote: e.target.value || undefined })}
            placeholder={t("settings.docHeaderNotePlaceholder")} />
        </div>
        <div className="form-group">
          <label className="form-label">{t("settings.docFooterNote")}</label>
          <input className="form-input" value={s.footerNote ?? ""} onChange={e => set({ footerNote: e.target.value || undefined })}
            placeholder={t("settings.docFooterNotePlaceholder")} />
        </div>
      </div>

      {/* ── STEP 2 — Per-document choice: simple built-in OR advanced layout ── */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div className="secretary-info-title">{t("settings.docModeTitle")}</div>
        <div className="secretary-info-desc" style={{ marginBottom: 10 }}>{t("settings.docModeDesc")}</div>
        <div className="doc-mode-list">
          {DOC_KINDS_LIST.map(kind => {
            const mode = docModeForKind(s, kind);
            return (
              <div key={kind} className="doc-mode-row">
                <span className="doc-mode-label">{t(`settings.pd.kind_${kind}`)}</span>
                <div className="doc-mode-toggle">
                  {(["simple", "advanced"] as const).map(m => (
                    <button key={m} type="button"
                      className={`doc-mode-btn${mode === m ? " active" : ""}`}
                      onClick={() => setMode(kind, m)}>
                      {t(`settings.docMode_${m}`)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP 3 — Exact preview + advanced layout editor ── */}
      {/* PageDesigner shows an exact, to-scale preview for EVERY document (real
          size + text positions). Simple documents are read-only here (with a
          "customise" button); documents set to Avancé are fully editable. */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div className="secretary-info-title" style={{ marginBottom: 2 }}>{t("settings.docPreviewExactTitle")}</div>
        <div className="secretary-info-desc" style={{ marginBottom: 10 }}>{t("settings.docPreviewExactDesc")}</div>
        <PageDesigner settings={s} doctorProfile={doctorProfile} onChange={onChange} />
      </div>
    </div>
  );
}

// ── Custom medications manager ─────────────────────────────────────────────────

function CustomDrugsSection({
  customDrugs,
  onChange,
}: {
  customDrugs: string[];
  onChange: (drugs: string[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");

  const allBuiltin = new Set(COMMON_DRUGS.map(d => d.toLowerCase()));

  const handleAdd = () => {
    const val = input.trim();
    if (!val) return;
    if (customDrugs.some(d => d.toLowerCase() === val.toLowerCase())) return;
    onChange([...customDrugs, val]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
  };

  return (
    <div>
      {/* Built-in list (read-only preview) */}
      <div className="drug-builtin-info">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {t("settings.drugsBuiltin", { n: COMMON_DRUGS.length })}
      </div>

      {/* Custom drugs list */}
      {customDrugs.length > 0 && (
        <div className="drug-custom-list">
          {customDrugs.map((d, i) => (
            <div key={i} className="drug-custom-row">
              <span className="drug-custom-name">{d}</span>
              {allBuiltin.has(d.toLowerCase()) && (
                <span className="drug-duplicate-badge">{t("settings.drugsDuplicate")}</span>
              )}
              <button
                className="drug-custom-remove"
                onClick={() => onChange(customDrugs.filter((_, j) => j !== i))}
                title={t("common.delete")}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add input */}
      <div className="drug-add-row">
        <input
          className="form-input"
          placeholder={t("settings.drugsAddPlaceholder")}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          list="drug-add-list"
        />
        <datalist id="drug-add-list">
          {COMMON_DRUGS.map(d => <option key={d} value={d} />)}
        </datalist>
        <button
          className="btn btn-primary"
          disabled={!input.trim()}
          onClick={handleAdd}
        >
          {t("common.add")}
        </button>
      </div>
    </div>
  );
}

// ── Security & privacy (reassurance card) ───────────────────────────────────────

function SecuritySection() {
  const { t } = useTranslation();
  const ICONS: Record<string, React.ReactNode> = {
    enc: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="13" r="1.3" fill="currentColor" />
      </svg>
    ),
    tls: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 2.5 4 5v4.2c0 3.7 2.5 6.4 6 8.3 3.5-1.9 6-4.6 6-8.3V5l-6-2.5Z"
          stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M7.5 10l1.8 1.8L13 8.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    access: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="7.5" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 8h7M14 8v2.5M16.5 8v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    own: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 3v9m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  };
  const ROWS: { key: string; title: string; desc: string }[] = [
    { key: "enc",    title: t("settings.secEncTitle"),    desc: t("settings.secEncDesc") },
    { key: "tls",    title: t("settings.secTlsTitle"),    desc: t("settings.secTlsDesc") },
    { key: "access", title: t("settings.secAccessTitle"), desc: t("settings.secAccessDesc") },
    { key: "own",    title: t("settings.secOwnTitle"),    desc: t("settings.secOwnDesc") },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ROWS.map((r) => (
        <div key={r.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 9,
              display: "grid", placeItems: "center",
              background: "var(--green-soft, rgba(21,168,118,.12))",
              color: "var(--green, #15A876)",
            }}
          >
            {ICONS[r.key]}
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45, marginTop: 2 }}>{r.desc}</div>
          </div>
        </div>
      ))}
      <div className="invite-code-hint" style={{ marginTop: 2 }}>{t("settings.secFooter")}</div>
    </div>
  );
}

// ── Import preview ─────────────────────────────────────────────────────────────

interface ImportPreview {
  raw:           string;
  appointments:  number;
  patients:      number;
  employees:     number;
  examResults:   number;
  prescriptions: number;
  certificates:  number;
  teleSessions:  number;
  exportedAt?:   string;
}

function count(d: Record<string, unknown>, key: string): number {
  return Array.isArray(d[key]) ? (d[key] as unknown[]).length : 0;
}

function parsePreview(json: string): ImportPreview {
  const d = JSON.parse(json) as Record<string, unknown>;
  return {
    raw:           json,
    appointments:  count(d, "appointments"),
    patients:      count(d, "patients"),
    employees:     count(d, "employees"),
    examResults:   count(d, "examResults"),
    prescriptions: count(d, "prescriptions"),
    certificates:  count(d, "certificates"),
    teleSessions:  count(d, "teleSessions"),
    exportedAt:    typeof d.exportedAt === "string" ? d.exportedAt : undefined,
  };
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ParametresPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  // Deep-link support: /parametres?section=backup (from dashboard storage /
  // backup alerts) lands on the Settings tab with the Backup section open.
  const [searchParams] = useSearchParams();
  const focusSection = searchParams.get("section");
  useEffect(() => {
    if (!focusSection) return;
    const el = document.getElementById(`settings-${focusSection}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusSection]);
  const {
    appointments, patients, employees,
    examResults, prescriptions, certificates, teleSessions,
    doctorProfile, setDoctorProfile, setSecretaryMode,
    exportCabinetJSON, importCabinetJSON,
    clearAppointments, clearPatients,
    listCabinetBackups, restoreCabinetBackup,
  } = useCabinet();
  const { user, transactions, exportFinancesJSON, importFinancesJSON } = useApp();
  const navigate = useNavigate();

  const { dark, toggle } = useDarkMode();
  const { canInstall, installed, install } = useInstallPWA();

  const fileRef     = useRef<HTMLInputElement>(null);
  const finFileRef  = useRef<HTMLInputElement>(null);

  const [preview,   setPreview]   = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState<"appointments" | "patients" | null>(null);

  const showToast = useToast();

  // ── Demonstration data (demo account only) ──────────────────────────────────
  const demoAccount = isDemoAccount(user?.email);
  const [demoBusy, setDemoBusy] = useState(false);
  const loadDemoData = async () => {
    if (!await confirmDialog(t("settings.demoLoadConfirm"))) return;
    setDemoBusy(true);
    try {
      const { cabinetJSON, financesJSON, summary } = generateDemoData();
      importCabinetJSON(cabinetJSON);
      importFinancesJSON(financesJSON);
      showToast(t("settings.demoLoaded", { summary }));
    } finally { setDemoBusy(false); }
  };
  const clearDemoData = async () => {
    if (!await confirmDialog(t("settings.demoClearConfirm"))) return;
    setDemoBusy(true);
    try {
      importCabinetJSON(EMPTY_CABINET_JSON);
      importFinancesJSON(EMPTY_FINANCES_JSON);
      showToast(t("settings.demoCleared"));
    } finally { setDemoBusy(false); }
  };

  // ── Persistent secretary accounts (username + password, revocable) ──────────
  const [secAccts, setSecAccts] = useState<SecretaryAccount[]>([]);
  const [acctForm, setAcctForm] = useState({ username: "", password: "", name: "" });
  const [acctBusy, setAcctBusy] = useState(false);
  // The plaintext credentials are only knowable at creation time — keep them
  // visible in a one-time share card until the doctor dismisses it.
  const [lastCreated, setLastCreated] = useState<{ username: string; password: string; name: string } | null>(null);

  useEffect(() => { secretaryAccountList().then(setSecAccts).catch(() => {}); }, []);

  const acctUsernameNorm = acctForm.username.trim().toLowerCase();
  const acctValid = acctUsernameNorm.length >= 3 && acctForm.password.length >= 6;

  const generateAcctPassword = () => {
    // Readable, unambiguous charset (no O/0/I/l/1) the doctor can dictate aloud.
    const charset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(10);
    crypto.getRandomValues(bytes);
    const pw = Array.from(bytes, b => charset[b % charset.length]).join("");
    setAcctForm(f => ({ ...f, password: pw }));
  };

  const handleCreateAccount = async () => {
    const username = acctUsernameNorm;
    if (!acctValid) {
      showToast(t("settings.acctValidation"), "error");
      return;
    }
    setAcctBusy(true);
    try {
      const name = acctForm.name.trim();
      const acct = await secretaryAccountCreate({ username, password: acctForm.password, name: name || undefined });
      setSecAccts(prev => [acct, ...prev]);
      setLastCreated({ username, password: acctForm.password, name });
      setAcctForm({ username: "", password: "", name: "" });
      showToast(t("settings.acctCreated"));
    } catch (err) {
      showToast((err as Error).message || t("settings.acctError"), "error");
    } finally {
      setAcctBusy(false);
    }
  };
  const handleCopyCreds = () => {
    if (!lastCreated) return;
    const text = `${t("settings.acctUsername")}: ${lastCreated.username}\n${t("settings.acctPassword")}: ${lastCreated.password}`;
    navigator.clipboard?.writeText(text).then(() => showToast(t("settings.acctCredsCopied")), () => {});
  };
  const handleRevokeAccount = async (id: string) => {
    if (!await confirmDialog(t("settings.acctRevokeConfirm"))) return;
    try {
      await secretaryAccountRevoke(id);
      setSecAccts(prev => prev.map(a => a.id === id ? { ...a, revoked: true } : a));
      showToast(t("settings.acctRevoked"));
    } catch (err) {
      showToast((err as Error).message || t("settings.acctError"), "error");
    }
  };

  const handlePurgeAccount = async (id: string) => {
    if (!await confirmDialog(t("settings.acctPurgeConfirm", { defaultValue: "Supprimer définitivement ce compte révoqué ?" }))) return;
    try {
      await secretaryAccountPurge(id);
      setSecAccts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      showToast((err as Error).message || t("settings.acctError"), "error");
    }
  };

  // ── Automatic backups ──────────────────────────────────────────────────────
  const [backups,        setBackups]        = useState<CabinetBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [restoringId,    setRestoringId]    = useState<string | null>(null);

  const refreshBackups = () => {
    setBackupsLoading(true);
    listCabinetBackups()
      .then(setBackups)
      .catch(() => setBackups([]))
      .finally(() => setBackupsLoading(false));
  };
  useEffect(() => { refreshBackups(); /* eslint-disable-next-line */ }, []);

  const handleRestore = async (b: CabinetBackup) => {
    if (!await confirmDialog(t("settings.restoreConfirm", { date: new Date(b.createdAt).toLocaleString() }))) return;
    setRestoringId(b.id);
    try {
      await restoreCabinetBackup(b.id);
      showToast(t("settings.restoreDone"));
      refreshBackups();
    } catch (err) {
      showToast((err as Error).message || t("settings.restoreError"), "error");
    } finally {
      setRestoringId(null);
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const json = exportCabinetJSON();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(json, `blackpine-cabinet-${date}.json`);
    showToast(t("settings.savedBackup"));
  };

  const handleFinancesExport = () => {
    const json = exportFinancesJSON();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(json, `blackpine-finances-${date}.json`);
    showToast(t("settings.savedFinances"));
  };

  const handleFinancesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        importFinancesJSON(ev.target?.result as string);
        showToast(t("settings.importedFinances"));
      } catch {
        showToast(t("settings.jsonError"), "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = parsePreview(ev.target?.result as string);
        setPreview(p);
      } catch {
        showToast(t("settings.jsonError"), "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    if (!preview) return;
    setImporting(true);
    try {
      importCabinetJSON(preview.raw);
      setPreview(null);
      showToast(t("settings.importedSuccess", { appts: preview.appointments, patients: preview.patients }));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setImporting(false);
    }
  };

  // ── Clear ───────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (confirmClear === "appointments") {
      clearAppointments();
      showToast(t("settings.clearApptsDone"));
    } else if (confirmClear === "patients") {
      clearPatients();
      showToast(t("settings.clearPatientsDone"));
    }
    setConfirmClear(null);
  };

  return (
    <Layout title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <div className="settings-page">

        {/* ── Données de démonstration (compte démo uniquement) ── */}
        {demoAccount && (
          <Section icon="security" title={t("settings.demoTitle")} subtitle={t("settings.demoSub")} defaultOpen>
            <div className="settings-secretary-info">
              <div className="settings-secretary-info-row">
                <span className="secretary-info-icon">🎬</span>
                <div>
                  <div className="secretary-info-title">{t("settings.demoTitle")}</div>
                  <div className="secretary-info-desc">{t("settings.demoDesc")}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button className="btn btn-primary" disabled={demoBusy} onClick={loadDemoData}>
                {t("settings.demoLoad")}
              </button>
              <button className="btn btn-ghost" style={{ color: "var(--coral)", borderColor: "var(--coral)" }} disabled={demoBusy} onClick={clearDemoData}>
                {t("settings.demoClear")}
              </button>
            </div>
          </Section>
        )}

        {/* ── Sécurité & confidentialité ── */}
        <div className="settings-category">{t("settings.catAccount")}</div>
        <Section icon="security" title={t("settings.securityTitle")} subtitle={t("settings.securitySub")} defaultOpen>
          <SecuritySection />
        </Section>

        {/* ── Verrouillage de l'application (code d'accès) ── */}
        <Section icon="appLock" title={t("settings.appLockTitle")} subtitle={t("settings.appLockSub")}>
          <AppLockSection t={t} showToast={showToast} />
        </Section>

        {/* ── Abonnement & tarifs ── */}
        <Section icon="subscription" title={t("settings.subTitle")} subtitle={t("settings.subSub")}>
          <SubscriptionSection />
        </Section>

        {/* ── Apparence ── */}
        <div className="settings-category">{t("settings.catCabinet")}</div>
        <Section icon="appearance" title={t("settings.appearance")} subtitle={t("settings.appearanceSub")}>
          <SettingsRow
            label={t("settings.darkTheme")}
            hint={t("settings.darkHint")}
          >
            <div className="settings-theme-row">
              <span className="settings-theme-label">{dark ? t("common.darkMode") : t("common.lightMode")}</span>
              <DarkToggle dark={dark} toggle={toggle} />
            </div>
          </SettingsRow>
          <WebPushRow />
        </Section>

        {/* ── Emplacements du cabinet ── */}
        <Section
          icon="locations"
          title={t("settings.locations")}
          subtitle={t("settings.locationsSub")}
        >
          <LocationsSection
            locations={doctorProfile?.locations ?? []}
            onChange={locs => setDoctorProfile({ ...doctorProfile, locations: locs })}
          />
        </Section>

        {/* ── Types de consultation ── */}
        <Section
          icon="consultationTypes"
          title={t("settings.consultationTypes")}
          subtitle={t("settings.consultationTypesSub")}
        >
          <ConsultationTypesSection
            profile={doctorProfile}
            onChange={setDoctorProfile}
          />
        </Section>

        {/* ── Étiquettes d'agenda (2e axe de différenciation) ── */}
        <Section
          icon="consultationTypes"
          title={t("settings.apptLabels")}
          subtitle={t("settings.apptLabelsSub")}
        >
          <ApptLabelsSection
            labels={doctorProfile?.apptLabels ?? []}
            onChange={l => setDoctorProfile({ ...doctorProfile, apptLabels: l.length ? l : undefined })}
          />
        </Section>

        {/* ── Médicaments personnalisés ── */}
        <Section
          icon="customDrugs"
          title={t("settings.customDrugs")}
          subtitle={t("settings.customDrugsSub")}
        >
          <CustomDrugsSection
            customDrugs={doctorProfile?.customDrugs ?? []}
            onChange={drugs => setDoctorProfile({ ...doctorProfile, customDrugs: drugs })}
          />
        </Section>

        {/* ── Codes des actes ── */}
        <Section
          icon="acteCodes"
          title={t("settings.acteCodesTitle")}
          subtitle={t("settings.acteCodesSub")}
        >
          <ActeCodesSection
            codes={doctorProfile?.acteCodes ?? []}
            onChange={list => setDoctorProfile({ ...doctorProfile, acteCodes: list.length ? list : undefined })}
          />
        </Section>

        {/* ── Format des documents ── */}
        <Section
          icon="docFormat"
          title={t("settings.docFormatTitle")}
          subtitle={t("settings.docFormatSub")}
        >
          <DocumentSettingsSection
            settings={doctorProfile?.documentSettings ?? DEFAULT_DOCUMENT_SETTINGS}
            onChange={s => setDoctorProfile({ ...doctorProfile, documentSettings: s })}
          />
        </Section>

        {/* ── Réservation en ligne ── */}
        <div className="settings-category">{t("settings.catAgenda")}</div>
        <Section
          icon="booking"
          title={t("settings.bookingTitle")}
          subtitle={t("settings.bookingSubtitle")}
        >
          <OnlineBookingSection doctorProfile={doctorProfile} t={t} showToast={showToast} />
        </Section>

        {/* ── Jours de congé & fériés ── */}
        <Section
          icon="daysoff"
          title={t("settings.daysOffTitle")}
          subtitle={t("settings.daysOffSubtitle")}
        >
          <DaysOffSection doctorProfile={doctorProfile} onChange={setDoctorProfile} />
        </Section>

        {/* ── Rappels SMS automatiques ── */}
        <Section
          icon="sms"
          title={t("settings.smsTitle")}
          subtitle={t("settings.smsSubtitle")}
        >
          <SmsRemindersSection t={t} showToast={showToast} />
        </Section>

        {/* ── Mode secrétaire ── */}
        <div className="settings-category">{t("settings.catTeam")}</div>
        <Section
          icon="secretary"
          title={t("settings.secretaryMode")}
          subtitle={t("settings.secretaryModeSub")}
        >
          <div className="settings-secretary-info">
            <div className="settings-secretary-info-row">
              <span className="secretary-info-icon">👤</span>
              <div>
                <div className="secretary-info-title">{t("settings.secretaryAccess")}</div>
                <div className="secretary-info-desc">{t("settings.secretaryDesc")}</div>
              </div>
            </div>
          </div>

          <SecretaryPermissionsSection
            perms={doctorProfile?.secretaryPermissions ?? DEFAULT_SECRETARY_PERMISSIONS}
            onChange={(p) => setDoctorProfile({ ...doctorProfile, secretaryPermissions: p })}
          />

          {/* Secretary preview — the doctor sees exactly what a secretary can
              access, from their own account (no PIN). Lives here, not in the
              sidebar. Exit via the banner shown while previewing. */}
          <div className="settings-secretary-info" style={{ marginTop: 14 }}>
            <div className="settings-secretary-info-row">
              <span className="secretary-info-icon">👁️</span>
              <div style={{ flex: 1 }}>
                <div className="secretary-info-title">{t("settings.secretaryPreviewTitle")}</div>
                <div className="secretary-info-desc">{t("settings.secretaryPreviewHint")}</div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ flexShrink: 0, fontSize: 13 }}
                onClick={() => { setSecretaryMode(true); navigate("/agenda"); }}
              >
                {t("sidebar.secretaryEnter")}
              </button>
            </div>
          </div>

          {/* ── Remote secretary login (separate device) ── */}
          <div className="settings-secretary-info" style={{ marginTop: 18 }}>
            <div className="settings-secretary-info-row">
              <span className="secretary-info-icon">🔗</span>
              <div>
                <div className="secretary-info-title">{t("settings.remoteSecretary")}</div>
                <div className="secretary-info-desc">{t("settings.remoteSecretaryDesc")}</div>
              </div>
            </div>
          </div>

          {/* ── Persistent secretary accounts ── */}
          <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="secretary-info-title" style={{ marginBottom: 4 }}>{t("settings.acctTitle")}</div>
            <div className="secretary-info-desc" style={{ marginBottom: 12 }}>{t("settings.acctDesc")}</div>

            {secAccts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {secAccts.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface-alt)", borderRadius: 8, opacity: a.revoked ? 0.55 : 1 }}>
                    <span style={{ fontSize: 16 }}>👤</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{a.name || a.username}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>@{a.username}{a.revoked ? ` · ${t("settings.acctRevokedTag")}` : ""}</div>
                    </div>
                    {!a.revoked
                      ? <button className="btn btn-danger-ghost" onClick={() => handleRevokeAccount(a.id)}>{t("settings.acctRevoke")}</button>
                      : <button className="btn btn-ghost" title={t("common.delete")} onClick={() => handlePurgeAccount(a.id)} aria-label={t("common.delete")}>×</button>
                    }
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label className="form-label">{t("settings.acctUsername")}</label>
                <input className="form-input" value={acctForm.username} autoCapitalize="none"
                  onChange={e => setAcctForm(f => ({ ...f, username: e.target.value }))} placeholder="Identifiant de connexion" />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label className="form-label">{t("settings.acctName")}</label>
                <input className="form-input" value={acctForm.name}
                  onChange={e => setAcctForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom de la secrétaire" />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <label className="form-label">{t("settings.acctPassword")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="form-input" type="text" value={acctForm.password} style={{ flex: 1, minWidth: 0 }}
                    onChange={e => setAcctForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" />
                  <button type="button" className="btn btn-ghost" onClick={generateAcctPassword} style={{ flexShrink: 0 }}>
                    {t("settings.acctGenerate")}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleCreateAccount} disabled={acctBusy || !acctValid}>
                {acctBusy ? t("settings.acctCreating") : t("settings.acctCreate")}
              </button>
            </div>

            {lastCreated && (
              <div className="invite-code-box" style={{ marginTop: 12 }}>
                <div className="secretary-info-title" style={{ marginBottom: 6 }}>✅ {t("settings.acctShareTitle")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, marginBottom: 8 }}>
                  <div><span style={{ color: "var(--muted)" }}>{t("settings.acctUsername")}:</span>{" "}
                    <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>{lastCreated.username}</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>{t("settings.acctPassword")}:</span>{" "}
                    <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>{lastCreated.password}</strong></div>
                </div>
                <div className="invite-code-hint" style={{ marginBottom: 10 }}>{t("settings.acctShareNote")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleCopyCreds}>{t("settings.acctCopyCreds")}</button>
                  <button className="btn btn-ghost" onClick={() => setLastCreated(null)}>{t("settings.acctDismiss")}</button>
                </div>
              </div>
            )}

            <div className="invite-code-hint" style={{ marginTop: 8 }}>{t("settings.acctShareHint")}</div>
          </div>
        </Section>

        {/* ── Sauvegarde & Restauration ── */}
        <div id="settings-backup">
        <div className="settings-category">{t("settings.catData")}</div>
        <Section
          icon="backup"
          title={t("settings.backup")}
          subtitle={t("settings.backupSub")}
          defaultOpen={focusSection === "backup"}
        >
          {/* Summary */}
          <div className="settings-data-summary">
            <div className="settings-data-stat">
              <div className="settings-data-val">{patients.length}</div>
              <div className="settings-data-lbl">{t("settings.patients")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{appointments.length}</div>
              <div className="settings-data-lbl">{t("settings.appointments")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{examResults.length}</div>
              <div className="settings-data-lbl">{t("settings.exams")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{prescriptions.length}</div>
              <div className="settings-data-lbl">{t("settings.prescriptions")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{certificates.length}</div>
              <div className="settings-data-lbl">{t("settings.certificates")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{teleSessions.length}</div>
              <div className="settings-data-lbl">{t("settings.teleconsults")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{transactions.length}</div>
              <div className="settings-data-lbl">{t("settings.transactions")}</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{employees.length}</div>
              <div className="settings-data-lbl">{t("settings.employees")}</div>
            </div>
          </div>

          {/* ── Automatic backups ── */}
          <div className="autobackup-block">
            <div className="autobackup-head">
              <div>
                <div className="autobackup-title">{t("settings.autoBackups")}</div>
                <div className="autobackup-sub">{t("settings.autoBackupsSub")}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={refreshBackups} disabled={backupsLoading}>
                {t("common.refresh")}
              </button>
            </div>
            {backupsLoading ? (
              <div className="autobackup-empty">{t("common.loading")}</div>
            ) : backups.length === 0 ? (
              <div className="autobackup-empty">{t("settings.autoBackupsEmpty")}</div>
            ) : (
              <div className="autobackup-list">
                {backups.map(b => (
                  <div key={b.id} className="autobackup-row">
                    <div className="autobackup-row-info">
                      <span className="autobackup-row-date">{new Date(b.createdAt).toLocaleString()}</span>
                      {b.reason === "pre-restore" && (
                        <span className="autobackup-row-tag">{t("settings.backupPreRestore")}</span>
                      )}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRestore(b)}
                      disabled={restoringId !== null}
                    >
                      {restoringId === b.id ? t("settings.restoring") : t("settings.restore")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SettingsRow
            label={t("settings.exportCabinet")}
            hint={t("settings.exportCabinetHint")}
          >
            <button className="btn btn-primary settings-action-btn" onClick={handleExport}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cabinet.json
            </button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.exportFinances")}
            hint={t("settings.exportFinancesHint")}
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={handleFinancesExport}
              disabled={transactions.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Finances.json
            </button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.exportPatientsCsv")}
            hint={t("settings.exportPatientsCsvHint")}
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={() => { exportPatientsCsv(patients); showToast(t("settings.exportedPatients")); }}
              disabled={patients.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Patients.csv
            </button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.exportApptsCsv")}
            hint={t("settings.exportApptsCsvHint")}
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={() => { exportAppointmentsCsv(appointments); showToast(t("settings.exportedAppts")); }}
              disabled={appointments.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Rendez-vous.csv
            </button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.exportAgendaIcs")}
            hint={t("settings.exportAgendaIcsHint")}
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={() => {
                const calName = doctorProfile?.fullName
                  ? `Cabinet Dr. ${doctorProfile.fullName}`
                  : "Blackpine";
                exportAgendaIcal(appointments, calName);
                showToast(t("settings.exportedIcal"));
              }}
              disabled={appointments.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 2V1M10 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M7 9V7M5.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Agenda.ics
            </button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.importCabinet")}
            hint={t("settings.importCabinetHint")}
          >
            <>
              <button
                className="btn btn-ghost settings-action-btn"
                onClick={() => fileRef.current?.click()}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                  <path d="M7 10V2M4 5l3-3 3 3M2 12h10"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("settings.restoreCabinet")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </>
          </SettingsRow>

          <SettingsRow
            label={t("settings.importFinances")}
            hint={t("settings.importFinancesHint")}
          >
            <>
              <button
                className="btn btn-ghost settings-action-btn"
                onClick={() => finFileRef.current?.click()}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                  <path d="M7 10V2M4 5l3-3 3 3M2 12h10"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("settings.restoreFinances")}
              </button>
              <input
                ref={finFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFinancesFileChange}
              />
            </>
          </SettingsRow>

          {/* Import preview */}
          {preview && (
            <div className="settings-import-preview">
              <div className="settings-import-title">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {t("settings.importPreviewTitle")}
              </div>
              <div className="settings-import-stats">
                <span><strong>{preview.patients}</strong> {t("settings.patients")}</span>
                <span><strong>{preview.appointments}</strong> {t("settings.appointments")}</span>
                {preview.examResults   > 0 && <span><strong>{preview.examResults}</strong> {t("settings.exams")}</span>}
                {preview.prescriptions > 0 && <span><strong>{preview.prescriptions}</strong> {t("settings.prescriptions")}</span>}
                {preview.certificates  > 0 && <span><strong>{preview.certificates}</strong> {t("settings.certificates")}</span>}
                {preview.teleSessions  > 0 && <span><strong>{preview.teleSessions}</strong> {t("settings.teleconsults")}</span>}
                {preview.employees     > 0 && <span><strong>{preview.employees}</strong> {t("settings.employees")}</span>}
                {preview.exportedAt && (
                  <span style={{ color: "var(--muted)" }}>
                    {t("settings.savedAt", { date: new Date(preview.exportedAt).toLocaleDateString(locale) })}
                  </span>
                )}
              </div>
              <div className="settings-import-warning">
                {t("settings.importPreviewWarn")}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setPreview(null)}>
                  {t("common.cancel")}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImportConfirm}
                  disabled={importing}
                >
                  {importing ? t("settings.importing") : t("settings.importConfirm")}
                </button>
              </div>
            </div>
          )}
        </Section>
        </div>

        {/* ── Zone de danger ── */}
        <Section
          icon="clearData"
          title={t("settings.clearData")}
          subtitle={t("settings.clearDataSub")}
        >
          <SettingsRow
            label={t("settings.clearAppts")}
            hint={t("settings.clearApptHint", { n: appointments.length })}
          >
            <button
              className="btn settings-danger-btn"
              onClick={() => setConfirmClear("appointments")}
              disabled={appointments.length === 0}
            >
              {t("settings.clearApptsBtnLabel")}
            </button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.clearPatients")}
            hint={t("settings.clearPatientHint", { n: patients.length })}
          >
            <button
              className="btn settings-danger-btn"
              onClick={() => setConfirmClear("patients")}
              disabled={patients.length === 0}
            >
              {t("settings.clearPatientsBtnLabel")}
            </button>
          </SettingsRow>
        </Section>

        {/* ── Application mobile / PWA ── */}
        <div className="settings-category">{t("settings.catApp")}</div>
        <Section
          icon="installApp"
          title={t("settings.installApp")}
          subtitle={t("settings.installAppSub")}
        >
          {installed ? (
            <div className="settings-row">
              <div className="settings-row-label">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <div>
                    <div>{t("settings.appInstalled")}</div>
                    <div className="settings-row-hint">{t("settings.appInstalledHint")}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="settings-row">
              <div className="settings-row-label">
                <div>{t("settings.installDevice")}</div>
                <div className="settings-row-hint">
                  {canInstall ? t("settings.installCanHint") : t("settings.installManualHint")}
                </div>
              </div>
              <div className="settings-row-control">
                {canInstall && (
                  <button className="btn btn-navy" onClick={install} style={{ fontSize: 13, padding: "7px 16px" }}>
                    {t("settings.installBtn")}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="settings-row">
            <div className="settings-row-label">
              <div>{t("settings.offlineMode")}</div>
              <div className="settings-row-hint">{t("settings.offlineHint")}</div>
            </div>
            <div className="settings-row-control">
              <span style={{
                fontSize: 11.5, fontWeight: 600, padding: "3px 10px",
                borderRadius: 20, background: "var(--green-soft, #e6f4ee)", color: "var(--green)",
              }}>
                {t("settings.offlineActive")}
              </span>
            </div>
          </div>
        </Section>

        {/* ── À propos ── */}
        <Section icon="about" title={t("settings.about")}>
          <div className="settings-about">
            <div className="settings-about-logo">
              <BlackpineLogo size={40} radius={10} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t("settings.aboutName")}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {t("settings.aboutDesc")}
              </div>
              <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 5 }}>
                {t("common.productOf")}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Danger zone: delete account ── */}
        <div className="settings-danger">
          <Link to="/supprimer-compte" className="settings-danger-link">
            {t("settings.deleteAccountLink")}
          </Link>
        </div>
      </div>

      {/* ── Confirm clear modal ── */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "var(--coral)" }}>
                {t("settings.deleteConfirmTitle")}
              </h2>
              <button className="modal-close" onClick={() => setConfirmClear(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                {confirmClear === "appointments"
                  ? t("settings.deleteConfirmAppts", { n: appointments.length })
                  : t("settings.deleteConfirmPatients", { n: patients.length })}
                {" "}<strong>{t("settings.irreversible")}</strong>.
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                {t("settings.exportBeforeDelete")}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmClear(null)}>{t("common.cancel")}</button>
              <button
                className="btn"
                style={{ background: "var(--coral)", color: "#fff" }}
                onClick={handleClear}
              >
                {t("settings.deleteFinal")}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
