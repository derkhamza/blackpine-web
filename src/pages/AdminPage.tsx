import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { adminGetStats, adminGetEvents, adminGetRetention, adminGetDoctors, adminGetDoctor, adminSetPlan, adminResetTrial, adminExpireAccount, adminDeleteAccount, adminGetConsumption, adminForceLogout, adminSetPassword, adminExtendDays, adminGetFinance, type AdminStats, type AdminEvents, type AdminRetention, type AdminDoctor, type AdminDoctorDetail, type AdminConsumption, type AdminFinance } from "../api/client";
import { AnimatedNumber } from "../components/AnimatedNumber";

// Horizontal bar list for "most used pages/actions".
function BarList({ items, color }: { items: { name: string; count: number }[]; color: string }) {
  if (items.length === 0) return <div className="admin-empty">Aucune donnée.</div>;
  const max = Math.max(1, ...items.map(i => i.count));
  const label = (n: string) => n.replace(/^page:/, "").replace(/^action:/, "");
  return (
    <div className="admin-barlist">
      {items.map((it) => (
        <div key={it.name} className="admin-barlist-row">
          <div className="admin-barlist-name" title={it.name}>{label(it.name)}</div>
          <div className="admin-barlist-track">
            <div className="admin-barlist-fill" style={{ width: `${(it.count / max) * 100}%`, background: color }} />
          </div>
          <div className="admin-barlist-val">{it.count.toLocaleString("fr-FR")}</div>
        </div>
      ))}
    </div>
  );
}

// Daily-volume area chart (SVG). Self-contained — no external chart dep.
function AreaChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  if (data.length === 0) return <div className="admin-empty">Aucune donnée sur la période.</div>;
  const W = 720, H = 160, PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const x = (i: number) => PAD + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD * 2));
  const y = (v: number) => PAD + (1 - v / max) * (H - PAD * 2);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`);
  const line = pts.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - PAD).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD).toFixed(1)} Z`;
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <>
      <svg className="admin-area" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Volume quotidien">
        <path d={area} fill={color} fillOpacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={`${d.date}-${i}`} cx={x(i)} cy={y(d.count)} r={d.date === peak.date ? 3 : 1.5} fill={color}>
            <title>{`${d.date} : ${d.count.toLocaleString("fr-FR")}`}</title>
          </circle>
        ))}
      </svg>
      <div className="admin-sub">
        Total : {total.toLocaleString("fr-FR")} · Pic : {peak.count.toLocaleString("fr-FR")} le {peak.date} · Moy./j : {Math.round(total / n).toLocaleString("fr-FR")}
      </div>
    </>
  );
}

// Activity across the hours of the day (24 bars). created_at is stored UTC; shift
// +1h to approximate Morocco local time so peaks line up with clinic hours.
function HourBars({ data, color }: { data?: { hour: number; count: number }[]; color: string }) {
  if (!data || data.length === 0) return <div className="admin-empty">Aucune donnée sur la période.</div>;
  const buckets = new Array(24).fill(0);
  for (const d of data) buckets[((d.hour + 1) % 24 + 24) % 24] += d.count;
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((s, v) => s + v, 0);
  const peakHour = buckets.indexOf(Math.max(...buckets));
  return (
    <>
      <div className="admin-hourbars" role="img" aria-label="Activité par heure de la journée">
        {buckets.map((v, h) => (
          <div key={h} className="admin-hourbar-col" title={`${String(h).padStart(2, "0")}h : ${v.toLocaleString("fr-FR")}`}>
            <div className="admin-hourbar" style={{ height: `${(v / max) * 100}%`, background: color }} />
            {h % 3 === 0 && <span className="admin-hourbar-lbl">{h}h</span>}
          </div>
        ))}
      </div>
      <div className="admin-sub">
        Pic d'activité : {String(peakHour).padStart(2, "0")}h · Total : {total.toLocaleString("fr-FR")} · heure locale (approx.)
      </div>
    </>
  );
}

// Stacked engagement-segment bar with legend (retention view).
const SEGMENTS: { key: "active7" | "sleeping" | "inactive" | "never"; label: string; color: string }[] = [
  { key: "active7",  label: "Actifs · 7j",        color: "var(--green)" },
  { key: "sleeping", label: "En sommeil · 8–30j", color: "var(--gold)" },
  { key: "inactive", label: "Inactifs · +30j",    color: "var(--coral)" },
  { key: "never",    label: "Jamais actifs",      color: "var(--border)" },
];
function StackedBar({ seg }: { seg: AdminRetention["segments"] }) {
  const total = Math.max(1, seg.total);
  return (
    <>
      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", background: "var(--surface)" }}>
        {SEGMENTS.map((s) => {
          const v = seg[s.key];
          if (v <= 0) return null;
          return <div key={s.key} title={`${s.label} : ${v}`} style={{ width: `${(v / total) * 100}%`, background: s.color }} />;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
        {SEGMENTS.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            {s.label} · <strong style={{ color: "var(--text)" }}>{seg[s.key].toLocaleString("fr-FR")}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

// Per-signup-week cohort retention (% still active in last 30 days).
function CohortList({ cohorts }: { cohorts: AdminRetention["cohorts"] }) {
  if (cohorts.length === 0) return <div className="admin-empty">Aucune inscription sur la période.</div>;
  const pct = (r: number) => Math.round(r * 100);
  const color = (r: number) => (r >= 0.6 ? "var(--green)" : r >= 0.3 ? "var(--gold)" : "var(--coral)");
  return (
    <div className="admin-barlist">
      {cohorts.map((c) => (
        <div key={c.label} className="admin-barlist-row">
          <div className="admin-barlist-name" title={`Semaine du ${c.label}`}>{c.label} · {c.size}</div>
          <div className="admin-barlist-track">
            <div className="admin-barlist-fill" style={{ width: `${pct(c.rate)}%`, background: color(c.rate) }} />
          </div>
          <div className="admin-barlist-val">{pct(c.rate)}% · {c.retained}/{c.size}</div>
        </div>
      ))}
    </div>
  );
}

// Owner-only usage analytics. Labels are hardcoded (single-operator internal tool).

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  mobile: "Mobile · médecin",
  "mobile-secretary": "Mobile · secrétaire",
};
const PLATFORM_ACCENTS: Record<string, string> = {
  web: "var(--blue)",
  mobile: "var(--green)",
  "mobile-secretary": "var(--gold)",
};

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="admin-tile">
      <div className="admin-tile-val" style={accent ? { color: accent } : undefined}>
        {typeof value === "number"
          ? <AnimatedNumber value={value} format={(n) => Math.round(n).toLocaleString("fr-FR")} />
          : value}
      </div>
      <div className="admin-tile-lbl">{label}</div>
    </div>
  );
}

// Segmented period selector for the behavioural block.
const RANGES = [7, 30, 90];
function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Période</span>
      <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {RANGES.map((d) => (
          <button
            key={d}
            onClick={() => onChange(d)}
            style={{
              border: "none", cursor: "pointer", padding: "6px 14px", fontSize: 12, fontWeight: 700,
              background: value === d ? "var(--blue)" : "transparent",
              color: value === d ? "#fff" : "var(--muted)",
            }}
          >
            {d} j
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

// Short date (YYYY-MM-DD) or "—".
const shortDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const PLAN_LABELS: Record<string, string> = { free_trial: "Essai", pro: "Pro", premium: "Premium", lifetime: "À vie" };

// ── Risks & shortfalls ─────────────────────────────────────────────────────────
// Synthesises the doctors list + aggregate stats into an actionable "what needs
// attention" view. All computed client-side from endpoints already in use — no
// new backend, counts only, no patient PII.

type RiskLevel = "critical" | "warning" | "info";
interface RiskBucket {
  id: string; level: RiskLevel; title: string; hint: string;
  docs: { email: string; note: string }[];
}
const RISK_TONE: Record<RiskLevel, string> = {
  critical: "var(--coral)", warning: "var(--gold)", info: "var(--blue)",
};

function RiskRow({ bucket, open, onToggle }: { bucket: RiskBucket; open: boolean; onToggle: () => void }) {
  const tone = RISK_TONE[bucket.level];
  return (
    <div className={`admin-risk-row${open ? " open" : ""}`}>
      <button className="admin-risk-head" onClick={onToggle}>
        <span className="admin-risk-count" style={{ background: tone }}>{bucket.docs.length}</span>
        <span className="admin-risk-titles">
          <span className="admin-risk-title">{bucket.title}</span>
          <span className="admin-risk-hint">{bucket.hint}</span>
        </span>
        <span className="admin-doc-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="admin-risk-list">
          {bucket.docs.map((d) => (
            <div key={d.email} className="admin-risk-item">
              <span className="admin-risk-email">{d.email}</span>
              <span className="admin-risk-note" style={{ color: tone }}>{d.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Feature-adoption bar: % of accounts using a capability. Low % = product shortfall.
function AdoptionBar({ label, n, total, weak }: { label: string; n: number; total: number; weak: boolean }) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  const tone = weak ? "var(--coral)" : pct >= 50 ? "var(--green)" : "var(--gold)";
  return (
    <div className="admin-barlist-row">
      <div className="admin-barlist-name" title={label}>{label}{weak && " · lacune"}</div>
      <div className="admin-barlist-track">
        <div className="admin-barlist-fill" style={{ width: `${Math.max(2, pct)}%`, background: tone }} />
      </div>
      <div className="admin-barlist-val">{pct}% · {n}/{total}</div>
    </div>
  );
}

function RisksSection({ stats, retention }: { stats: AdminStats; retention: AdminRetention | null }) {
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { adminGetDoctors().then((r) => setDoctors(r.doctors)).catch(() => setDoctors([])); }, []);

  if (!doctors) return <Section title="Risques & lacunes"><div className="admin-empty">Chargement…</div></Section>;

  const now = Date.now();
  const since = (iso: string | null) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : null);
  const until = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - now) / 86400000) : null);

  const expiring = doctors.filter((d) => d.plan === "free_trial" && until(d.expiresAt) != null && until(d.expiresAt)! >= 0 && until(d.expiresAt)! <= 7);
  const expired  = doctors.filter((d) => until(d.expiresAt) != null && until(d.expiresAt)! < 0);
  const churned  = doctors.filter((d) => (d.apptCount > 0 || d.eventCount > 0) && (since(d.lastActive) ?? 9999) > 30);
  const sleeping = doctors.filter((d) => { const s = since(d.lastActive); return s != null && s >= 8 && s <= 30; });
  const stalled  = doctors.filter((d) => d.apptCount === 0 && d.eventCount === 0 && (since(d.createdAt) ?? 0) >= 2);
  const emptyCab = doctors.filter((d) => d.patientCount === 0 && d.eventCount > 0 && (since(d.createdAt) ?? 0) >= 7);

  const allBuckets: RiskBucket[] = [
    { id: "expiring", level: "critical", title: "Essais expirant ≤ 7 j", hint: "à convertir avant l'échéance",
      docs: expiring.map((d) => ({ email: d.email, note: until(d.expiresAt)! <= 0 ? "expire aujourd'hui" : `expire dans ${until(d.expiresAt)} j` })) },
    { id: "expired", level: "critical", title: "Abonnements / essais expirés", hint: "accès perdu — relancer ou clôturer",
      docs: expired.map((d) => ({ email: d.email, note: `expiré depuis ${-until(d.expiresAt)!} j` })) },
    { id: "churned", level: "warning", title: "Médecins perdus (+30 j sans activité)", hint: "étaient actifs — revenus à risque",
      docs: churned.map((d) => ({ email: d.email, note: `inactif ${since(d.lastActive)} j` })) },
    { id: "sleeping", level: "warning", title: "En sommeil (8–30 j)", hint: "signal précoce de décrochage",
      docs: sleeping.map((d) => ({ email: d.email, note: `vu il y a ${since(d.lastActive)} j` })) },
    { id: "stalled", level: "warning", title: "Jamais activés", hint: "inscrits mais aucune utilisation — onboarding à revoir",
      docs: stalled.map((d) => ({ email: d.email, note: `inscrit il y a ${since(d.createdAt)} j` })) },
    { id: "emptyCab", level: "info", title: "Cabinets sans patient", hint: "utilisent l'app mais n'ont rien saisi",
      docs: emptyCab.map((d) => ({ email: d.email, note: `inscrit il y a ${since(d.createdAt)} j` })) },
  ];
  const buckets = allBuckets.filter((b) => b.docs.length > 0);

  const total = stats.doctors.total;
  const stickiness = retention?.stickiness.ratio ?? null;

  return (
    <>
      <Section title="Risques & lacunes">
        {buckets.length === 0 ? (
          <div className="admin-empty">✓ Aucun risque majeur détecté sur les comptes.</div>
        ) : (
          <div className="admin-risks">
            {buckets.map((b) => (
              <RiskRow key={b.id} bucket={b} open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Adoption des fonctionnalités (lacunes produit)">
        <div className="admin-barlist">
          <AdoptionBar label="Réservation en ligne" n={stats.features.bookingEnabled} total={total} weak={total > 0 && stats.features.bookingEnabled / total < 0.25} />
          <AdoptionBar label="Rappels SMS"           n={stats.features.smsEnabled}     total={total} weak={total > 0 && stats.features.smsEnabled / total < 0.25} />
          <AdoptionBar label="Notifications push"    n={stats.features.pushDoctors}    total={total} weak={total > 0 && stats.features.pushDoctors / total < 0.25} />
          <AdoptionBar label="Secrétaire"            n={stats.features.secretaryDoctors} total={total} weak={total > 0 && stats.features.secretaryDoctors / total < 0.15} />
        </div>
        <div className="admin-sub">
          Engagement (stickiness DAU/MAU) : {stickiness != null
            ? <strong style={{ color: stickiness < 20 ? "var(--coral)" : "var(--green)" }}>{stickiness}%{stickiness < 20 ? " · faible" : ""}</strong>
            : "n/d"} — un ratio élevé signifie que les médecins reviennent quotidiennement.
        </div>
      </Section>
    </>
  );
}

// Destructive account controls for one doctor. State is per-doctor (keyed).
function AdminZone({ doctor, onChanged, onDeleted }: {
  doctor: AdminDoctor;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [plan, setPlan] = useState(doctor.plan);
  const [expiry, setExpiry] = useState(doctor.expiresAt ? doctor.expiresAt.slice(0, 10) : "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = async (fn: () => Promise<void>, okText: string, after: () => void) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ kind: "ok", text: okText }); after(); }
    catch (e) { setMsg({ kind: "err", text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const needsExpiry = plan === "pro" || plan === "premium";
  const expiryIso = expiry ? new Date(expiry + "T00:00:00.000Z").toISOString() : null;
  const canDelete = confirmEmail.trim().toLowerCase() === doctor.email.toLowerCase();

  return (
    <div className="admin-danger">
      <div className="admin-doc-subtitle" style={{ color: "var(--coral)" }}>Zone admin</div>

      {/* Plan */}
      <div className="admin-danger-row">
        <select className="admin-select" value={plan} onChange={(e) => setPlan(e.target.value)} disabled={busy}>
          <option value="free_trial">Essai gratuit</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="lifetime">À vie (lifetime)</option>
        </select>
        {needsExpiry && (
          <input className="admin-select" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} disabled={busy} />
        )}
        <button className="admin-btn" disabled={busy} onClick={() => run(() => adminSetPlan(doctor.id, plan, needsExpiry ? expiryIso : null), "Abonnement mis à jour.", onChanged)}>
          Appliquer
        </button>
      </div>

      {/* Trial / expire */}
      <div className="admin-danger-row">
        <button className="admin-btn" disabled={busy} onClick={() => run(() => adminResetTrial(doctor.id), "Essai prolongé de 30 jours.", onChanged)}>
          Prolonger l'essai (30 j)
        </button>
        <button className="admin-btn warn" disabled={busy} onClick={() => {
          if (window.confirm(`Expirer immédiatement l'accès de ${doctor.email} ?`)) run(() => adminExpireAccount(doctor.id), "Compte expiré.", onChanged);
        }}>
          Expirer maintenant
        </button>
      </div>

      {/* Extend by N days */}
      <div className="admin-danger-row">
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Prolonger de</span>
        <input className="admin-select" type="number" style={{ width: 80 }} value={extendDays}
          onChange={(e) => setExtendDays(e.target.value)} disabled={busy} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>jours</span>
        <button className="admin-btn" disabled={busy || !Number(extendDays)}
          onClick={() => run(() => adminExtendDays(doctor.id, Number(extendDays)), `Abonnement prolongé de ${extendDays} j.`, onChanged)}>
          Appliquer
        </button>
      </div>

      {/* Deep powers: force logout + set password */}
      <div className="admin-danger-row">
        <button className="admin-btn warn" disabled={busy} onClick={() => {
          if (window.confirm(`Déconnecter ${doctor.email} de tous ses appareils ?`)) run(() => adminForceLogout(doctor.id), "Sessions révoquées — reconnexion requise.", () => {});
        }}>
          Déconnecter partout
        </button>
        <input className="admin-select" type="text" placeholder="Nouveau mot de passe (8+)" value={newPw}
          onChange={(e) => setNewPw(e.target.value)} disabled={busy} style={{ flex: 1, minWidth: 180 }} />
        <button className="admin-btn warn" disabled={busy || newPw.trim().length < 8} onClick={() => {
          if (window.confirm(`Définir un nouveau mot de passe pour ${doctor.email} ? Ses sessions seront révoquées.`))
            run(() => adminSetPassword(doctor.id, newPw), "Mot de passe réinitialisé.", () => setNewPw(""));
        }}>
          Réinitialiser
        </button>
      </div>

      {/* Delete */}
      <div className="admin-danger-row">
        <input
          className="admin-select"
          placeholder={`Tapez « ${doctor.email} » pour confirmer`}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          disabled={busy}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          className="admin-btn danger"
          disabled={busy || !canDelete}
          onClick={() => {
            if (window.confirm(`SUPPRIMER définitivement ${doctor.email} et TOUTES ses données (patients, rendez-vous…) ? Cette action est irréversible.`))
              run(() => adminDeleteAccount(doctor.id, confirmEmail.trim()), "Compte supprimé.", onDeleted);
          }}
        >
          Supprimer le compte
        </button>
      </div>

      {msg && <div className={`admin-danger-msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}

// Per-doctor drill-down: searchable list → click a row to load its detail panel.
function DoctorsSection() {
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"active" | "signup" | "appts" | "patients" | "trial">("active");
  const [riskOnly, setRiskOnly] = useState(false);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDoctorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const reloadList = () => adminGetDoctors().then((r) => setDoctors(r.doctors)).catch(() => setDoctors([]));
  useEffect(() => { reloadList(); }, []);

  const reloadDetail = (id: string) => {
    setLoadingDetail(true);
    adminGetDoctor(id).then(setDetail).catch(() => setDetail(null)).finally(() => setLoadingDetail(false));
  };
  const toggle = (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); reloadDetail(id);
  };
  const onChanged = (id: string) => { void reloadList(); reloadDetail(id); };
  const onDeleted = () => { void reloadList(); setOpenId(null); setDetail(null); };

  if (!doctors) return <Section title="Médecins"><div className="tx-empty" style={{ padding: 20 }}>Chargement…</div></Section>;

  const q = search.toLowerCase().trim();
  const now = Date.now();
  const TRIAL_DAYS = 30;
  const daysSince = (iso: string | null) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : Infinity);
  // Trial days remaining for a free-trial account (30-day window from trial_start).
  const trialLeft = (d: AdminDoctor): number | null =>
    d.plan === "free_trial" && d.trialStart ? Math.max(0, TRIAL_DAYS - daysSince(d.trialStart)) : null;
  // Plans present in the data, for the filter dropdown.
  const plans = Array.from(new Set(doctors.map((d) => d.plan || "free_trial")));
  const isAtRisk = (d: AdminDoctor) => {
    const expIn = d.expiresAt ? Math.ceil((new Date(d.expiresAt).getTime() - now) / 86400000) : null;
    const inactive = (d.apptCount > 0 || d.eventCount > 0) && daysSince(d.lastActive) > 30;
    const expiring = d.plan === "free_trial" && expIn != null && expIn <= 7;
    const expired  = expIn != null && expIn < 0;
    const stalled  = d.apptCount === 0 && d.eventCount === 0 && daysSince(d.createdAt) >= 2;
    return inactive || expiring || expired || stalled;
  };
  const searched = q
    ? doctors.filter((d) => d.email.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.commune.toLowerCase().includes(q))
    : doctors;
  const byPlan = planFilter === "all" ? searched : searched.filter((d) => (d.plan || "free_trial") === planFilter);
  const filtered = [...(riskOnly ? byPlan.filter(isAtRisk) : byPlan)].sort((a, b) => {
    if (sort === "signup")   return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    if (sort === "appts")    return b.apptCount - a.apptCount;
    if (sort === "patients") return b.patientCount - a.patientCount;
    if (sort === "trial")    return (trialLeft(a) ?? 9999) - (trialLeft(b) ?? 9999); // soonest-to-expire first
    return daysSince(a.lastActive) - daysSince(b.lastActive); // most recently active first
  });

  return (
    <Section title={`Médecins · ${doctors.length}`}>
      <input
        className="admin-search"
        placeholder="Rechercher par e-mail, spécialité, ville…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="admin-doc-controls">
        <label className="admin-doc-sort">
          Trier :
          <select className="admin-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="active">Activité récente</option>
            <option value="signup">Date d'inscription</option>
            <option value="appts">Rendez-vous</option>
            <option value="patients">Patients</option>
            <option value="trial">Essai — jours restants</option>
          </select>
        </label>
        <label className="admin-doc-sort">
          Plan :
          <select className="admin-select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="all">Tous</option>
            {plans.map((p) => <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>)}
          </select>
        </label>
        <button
          className={`admin-risk-toggle${riskOnly ? " active" : ""}`}
          onClick={() => setRiskOnly((v) => !v)}
        >
          À risque uniquement
        </button>
        <span className="admin-doc-count">{filtered.length} affiché(s)</span>
      </div>
      <div className="admin-doctors">
        {filtered.length === 0 ? (
          <div className="admin-empty">Aucun médecin ne correspond.</div>
        ) : filtered.map((d) => (
          <div key={d.id} className={`admin-doc-row${openId === d.id ? " open" : ""}`}>
            <button className="admin-doc-head" onClick={() => toggle(d.id)}>
              <div className="admin-doc-id">
                <span className="admin-doc-email">{d.email}</span>
                <span className="admin-doc-meta">
                  {d.specialty || "Spécialité n/d"}{d.commune ? ` · ${d.commune}` : ""} · inscrit {shortDate(d.createdAt)}
                </span>
              </div>
              <div className="admin-doc-stats">
                <span className="admin-chip" title="Dernière activité">⏱ {shortDate(d.lastActive)}</span>
                <span className="admin-chip">{PLAN_LABELS[d.plan] ?? d.plan}</span>
                {(() => {
                  // Free-trial accounts: show days left in the 30-day trial window.
                  const tl = trialLeft(d);
                  if (tl != null) {
                    const tone = tl <= 3 ? "var(--coral)" : tl <= 7 ? "var(--gold)" : "var(--green)";
                    return <span className="admin-chip" title="Jours d'essai restants" style={{ color: tone, fontWeight: 700 }}>
                      🎁 {tl}j essai
                    </span>;
                  }
                  // Paid plans: show subscription time remaining.
                  const left = d.expiresAt ? Math.ceil((new Date(d.expiresAt).getTime() - now) / 86400000) : null;
                  if (left == null) return d.plan === "lifetime"
                    ? <span className="admin-chip" title="Abonnement">∞</span>
                    : null;
                  const tone = left < 0 ? "var(--coral)" : left <= 7 ? "var(--gold)" : "var(--green)";
                  return <span className="admin-chip" title="Temps restant d'abonnement" style={{ color: tone, fontWeight: 700 }}>
                    {left < 0 ? `expiré · ${-left}j` : `⏳ ${left}j`}
                  </span>;
                })()}
                <span className="admin-chip" title="Rendez-vous">📅 {d.apptCount}</span>
                <span className="admin-chip" title="Patients">👥 {d.patientCount}</span>
                <span className="admin-chip" title="Événements suivis">⚡ {d.eventCount}</span>
                <span className="admin-doc-caret">{openId === d.id ? "▾" : "▸"}</span>
              </div>
            </button>
            {openId === d.id && (
              <div className="admin-doc-detail">
                {loadingDetail || !detail ? (
                  <div className="admin-empty">{loadingDetail ? "Chargement du détail…" : "Détail indisponible."}</div>
                ) : (
                  <>
                    <div className="admin-grid">
                      <Tile label="Rendez-vous" value={detail.doctor.apptCount} accent="var(--blue)" />
                      <Tile label="Patients" value={detail.doctor.patientCount} accent="var(--green)" />
                      <Tile label="Réserv. en ligne" value={detail.doctor.onlineBookings} accent="var(--gold)" />
                      <Tile label="Événements" value={detail.doctor.eventCount} />
                      <Tile label="Secrétaires" value={detail.doctor.secretaryCount} />
                      <Tile label="Appareils push" value={detail.doctor.pushDevices} />
                    </div>
                    <div className="admin-sub">
                      Réservation en ligne : {detail.features.bookingEnabled ? "activée" : "non"} · Rappels SMS : {detail.features.smsEnabled ? "activés" : "non"}
                      {detail.doctor.lastEvent ? ` · Dernier événement : ${shortDate(detail.doctor.lastEvent)}` : ""}
                    </div>
                    {detail.byDay.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div className="admin-doc-subtitle">Activité — 30 derniers jours</div>
                        <AreaChart data={detail.byDay} color="var(--blue)" />
                      </div>
                    )}
                    {detail.byHour && detail.byHour.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div className="admin-doc-subtitle">Activité par heure de la journée</div>
                        <HourBars data={detail.byHour} color="var(--green)" />
                      </div>
                    )}
                    {detail.byPlatform.length > 0 && (
                      <div className="admin-sub" style={{ marginTop: 10 }}>
                        {detail.byPlatform.map((p) => `${PLATFORM_LABELS[p.platform] ?? p.platform} : ${p.count.toLocaleString("fr-FR")}`).join(" · ")}
                      </div>
                    )}
                    <div className="admin-doc-cols">
                      <div>
                        <div className="admin-doc-subtitle">Écrans</div>
                        <BarList items={detail.topPages} color="var(--blue)" />
                      </div>
                      <div>
                        <div className="admin-doc-subtitle">Actions</div>
                        <BarList items={detail.topActions} color="var(--green)" />
                      </div>
                    </div>
                    <AdminZone
                      key={detail.doctor.id}
                      doctor={detail.doctor}
                      onChanged={() => onChanged(detail.doctor.id)}
                      onDeleted={onDeleted}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Financial dashboard (owner) ────────────────────────────────────────────────
// Revenue derives from the REAL paying-subscriber count; costs, ARPU and growth
// are owner-editable assumptions (persisted locally). Projects 12 months forward.
const FIN_KEY = "bp.admin.finance";
interface FinanceCfg {
  arpu: number;              // MAD collected per paying (recurring) subscriber / month
  growthPct: number;         // monthly gross subscriber growth (%)
  churnPct: number;          // monthly churn (%) — projection assumption
  conversionPct: number;     // % of the CURRENT trial pool that converts to paying
  variablePerUser: number;   // MAD infra cost per active cabinet / month
  oneOff: number;            // one-time cost booked in month 1 (MAD)
  // Prices used to IMPUTE booked revenue from redeemed activation codes.
  priceMonthly: number;      // MAD — a ≤31-day code
  priceYearly: number;       // MAD — a ≥300-day code
  priceLifetime: number;     // MAD — a lifetime code
  costs: { label: string; monthly: number }[]; // fixed monthly costs (MAD)
}
const DEFAULT_FINANCE: FinanceCfg = {
  arpu: 249, growthPct: 8, churnPct: 3, conversionPct: 20, variablePerUser: 3, oneOff: 0,
  priceMonthly: 299, priceYearly: 2990, priceLifetime: 4990,
  costs: [
    { label: "Hébergement (Vercel)", monthly: 200 },
    { label: "Base de données (Neon)", monthly: 190 },
    { label: "E-mails (Resend)", monthly: 90 },
    { label: "Nom de domaine / divers", monthly: 60 },
  ],
};
function loadFinance(): FinanceCfg {
  try { const r = localStorage.getItem(FIN_KEY); if (r) return { ...DEFAULT_FINANCE, ...JSON.parse(r) }; } catch { /* ignore */ }
  return DEFAULT_FINANCE;
}

// Derived business metrics shared by the Direction cockpit and the Finances tab.
// Revenue is real (imputed from redeemed activation codes); MRR/ARR from the
// current active recurring base × ARPU; churn/conversion from the actual states.
function financeMetrics(fin: AdminFinance, cfg: FinanceCfg) {
  const recurringActive = Math.max(0, fin.subs.activePaid - fin.subs.activeLifetime);
  const mrr = recurringActive * cfg.arpu;
  const everPaid = fin.subs.activePaid + fin.subs.expiredPaid;
  const conversion = fin.subs.total > 0 ? (everPaid / fin.subs.total) * 100 : 0;
  const churnBase = fin.subs.activePaid + fin.expiredThisMonth;
  const churn = churnBase > 0 ? (fin.expiredThisMonth / churnBase) * 100 : 0;
  const ltv = churn > 0 ? cfg.arpu / (churn / 100) : cfg.arpu * 24;
  const su = fin.signupsByMonth;
  const suThis = su.length ? su[su.length - 1].count : 0;
  const suPrev = su.length > 1 ? su[su.length - 2].count : 0;
  const suGrowth = suPrev > 0 ? ((suThis - suPrev) / suPrev) * 100 : (suThis > 0 ? 100 : 0);
  const priceOf = (plan: string, dur: number) =>
    plan === "lifetime" ? cfg.priceLifetime : dur >= 300 ? cfg.priceYearly : cfg.priceMonthly;
  const revMap: Record<string, number> = {};
  for (const b of fin.codes.redeemedBuckets) revMap[b.month] = (revMap[b.month] || 0) + b.count * priceOf(b.plan, b.durationDays);
  const revByMonth = fin.codes.redeemedByMonth.map(mm => ({ date: mm.month, count: revMap[mm.month] || 0 }));
  const bookedTotal = fin.codes.redeemedBuckets.reduce((s, b) => s + b.count * priceOf(b.plan, b.durationDays), 0);
  const revThis = revByMonth.length ? revByMonth[revByMonth.length - 1].count : 0;
  return { recurringActive, mrr, arr: mrr * 12, conversion, churn, ltv, suThis, suPrev, suGrowth, revByMonth, bookedTotal, revThis };
}
const fmtMAD = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} MAD`;

// ── Executive cockpit (the CEO's one-screen read) ─────────────────────────────
function ExecutiveTab({ stats, finance, retention, onGoto }: {
  stats: AdminStats;
  finance: AdminFinance | null;
  retention: AdminRetention | null;
  onGoto: (t: AdminTab) => void;
}) {
  if (!finance) return <Section title="Direction"><div className="admin-empty">Chargement des indicateurs…</div></Section>;
  const cfg = loadFinance();
  const m = financeMetrics(finance, cfg);
  const stick = retention ? Math.round(retention.stickiness.ratio * 100) : 0;

  return (<>
    <div className="admin-exec-summary">
      <strong>{finance.subs.activePaid}</strong> abonnés payants · MRR <strong>{fmtMAD(m.mrr)}</strong> · {finance.subs.activeTrials} essais en cours · {stats.trialsExpiring7} expirent sous 7 j · {stats.active.wau} cabinets actifs cette semaine.
    </div>

    <div className="admin-grid">
      <Tile label="MRR (mensuel)" value={fmtMAD(m.mrr)} accent="var(--green)" />
      <Tile label="ARR (annualisé)" value={fmtMAD(m.arr)} accent="var(--blue)" />
      <Tile label="Abonnés payants" value={finance.subs.activePaid} accent="var(--green)" />
      <Tile label="Comptes total" value={finance.subs.total} accent="var(--blue)" />
      <Tile label="Conversion payants" value={`${m.conversion.toFixed(0)} %`} accent="var(--gold)" />
      <Tile label="Churn (ce mois)" value={`${m.churn.toFixed(1)} %`} accent={m.churn > 5 ? "var(--coral)" : "var(--muted)"} />
    </div>

    <div className="admin-two-col">
      <Section title="Revenu encaissé — 12 mois">
        <AreaChart data={m.revByMonth} color="var(--green)" />
        <div className="admin-sub">Imputé depuis les codes d'activation utilisés · encaissé cumulé <strong>{fmtMAD(m.bookedTotal)}</strong></div>
      </Section>
      <Section title="Inscriptions — 12 mois">
        <AreaChart data={finance.signupsByMonth.map(s => ({ date: s.month, count: s.count }))} color="var(--blue)" />
        <div className="admin-sub">Ce mois : <strong>{m.suThis}</strong> · {m.suGrowth >= 0 ? "+" : ""}{m.suGrowth.toFixed(0)} % vs mois précédent</div>
      </Section>
    </div>

    <Section title="Abonnements actifs par formule">
      <div className="admin-grid">
        {Object.entries(finance.subs.activeByPlan).map(([plan, n]) => (
          <Tile key={plan} label={PLAN_LABELS[plan] ?? plan} value={n as number} accent="var(--blue)" />
        ))}
        <Tile label="Essais actifs" value={finance.subs.activeTrials} accent="var(--gold)" />
        <Tile label="À vie" value={finance.subs.activeLifetime} />
      </div>
    </Section>

    <Section title="Cohortes de conversion (par mois d'inscription)">
      {finance.cohorts.filter(c => c.signups > 0).length === 0 ? (
        <div className="admin-empty">Pas encore de données de cohorte — le journal d'abonnements s'alimente dès maintenant.</div>
      ) : (
        <div className="admin-cohorts">
          {finance.cohorts.filter(c => c.signups > 0).map(c => (
            <div key={c.month} className="admin-cohort-row">
              <span className="admin-cohort-m">{c.month}</span>
              <span className="admin-cohort-n">{c.signups} inscrits</span>
              <div className="admin-cohort-track">
                <div className="admin-cohort-fill" style={{ width: `${Math.min(100, c.rate)}%`, background: c.rate >= 30 ? "var(--green)" : c.rate >= 15 ? "var(--gold)" : "var(--coral)" }} />
              </div>
              <span className="admin-cohort-r">{c.converted} → {c.rate} %</span>
            </div>
          ))}
        </div>
      )}
      <div className="admin-sub">Part des comptes créés chaque mois ayant souscrit un plan payant · {finance.eventsLogged} événements journalisés.</div>
    </Section>

    <div className="admin-two-col">
      <Section title="Cabinets actifs">
        <div className="admin-grid">
          <Tile label="Aujourd'hui" value={stats.active.dau} accent="var(--green)" />
          <Tile label="7 jours" value={stats.active.wau} />
          <Tile label="30 jours" value={stats.active.mau} />
          <Tile label="Adhérence (DAU/MAU)" value={`${stick} %`} accent="var(--blue)" />
        </div>
      </Section>
      <Section title="À surveiller">
        <div className="admin-grid">
          <Tile label="Essais → 7 j" value={stats.trialsExpiring7} accent="var(--gold)" />
          <Tile label="Payants expirés" value={finance.subs.expiredPaid} accent="var(--coral)" />
          <Tile label="LTV estimée" value={fmtMAD(m.ltv)} accent="var(--blue)" />
          <Tile label="Codes non utilisés" value={finance.codes.unused} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="admin-btn" onClick={() => onGoto("finances")}>Finances détaillées →</button>
          <button className="admin-btn" onClick={() => onGoto("doctors")}>Comptes & contrôles →</button>
        </div>
      </Section>
    </div>
  </>);
}

// Revenue / cost / net over 12 months as a layered SVG chart (revenue area,
// costs + net lines, zero baseline). Self-contained, theme-aware.
function FinChart({ data }: { data: { m: number; rev: number; cost: number; net: number }[] }) {
  const W = 720, H = 200, PAD = 8;
  const vals = data.flatMap(d => [d.rev, d.cost, d.net]);
  const maxV = Math.max(1, ...vals);
  const minV = Math.min(0, ...vals);
  const n = data.length;
  const x = (i: number) => PAD + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD * 2));
  const y = (v: number) => PAD + (1 - (v - minV) / (maxV - minV)) * (H - PAD * 2);
  const path = (key: "rev" | "cost" | "net") =>
    data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const revArea = `${path("rev")} L${x(n - 1).toFixed(1)},${y(minV).toFixed(1)} L${x(0).toFixed(1)},${y(minV).toFixed(1)} Z`;
  return (
    <svg className="admin-area" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Projection financière">
      <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
      <path d={revArea} fill="var(--blue)" fillOpacity={0.12} />
      <path d={path("rev")} fill="none" stroke="var(--blue)" strokeWidth={2} strokeLinejoin="round" />
      <path d={path("cost")} fill="none" stroke="var(--coral)" strokeWidth={2} strokeLinejoin="round" />
      <path d={path("net")} fill="none" stroke="var(--green)" strokeWidth={2.4} strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.net)} r={1.6} fill="var(--green)">
          <title>{`M+${d.m} · net ${Math.round(d.net).toLocaleString("fr-FR")} MAD`}</title>
        </circle>
      ))}
    </svg>
  );
}

function FinancialDashboard({ stats, finance }: { stats: AdminStats; finance: AdminFinance | null }) {
  const [cfg, setCfg] = useState<FinanceCfg>(loadFinance);
  const save = (next: FinanceCfg) => { setCfg(next); try { localStorage.setItem(FIN_KEY, JSON.stringify(next)); } catch { /* ignore */ } };

  const m = finance ? financeMetrics(finance, cfg) : null;
  // Paying = REAL active-paid (excludes expired) when finance is loaded; the
  // stats fallback (which counts expired too) only shows before /finance resolves.
  const subEntries = Object.entries(stats.subscriptions);
  const payingFallback = subEntries.filter(([p]) => p !== "free_trial").reduce((s, [, n]) => s + (n as number), 0);
  const paying   = finance ? finance.subs.activePaid : payingFallback;
  const recurring = finance && m ? m.recurringActive : paying;
  const trial    = finance ? finance.subs.activeTrials : ((stats.subscriptions as Record<string, number>)["free_trial"] ?? 0);
  const activeCabinets = stats.volumes.snapshots;

  const fixedCosts = cfg.costs.reduce((s, c) => s + c.monthly, 0);
  const mrr = recurring * cfg.arpu;
  const monthlyCost = fixedCosts + activeCabinets * cfg.variablePerUser;
  const net = mrr - monthlyCost;
  const margin = mrr > 0 ? Math.round((net / mrr) * 100) : 0;
  const fmtM = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} MAD`;

  // 12-month projection. Base = today's payers + expected trial conversions; the
  // sub base then compounds at (growth − churn); costs = fixed + variable × subs
  // (+ a one-off in month 1).
  const base = recurring + Math.round(trial * cfg.conversionPct / 100);
  const netG = (cfg.growthPct - cfg.churnPct) / 100;
  const projection = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const subs = base * Math.pow(1 + netG, m);
    const rev = subs * cfg.arpu;
    const cost = fixedCosts + subs * cfg.variablePerUser + (m === 1 ? cfg.oneOff : 0);
    return { m, subs, rev, cost, net: rev - cost };
  });
  const year1Net = projection.reduce((s, p) => s + p.net, 0) - cfg.oneOff;
  const breakevenMonth = projection.find(p => p.net >= 0)?.m ?? null;

  const setCost = (i: number, patch: Partial<{ label: string; monthly: number }>) =>
    save({ ...cfg, costs: cfg.costs.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addCost = () => save({ ...cfg, costs: [...cfg.costs, { label: "Nouveau coût", monthly: 0 }] });
  const removeCost = (i: number) => save({ ...cfg, costs: cfg.costs.filter((_, idx) => idx !== i) });

  return (<>
    {finance && m && (
      <Section title="Situation réelle (données actuelles)">
        <div className="admin-grid">
          <Tile label="Abonnés payants actifs" value={finance.subs.activePaid} accent="var(--green)" />
          <Tile label="dont récurrents" value={m.recurringActive} />
          <Tile label="À vie" value={finance.subs.activeLifetime} />
          <Tile label="Payants expirés" value={finance.subs.expiredPaid} accent="var(--coral)" />
          <Tile label="Conversion payants" value={`${m.conversion.toFixed(0)} %`} accent="var(--gold)" />
          <Tile label="Churn (ce mois)" value={`${m.churn.toFixed(1)} %`} accent={m.churn > 5 ? "var(--coral)" : "var(--muted)"} />
          <Tile label="LTV estimée" value={fmtMAD(m.ltv)} accent="var(--blue)" />
          <Tile label="Encaissé (12 mois)" value={fmtMAD(m.bookedTotal)} accent="var(--green)" />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="admin-doc-subtitle" style={{ marginBottom: 6 }}>Revenu encaissé par mois (codes d'activation utilisés)</div>
          <AreaChart data={m.revByMonth} color="var(--green)" />
        </div>
        <div className="admin-sub">Codes d'activation : {finance.codes.redeemed} utilisés / {finance.codes.issued} émis · {finance.codes.unused} en attente.</div>
      </Section>
    )}

    <Section title="Revenus & rentabilité (projection)">
      <div className="admin-grid">
        <Tile label="Abonnés payants" value={paying} accent="var(--green)" />
        <Tile label="En essai (à convertir)" value={trial} accent="var(--gold)" />
        <Tile label="MRR (revenu mensuel)" value={fmtM(mrr)} accent="var(--blue)" />
        <Tile label="ARR (annualisé)" value={fmtM(mrr * 12)} accent="var(--blue)" />
        <Tile label="Coûts mensuels" value={fmtM(monthlyCost)} accent="var(--coral)" />
        <Tile label="Cashflow net / mois" value={fmtM(net)} accent={net >= 0 ? "var(--green)" : "var(--coral)"} />
      </div>
      <div className="admin-sub">
        Marge nette : <strong style={{ color: margin >= 0 ? "var(--green)" : "var(--coral)" }}>{margin}%</strong>
        {" · "}Seuil de rentabilité : <strong>{Math.ceil(monthlyCost / Math.max(1, cfg.arpu))}</strong> abonnés payants
        {" · "}Projection nette 12 mois : <strong style={{ color: year1Net >= 0 ? "var(--green)" : "var(--coral)" }}>{fmtM(year1Net)}</strong>
      </div>
    </Section>

    <Section title="Projection sur 12 mois">
      <FinChart data={projection} />
      <div className="admin-fin-legend">
        <span><i style={{ background: "var(--blue)" }} /> Revenu</span>
        <span><i style={{ background: "var(--coral)" }} /> Coûts</span>
        <span><i style={{ background: "var(--green)" }} /> Cashflow net</span>
      </div>
      <div className="admin-sub">
        Base : {base} abonnés (payants + conversions d'essais), croissance nette {(cfg.growthPct - cfg.churnPct)}%/mois
        {breakevenMonth ? ` · rentable dès M+${breakevenMonth}` : " · non rentable sur 12 mois aux hypothèses actuelles"}.
      </div>
    </Section>

    <Section title="Hypothèses (modifiables)">
      <div className="admin-fin-cfg">
        <label className="admin-fin-field">ARPU (revenu/abonné/mois)
          <input className="admin-select" type="number" min="0" value={cfg.arpu} onChange={(e) => save({ ...cfg, arpu: +e.target.value || 0 })} /> MAD
        </label>
        <label className="admin-fin-field">Croissance mensuelle
          <input className="admin-select" type="number" min="-50" max="100" value={cfg.growthPct} onChange={(e) => save({ ...cfg, growthPct: +e.target.value || 0 })} /> %
        </label>
        <label className="admin-fin-field">Attrition (churn)
          <input className="admin-select" type="number" min="0" max="100" value={cfg.churnPct} onChange={(e) => save({ ...cfg, churnPct: +e.target.value || 0 })} /> %
        </label>
        <label className="admin-fin-field">Conversion des essais
          <input className="admin-select" type="number" min="0" max="100" value={cfg.conversionPct} onChange={(e) => save({ ...cfg, conversionPct: +e.target.value || 0 })} /> %
        </label>
        <label className="admin-fin-field">Coût variable / cabinet / mois
          <input className="admin-select" type="number" min="0" value={cfg.variablePerUser} onChange={(e) => save({ ...cfg, variablePerUser: +e.target.value || 0 })} /> MAD
        </label>
        <label className="admin-fin-field">Coût unique (M+1)
          <input className="admin-select" type="number" min="0" value={cfg.oneOff} onChange={(e) => save({ ...cfg, oneOff: +e.target.value || 0 })} /> MAD
        </label>
        <label className="admin-fin-field">Prix mensuel (code 30 j)
          <input className="admin-select" type="number" min="0" value={cfg.priceMonthly} onChange={(e) => save({ ...cfg, priceMonthly: +e.target.value || 0 })} /> MAD
        </label>
        <label className="admin-fin-field">Prix annuel (code 365 j)
          <input className="admin-select" type="number" min="0" value={cfg.priceYearly} onChange={(e) => save({ ...cfg, priceYearly: +e.target.value || 0 })} /> MAD
        </label>
        <label className="admin-fin-field">Prix à vie
          <input className="admin-select" type="number" min="0" value={cfg.priceLifetime} onChange={(e) => save({ ...cfg, priceLifetime: +e.target.value || 0 })} /> MAD
        </label>
      </div>
      <div className="admin-fin-costs">
        <div className="admin-doc-subtitle" style={{ marginBottom: 4 }}>Coûts fixes mensuels</div>
        {cfg.costs.map((c, i) => (
          <div key={i} className="admin-fin-cost-row">
            <input className="admin-select" value={c.label} onChange={(e) => setCost(i, { label: e.target.value })} style={{ flex: 1 }} />
            <input className="admin-select" type="number" min="0" value={c.monthly} onChange={(e) => setCost(i, { monthly: +e.target.value || 0 })} style={{ width: 110 }} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>MAD/mois</span>
            <button className="admin-fin-cost-del" onClick={() => removeCost(i)} title="Supprimer" aria-label="Supprimer">×</button>
          </div>
        ))}
        <div className="admin-fin-cost-row admin-fin-cost-total">
          <span style={{ flex: 1 }}>Total coûts fixes</span><strong>{fmtM(fixedCosts)}/mois</strong>
        </div>
        <button className="admin-btn" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={addCost}>+ Ajouter un coût</button>
      </div>
    </Section>
  </>);
}

// ── Resource consumption (storage + per-user usage + connexion geo) ────────────
const fmtBytes = (b: number) => {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} Mo`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${b} o`;
};
const COUNTRY_NAMES: Record<string, string> = {
  MA: "Maroc", FR: "France", ES: "Espagne", US: "États-Unis", BE: "Belgique",
  DE: "Allemagne", GB: "Royaume-Uni", CA: "Canada", NL: "Pays-Bas", IT: "Italie",
};

function ConsumptionSection() {
  const [data, setData] = useState<AdminConsumption | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { adminGetConsumption().then(setData).catch(() => setErr(true)); }, []);

  if (err) return <Section title="Consommation"><div className="admin-empty">Indisponible.</div></Section>;
  if (!data) return <Section title="Consommation"><div className="admin-empty">Chargement…</div></Section>;

  const { storage, usage, countries } = data;
  const maxBytes = Math.max(1, ...storage.users.map(u => u.bytes));
  return (<>
    <Section title="Stockage (base de données)">
      <div className="admin-grid">
        <Tile label="Stockage total" value={fmtBytes(storage.totalBytes)} accent="var(--blue)" />
        <Tile label="Cabinets" value={storage.cabinets} />
        <Tile label="Moyenne / cabinet" value={fmtBytes(storage.avgBytes)} />
      </div>
      <div className="admin-sub" style={{ marginBottom: 10 }}>Plus gros consommateurs (part du stockage total) :</div>
      <div className="admin-barlist">
        {storage.users.slice(0, 12).map((u) => (
          <div key={u.email} className="admin-barlist-row">
            <div className="admin-barlist-name" title={u.email}>{u.email}</div>
            <div className="admin-barlist-track">
              <div className="admin-barlist-fill" style={{ width: `${(u.bytes / maxBytes) * 100}%`, background: "var(--blue)" }} />
            </div>
            <div className="admin-barlist-val">{fmtBytes(u.bytes)} · {u.pct}%</div>
          </div>
        ))}
      </div>
      <div className="admin-sub">Le « calcul » (compute) n'est pas mesurable côté serverless ; le volume d'activité ci-dessous en est l'indicateur.</div>
    </Section>

    <Section title="Usage par utilisateur">
      <div className="admin-doc-cols">
        <div>
          <div className="admin-doc-subtitle">Événements & jours actifs</div>
          <div className="admin-barlist">
            {usage.users.slice(0, 12).map((u) => (
              <div key={u.email} className="admin-barlist-row">
                <div className="admin-barlist-name" title={u.email}>{u.email}</div>
                <div className="admin-barlist-val" style={{ width: "auto" }}>
                  {u.events.toLocaleString("fr-FR")} évts · {u.activeDays} j · {u.activeHours} h actives
                </div>
              </div>
            ))}
          </div>
          <div className="admin-sub">« h actives » = heures distinctes avec activité (indicateur du temps passé ; la durée exacte de session n'est pas suivie).</div>
        </div>
        <div>
          <div className="admin-doc-subtitle">Localisation des connexions</div>
          {countries.length === 0 ? (
            <div className="admin-empty">Aucune donnée de pays encore (capturée à partir des prochaines connexions).</div>
          ) : (
            <div className="admin-barlist">
              {countries.map((c) => (
                <div key={c.country} className="admin-barlist-row">
                  <div className="admin-barlist-name">{COUNTRY_NAMES[c.country] ?? c.country}</div>
                  <div className="admin-barlist-val">{c.users} méd. · {c.events.toLocaleString("fr-FR")} évts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  </>);
}

type AdminTab = "direction" | "overview" | "growth" | "usage" | "finances" | "doctors" | "system";
const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: "direction", label: "Direction" },
  { key: "overview", label: "Vue d'ensemble" },
  { key: "growth",   label: "Croissance" },
  { key: "usage",    label: "Usage" },
  { key: "finances", label: "Finances" },
  { key: "doctors",  label: "Médecins & contrôles" },
  { key: "system",   label: "Système" },
];

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<AdminEvents | null>(null);
  const [retention, setRetention] = useState<AdminRetention | null>(null);
  const [finance, setFinance] = useState<AdminFinance | null>(null);
  const [range, setRange] = useState<number>(30);   // behavioural window in days
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("direction");

  // Stats + retention + finance use fixed windows → load once.
  useEffect(() => {
    adminGetStats().then(setStats).catch((e) => setErr((e as Error).message));
    adminGetRetention().then(setRetention).catch(() => { /* retention optional */ });
    adminGetFinance().then(setFinance).catch(() => { /* finance optional */ });
  }, []);

  // Behavioural block is range-driven → refetch when the period changes.
  useEffect(() => {
    adminGetEvents(range).then(setEvents).catch(() => { /* events optional */ });
  }, [range]);

  if (err) {
    return (
      <Layout title="Supervision">
        <div className="tx-empty" style={{ padding: "40px 0", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>{err === "FORBIDDEN" ? "🔒" : "⚠️"}</div>
          <div style={{ fontWeight: 700 }}>{err === "FORBIDDEN" ? "Accès réservé au propriétaire" : "Erreur de chargement"}</div>
        </div>
      </Layout>
    );
  }
  if (!stats) {
    return <Layout title="Supervision"><div className="tx-empty" style={{ padding: 40 }}>Chargement…</div></Layout>;
  }

  const maxSignup = Math.max(1, ...stats.signupsByDay.map((d) => d.count));
  const fmt = (n: number) => n.toLocaleString("fr-FR");

  return (
    <Layout title="Supervision" subtitle={`Données au ${new Date(stats.generatedAt).toLocaleString("fr-FR")}`}>
      {/* ── Console section tabs ── */}
      <div className="admin-tabs">
        {ADMIN_TABS.map(tb => (
          <button
            key={tb.key}
            className={`admin-tab${tab === tb.key ? " active" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "direction" && <ExecutiveTab stats={stats} finance={finance} retention={retention} onGoto={setTab} />}

      {tab === "overview" && (<>
      {/* ── Headline KPIs ── */}
      <div className="admin-grid">
        <Tile label="Médecins inscrits" value={stats.doctors.total} accent="var(--blue)" />
        <Tile label="Actifs · 7 jours" value={stats.active.wau} accent="var(--green)" />
        <Tile label="Actifs · 30 jours" value={stats.active.mau} />
        <Tile label="Nouveaux · 30 jours" value={stats.doctors.new30} accent="var(--gold)" />
      </div>

      {/* ── Risks & shortfalls (actionable, first) ── */}
      <RisksSection stats={stats} retention={retention} />
      </>)}

      {tab === "growth" && (<>
      {/* ── Signups over time ── */}
      <Section title="Inscriptions — 30 derniers jours">
        <div className="admin-bars">
          {stats.signupsByDay.length === 0 ? (
            <div className="admin-empty">Aucune inscription sur la période.</div>
          ) : stats.signupsByDay.map((d, i) => (
            <div key={`${d.date}-${i}`} className="admin-bar-col" title={`${d.date} : ${d.count}`}>
              <div className="admin-bar" style={{ height: `${Math.max(4, (d.count / maxSignup) * 100)}%` }} />
              <div className="admin-bar-x">{d.date.slice(8)}</div>
            </div>
          ))}
        </div>
        <div className="admin-sub">Aujourd'hui : {fmt(stats.doctors.newToday)} · 7 j : {fmt(stats.doctors.new7)}</div>
      </Section>

      {/* ── Activity ── */}
      <Section title="Activité (synchronisation cabinet)">
        <div className="admin-grid">
          <Tile label="Actifs aujourd'hui" value={stats.active.dau} accent="var(--green)" />
          <Tile label="Actifs · 7 jours" value={stats.active.wau} />
          <Tile label="Actifs · 30 jours" value={stats.active.mau} />
          <Tile label="Cabinets avec données" value={stats.volumes.snapshots} />
        </div>
      </Section>

      {/* ── Subscriptions ── */}
      <Section title="Abonnements">
        <div className="admin-grid">
          {Object.entries(stats.subscriptions).map(([plan, n]) => (
            <Tile key={plan} label={plan === "free_trial" ? "Essai gratuit" : plan} value={n} />
          ))}
          <Tile label="Essais expirant (7 j)" value={stats.trialsExpiring7} accent="var(--coral)" />
        </div>
      </Section>
      </>)}

      {tab === "usage" && (<>
      {/* ── Feature adoption ── */}
      <Section title="Adoption des fonctionnalités">
        <div className="admin-grid">
          <Tile label="Réservation en ligne active" value={stats.features.bookingEnabled} accent="var(--blue)" />
          <Tile label="Rappels SMS activés" value={stats.features.smsEnabled} />
          <Tile label="SMS envoyés · 30 j" value={stats.features.smsSent30} />
          <Tile label="Comptes secrétaire" value={stats.features.secretaryAccounts} />
          <Tile label="Médecins avec secrétaire" value={stats.features.secretaryDoctors} />
          <Tile label="Appareils push" value={stats.features.pushDevices} accent="var(--green)" />
        </div>
      </Section>

      {/* ── Data volumes ── */}
      <Section title="Volumétrie">
        <div className="admin-grid">
          <Tile label="Rendez-vous gérés" value={stats.volumes.totalAppointments} accent="var(--blue)" />
          <Tile label="Patients enregistrés" value={stats.volumes.totalPatients} accent="var(--green)" />
          <Tile label="Réservations en ligne" value={stats.volumes.onlineBookings} accent="var(--gold)" />
          <Tile label="Cabinets" value={stats.volumes.snapshots} />
        </div>
      </Section>

      {/* ── Retention / returning doctors ── */}
      {retention && (
        <>
          <Section title="Rétention & fidélité">
            <div className="admin-grid">
              <Tile label="Médecins actifs · 7j" value={retention.segments.active7} accent="var(--green)" />
              <Tile label="Médecins fidèles · 7j" value={retention.newVsReturning.returning} accent="var(--blue)" />
              <Tile label="Nouveaux actifs · 7j" value={retention.newVsReturning.new} accent="var(--gold)" />
              <Tile label="Stickiness (DAU/MAU)" value={`${retention.stickiness.ratio}%`} accent="var(--green)" />
            </div>
            <div className="admin-sub">
              Un médecin « fidèle » est inscrit depuis plus de 7 jours et a synchronisé son cabinet cette semaine.
            </div>
          </Section>
          <Section title="Segments d'engagement">
            <StackedBar seg={retention.segments} />
          </Section>
          <Section title="Cohortes d'inscription — rétention (8 dernières semaines)">
            <CohortList cohorts={retention.cohorts} />
            <div className="admin-sub">% des médecins de chaque semaine d'inscription encore actifs (synchro &lt; 30 j).</div>
          </Section>
        </>
      )}

      {/* ── Behavioural usage (Phase 2) ── */}
      {events && <RangePicker value={range} onChange={setRange} />}
      {events && (events.totalEvents > 0 ? (
        <>
          <Section title={`Comportement — ${range} derniers jours`}>
            <div className="admin-grid">
              <Tile label="Événements" value={events.totalEvents} accent="var(--blue)" />
              <Tile label="Utilisateurs actifs" value={events.activeUsers} accent="var(--green)" />
              <Tile label="Écrans suivis" value={events.topPages.length} />
              <Tile label="Actions suivies" value={events.topActions.length} />
            </div>
          </Section>
          {events.byDay && events.byDay.length > 0 && (
            <Section title={`Volume d'activité — ${range} derniers jours`}>
              <AreaChart data={events.byDay} color="var(--blue)" />
            </Section>
          )}
          {events.byHour && events.byHour.length > 0 && (
            <Section title="Activité par heure de la journée">
              <HourBars data={events.byHour} color="var(--blue)" />
            </Section>
          )}
          <Section title="Que mesure-t-on ?">
            <dl className="admin-metric-defs">
              <div><dt>Événements</dt><dd>Total des interactions suivies (ouvertures d'écran + actions).</dd></div>
              <div><dt>Utilisateurs actifs</dt><dd>Comptes distincts ayant généré au moins un événement sur la période.</dd></div>
              <div><dt>Écrans / Actions</dt><dd>Écrans les plus consultés et actions les plus déclenchées — les préférences d'usage.</dd></div>
              <div><dt>Activité par heure</dt><dd>Répartition des événements sur les 24 heures (heure locale approx.) — révèle les créneaux d'usage.</dd></div>
              <div><dt>Plateforme</dt><dd>Part du web vs application mobile (médecin / secrétaire).</dd></div>
            </dl>
          </Section>
          {events.byPlatform && events.byPlatform.length > 0 && (
            <Section title="Répartition par plateforme">
              <div className="admin-grid">
                {events.byPlatform.map((p) => (
                  <Tile
                    key={p.platform}
                    label={PLATFORM_LABELS[p.platform] ?? p.platform}
                    value={p.count}
                    accent={PLATFORM_ACCENTS[p.platform]}
                  />
                ))}
              </div>
              <div className="admin-sub">
                {events.byPlatform.map((p) => `${PLATFORM_LABELS[p.platform] ?? p.platform} : ${fmt(p.users)} utilisateur(s)`).join(" · ")}
              </div>
            </Section>
          )}
          <Section title="Écrans les plus consultés">
            <BarList items={events.topPages} color="var(--blue)" />
          </Section>
          <Section title="Actions les plus fréquentes">
            <BarList items={events.topActions} color="var(--green)" />
          </Section>
        </>
      ) : (
        <Section title="Comportement">
          <div className="admin-empty">Aucun événement encore enregistré — les statistiques d'usage apparaîtront ici dès que l'app sera utilisée.</div>
        </Section>
      ))}
      <ConsumptionSection />
      </>)}

      {tab === "finances" && <FinancialDashboard stats={stats} finance={finance} />}

      {tab === "doctors" && <DoctorsSection />}

      {tab === "system" && <VersionRollbackSection />}
    </Layout>
  );
}

// Owner-facing summary of the release process: which build is live, how it is
// gated (automated tests + scored manual pass), and how to revert to the
// previous version. Full details live in the repo's DEPLOY.md / TESTING.md.
function VersionRollbackSection() {
  const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "—";
  return (
    <Section title="Version & déploiement">
      <div className="admin-grid">
        <Tile label="Version en ligne" value={`v${version}`} accent="var(--blue)" />
        <Tile label="Déploiement" value="Manuel · contrôlé" />
        <Tile label="Tests auto" value="npm test" accent="var(--green)" />
      </div>
      <div className="admin-release">
        <div className="admin-release-block">
          <div className="admin-release-title">Avant de déployer</div>
          <ol className="admin-release-list">
            <li>Tests automatiques verts : <code>npm test</code> + <code>npm run build</code>.</li>
            <li>Passage manuel (checklist <code>TESTING.md</code>) → décision <b>GO</b> (aucun test 🔴 en échec, score ≥ 90 %).</li>
            <li>Noter l'URL du déploiement de production actuel (cible de retour arrière).</li>
            <li>Promouvoir la préversion en production (Vercel → <i>Promote to Production</i>).</li>
            <li>Smoke-test : connexion, une consultation, une facture.</li>
          </ol>
        </div>
        <div className="admin-release-block admin-release-rollback">
          <div className="admin-release-title">Revenir à la version précédente (rollback)</div>
          <ol className="admin-release-list">
            <li>Vercel → le projet → <b>Deployments</b>.</li>
            <li>Repérer le dernier déploiement sain (production précédente).</li>
            <li>Menu <b>⋯ → Promote to Production</b> (<i>Instant Rollback</i>) — effet en quelques secondes, sans reconstruction.</li>
            <li>Vérifier en production (connexion + une facture).</li>
            <li>PWA : demander un rechargement forcé (Ctrl/Cmd+Maj+R) aux postes concernés.</li>
          </ol>
          <div className="admin-sub">
            En ligne de commande : <code>vercel rollback &lt;url-du-déploiement&gt;</code>. Le retour arrière ne
            restaure pas les données — les migrations Blackpine sont additives et rétro-compatibles.
            Procédure complète : <code>DEPLOY.md</code> à la racine du dépôt.
          </div>
        </div>
      </div>
    </Section>
  );
}
