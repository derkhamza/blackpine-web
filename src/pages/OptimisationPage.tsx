import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { IRBracket } from "../engine";
import { loadFiscalYearConfig } from "../engine";
import { Layout } from "../components/Layout";
import { ActionIcon } from "../components/ActionIcon";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD } from "../lib/format";

// ── IR simulation helpers ──────────────────────────────────────────────────────

function calcGrossIR(income: number, brackets: IRBracket[]): number {
  if (income <= 0) return 0;
  for (const b of brackets) {
    if (income >= b.from && (b.to === null || income <= b.to)) {
      return Math.max(0, income * b.rate - b.deduction);
    }
  }
  return 0;
}

function simulateSaving(
  resFiscal: number,
  familyDeduction: number,
  cmBase: number,
  cmRate: number,
  brackets: IRBracket[],
  extraCharges: number,
): number {
  const newRes = Math.max(0, resFiscal - extraCharges);
  const irOld  = Math.max(0, calcGrossIR(resFiscal, brackets) - familyDeduction);
  const irNew  = Math.max(0, calcGrossIR(newRes,    brackets) - familyDeduction);
  const cmOld  = cmBase * cmRate;
  const cmNew  = cmBase * cmRate;
  const taxOld = Math.max(irOld, cmOld);
  const taxNew = Math.max(irNew, cmNew);
  return Math.max(0, taxOld - taxNew);
}

// ── Types ──────────────────────────────────────────────────────────────────────

type TipPriority = "urgent" | "important" | "conseil";

interface Tip {
  id:          string;
  priority:    TipPriority;
  icon:        string;
  title:       string;
  description: string;
  saving?:     number;
  action?:     { label: string; to: string };
}

// ── Bracket bar ────────────────────────────────────────────────────────────────

function BracketBar({
  brackets, resFiscal,
}: { brackets: IRBracket[]; resFiscal: number }) {
  const DISPLAY_MAX = 200_000;
  const finite = brackets.filter(b => b.to !== null) as (IRBracket & { to: number })[];
  const lastB  = brackets[brackets.length - 1];

  const finiteTotal = finite.reduce((s, b) => s + (b.to - b.from), 0);
  const lastVisual  = DISPLAY_MAX - finiteTotal;

  const RATE_COLORS: Record<number, string> = {
    0:    "#10B981",
    0.10: "#3B82F6",
    0.20: "#F59E0B",
    0.30: "#F97316",
    0.34: "#EF4444",
    0.38: "#991B1B",
  };

  const positionPct = resFiscal > 0
    ? Math.min((resFiscal / DISPLAY_MAX) * 100, 97)
    : 0;

  return (
    <div className="bracket-wrap">
      <div className="bracket-bar">
        {finite.map((b, i) => {
          const w = ((b.to - b.from) / DISPLAY_MAX) * 100;
          const active = resFiscal >= b.from && resFiscal <= b.to;
          return (
            <div
              key={i}
              className={`bracket-seg${active ? " active" : ""}`}
              style={{
                width: `${w}%`,
                background: active
                  ? RATE_COLORS[b.rate] ?? "#6B7280"
                  : (RATE_COLORS[b.rate] ?? "#6B7280") + "33",
                borderColor: RATE_COLORS[b.rate] ?? "#6B7280",
              }}
              title={`${b.rate * 100}% · ${formatMAD(b.from)} – ${formatMAD(b.to)}`}
            >
              <span className="bracket-seg-label">
                {b.rate === 0 ? "0%" : `${(b.rate * 100).toFixed(0)}%`}
              </span>
            </div>
          );
        })}
        {lastB && (
          <div
            className={`bracket-seg${resFiscal > (finite[finite.length - 1]?.to ?? 0) ? " active" : ""}`}
            style={{
              width: `${(lastVisual / DISPLAY_MAX) * 100}%`,
              background: resFiscal > (finite[finite.length - 1]?.to ?? 0)
                ? RATE_COLORS[lastB.rate] ?? "#991B1B"
                : (RATE_COLORS[lastB.rate] ?? "#991B1B") + "33",
              borderColor: RATE_COLORS[lastB.rate] ?? "#991B1B",
            }}
            title={`${lastB.rate * 100}% · > ${formatMAD(finite[finite.length - 1]?.to ?? 0)}`}
          >
            <span className="bracket-seg-label">{(lastB.rate * 100).toFixed(0)}%</span>
          </div>
        )}
        {resFiscal > 0 && (
          <div
            className="bracket-marker"
            style={{ left: `${positionPct}%` }}
          />
        )}
      </div>
      <div className="bracket-scale">
        <span>0</span>
        {finite.map(b => (
          <span key={b.to} style={{ left: `${(b.to / DISPLAY_MAX) * 100}%`, position: "absolute" }}>
            {b.to >= 1000 ? `${b.to / 1000}K` : b.to}
          </span>
        ))}
        <span style={{ position: "absolute", right: 0 }}>200K+</span>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function OptimisationPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t } = useTranslation();

  const {
    result, fiscalYear, assets, recurringRules, transactions,
  } = useApp();
  const { appointments } = useCabinet();

  const config = useMemo(() => {
    try { return loadFiscalYearConfig(fiscalYear); }
    catch { return null; }
  }, [fiscalYear]);

  const brackets = config?.irBracketsProfessional ?? [];

  const rec        = result.breakdown.totalRecettes;
  const chargesDed = result.breakdown.totalChargesDeductibles;
  const resFiscal  = result.breakdown.resultatFiscal;
  const taxDue     = result.tax.taxDue;
  const effRate    = result.tax.ir.effectiveRate;
  const regime     = result.tax.regime;
  const familyDed  = result.tax.familyDeduction;

  const cmRate = config?.cotisationMinimale.rateMedical ?? 0.005;

  const chargeRatio = rec > 0 ? chargesDed / rec : 0;

  const currentBracketIdx = brackets.findIndex(
    b => resFiscal >= b.from && (b.to === null || resFiscal <= b.to),
  );
  const currentBracket = brackets[currentBracketIdx];
  const lowerBracket   = currentBracketIdx > 0 ? brackets[currentBracketIdx - 1] : null;
  const upperBracket   = currentBracketIdx < brackets.length - 1
    ? brackets[currentBracketIdx + 1]
    : null;

  const marginToLower = lowerBracket?.to != null
    ? Math.max(0, resFiscal - lowerBracket.to)
    : 0;
  const marginToUpper = upperBracket?.from != null
    ? Math.max(0, upperBracket.from - resFiscal)
    : 0;

  const [simCharges, setSimCharges] = useState(5000);
  const simSaving = useMemo(
    () => simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, simCharges),
    [resFiscal, familyDed, rec, cmRate, brackets, simCharges],
  );
  const simNewRes = Math.max(0, resFiscal - simCharges);
  const simNewIR  = Math.max(0, calcGrossIR(simNewRes, brackets) - familyDed);

  const unbilledAppts = appointments.filter(
    a => a.status === "completed" && !a.billedAt,
  ).length;
  const cnopsPending = appointments.filter(
    a => a.reimbursementStatus === "pending",
  ).length;
  const cnopsAmount = appointments
    .filter(a => a.reimbursementStatus === "pending")
    .reduce((s, a) => s + (a.reimbursementAmount ?? 0), 0);

  const hasAssets    = assets.length > 0;
  const hasRecurring = recurringRules.filter(r => r.active).length > 0;

  const needsReview = transactions.filter(
    tx => tx.date.startsWith(String(fiscalYear)) && tx.deductibilityStatus === "NEEDS_REVIEW",
  ).length;

  const PRIORITY_META: Record<TipPriority, { labelKey: string; bg: string; border: string; color: string }> = {
    urgent:    { labelKey: "optimisation.tipPriUrgent",    bg: "var(--coral-soft)", border: "#FECACA", color: "var(--coral)" },
    important: { labelKey: "optimisation.tipPriImportant", bg: "var(--gold-soft)",  border: "#FDE68A", color: "var(--gold)" },
    conseil:   { labelKey: "optimisation.tipPriConseil",   bg: "var(--blue-soft)",  border: "var(--border-strong)", color: "var(--blue)" },
  };

  const tips = useMemo<Tip[]>(() => {
    const out: Tip[] = [];

    if (unbilledAppts > 0) {
      out.push({
        id: "unbilled", priority: "urgent", icon: "money",
        title: t("optimisation.tipUnbilledTitle", { n: unbilledAppts, s: unbilledAppts > 1 ? "s" : "" }),
        description: t("optimisation.tipUnbilledDesc", { n: unbilledAppts, s: unbilledAppts > 1 ? "s" : "" }),
        action: { label: t("optimisation.tipUnbilledAction"), to: "/agenda" },
      });
    }

    if (cnopsPending > 0) {
      const amountStr = cnopsAmount > 0 ? ` · ${formatMAD(cnopsAmount)}` : "";
      out.push({
        id: "cnops", priority: "urgent", icon: "hospital",
        title: t("optimisation.tipCnopsTitle", { n: cnopsPending, s: cnopsPending > 1 ? "s" : "", amount: amountStr }),
        description: t("optimisation.tipCnopsDesc"),
        action: { label: t("optimisation.tipCnopsAction"), to: "/agenda" },
        saving: cnopsAmount,
      });
    }

    if (needsReview > 0) {
      out.push({
        id: "review", priority: "important", icon: "search",
        title: t("optimisation.tipReviewTitle", { n: needsReview, s: needsReview > 1 ? "s" : "" }),
        description: t("optimisation.tipReviewDesc"),
        action: { label: t("optimisation.tipReviewAction"), to: "/transactions" },
      });
    }

    if (!hasAssets && rec > 50_000) {
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, 15_000);
      out.push({
        id: "assets", priority: "important", icon: "monitor",
        title: t("optimisation.tipAssetsTitle"),
        description: t("optimisation.tipAssetsDesc", { charge: formatMAD(3_000) }),
        action: { label: t("optimisation.tipAssetsAction"), to: "/comptabilite" },
        saving,
      });
    }

    if (!hasRecurring) {
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, 30_000);
      out.push({
        id: "recurring", priority: "important", icon: "repeat",
        title: t("optimisation.tipRecurTitle"),
        description: t("optimisation.tipRecurDesc"),
        action: { label: t("optimisation.tipRecurAction"), to: "/comptabilite" },
        saving: hasRecurring ? 0 : saving,
      });
    }

    if (chargeRatio < 0.25 && rec > 0) {
      const target = rec * 0.40;
      const extra  = Math.max(0, target - chargesDed);
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, extra);
      out.push({
        id: "ratio", priority: "important", icon: "chartBar",
        title: t("optimisation.tipRatioTitle", { rate: (chargeRatio * 100).toFixed(0) }),
        description: t("optimisation.tipRatioDesc", {
          rate: (chargeRatio * 100).toFixed(0),
          extra: formatMAD(extra),
          saving: formatMAD(saving),
        }),
        action: { label: t("optimisation.tipRatioAction"), to: "/transactions" },
        saving,
      });
    }

    if (lowerBracket?.to && marginToLower > 0 && marginToLower <= 25_000) {
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, marginToLower);
      out.push({
        id: "bracket", priority: "conseil", icon: "chartDown",
        title: t("optimisation.tipBracketTitle", { amount: formatMAD(marginToLower), rate: (lowerBracket.rate * 100).toFixed(0) }),
        description: t("optimisation.tipBracketDesc", {
          amount: formatMAD(marginToLower),
          rate: (lowerBracket.rate * 100).toFixed(0),
          saving: formatMAD(saving),
        }),
        saving,
      });
    }

    if (marginToUpper > 0 && marginToUpper <= 20_000 && upperBracket) {
      out.push({
        id: "upperBracket", priority: "conseil", icon: "chartUp",
        title: t("optimisation.tipUpperTitle", { amount: formatMAD(marginToUpper), rate: (upperBracket.rate * 100).toFixed(0) }),
        description: t("optimisation.tipUpperDesc", { amount: formatMAD(marginToUpper), rate: (upperBracket.rate * 100).toFixed(0) }),
      });
    }

    if (out.length === 0) {
      out.push({
        id: "good", priority: "conseil", icon: "check",
        title: t("optimisation.tipGoodTitle"),
        description: rec === 0
          ? t("optimisation.tipGoodDescEmpty", { year: fiscalYear })
          : t("optimisation.tipGoodDesc"),
      });
    }

    return out;
  }, [
    t, unbilledAppts, cnopsPending, cnopsAmount, needsReview, hasAssets, hasRecurring,
    chargeRatio, rec, chargesDed, resFiscal, familyDed, cmRate, brackets,
    lowerBracket, upperBracket, marginToLower, marginToUpper, fiscalYear,
  ]);

  const urgentCount    = tips.filter(tip => tip.priority === "urgent").length;
  const totalPotential = tips.reduce((s, tip) => s + (tip.saving ?? 0), 0);

  const body = (
    <>
      {/* ── Hero KPIs ── */}
      <div className="opt-hero-grid">
        <div className="opt-hero-card opt-hero-main">
          <div className="opt-hero-lbl">{t("optimisation.kpiTax", { year: fiscalYear })}</div>
          <div className="opt-hero-val">{formatMAD(taxDue)}</div>
          <div className="opt-hero-sub">
            {t("optimisation.kpiTaxSub", { regime, rate: (effRate * 100).toFixed(1) })}
          </div>
        </div>
        <div className="opt-hero-card">
          <div className="opt-hero-lbl">{t("optimisation.kpiFiscal")}</div>
          <div className="opt-hero-val" style={{ fontSize: 20 }}>{formatMAD(resFiscal)}</div>
          <div className="opt-hero-sub">
            {currentBracket
              ? t("optimisation.kpiFiscalSub", { rate: (currentBracket.rate * 100).toFixed(0) })
              : "—"}
          </div>
        </div>
        <div className="opt-hero-card">
          <div className="opt-hero-lbl">{t("optimisation.kpiRatio")}</div>
          <div
            className="opt-hero-val"
            style={{
              fontSize: 20,
              color: chargeRatio >= 0.35 ? "var(--green)" : chargeRatio >= 0.20 ? "var(--gold)" : "var(--coral)",
            }}
          >
            {rec > 0 ? `${(chargeRatio * 100).toFixed(0)}%` : "—"}
          </div>
          <div className="opt-hero-sub">{t("optimisation.kpiRatioTarget")}</div>
        </div>
        {urgentCount > 0 ? (
          <div className="opt-hero-card opt-hero-alert">
            <div className="opt-hero-lbl">{t("optimisation.kpiUrgent")}</div>
            <div className="opt-hero-val" style={{ color: "var(--coral)" }}>{urgentCount}</div>
            <div className="opt-hero-sub">{t("optimisation.kpiUrgentSub")}</div>
          </div>
        ) : (
          <div className="opt-hero-card">
            <div className="opt-hero-lbl">{t("optimisation.kpiPotential")}</div>
            <div className="opt-hero-val" style={{ fontSize: 20, color: "var(--green)" }}>
              {totalPotential > 0 ? formatMAD(totalPotential) : "—"}
            </div>
            <div className="opt-hero-sub">{t("optimisation.kpiPotentialSub")}</div>
          </div>
        )}
      </div>

      <div className="opt-2col">
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* IR bracket bar */}
          {brackets.length > 0 && (
            <div className="opt-card">
              <div className="opt-card-title">{t("optimisation.bracketsTitle", { year: fiscalYear })}</div>
              <BracketBar brackets={brackets} resFiscal={resFiscal} />
              <div className="opt-bracket-summary">
                <div>
                  <span className="opt-bracket-dot" style={{ background: "#F97316" }} />
                  {t("optimisation.bracketCurrent", { rate: currentBracket ? (currentBracket.rate * 100).toFixed(0) : "—" })}
                </div>
                {marginToLower > 0 && lowerBracket && (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {t("optimisation.bracketDown", { amount: formatMAD(marginToLower), rate: (lowerBracket.rate * 100).toFixed(0) })}
                  </div>
                )}
                {marginToUpper > 0 && upperBracket && (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {t("optimisation.bracketUp", { amount: formatMAD(marginToUpper), rate: (upperBracket.rate * 100).toFixed(0) })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Charge ratio gauge */}
          {rec > 0 && (
            <div className="opt-card">
              <div className="opt-card-title">{t("optimisation.ratioTitle")}</div>
              <div className="opt-ratio-row">
                <div className="opt-ratio-pct" style={{
                  color: chargeRatio >= 0.35 ? "var(--green)" : chargeRatio >= 0.20 ? "var(--gold)" : "var(--coral)",
                }}>
                  {(chargeRatio * 100).toFixed(1)}%
                </div>
                <div style={{ flex: 1 }}>
                  <div className="opt-ratio-bar-wrap">
                    <div className="opt-ratio-zone opt-zone-low" />
                    <div className="opt-ratio-zone opt-zone-mid" />
                    <div className="opt-ratio-zone opt-zone-good" />
                    <div className="opt-ratio-zone opt-zone-high" />
                    <div
                      className="opt-ratio-needle"
                      style={{ left: `${Math.min(chargeRatio * 100 * 2, 98)}%` }}
                    />
                  </div>
                  <div className="opt-ratio-labels">
                    <span>0%</span>
                    <span>20%</span>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>35–50%</span>
                    <span>50%+</span>
                  </div>
                </div>
              </div>
              <div className="opt-ratio-amounts">
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>{t("optimisation.ratioCharges")}</div>
                  <div style={{ fontWeight: 700 }}>{formatMAD(chargesDed)}</div>
                </div>
                <div style={{ color: "var(--muted)", alignSelf: "center" }}>÷</div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>{t("optimisation.ratioRecettes")}</div>
                  <div style={{ fontWeight: 700 }}>{formatMAD(rec)}</div>
                </div>
                <div style={{ color: "var(--muted)", alignSelf: "center" }}>=</div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>{t("optimisation.ratioRatio")}</div>
                  <div style={{ fontWeight: 700, color: chargeRatio >= 0.35 ? "var(--green)" : chargeRatio >= 0.20 ? "var(--gold)" : "var(--coral)" }}>
                    {(chargeRatio * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* What-if simulator */}
          {resFiscal > 0 && brackets.length > 0 && (
            <div className="opt-card">
              <div className="opt-card-title">{t("optimisation.simTitle")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                {t("optimisation.simSub")}
              </div>
              <div className="opt-sim-row">
                <span style={{ fontSize: 13, minWidth: 80 }}>{t("optimisation.simAmount", { amount: formatMAD(simCharges, { showCurrency: false }) })}</span>
                <input
                  type="range" min={1000} max={100000} step={1000}
                  value={simCharges}
                  onChange={e => setSimCharges(Number(e.target.value))}
                  className="opt-slider"
                />
              </div>
              <div className="opt-sim-result">
                <div className="opt-sim-item">
                  <div className="opt-sim-lbl">{t("optimisation.simNewFiscal")}</div>
                  <div className="opt-sim-val">{formatMAD(simNewRes)}</div>
                </div>
                <div className="opt-sim-arrow">→</div>
                <div className="opt-sim-item">
                  <div className="opt-sim-lbl">{t("optimisation.simNewIr")}</div>
                  <div className="opt-sim-val">{formatMAD(simNewIR)}</div>
                </div>
                <div className="opt-sim-arrow">→</div>
                <div className="opt-sim-item opt-sim-saving">
                  <div className="opt-sim-lbl">{t("optimisation.simSaving")}</div>
                  <div className="opt-sim-val" style={{ color: simSaving > 0 ? "var(--green)" : "var(--muted)" }}>
                    {simSaving > 0 ? `− ${formatMAD(simSaving)}` : "—"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
                {t("optimisation.simNote", { regime })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: tips ── */}
        <div className="opt-tips">
          <div className="opt-tips-header">
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {t("optimisation.tipsTitle")}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {t("optimisation.tipsCount", { n: tips.length, s: tips.length > 1 ? "s" : "" })}
              {totalPotential > 0 && ` ${t("optimisation.tipsPotential", { amount: formatMAD(totalPotential) })}`}
            </div>
          </div>

          {tips.map(tip => {
            const meta = PRIORITY_META[tip.priority];
            return (
              <div key={tip.id} className="opt-tip" style={{ background: meta.bg, borderColor: meta.border }}>
                <div className="opt-tip-top">
                  <span className="opt-tip-icon"><ActionIcon name={tip.icon} /></span>
                  <div className="opt-tip-content">
                    <div className="opt-tip-title">{tip.title}</div>
                    <span className="opt-tip-badge" style={{ background: meta.color + "22", color: meta.color }}>
                      {t(meta.labelKey)}
                    </span>
                  </div>
                  {tip.saving != null && tip.saving > 0 && (
                    <div className="opt-tip-saving">
                      <div style={{ fontSize: 10, color: "var(--green)", textTransform: "uppercase", fontWeight: 700 }}>{t("optimisation.tipEconomy")}</div>
                      <div style={{ fontWeight: 800, color: "var(--green)", fontSize: 14 }}>~{formatMAD(tip.saving)}</div>
                    </div>
                  )}
                </div>
                <div className="opt-tip-desc">{tip.description}</div>
                {tip.action && (
                  <Link to={tip.action.to} className="opt-tip-action">
                    {tip.action.label} →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
  if (noLayout) return body;
  return (
    <Layout title={t("optimisation.title")} subtitle={t("optimisation.subtitle", { year: fiscalYear })}>
      {body}
    </Layout>
  );
}
