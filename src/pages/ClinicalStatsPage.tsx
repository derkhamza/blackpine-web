import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCabinet } from "../context/CabinetContext";
import { AnimatedNumber } from "../components/AnimatedNumber";
import {
  CERT_TYPE_LABELS, CERT_TYPE_COLORS,
  EXAM_TYPE_LABELS, EXAM_TYPE_COLORS,
  TELE_STATUS_LABELS,
} from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function topFreq(items: (string | undefined | null)[], n = 10) {
  const map = new Map<string, { display: string; count: number }>();
  for (const raw of items) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const existing = map.get(key);
    if (existing) { existing.count++; }
    else { map.set(key, { display: trimmed, count: 1 }); }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function KpiCard({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="ana-kpi" style={{ borderTopColor: color ?? "var(--blue)" }}>
      <div className="ana-kpi-val" style={{ color: color ?? "var(--blue)" }}>
        {typeof value === "number"
          ? <AnimatedNumber value={value} format={(n) => Math.round(n).toLocaleString("fr-FR")} />
          : value}
      </div>
      <div className="ana-kpi-lbl">{label}</div>
    </div>
  );
}

function HBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="clin-hbar-row">
      <div className="clin-hbar-label" title={label}>{label}</div>
      <div className="clin-hbar-track">
        <div className="clin-hbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="clin-hbar-count">{value}</div>
    </div>
  );
}

function SectionCard({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">{title}</div>
        {sub && <span className="ana-card-sub">{sub}</span>}
      </div>
      <div style={{ padding: "0 18px 16px" }}>{children}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div style={{ color: "var(--muted)", fontSize: 12.5, padding: "8px 0" }}>{text}</div>;
}

// ── Main exported component ───────────────────────────────────────────────────

export function ClinicalStatsContent() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const { appointments, prescriptions, examResults, certificates, teleSessions } = useCabinet();

  const doneAppts = useMemo(
    () => appointments.filter(a => a.status === "completed"),
    [appointments],
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const noteRate = useMemo(() => {
    if (doneAppts.length === 0) return 0;
    const withNote = doneAppts.filter(
      a => a.consultationNote?.diagnosis || a.consultationNote?.motif,
    ).length;
    return Math.round((withNote / doneAppts.length) * 100);
  }, [doneAppts]);

  // ── Motifs ────────────────────────────────────────────────────────────────
  const topMotifs = useMemo(
    () => topFreq(doneAppts.map(a => a.consultationNote?.motif)),
    [doneAppts],
  );
  const maxMotif = topMotifs[0]?.count ?? 1;

  // ── Diagnostics ───────────────────────────────────────────────────────────
  const topDiagnoses = useMemo(
    () => topFreq(doneAppts.map(a => a.consultationNote?.diagnosis)),
    [doneAppts],
  );
  const maxDiag = topDiagnoses[0]?.count ?? 1;

  // ── Médicaments ───────────────────────────────────────────────────────────
  const topDrugs = useMemo(() => {
    const lines: string[] = [];
    for (const p of prescriptions) {
      for (const line of p.lines) { if (line.drug?.trim()) lines.push(line.drug.trim()); }
    }
    for (const a of doneAppts) {
      const saved = (a as any).savedOrdonnance;
      if (saved?.lines) {
        for (const line of saved.lines) {
          if (line.drug?.trim()) lines.push(line.drug.trim());
        }
      }
    }
    return topFreq(lines);
  }, [prescriptions, doneAppts]);
  const maxDrug = topDrugs[0]?.count ?? 1;

  // ── Examens par type ──────────────────────────────────────────────────────
  const examBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of examResults) map[e.type] = (map[e.type] ?? 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [examResults]);
  const maxExam = examBreakdown[0]?.[1] ?? 1;

  // ── Certificats par type ──────────────────────────────────────────────────
  const certBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of certificates) map[c.type] = (map[c.type] ?? 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [certificates]);
  const maxCert = certBreakdown[0]?.[1] ?? 1;

  // ── Téléconsultations ─────────────────────────────────────────────────────
  const teleBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const session of teleSessions) map[session.status] = (map[session.status] ?? 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [teleSessions]);
  const maxTele = teleBreakdown[0]?.[1] ?? 1;

  // ── Monthly prescription trend (last 6 months) ────────────────────────────
  const now = new Date();
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleDateString(locale, { month: "short" }),
    };
  });

  const rxTrend = useMemo(() => {
    return last6.map(({ key, label }) => ({
      label,
      value: prescriptions.filter(p => p.date.startsWith(key)).length,
    }));
  }, [prescriptions]);
  const maxRx = Math.max(...rxTrend.map(m => m.value), 1);

  return (
    <>
      {/* KPI strip */}
      <div className="ana-kpi-strip">
        <KpiCard value={prescriptions.length}  label={t("clinicalStats.kpiOrdonnances")} color="var(--green)"  />
        <KpiCard value={examResults.length}    label={t("clinicalStats.kpiExamens")}     color="#9B72D0"       />
        <KpiCard value={teleSessions.length}   label={t("clinicalStats.kpiTeleconsults")} color="var(--blue)"  />
        <KpiCard value={certificates.length}   label={t("clinicalStats.kpiCertificats")} color="var(--gold)"   />
      </div>

      {/* Note completeness */}
      {doneAppts.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              {t("clinicalStats.noteRate")}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: noteRate >= 70 ? "var(--green)" : noteRate >= 40 ? "var(--gold)" : "var(--coral)",
            }}>
              {noteRate}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${noteRate}%`,
              background: noteRate >= 70 ? "var(--green)" : noteRate >= 40 ? "var(--gold)" : "var(--coral)",
              transition: "width 0.4s",
            }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
            {t("clinicalStats.noteSub")}
          </div>
        </div>
      )}

      <div className="ana-grid">
        {/* Left column */}
        <div className="ana-col">

          <SectionCard
            title={t("clinicalStats.motifsTitle")}
            sub={t("clinicalStats.motifsSub", { n: topMotifs.length, s: topMotifs.length !== 1 ? "s" : "" })}
          >
            {topMotifs.length === 0
              ? <EmptyHint text={t("clinicalStats.motifsEmpty")} />
              : topMotifs.map(({ display, count }) => (
                <HBar key={display} label={display} value={count} max={maxMotif} color="var(--blue)" />
              ))
            }
          </SectionCard>

          <SectionCard
            title={t("clinicalStats.diagTitle")}
            sub={t("clinicalStats.diagSub", { n: topDiagnoses.length, s: topDiagnoses.length !== 1 ? "s" : "" })}
          >
            {topDiagnoses.length === 0
              ? <EmptyHint text={t("clinicalStats.diagEmpty")} />
              : topDiagnoses.map(({ display, count }) => (
                <HBar key={display} label={display} value={count} max={maxDiag} color="#15A876" />
              ))
            }
          </SectionCard>

          {prescriptions.length > 0 && (
            <SectionCard title={t("clinicalStats.rxTitle")} sub={t("clinicalStats.rxSub")}>
              <div className="clin-rx-trend">
                {rxTrend.map(({ label, value }) => {
                  const h = maxRx > 0 ? Math.max(4, (value / maxRx) * 80) : 0;
                  const isPeak = value === maxRx && value > 0;
                  return (
                    <div key={label} className="clin-rx-bar-wrap">
                      <div className="clin-rx-count" style={{ color: isPeak ? "var(--navy)" : "var(--muted)" }}>
                        {value > 0 ? value : ""}
                      </div>
                      <div className="clin-rx-bar-track">
                        <div className="clin-rx-bar-fill" style={{
                          height: h,
                          background: isPeak ? "var(--green)" : "rgba(21,168,118,0.35)",
                        }} />
                      </div>
                      <div className="clin-rx-label">{label}</div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right column */}
        <div className="ana-col">

          <SectionCard
            title={t("clinicalStats.drugsTitle")}
            sub={t("clinicalStats.drugsSub", { n: topDrugs.length, s: topDrugs.length !== 1 ? "s" : "" })}
          >
            {topDrugs.length === 0
              ? <EmptyHint text={t("clinicalStats.drugsEmpty")} />
              : topDrugs.map(({ display, count }) => (
                <HBar key={display} label={display} value={count} max={maxDrug} color="#9B72D0" />
              ))
            }
          </SectionCard>

          {examBreakdown.length > 0 && (
            <SectionCard title={t("clinicalStats.examsTitle")}>
              {examBreakdown.map(([type, count]) => (
                <HBar
                  key={type}
                  label={EXAM_TYPE_LABELS[type as keyof typeof EXAM_TYPE_LABELS] ?? type}
                  value={count}
                  max={maxExam}
                  color={EXAM_TYPE_COLORS[type as keyof typeof EXAM_TYPE_COLORS] ?? "var(--blue)"}
                />
              ))}
            </SectionCard>
          )}

          {certBreakdown.length > 0 && (
            <SectionCard title={t("clinicalStats.certsTitle")}>
              {certBreakdown.map(([type, count]) => (
                <HBar
                  key={type}
                  label={CERT_TYPE_LABELS[type as keyof typeof CERT_TYPE_LABELS] ?? type}
                  value={count}
                  max={maxCert}
                  color={CERT_TYPE_COLORS[type as keyof typeof CERT_TYPE_COLORS] ?? "var(--gold)"}
                />
              ))}
            </SectionCard>
          )}

          {teleSessions.length > 0 && (
            <SectionCard title={t("clinicalStats.teleTitle")} sub={t("clinicalStats.teleSub", { n: teleSessions.length })}>
              {teleBreakdown.map(([status, count]) => (
                <HBar
                  key={status}
                  label={TELE_STATUS_LABELS[status as keyof typeof TELE_STATUS_LABELS] ?? status}
                  value={count}
                  max={maxTele}
                  color="var(--blue)"
                />
              ))}
            </SectionCard>
          )}

          {examBreakdown.length === 0 && certBreakdown.length === 0 && teleSessions.length === 0 && topDrugs.length === 0 && (
            <div className="tx-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>🩺</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("clinicalStats.emptyTitle")}</div>
              <div style={{ fontSize: 13 }}>{t("clinicalStats.emptyHint")}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
