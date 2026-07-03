import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { formatMAD } from "../lib/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { APPT_TYPE_LABELS, APPT_TYPE_COLORS } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateLong(iso: string, locale: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "long", year: "numeric",
  });
}
function fmtDateShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function getWeekdayShort(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2000, 0, 3 + i); // 2000-01-03 is Monday
    return d.toLocaleDateString(locale, { weekday: "short" });
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stats-section-card">
      <div className="stats-section-header">{title}</div>
      {children}
    </div>
  );
}

// Count-up when there's data, "—" when empty.
function StatNum({ value, format }: { value: number; format?: (n: number) => string }) {
  if (value <= 0) return <>—</>;
  return <AnimatedNumber value={value} format={format ?? ((n) => Math.round(n).toLocaleString("fr-FR"))} />;
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

export function StatsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const { appointments, patients } = useCabinet();
  const { transactions }           = useApp();

  const now       = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.toISOString().slice(0, 7);

  const weekdayLabels = getWeekdayShort(locale);

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

  // ── Acts performed ────────────────────────────────────────────────────────
  // Aggregate every billed line item across all appointments: how many times
  // each act was performed and how much revenue it brought in.
  const acteBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const a of appointments) {
      if (!a.billedItems) continue;
      for (const it of a.billedItems) {
        const label = it.label.trim();
        if (!label) continue;
        const e = map.get(label) ?? { count: 0, revenue: 0 };
        e.count   += it.qty;
        e.revenue += it.unitPrice * it.qty;
        map.set(label, e);
      }
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  }, [appointments]);
  const maxActeCount   = acteBreakdown[0]?.count ?? 1;
  const acteTotalCount = acteBreakdown.reduce((s, a) => s + a.count, 0);
  const acteTotalRev   = acteBreakdown.reduce((s, a) => s + a.revenue, 0);

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = completedAppts.length === 0;

  const body = (
    <>
      {/* ── Hero ── */}
      <div className="stats-hero">
        <div className="stats-hero-highlight" />
        <div className="stats-hero-label">{t("stats.heroLabel")}</div>
        <div className="stats-hero-number">
          {isEmpty ? "—" : <AnimatedNumber value={totalConsultations} format={(n) => Math.round(n).toLocaleString(locale)} />}
        </div>
        <div className="stats-hero-sub">
          {firstDate
            ? t("stats.heroSince", { date: fmtDateLong(firstDate, locale) })
            : t("stats.heroEmpty")}
        </div>
      </div>

      {/* ── Layout grid ── */}
      <div className="stats-page-grid">

        {/* Left column */}
        <div className="stats-col">

          {/* Cette année */}
          <SectionCard title={t("stats.thisYear", { year: thisYear })}>
            <div className="stats-kpi-3col">
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: "var(--green)" }}>
                  <StatNum value={thisYearRevenue} format={formatMAD} />
                </div>
                <div className="stats-kpi-cell-label">{t("stats.kpiRevenue")}</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: "var(--blue)" }}>
                  <StatNum value={thisYearAppts.length} />
                </div>
                <div className="stats-kpi-cell-label">{t("stats.kpiConsultations")}</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big">
                  <StatNum value={thisYearUniqPatients} />
                </div>
                <div className="stats-kpi-cell-label">{t("stats.kpiPatients")}</div>
              </div>
            </div>
          </SectionCard>

          {/* Records */}
          {!isEmpty && (
            <SectionCard title={t("stats.records")}>
              {bestDay && (
                <RecordRow
                  icon="📅"
                  label={t("stats.bestDay")}
                  value={t("stats.bestDayCount", { n: bestDay.count, s: bestDay.count > 1 ? "s" : "" })}
                  sub={fmtDateShort(bestDay.date)}
                />
              )}
              {mostLoyal && mostLoyal.count > 1 && (
                <>
                  <div className="stats-record-divider" />
                  <RecordRow
                    icon="⭐"
                    label={t("stats.mostLoyal")}
                    value={mostLoyal.name.split(" ")[0]}
                    sub={t("stats.mostLoyalSub", { n: mostLoyal.count })}
                  />
                </>
              )}
              {topType && (
                <>
                  <div className="stats-record-divider" />
                  <RecordRow
                    icon="🩺"
                    label={t("stats.topAct")}
                    value={APPT_TYPE_LABELS[topType[0] as keyof typeof APPT_TYPE_LABELS] ?? topType[0]}
                    sub={t("stats.topActSub", { n: topType[1] })}
                  />
                </>
              )}
              {!bestDay && !mostLoyal && !topType && (
                <div className="stats-empty-hint">{t("stats.noData")}</div>
              )}
            </SectionCard>
          )}

          {/* Weekday chart */}
          {!isEmpty && (
            <SectionCard title={t("stats.weekdays")}>
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
                        {weekdayLabels[idx]}
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
          <SectionCard title={t("stats.portfolio")}>
            <div className="stats-kpi-3col">
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: "var(--blue)" }}>
                  <StatNum value={totalPatients} />
                </div>
                <div className="stats-kpi-cell-label">{t("stats.portfolioReg")}</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: newThisMonth > 0 ? "var(--green)" : undefined }}>
                  <StatNum value={newThisMonth} format={(n) => "+" + Math.round(n).toLocaleString("fr-FR")} />
                </div>
                <div className="stats-kpi-cell-label">{t("stats.portfolioMonth")}</div>
              </div>
              <div className="stats-kpi-divider" />
              <div className="stats-kpi-cell">
                <div className="stats-kpi-big" style={{ color: cnopsPatients > 0 ? "#6b46c1" : undefined }}>
                  <StatNum value={cnopsPatients} />
                </div>
                <div className="stats-kpi-cell-label">{t("stats.portfolioCnops")}</div>
              </div>
            </div>

            {returnRate > 0 && (
              <div className="stats-return-rate">
                <div className="stats-return-header">
                  <span className="stats-return-label">{t("stats.returnRate")}</span>
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
                <div className="stats-return-sub">{t("stats.returnSub")}</div>
              </div>
            )}
          </SectionCard>

          {/* Type breakdown */}
          {typeBreakdown.length > 0 && (
            <SectionCard title={t("stats.byType")}>
              <div className="stats-type-list">
                {typeBreakdown.map(([type, count], idx) => {
                  const color = (APPT_TYPE_COLORS as Record<string, string>)[type] ?? "var(--blue)";
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

          {/* Acts performed */}
          {acteBreakdown.length > 0 && (
            <SectionCard title={t("stats.actesTitle")}>
              <div className="stats-kpi-sub" style={{ padding: "0 0 8px" }}>
                {t("stats.actesSummary", { n: acteTotalCount, rev: formatMAD(acteTotalRev) })}
              </div>
              <div className="stats-type-list">
                {acteBreakdown.map((acte, idx) => {
                  const pct = Math.round((acte.count / maxActeCount) * 100);
                  return (
                    <div key={acte.label}>
                      {idx > 0 && <div className="stats-type-divider" />}
                      <div className="stats-type-row">
                        <div className="stats-type-dot" style={{ background: "var(--green)" }} />
                        <span className="stats-type-label" title={acte.label}>{acte.label}</span>
                        <div className="stats-type-bar-track">
                          <div
                            className="stats-type-bar-fill"
                            style={{ width: `${pct}%`, background: "var(--green)", opacity: 0.8 }}
                          />
                        </div>
                        <span className="stats-acte-count">
                          <span className="stats-type-count" style={{ color: "var(--green)" }}>{acte.count}×</span>
                          <span className="stats-acte-rev">{formatMAD(acte.revenue)}</span>
                        </span>
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
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("stats.emptyTitle")}</div>
              <div style={{ fontSize: 13 }}>{t("stats.emptyHint")}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title={t("stats.title")}
      subtitle={t("stats.subtitle", { year: thisYear, n: totalConsultations, s: totalConsultations !== 1 ? "s" : "" })}
    >
      {body}
    </Layout>
  );
}
