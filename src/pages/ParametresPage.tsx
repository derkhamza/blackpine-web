import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { ProfilePage } from "./ProfilePage";
import { useDarkMode } from "../lib/useDarkMode";
import { exportPatientsCsv, exportAppointmentsCsv } from "../lib/csvExport";
import { exportAgendaIcal } from "../lib/icalExport";
import { useInstallPWA } from "../components/PWAPrompts";
import { useTranslation } from "react-i18next";
import type { CabinetLocation, AppointmentType, SecretaryPermissions, ActeCode, DocumentSettings, DocumentLayout, CabinetDoctorProfile } from "../lib/cabinetTypes";
import { APPT_TYPE_COLORS, DEFAULT_SECRETARY_PERMISSIONS, DEFAULT_DOCUMENT_SETTINGS, DOCUMENT_LAYOUT_LABELS } from "../lib/cabinetTypes";
import { COMMON_DRUGS } from "../lib/ordonnancePrinter";
import {
  inviteCreate, inviteRevoke, type CabinetBackup,
  secretaryAccountList, secretaryAccountCreate, secretaryAccountRevoke, type SecretaryAccount,
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

function Section({ title, subtitle, children, defaultOpen = false }: {
  title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`settings-section${open ? " open" : ""}`}>
      <button
        type="button"
        className="settings-section-head"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <div className="settings-section-title">{title}</div>
          {subtitle && <div className="settings-section-sub">{subtitle}</div>}
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

  function handleDelete(id: string) {
    if (confirm(t("settings.locDeleteConfirm"))) {
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

  useEffect(() => {
    bookingGetMe().then(setCfg).catch(() => setCfg({ slug: null })).finally(() => setLoaded(true));
  }, []);

  const link = cfg?.slug ? `${window.location.origin}/book/${cfg.slug}` : "";
  const enabled = !!cfg?.enabled && !!cfg?.slug;

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
  if (!cfg) return <div className="secretary-info-desc">{t("settings.smsError")}</div>;

  return (
    <div>
      <div className="secretary-info-desc" style={{ marginBottom: 12 }}>{t("settings.smsDesc")}</div>

      {!cfg.serverConfigured && (
        <div className="ord-allergy-banner" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 15, lineHeight: 1.2 }}>⚙️</span>
          <div className="ord-allergy-title" style={{ fontWeight: 600 }}>{t("settings.smsNotConfigured")}</div>
        </div>
      )}

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

// ── Consultation types manager ────────────────────────────────────────────────

const ALL_TYPES: AppointmentType[] = ["consultation", "controle", "suivi", "procedure", "urgence", "autre"];

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
    { key: "viewDocuments", label: t("settings.permViewDocuments"), hint: t("settings.permViewDocumentsHint") },
    { key: "viewFinances",  label: t("settings.permViewFinances"),  hint: t("settings.permViewFinancesHint") },
    { key: "managePayroll", label: t("settings.permManagePayroll"), hint: t("settings.permManagePayrollHint") },
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
  hidden,
  onChange,
  prices,
  onPriceChange,
}: {
  hidden: AppointmentType[];
  onChange: (h: AppointmentType[]) => void;
  prices: Partial<Record<AppointmentType, number>>;
  onPriceChange: (p: Partial<Record<AppointmentType, number>>) => void;
}) {
  const { t } = useTranslation();
  const toggle = (type: AppointmentType) => {
    if (hidden.includes(type)) {
      onChange(hidden.filter(h => h !== type));
    } else {
      // don't hide all types — keep at least one visible
      if (hidden.length >= ALL_TYPES.length - 1) return;
      onChange([...hidden, type]);
    }
  };
  const setPrice = (type: AppointmentType, raw: string) => {
    const n = parseFloat(raw);
    const next = { ...prices };
    if (!raw || Number.isNaN(n) || n <= 0) delete next[type];
    else next[type] = n;
    onPriceChange(next);
  };
  return (
    <div className="consult-types-list">
      {ALL_TYPES.map((type) => {
        const visible = !hidden.includes(type);
        const color = APPT_TYPE_COLORS[type];
        return (
          <div key={type} className={`consult-type-row${visible ? " visible" : ""}`}>
            <button
              className="consult-type-main"
              onClick={() => toggle(type)}
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <span className="consult-type-dot" style={{ background: visible ? color : "var(--border)" }} />
              <span className="consult-type-label" style={{ color: visible ? "var(--text)" : "var(--tertiary)" }}>
                {t(`apptType.${type}`)}
              </span>
              <span className="consult-type-toggle">
                {visible ? t("settings.typeVisible") : t("settings.typeHidden")}
              </span>
            </button>
            {visible && (
              <span className="consult-type-price" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  className="form-input"
                  type="number" min="0" step="10"
                  style={{ width: 90, textAlign: "right" }}
                  placeholder={t("settings.pricePlaceholder")}
                  value={prices[type] ?? ""}
                  onChange={(e) => setPrice(type, e.target.value)}
                />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>MAD</span>
              </span>
            )}
          </div>
        );
      })}
      {hidden.length > 0 && (
        <div className="consult-types-hint">
          {t("settings.typesHiddenCount", { n: hidden.length })}
        </div>
      )}
      <div className="consult-types-hint">{t("settings.priceHint")}</div>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {codes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {codes.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--blue)", minWidth: 48 }}>{c.code}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.price != null && <span style={{ color: "var(--muted)" }}>{c.price} MAD</span>}
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
  return (
    <div className="form-group">
      <label className="form-label">{t("settings.docPreview")}</label>
      <div className={`docpv docpv-${layout}`} aria-hidden>
        {layout === "letterhead" && <div className="docpv-band" />}
        <div className="docpv-head">
          <div className="docpv-name">{name}</div>
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DocumentPreview s={s} doc={doctorProfile} />
      <div className="form-group">
        <label className="form-label">{t("settings.docLayout")}</label>
        <select className="form-select" value={s.layout} onChange={e => set({ layout: e.target.value as DocumentLayout })}>
          {LAYOUTS.map(l => <option key={l} value={l}>{DOCUMENT_LAYOUT_LABELS[l]}</option>)}
        </select>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{t("settings.docLayoutHint")}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {([["showInpe", "INPE"], ["showIce", "ICE"], ["showRib", "RIB"]] as [keyof DocumentSettings, string][]).map(([k, lbl]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={!!s[k]} onChange={e => set({ [k]: e.target.checked })} />
            <span>{t("settings.docShow", { field: lbl })}</span>
          </label>
        ))}
      </div>
      <div className="form-group">
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

  const [settingsTab, setSettingsTab] = useState<"profil" | "parametres">("profil");
  const {
    appointments, patients, employees,
    examResults, prescriptions, certificates, teleSessions,
    doctorProfile, setDoctorProfile,
    exportCabinetJSON, importCabinetJSON,
    clearAppointments, clearPatients,
    listCabinetBackups, restoreCabinetBackup,
  } = useCabinet();
  const { transactions, exportFinancesJSON, importFinancesJSON } = useApp();

  const { dark, toggle } = useDarkMode();
  const { canInstall, installed, install } = useInstallPWA();

  const fileRef     = useRef<HTMLInputElement>(null);
  const finFileRef  = useRef<HTMLInputElement>(null);

  const [preview,   setPreview]   = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState<"appointments" | "patients" | null>(null);

  // ── Secretary PIN ──────────────────────────────────────────────────────────
  const [pinInput,    setPinInput]    = useState("");
  const [pinConfirm,  setPinConfirm]  = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinError,    setPinError]    = useState("");

  const showToast = useToast();

  // ── Secretary PIN helpers ───────────────────────────────────────────────────
  const handleSavePin = () => {
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError(t("settings.pinError4digits"));
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError(t("settings.pinMismatch"));
      return;
    }
    setDoctorProfile({ ...doctorProfile, secretaryPin: pinInput });
    setPinInput(""); setPinConfirm(""); setPinError(""); setShowPinForm(false);
    showToast(t("settings.pinSaved"));
  };
  const handleRemovePin = () => {
    if (!confirm(t("settings.pinRemoveConfirm"))) return;
    const next = { ...doctorProfile };
    delete next.secretaryPin;
    setDoctorProfile(next);
    showToast(t("settings.pinRemoved"));
  };

  // ── Remote secretary invite ────────────────────────────────────────────────
  const [inviteCode,    setInviteCode]    = useState<string | null>(null);
  const [inviteExpires, setInviteExpires] = useState<string | null>(null);
  const [inviteBusy,    setInviteBusy]    = useState(false);

  const handleGenerateInvite = async () => {
    setInviteBusy(true);
    try {
      const { code, expiresAt } = await inviteCreate();
      setInviteCode(code);
      setInviteExpires(expiresAt);
    } catch (err) {
      showToast((err as Error).message || t("settings.inviteError"), "error");
    } finally {
      setInviteBusy(false);
    }
  };
  const handleRevokeInvite = async () => {
    if (!confirm(t("settings.inviteRevokeConfirm"))) return;
    setInviteBusy(true);
    try {
      await inviteRevoke();
      setInviteCode(null);
      setInviteExpires(null);
      showToast(t("settings.inviteRevoked"));
    } catch (err) {
      showToast((err as Error).message || t("settings.inviteError"), "error");
    } finally {
      setInviteBusy(false);
    }
  };
  const handleCopyInvite = () => {
    if (inviteCode) {
      navigator.clipboard?.writeText(inviteCode).then(
        () => showToast(t("settings.inviteCopied")),
        () => {},
      );
    }
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
    if (!confirm(t("settings.acctRevokeConfirm"))) return;
    try {
      await secretaryAccountRevoke(id);
      setSecAccts(prev => prev.map(a => a.id === id ? { ...a, revoked: true } : a));
      showToast(t("settings.acctRevoked"));
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
    if (!confirm(t("settings.restoreConfirm", { date: new Date(b.createdAt).toLocaleString() }))) return;
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
      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${settingsTab === "profil" ? " active" : ""}`}
          onClick={() => setSettingsTab("profil")}
        >
          {t("settings.profile")}
        </button>
        <button
          className={`tab-btn${settingsTab === "parametres" ? " active" : ""}`}
          onClick={() => setSettingsTab("parametres")}
        >
          {t("settings.params")}
        </button>
      </div>

      {settingsTab === "profil" && <ProfilePage noLayout />}

      {settingsTab === "parametres" && <div className="settings-page">

        {/* ── Sécurité & confidentialité ── */}
        <Section title={t("settings.securityTitle")} subtitle={t("settings.securitySub")} defaultOpen>
          <SecuritySection />
        </Section>

        {/* ── Apparence ── */}
        <Section title={t("settings.appearance")} subtitle={t("settings.appearanceSub")}>
          <SettingsRow
            label={t("settings.darkTheme")}
            hint={t("settings.darkHint")}
          >
            <div className="settings-theme-row">
              <span className="settings-theme-label">{dark ? t("common.darkMode") : t("common.lightMode")}</span>
              <DarkToggle dark={dark} toggle={toggle} />
            </div>
          </SettingsRow>
        </Section>

        {/* ── Emplacements du cabinet ── */}
        <Section
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
          title={t("settings.consultationTypes")}
          subtitle={t("settings.consultationTypesSub")}
        >
          <ConsultationTypesSection
            hidden={doctorProfile?.hiddenConsultationTypes ?? []}
            onChange={h => setDoctorProfile({ ...doctorProfile, hiddenConsultationTypes: h.length ? h : undefined })}
            prices={doctorProfile?.appointmentPrices ?? {}}
            onPriceChange={p => setDoctorProfile({ ...doctorProfile, appointmentPrices: Object.keys(p).length ? p : undefined })}
          />
        </Section>

        {/* ── Médicaments personnalisés ── */}
        <Section
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
          title={t("settings.docFormatTitle")}
          subtitle={t("settings.docFormatSub")}
        >
          <DocumentSettingsSection
            settings={doctorProfile?.documentSettings ?? DEFAULT_DOCUMENT_SETTINGS}
            onChange={s => setDoctorProfile({ ...doctorProfile, documentSettings: s })}
          />
        </Section>

        {/* ── Réservation en ligne ── */}
        <Section
          title={t("settings.bookingTitle")}
          subtitle={t("settings.bookingSubtitle")}
        >
          <OnlineBookingSection doctorProfile={doctorProfile} t={t} showToast={showToast} />
        </Section>

        {/* ── Rappels SMS automatiques ── */}
        <Section
          title={t("settings.smsTitle")}
          subtitle={t("settings.smsSubtitle")}
        >
          <SmsRemindersSection t={t} showToast={showToast} />
        </Section>

        {/* ── Mode secrétaire ── */}
        <Section
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

          {doctorProfile?.secretaryPin ? (
            <SettingsRow
              label={t("settings.secretaryPin")}
              hint={t("settings.secretaryPinHint")}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => { setShowPinForm(f => !f); setPinError(""); setPinInput(""); setPinConfirm(""); }}>
                  {showPinForm ? t("common.cancel") : t("settings.modifyPin")}
                </button>
                <button className="btn btn-danger-ghost" onClick={handleRemovePin}>
                  {t("settings.removePin")}
                </button>
              </div>
            </SettingsRow>
          ) : (
            <SettingsRow
              label={t("settings.enablePin")}
              hint={t("settings.enablePinHint")}
            >
              <button className="btn btn-primary" onClick={() => { setShowPinForm(true); setPinError(""); }}>
                {t("settings.setPin")}
              </button>
            </SettingsRow>
          )}

          {showPinForm && (
            <div className="secretary-pin-form">
              <div className="secretary-pin-form-row">
                <label className="secretary-pin-label">{t("settings.newPin")}</label>
                <input
                  className="secretary-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  placeholder="••••"
                  onChange={e => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
                />
              </div>
              <div className="secretary-pin-form-row">
                <label className="secretary-pin-label">{t("settings.confirmPin")}</label>
                <input
                  className="secretary-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirm}
                  placeholder="••••"
                  onChange={e => { setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
                />
              </div>
              {pinError && <div className="secretary-pin-error">{pinError}</div>}
              <div className="secretary-pin-form-actions">
                <button className="btn btn-ghost" onClick={() => { setShowPinForm(false); setPinInput(""); setPinConfirm(""); setPinError(""); }}>
                  {t("common.cancel")}
                </button>
                <button className="btn btn-primary" onClick={handleSavePin}>
                  {t("common.save")}
                </button>
              </div>
            </div>
          )}

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

          <SettingsRow
            label={t("settings.inviteCodeLabel")}
            hint={t("settings.inviteCodeHint")}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={handleGenerateInvite} disabled={inviteBusy}>
                {t("settings.generateInvite")}
              </button>
              <button className="btn btn-danger-ghost" onClick={handleRevokeInvite} disabled={inviteBusy}>
                {t("settings.revokeInvite")}
              </button>
            </div>
          </SettingsRow>

          {inviteCode && (
            <div className="invite-code-box">
              <div className="invite-code-value" onClick={handleCopyInvite} title={t("settings.inviteCopy")}>
                {inviteCode}
              </div>
              <div className="invite-code-meta">
                {inviteExpires
                  ? t("settings.inviteExpires", {
                      date: new Date(inviteExpires).toLocaleString(),
                    })
                  : ""}
              </div>
              <div className="invite-code-hint">{t("settings.inviteShareHint")}</div>
            </div>
          )}

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
                    {!a.revoked && (
                      <button className="btn btn-danger-ghost" onClick={() => handleRevokeAccount(a.id)}>{t("settings.acctRevoke")}</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label className="form-label">{t("settings.acctUsername")}</label>
                <input className="form-input" value={acctForm.username} autoCapitalize="none"
                  onChange={e => setAcctForm(f => ({ ...f, username: e.target.value }))} placeholder="sara.secretaire" />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label className="form-label">{t("settings.acctName")}</label>
                <input className="form-input" value={acctForm.name}
                  onChange={e => setAcctForm(f => ({ ...f, name: e.target.value }))} placeholder="Sara" />
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
        <Section
          title={t("settings.backup")}
          subtitle={t("settings.backupSub")}
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
                  : "Blackpine Cabinet";
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

        {/* ── Zone de danger ── */}
        <Section
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
        <Section
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
        <Section title={t("settings.about")}>
          <div className="settings-about">
            <div className="settings-about-logo">
              <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
                <path d="M4 4h5.5a3.5 3.5 0 0 1 0 7H4V4Z" fill="var(--navy)" fillOpacity="0.8"/>
                <path d="M4 11h6a4 4 0 0 1 0 8H4v-8Z" fill="var(--navy)" fillOpacity="0.5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t("settings.aboutName")}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {t("settings.aboutDesc")}
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
      </div>}

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
