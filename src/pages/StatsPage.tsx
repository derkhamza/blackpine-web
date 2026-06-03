import { useMemo } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { formatMAD } from "../lib/format";
import { APPT_TYPE_LABELS } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateLong(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function fmtDateShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const TYPE_COLORS: Record<string, string> = {
  consultation: "#1890C5",
  suivi:        "#15A876",
  procedure:    "#9B72D0",
  urgence:      "#E85B5B",
  autre:        "#D4962A",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stats-section-card">
      <div className="stats-section-header">{title}</div>
      {children}
    </div>
  );
}

function KpiRow({ label, value, color, sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="stats-kpi-row">
      <span className="stats-kpi-label">{label}</span>
      <div style={{ textAlign: "right" }}>
        <span className="stats-kpi-value" style={{ color }}>{value}</span>
        {sub && <div className="stats-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function RecordRow({ icon, label, value, sub }: {
  icon: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="stats-record-row">
      <div className="stats-record-icon">{icon}</div>
      <div className="stats-record-text">
        <div className="stats-record-label">{label}</div>
        <div className="stats-record-value">{value}</div>
        {sub && <div className="stats-record-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function StatsPage() {
  const { appointments, patients } = useCabinet();
  const { transactions }           = useApp();

  const now       = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.toISOString().slice(0, 7);

  // ── Core datasets ─────────────────────────────────────────────────────────
  const completedAppts = useMemo(
    () => appointments.filter((a) => a.status === "completed"),
    [appointments],
  );

  // ── Hero ──────────────────────────────────────────────────────────────────
  const totalConsultations = completedAppts.length;

  const firstDate = useMemo(
    () =>
      completedAppts.length > 0
        ? completedAppts.reduce((min, a) => (a.date < min ? a.date : min), completedAppts[0].date)
        : null,
    [completedAppts],
  );

  // ── Cette année ───────────────────────────────────────────────────────────
  const thisYearAppts = useMemo(
    () => completedAppts.filter((a) => a.date.startsWith(String(thisYear))),
    [completedAppts, thisYear],
  );

  const thisYearRevenue = useMemo(
    () =>
      transactions
        .filter((tx) => tx.date.startsWith(String(thisYear)) && tx.type === "RECETTE")
        .reduce((s, tx) => s + tx.amount, 0),
    [transactions, thisYear],
  );

  const thisYearUniqPatients = useMemo(
    () => new Set(thisYearAppts.map((a) => a.patientId ?? a.patientName)).size,
    [thisYearAppts],
  );

  // ── Records ───────────────────────────────────────────────────────────────
  const bestDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of completedAppts) map[a.date] = (map[a.date] ?? 0) + 1;
    const entries = Object.entries(map);
    if (entries.length === 0) return null;
    const [date, count] = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
    return { date, count };
  }, [completedAppts]);

  const mostLoyal = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    for (const a of completedAppts) {
      const key = a.patientId ?? a.patientName;
      if (!map[key]) map[key] = { name: a.patientName, count: 0 };
      map[key].count++;
    }
    const entries = Object.values(map);
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => (e.count > best.count ? e : best));
  }, [completedAppts]);

  const topType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of completedAppts) map[a.type] = (map[a.type] ?? 0) + 1;
    const entries = Object.entries(map);
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => (e[1] > best[1] ? e : best));
  }, [completedAppts]);

  // ── Weekday distribution ──────────────────────────────────────────────────
  const weekdayCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Mon … Sun
    for (const a of completedAppts) {
      const d = new Date(a.date + "T12:00:00").getDay(); // 0=Sun
      counts[d === 0 ? 6 : d - 1]++;
    }
    return counts;
  }, [completedAppts]);
  const maxWeekday = Math.max(...weekdayCounts, 1);

  // ── Patient portfolio ─────────────────────────────────────────────────────
  const totalPatients = patients.length;
  const newThisMonth  = patients.filter((p) => p.createdAt?.startsWith(thisMonth)).length;
  const cnopsPatients = patients.filter((p) => !!p.cnopsNumber).length;

  const returnRate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of completedAppts) {
      const key = a.patientId ?? a.patientName;
      map[key] = (map[key] ?? 0) + 1;
    }
    const total = Object.keys(map).length;
    if (total === 0) return 0;
    const returning = Object.values(map).filter((c) => c > 1).length;
    return Math.round((returning / total) * 100);
  }, [completedAppts]);

  // ── Type breakdown ────────────────────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of completedAppts) map[a.type] = (map[a.type] ?? 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [completedAppts]);
  const maxTypeCount = typeBreakdown[0]?.[1] ?? 1;

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = completedAppts.length === 0;

  return (
    <Layout
      title="Activité du cabinet"
      subtitle={`${thisYear} · ${totalConsultations} consultation${totalConsultations !== 1 ? "s" : ""} au total`}
    >
      {/* ── Hero ── */}
      <div className="stats-hero">
        <div className="stats-hero-highlight" />
        <div className="stats-hero-label">Consultations réalisées</div>
        <div className="stats-hero-number">
          {isEmpty ? "—" : totalConsultations.toLocaleString("fr-FR")}
        </div>
        <div className="stats-hero-sub">
          {firstDate
            ? `depuis le ${fmtDateLong(firstDate)}`
            : "Aucune consultation terminée enregistrée"}
        </div>
      </div>

      {/* ── Layout grid ── */}
      <div className="stats-page-grid">

        {/* Left column */}
        <div className="stats-col">

          {/* Cette année */}
          <SectionCard title={`Cette année · ${thisYear}`}>
            <div className="stats-kpi-3col">
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: "var(--green)" }}>
                  {thisYearRevenue > 0 ? formatMAD(thisYearRevenue) : "—"}
                </div>
                <div className="stats-kpi-cell-label">Recettes</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: "var(--blue)" }}>
                  {thisYearAppts.length > 0 ? String(thisYearAppts.length) : "—"}
                </div>
                <div className="stats-kpi-cell-label">Consultations</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big">
                  {thisYearUniqPatients > 0 ? String(thisYearUniqPatients) : "—"}
                </div>
                <div className="stats-kpi-cell-label">Patients vus</div>
              </div>
            </div>
          </SectionCard>

          {/* Records */}
          {!isEmpty && (
            <SectionCard title="Vos records">
              {bestDay && (
                <RecordRow
                  icon="📅"
                  label="Meilleure journée"
                  value={`${bestDay.count} consultation${bestDay.count > 1 ? "s" : ""}`}
                  sub={fmtDateShort(bestDay.date)}
                />
              )}
              {mostLoyal && mostLoyal.count > 1 && (
                <>
                  <div className="stats-record-divider" />
                  <RecordRow
                    icon="⭐"
                    label="Patient le plus fidèle"
                    value={mostLoyal.name.split(" ")[0]}
                    sub={`${mostLoyal.count} visites`}
                  />
                </>
              )}
              {topType && (
                <>
                  <div className="stats-record-divider" />
                  <RecordRow
                    icon="🩺"
                    label="Acte le plus fréquent"
                    value={APPT_TYPE_LABELS[topType[0] as keyof typeof APPT_TYPE_LABELS] ?? topType[0]}
                    sub={`${topType[1]} fois`}
                  />
                </>
              )}
              {!bestDay && !mostLoyal && !topType && (
                <div className="stats-empty-hint">Pas encore de données</div>
              )}
            </SectionCard>
          )}

          {/* Weekday chart */}
          {!isEmpty && (
            <SectionCard title="Jours les plus actifs">
              <div className="weekday-chart">
                {weekdayCounts.map((count, idx) => {
                  const isPeak = count === maxWeekday && count > 0;
                  const heightPct = count > 0 ? Math.max(8, (count / maxWeekday) * 100) : 0;
                  return (
                    <div key={idx} className="weekday-bar-wrap">
                      <div className="weekday-bar-track">
                        <div
                          className="weekday-bar-fill"
                          style={{
                            height: `${heightPct}%`,
                            background: isPeak ? "var(--navy)" : "var(--blue-soft)",
                            borderColor: isPeak ? "var(--navy)" : "var(--blue)",
                          }}
                        />
                      </div>
                      {count > 0 && (
                        <div
                          className="weekday-bar-count"
                          style={{ fontWeight: isPeak ? 800 : 500, color: isPeak ? "var(--navy)" : "var(--muted)" }}
                        >
                          {count}
                        </div>
                      )}
                      <div
                        className="weekday-bar-label"
                        style={{ fontWeight: isPeak ? 700 : 500, color: isPeak ? "var(--navy)" : "var(--tertiary)" }}
                      >
                        {WEEKDAY_LABELS[idx]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right column */}
        <div className="stats-col">

          {/* Patient portfolio */}
          <SectionCard title="Portefeuille patients">
            <div className="stats-kpi-3col">
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: "var(--blue)" }}>
                  {totalPatients > 0 ? String(totalPatients) : "—"}
                </div>
                <div className="stats-kpi-cell-label">Enregistrés</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: newThisMonth > 0 ? "var(--green)" : undefined }}>
                  {newThisMonth > 0 ? `+${newThisMonth}` : "—"}
                </div>
                <div className="stats-kpi-cell-label">Ce mois</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: cnopsPatients > 0 ? "#6b46c1" : undefined }}>
                  {cnopsPatients > 0 ? String(cnopsPatients) : "—"}
                </div>
                <div className="stats-kpi-cell-label">AMO/CNOPS</div>
              </div>
            </div>

            {returnRate > 0 && (
              <div className="stats-return-rate">
                <div className="stats-return-header">
                  <span className="stats-return-label">Taux de fidélisation</span>
                  <span
                    className="stats-return-pct"
                    style={{
                      color: returnRate >= 50 ? "var(--green)" : returnRate >= 25 ? "var(--gold)" : "var(--muted)",
                    }}
                  >
                    {returnRate}%
                  </span>
                </div>
                <div className="stats-return-track">
                  <div
                    className="stats-return-fill"
                    style={{
                      width: `${returnRate}%`,
                      background: returnRate >= 50 ? "var(--green)" : returnRate >= 25 ? "var(--gold)" : "var(--tertiary)",
                    }}
                  />
                </div>
                <div className="stats-return-sub">patients avec plusieurs consultations</div>
              </div>
            )}
          </SectionCard>

          {/* Type breakdown */}
          {typeBreakdown.length > 0 && (
            <SectionCard title="Par type d'acte">
              <div className="stats-type-list">
                {typeBreakdown.map(([type, count], idx) => {
                  const color = TYPE_COLORS[type] ?? "var(--blue)";
                  const pct   = Math.round((count / maxTypeCount) * 100);
                  return (
                    <div key={type}>
                      {idx > 0 && <div className="stats-type-divider" />}
                      <div className="stats-type-row">
                        <div className="stats-type-dot" style={{ background: color }} />
                        <span className="stats-type-label">
                          {APPT_TYPE_LABELS[type as keyof typeof APPT_TYPE_LABELS] ?? type}
                        </span>
                        <div className="stats-type-bar-track">
                          <div
                            className="stats-type-bar-fill"
                            style={{ width: `${pct}%`, background: color + "cc" }}
                          />
                        </div>
                        <span className="stats-type-count" style={{ color }}>{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="tx-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucune donnée disponible</div>
              <div style={{ fontSize: 13 }}>
                Marquez des rendez-vous comme «&nbsp;Terminés&nbsp;» dans l'agenda pour voir
                les statistiques de votre cabinet ici.
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
