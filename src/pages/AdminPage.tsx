import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { adminGetStats, adminGetEvents, adminGetRetention, adminGetDoctors, adminGetDoctor, adminSetPlan, adminResetTrial, adminExpireAccount, adminDeleteAccount, type AdminStats, type AdminEvents, type AdminRetention, type AdminDoctor, type AdminDoctorDetail } from "../api/client";
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
const PLAN_LABELS: Record<string, string> = { free_trial: "Essai", pro: "Pro", premium: "Premium" };

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
  const filtered = q
    ? doctors.filter((d) => d.email.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || d.commune.toLowerCase().includes(q))
    : doctors;

  return (
    <Section title={`Médecins · ${doctors.length}`}>
      <input
        className="admin-search"
        placeholder="Rechercher par e-mail, spécialité, ville…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
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

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<AdminEvents | null>(null);
  const [retention, setRetention] = useState<AdminRetention | null>(null);
  const [range, setRange] = useState<number>(30);   // behavioural window in days
  const [err, setErr] = useState<string | null>(null);

  // Stats + retention use fixed multi-windows (DAU/WAU/MAU, etc.) → load once.
  useEffect(() => {
    adminGetStats().then(setStats).catch((e) => setErr((e as Error).message));
    adminGetRetention().then(setRetention).catch(() => { /* retention optional */ });
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
      {/* ── Headline KPIs ── */}
      <div className="admin-grid">
        <Tile label="Médecins inscrits" value={stats.doctors.total} accent="var(--blue)" />
        <Tile label="Actifs · 7 jours" value={stats.active.wau} accent="var(--green)" />
        <Tile label="Actifs · 30 jours" value={stats.active.mau} />
        <Tile label="Nouveaux · 30 jours" value={stats.doctors.new30} accent="var(--gold)" />
      </div>

      {/* ── Risks & shortfalls (actionable, first) ── */}
      <RisksSection stats={stats} retention={retention} />

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

      {/* ── Per-doctor drill-down ── */}
      <DoctorsSection />
    </Layout>
  );
}
