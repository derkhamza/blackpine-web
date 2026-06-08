import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso, formatMAD } from "../lib/format";
import { StatsPage } from "./StatsPage";
import { ClinicalStatsContent } from "./ClinicalStatsPage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  return Math.floor(
    (new Date(todayIso() + "T12:00:00").getTime() - new Date(dob + "T12:00:00").getTime())
    / (365.25 * 86400000),
  );
}

function getLast12Months(): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    return { key, label };
  });
}

const AGE_GROUPS = [
  { label: "0–17",  min: 0,  max: 17  },
  { label: "18–30", min: 18, max: 30  },
  { label: "31–45", min: 31, max: 45  },
  { label: "46–60", min: 46, max: 60  },
  { label: "61+",   min: 61, max: 200 },
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ── Small bar chart (vertical) ────────────────────────────────────────────────

function BarChart({ data, color = "var(--blue)", height = 100 }: {
  data:   { label: string; value: number; subLabel?: string }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="ana-bar-chart" style={{ height: height + 40 }}>
      <div className="ana-bars" style={{ height }}>
        {data.map(d => (
          <div key={d.label} className="ana-bar-wrap">
            <div className="ana-bar-count">{d.value > 0 ? d.value : ""}</div>
            <div className="ana-bar-track">
              <div
                className="ana-bar-fill"
                style={{ height: `${(d.value / max) * 100}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="ana-bar-labels">
        {data.map(d => (
          <div key={d.label} className="ana-bar-label">
            <div>{d.label}</div>
            {d.subLabel && <div className="ana-bar-sub">{d.subLabel}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal bar (for age groups / blood types) ─────────────────────────────

function HBar({ label, value, max, color, pct }: {
  label: string; value: number; max: number; color: string; pct?: boolean;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="ana-hbar-row">
      <div className="ana-hbar-label">{label}</div>
      <div className="ana-hbar-track">
        <div className="ana-hbar-fill" style={{ width: `${width}%`, background: color }} />
      </div>
      <div className="ana-hbar-val">
        {value}{pct && max > 0 ? ` (${Math.round((value / max) * 100)}%)` : ""}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ATab = "patients" | "activite" | "clinique";

export function AnalytiquesPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const [anaTab, setAnaTab] = useState<ATab>("patients");
  if (noLayout) return <AnalytiquesContent />;
  return (
    <Layout title="Analytiques" subtitle="Patients, activité & statistiques cliniques">
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab-btn${anaTab === "patients" ? " active" : ""}`} onClick={() => setAnaTab("patients")}>
          Patients
        </button>
        <button className={`tab-btn${anaTab === "activite" ? " active" : ""}`} onClick={() => setAnaTab("activite")}>
          Activité
        </button>
        <button className={`tab-btn${anaTab === "clinique" ? " active" : ""}`} onClick={() => setAnaTab("clinique")}>
          Clinique
        </button>
      </div>
      {anaTab === "patients" ? <AnalytiquesContent />
        : anaTab === "activite" ? <StatsPage noLayout />
        : <ClinicalStatsContent />}
    </Layout>
  );
}

// ── Inner demographics content (no Layout) ─────────────────────────────────────
function AnalytiquesContent() {
  const { patients, appointments } = useCabinet();
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const thisYear  = today.slice(0, 4);
  const months12  = getLast12Months();

  // ── Patient KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const withDob    = patients.filter(p => !!p.dateOfBirth);
    const ages       = withDob.map(p => calcAge(p.dateOfBirth!));
    const avgAge     = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;
    const newThisMth = patients.filter(p => p.createdAt.startsWith(thisMonth)).length;
    const withCnops  = patients.filter(p => !!p.cnopsNumber).length;
    return { total: patients.length, avgAge, newThisMth, withCnops };
  }, [patients, thisMonth]);

  // ── Age distribution ──────────────────────────────────────────────────────
  const ageDist = useMemo(() => {
    const withDob = patients.filter(p => !!p.dateOfBirth);
    return AGE_GROUPS.map(g => ({
      label: g.label,
      value: withDob.filter(p => {
        const a = calcAge(p.dateOfBirth!);
        return a >= g.min && a <= g.max;
      }).length,
    }));
  }, [patients]);

  // ── Gender breakdown ──────────────────────────────────────────────────────
  const genderDist = useMemo(() => {
    const M = patients.filter(p => p.gender === "M").length;
    const F = patients.filter(p => p.gender === "F").length;
    const U = patients.length - M - F;
    return [
      { label: "Femmes",          value: F, color: "#c084fc" },
      { label: "Hommes",          value: M, color: "var(--blue)" },
      { label: "Non renseigné",   value: U, color: "var(--border-strong)" },
    ];
  }, [patients]);

  // ── Blood type distribution ───────────────────────────────────────────────
  const bloodDist = useMemo(() => {
    const counts = Object.fromEntries(BLOOD_TYPES.map(t => [t, 0]));
    for (const p of patients) {
      if (p.bloodType && counts[p.bloodType] !== undefined) counts[p.bloodType]++;
    }
    return BLOOD_TYPES
      .map(t => ({ label: t, value: counts[t] }))
      .filter(b => b.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  // ── Monthly consultations ─────────────────────────────────────────────────
  const monthlyAppts = useMemo(() => {
    return months12.map(({ key, label }) => ({
      label,
      value: appointments.filter(a => a.date.startsWith(key)).length,
    }));
  }, [appointments, months12]);

  // ── Monthly revenue ───────────────────────────────────────────────────────
  const monthlyRevenue = useMemo(() => {
    return months12.map(({ key, label }) => ({
      label,
      subLabel: "",
      value: Math.round(
        appointments
          .filter(a => a.billedAt && a.billedAt.startsWith(key))
          .reduce((s, a) => s + (a.billedAmount ?? 0), 0),
      ),
    }));
  }, [appointments, months12]);

  // ── Top patients ──────────────────────────────────────────────────────────
  const topPatients = useMemo(() => {
    const countMap = new Map<string, { name: string; id?: string; count: number; last: string }>();
    for (const a of appointments) {
      const key = a.patientId ?? a.patientName;
      const existing = countMap.get(key);
      if (existing) {
        existing.count++;
        if (a.date > existing.last) existing.last = a.date;
      } else {
        countMap.set(key, { name: a.patientName, id: a.patientId, count: 1, last: a.date });
      }
    }
    return [...countMap.values()]
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .slice(0, 8);
  }, [appointments]);

  // ── This-year totals ──────────────────────────────────────────────────────
  const yearTotals = useMemo(() => {
    const yearAppts = appointments.filter(a => a.date.startsWith(thisYear));
    return {
      total:     yearAppts.length,
      completed: yearAppts.filter(a => a.status === "completed").length,
      billed:    yearAppts.filter(a => !!a.billedAt).length,
      revenue:   yearAppts.reduce((s, a) => s + (a.billedAmount ?? 0), 0),
    };
  }, [appointments, thisYear]);

  const maxGender = Math.max(...genderDist.map(g => g.value), 1);

  return (
    <>
      {/* ── Patient KPIs ── */}
      <div className="ana-kpi-strip">
        <div className="ana-kpi" style={{ borderTopColor: "var(--blue)" }}>
          <div className="ana-kpi-val" style={{ color: "var(--blue)" }}>{kpis.total}</div>
          <div className="ana-kpi-lbl">Patients</div>
        </div>
        <div className="ana-kpi" style={{ borderTopColor: "var(--green)" }}>
          <div className="ana-kpi-val" style={{ color: "var(--green)" }}>
            {kpis.avgAge !== null ? `${kpis.avgAge} ans` : "—"}
          </div>
          <div className="ana-kpi-lbl">Âge moyen</div>
        </div>
        <div className="ana-kpi" style={{ borderTopColor: "#c084fc" }}>
          <div className="ana-kpi-val" style={{ color: "#c084fc" }}>{kpis.withCnops}</div>
          <div className="ana-kpi-lbl">Avec AMO/CNOPS</div>
        </div>
        <div className="ana-kpi" style={{ borderTopColor: "var(--gold)" }}>
          <div className="ana-kpi-val" style={{ color: "var(--gold)" }}>+{kpis.newThisMth}</div>
          <div className="ana-kpi-lbl">Nouveaux ce mois</div>
        </div>
      </div>

      <div className="ana-grid">
        {/* ── Demographics column ── */}
        <div className="ana-col">

          {/* Age distribution */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Répartition par âge</div>
              <span className="ana-card-sub">
                {patients.filter(p => p.dateOfBirth).length}/{patients.length} avec DDN
              </span>
            </div>
            <div style={{ padding: "0 18px 16px" }}>
              {ageDist.map((g, i) => (
                <HBar
                  key={g.label}
                  label={g.label}
                  value={g.value}
                  max={Math.max(...ageDist.map(a => a.value), 1)}
                  color={["#60a5fa","#34d399","#a78bfa","#fb923c","#f472b6"][i]}
                  pct
                />
              ))}
            </div>
          </div>

          {/* Gender breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Genre</div>
            </div>
            <div style={{ padding: "0 18px 16px" }}>
              {genderDist.map(g => (
                <HBar
                  key={g.label}
                  label={g.label}
                  value={g.value}
                  max={maxGender}
                  color={g.color}
                  pct
                />
              ))}
            </div>
          </div>

          {/* Blood types */}
          {bloodDist.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Groupes sanguins</div>
                <span className="ana-card-sub">
                  {patients.filter(p => p.bloodType).length} renseignés
                </span>
              </div>
              <div style={{ padding: "0 18px 16px" }}>
                {bloodDist.map(b => (
                  <HBar
                    key={b.label}
                    label={b.label}
                    value={b.value}
                    max={Math.max(...bloodDist.map(d => d.value), 1)}
                    color="var(--coral)"
                    pct
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Activity column ── */}
        <div className="ana-col">

          {/* Year summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Activité {thisYear}</div>
            </div>
            <div className="ana-year-kpis">
              {[
                { label: "RDV total",   value: yearTotals.total,     color: "var(--blue)" },
                { label: "Terminés",    value: yearTotals.completed, color: "var(--green)" },
                { label: "Facturés",    value: yearTotals.billed,    color: "var(--gold)" },
                { label: "CA",          value: formatMAD(yearTotals.revenue), color: "var(--navy)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="ana-year-kpi">
                  <div className="ana-year-val" style={{ color }}>{value}</div>
                  <div className="ana-year-lbl">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly consultations */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Consultations par mois</div>
              <span className="ana-card-sub">12 derniers mois</span>
            </div>
            <div style={{ padding: "0 18px 12px" }}>
              <BarChart data={monthlyAppts} color="var(--blue)" height={90} />
            </div>
          </div>

          {/* Monthly revenue */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Revenus facturés par mois</div>
              <span className="ana-card-sub">12 derniers mois</span>
            </div>
            <div style={{ padding: "0 18px 12px" }}>
              <BarChart data={monthlyRevenue} color="var(--green)" height={90} />
            </div>
          </div>

          {/* Top patients */}
          {topPatients.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Patients les plus fidèles</div>
                <span className="ana-card-sub">par nombre de visites</span>
              </div>
              <div className="ana-top-list">
                {topPatients.map((p, i) => (
                  <div key={p.name + p.id} className="ana-top-row">
                    <div className="ana-top-rank">{i + 1}</div>
                    <div className="ana-top-info">
                      {p.id
                        ? <Link to={`/patients/${p.id}`} className="ana-top-name">{p.name}</Link>
                        : <span className="ana-top-name">{p.name}</span>
                      }
                      <span className="ana-top-last">
                        Dernière visite :{" "}
                        {new Date(p.last + "T12:00:00").toLocaleDateString("fr-FR", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="ana-top-count">
                      <span className="ana-top-num">{p.count}</span>
                      <span className="ana-top-visits"> visite{p.count > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
