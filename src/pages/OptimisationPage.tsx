import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { IRBracket } from "../engine";
import { loadFiscalYearConfig } from "../engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD } from "../lib/format";

// ── IR simulation helpers ──────────────────────────────────────────────────────

/** Compute gross IR from brackets using the Moroccan formula: income×rate − deduction */
function calcGrossIR(income: number, brackets: IRBracket[]): number {
  if (income <= 0) return 0;
  for (const b of brackets) {
    if (income >= b.from && (b.to === null || income <= b.to)) {
      return Math.max(0, income * b.rate - b.deduction);
    }
  }
  return 0;
}

/** How much IR saved by adding extraCharges (reduces résultat fiscal) */
function simulateSaving(
  resFiscal: number,
  familyDeduction: number,
  cmBase: number,
  cmRate: number,
  brackets: IRBracket[],
  extraCharges: number,
): number {
  const newRes     = Math.max(0, resFiscal - extraCharges);
  const irOld      = Math.max(0, calcGrossIR(resFiscal, brackets) - familyDeduction);
  const irNew      = Math.max(0, calcGrossIR(newRes,    brackets) - familyDeduction);
  const cmOld      = cmBase * cmRate;
  const cmNew      = cmBase * cmRate; // CM based on recettes, unaffected by charges
  const taxOld     = Math.max(irOld, cmOld);
  const taxNew     = Math.max(irNew, cmNew);
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

const PRIORITY_META: Record<TipPriority, { label: string; bg: string; border: string; color: string }> = {
  urgent:    { label: "Urgent",    bg: "var(--coral-soft)", border: "#FECACA", color: "var(--coral)" },
  important: { label: "Important", bg: "var(--gold-soft)",  border: "#FDE68A", color: "var(--gold)" },
  conseil:   { label: "Conseil",   bg: "var(--blue-soft)",  border: "var(--border-strong)", color: "var(--blue)" },
};

// ── Bracket bar ────────────────────────────────────────────────────────────────

function BracketBar({
  brackets, resFiscal,
}: { brackets: IRBracket[]; resFiscal: number }) {
  // Only show brackets up to 200K; last bracket is visual only
  const DISPLAY_MAX = 200_000;
  const finite = brackets.filter(b => b.to !== null) as (IRBracket & { to: number })[];
  const lastB  = brackets[brackets.length - 1];

  // Total visual width from finite brackets
  const finiteTotal = finite.reduce((s, b) => s + (b.to - b.from), 0);
  const lastVisual  = DISPLAY_MAX - finiteTotal; // remaining visual for last bracket

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
        {/* Last bracket (infinite) */}
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
        {/* Current position marker */}
        {resFiscal > 0 && (
          <div
            className="bracket-marker"
            style={{ left: `${positionPct}%` }}
            title={`Résultat fiscal : ${formatMAD(resFiscal)}`}
          />
        )}
      </div>
      {/* Scale labels */}
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

  // CM rate from config
  const cmRate = config?.cotisationMinimale.rateMedical ?? 0.005;

  const chargeRatio = rec > 0 ? chargesDed / rec : 0;

  // Find current bracket index
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

  // What-if simulator
  const [simCharges, setSimCharges] = useState(5000);
  const simSaving = useMemo(
    () => simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, simCharges),
    [resFiscal, familyDed, rec, cmRate, brackets, simCharges],
  );
  const simNewRes = Math.max(0, resFiscal - simCharges);
  const simNewIR  = Math.max(0, calcGrossIR(simNewRes, brackets) - familyDed);

  // Pending actions
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

  // NEEDS_REVIEW transactions
  const needsReview = transactions.filter(
    t => t.date.startsWith(String(fiscalYear)) && t.deductibilityStatus === "NEEDS_REVIEW",
  ).length;

  // Generate tips
  const tips = useMemo<Tip[]>(() => {
    const out: Tip[] = [];

    if (unbilledAppts > 0) {
      out.push({
        id: "unbilled", priority: "urgent", icon: "💰",
        title: `${unbilledAppts} rendez-vous non facturé${unbilledAppts > 1 ? "s" : ""}`,
        description: `Vous avez ${unbilledAppts} consultation${unbilledAppts > 1 ? "s" : ""} terminée${unbilledAppts > 1 ? "s" : ""} sans recette associée. Chaque rendez-vous non facturé sous-déclare votre revenu réel.`,
        action: { label: "Aller à l'agenda", to: "/agenda" },
      });
    }

    if (cnopsPending > 0) {
      out.push({
        id: "cnops", priority: "urgent", icon: "🏥",
        title: `${cnopsPending} dossier${cnopsPending > 1 ? "s" : ""} CNOPS en attente${cnopsAmount > 0 ? ` · ${formatMAD(cnopsAmount)}` : ""}`,
        description: `Des remboursements AMO/CNOPS sont en attente. Relancez la CNOPS pour encaisser les montants dus.`,
        action: { label: "Voir l'agenda", to: "/agenda" },
        saving: cnopsAmount,
      });
    }

    if (needsReview > 0) {
      out.push({
        id: "review", priority: "important", icon: "🔍",
        title: `${needsReview} transaction${needsReview > 1 ? "s" : ""} à vérifier`,
        description: `Ces transactions ont un statut de déductibilité incertain. Vérifiez-les pour maximiser vos charges déductibles.`,
        action: { label: "Voir les transactions", to: "/transactions" },
      });
    }

    if (!hasAssets && rec > 50_000) {
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, 15_000);
      out.push({
        id: "assets", priority: "important", icon: "🖥️",
        title: "Matériel médical non déclaré",
        description: `Vous n'avez aucune immobilisation enregistrée. L'amortissement de votre équipement (échographe, matériel de bureau…) est déductible. 15 000 MAD d'équipement à 20% représentent ${formatMAD(3_000)} de charge annuelle.`,
        action: { label: "Ajouter des actifs", to: "/comptabilite" },
        saving,
      });
    }

    if (!hasRecurring) {
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, 30_000);
      out.push({
        id: "recurring", priority: "important", icon: "🔁",
        title: "Charges récurrentes non configurées",
        description: `Votre loyer, assurance professionnelle, forfait téléphonique et abonnements ne sont pas enregistrés. Configurez-les pour les intégrer automatiquement dans votre calcul.`,
        action: { label: "Configurer", to: "/comptabilite" },
        saving: hasRecurring ? 0 : saving,
      });
    }

    if (chargeRatio < 0.25 && rec > 0) {
      const target = rec * 0.40;
      const extra  = Math.max(0, target - chargesDed);
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, extra);
      out.push({
        id: "ratio", priority: "important", icon: "📊",
        title: `Taux de charges faible : ${(chargeRatio * 100).toFixed(0)}%`,
        description: `Un cabinet médical dépense typiquement 35–50% de ses recettes en charges déductibles. Vous êtes à ${(chargeRatio * 100).toFixed(0)}%. Porter ce ratio à 40% représenterait ${formatMAD(extra)} de charges supplémentaires et ${formatMAD(saving)} d'économie d'impôt.`,
        action: { label: "Voir les charges", to: "/transactions" },
        saving,
      });
    }

    if (lowerBracket?.to && marginToLower > 0 && marginToLower <= 25_000) {
      const saving = simulateSaving(resFiscal, familyDed, rec, cmRate, brackets, marginToLower);
      out.push({
        id: "bracket", priority: "conseil", icon: "📉",
        title: `À ${formatMAD(marginToLower)} de la tranche ${(lowerBracket.rate * 100).toFixed(0)}%`,
        description: `${formatMAD(marginToLower)} de charges déductibles supplémentaires feraient passer votre résultat fiscal dans la tranche à ${(lowerBracket.rate * 100).toFixed(0)}%, économisant environ ${formatMAD(saving)}.`,
        saving,
      });
    }

    if (marginToUpper > 0 && marginToUpper <= 20_000 && upperBracket) {
      out.push({
        id: "upperBracket", priority: "conseil", icon: "📈",
        title: `Marge de ${formatMAD(marginToUpper)} avant la tranche ${(upperBracket.rate * 100).toFixed(0)}%`,
        description: `Vous pouvez générer ${formatMAD(marginToUpper)} de recettes supplémentaires avant d'entrer dans la tranche à ${(upperBracket.rate * 100).toFixed(0)}%.`,
      });
    }

    if (out.length === 0) {
      out.push({
        id: "good", priority: "conseil", icon: "✅",
        title: "Situation optimisée",
        description: rec === 0
          ? `Ajoutez des transactions pour ${fiscalYear} pour recevoir des conseils personnalisés.`
          : "Aucune optimisation majeure détectée. Continuez à enregistrer vos charges régulièrement.",
      });
    }

    return out;
  }, [
    unbilledAppts, cnopsPending, cnopsAmount, needsReview, hasAssets, hasRecurring,
    chargeRatio, rec, chargesDed, resFiscal, familyDed, cmRate, brackets,
    lowerBracket, upperBracket, marginToLower, marginToUpper, fiscalYear,
  ]);

  const urgentCount    = tips.filter(t => t.priority === "urgent").length;
  const totalPotential = tips.reduce((s, t) => s + (t.saving ?? 0), 0);

  const body = (
    <>
      {/* ── Hero KPIs ── */}
      <div className="opt-hero-grid">
        <div className="opt-hero-card opt-hero-main">
          <div className="opt-hero-lbl">Impôt payable {fiscalYear}</div>
          <div className="opt-hero-val">{formatMAD(taxDue)}</div>
          <div className="opt-hero-sub">
            {regime} · Taux effectif {(effRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="opt-hero-card">
          <div className="opt-hero-lbl">Résultat fiscal</div>
          <div className="opt-hero-val" style={{ fontSize: 20 }}>{formatMAD(resFiscal)}</div>
          <div className="opt-hero-sub">Tranche {currentBracket ? `${(currentBracket.rate * 100).toFixed(0)}%` : "—"}</div>
        </div>
        <div className="opt-hero-card">
          <div className="opt-hero-lbl">Taux de charges</div>
          <div
            className="opt-hero-val"
            style={{
              fontSize: 20,
              color: chargeRatio >= 0.35 ? "var(--green)" : chargeRatio >= 0.20 ? "var(--gold)" : "var(--coral)",
            }}
          >
            {rec > 0 ? `${(chargeRatio * 100).toFixed(0)}%` : "—"}
          </div>
          <div className="opt-hero-sub">Cible : 35–50%</div>
        </div>
        {urgentCount > 0 ? (
          <div className="opt-hero-card opt-hero-alert">
            <div className="opt-hero-lbl">Actions urgentes</div>
            <div className="opt-hero-val" style={{ color: "var(--coral)" }}>{urgentCount}</div>
            <div className="opt-hero-sub">À traiter dès maintenant</div>
          </div>
        ) : (
          <div className="opt-hero-card">
            <div className="opt-hero-lbl">Économies potentielles</div>
            <div className="opt-hero-val" style={{ fontSize: 20, color: "var(--green)" }}>
              {totalPotential > 0 ? formatMAD(totalPotential) : "—"}
            </div>
            <div className="opt-hero-sub">En appliquant les conseils</div>
          </div>
        )}
      </div>

      <div className="opt-2col">
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* IR bracket bar */}
          {brackets.length > 0 && (
            <div className="opt-card">
              <div className="opt-card-title">Paliers de l'IR {fiscalYear}</div>
              <BracketBar brackets={brackets} resFiscal={resFiscal} />
              <div className="opt-bracket-summary">
                <div>
                  <span className="opt-bracket-dot" style={{ background: "#F97316" }} />
                  Tranche actuelle : <strong>{currentBracket ? `${(currentBracket.rate * 100).toFixed(0)}%` : "—"}</strong>
                </div>
                {marginToLower > 0 && lowerBracket && (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    − {formatMAD(marginToLower)} pour atteindre {(lowerBracket.rate * 100).toFixed(0)}%
                  </div>
                )}
                {marginToUpper > 0 && upperBracket && (
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    + {formatMAD(marginToUpper)} avant {(upperBracket.rate * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Charge ratio gauge */}
          {rec > 0 && (
            <div className="opt-card">
              <div className="opt-card-title">Ratio charges / recettes</div>
              <div className="opt-ratio-row">
                <div className="opt-ratio-pct" style={{
                  color: chargeRatio >= 0.35 ? "var(--green)" : chargeRatio >= 0.20 ? "var(--gold)" : "var(--coral)",
                }}>
                  {(chargeRatio * 100).toFixed(1)}%
                </div>
                <div style={{ flex: 1 }}>
                  <div className="opt-ratio-bar-wrap">
                    {/* Zones */}
                    <div className="opt-ratio-zone opt-zone-low"   title="< 20% (faible)" />
                    <div className="opt-ratio-zone opt-zone-mid"   title="20–35% (acceptable)" />
                    <div className="opt-ratio-zone opt-zone-good"  title="35–50% (optimal)" />
                    <div className="opt-ratio-zone opt-zone-high"  title="> 50% (élevé)" />
                    {/* Needle */}
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
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Charges</div>
                  <div style={{ fontWeight: 700 }}>{formatMAD(chargesDed)}</div>
                </div>
                <div style={{ color: "var(--muted)", alignSelf: "center" }}>÷</div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Recettes</div>
                  <div style={{ fontWeight: 700 }}>{formatMAD(rec)}</div>
                </div>
                <div style={{ color: "var(--muted)", alignSelf: "center" }}>=</div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Ratio</div>
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
              <div className="opt-card-title">Simulateur de charges</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                Si j'ajoute des charges déductibles supplémentaires…
              </div>
              <div className="opt-sim-row">
                <span style={{ fontSize: 13, minWidth: 80 }}>+ {formatMAD(simCharges, { showCurrency: false })} MAD</span>
                <input
                  type="range" min={1000} max={100000} step={1000}
                  value={simCharges}
                  onChange={e => setSimCharges(Number(e.target.value))}
                  className="opt-slider"
                />
              </div>
              <div className="opt-sim-result">
                <div className="opt-sim-item">
                  <div className="opt-sim-lbl">Nouveau résultat fiscal</div>
                  <div className="opt-sim-val">{formatMAD(simNewRes)}</div>
                </div>
                <div className="opt-sim-arrow">→</div>
                <div className="opt-sim-item">
                  <div className="opt-sim-lbl">Nouvel IR brut</div>
                  <div className="opt-sim-val">{formatMAD(simNewIR)}</div>
                </div>
                <div className="opt-sim-arrow">→</div>
                <div className="opt-sim-item opt-sim-saving">
                  <div className="opt-sim-lbl">Économie estimée</div>
                  <div className="opt-sim-val" style={{ color: simSaving > 0 ? "var(--green)" : "var(--muted)" }}>
                    {simSaving > 0 ? `− ${formatMAD(simSaving)}` : "—"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
                * Simulation basée sur le régime {regime}. La CM n'est pas réduite par les charges.
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: tips ── */}
        <div className="opt-tips">
          <div className="opt-tips-header">
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Conseils personnalisés
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {tips.length} point{tips.length > 1 ? "s" : ""}
              {totalPotential > 0 && ` · ${formatMAD(totalPotential)} potentiels`}
            </div>
          </div>

          {tips.map(tip => {
            const meta = PRIORITY_META[tip.priority];
            return (
              <div key={tip.id} className="opt-tip" style={{ background: meta.bg, borderColor: meta.border }}>
                <div className="opt-tip-top">
                  <span className="opt-tip-icon">{tip.icon}</span>
                  <div className="opt-tip-content">
                    <div className="opt-tip-title">{tip.title}</div>
                    <span className="opt-tip-badge" style={{ background: meta.color + "22", color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  {tip.saving != null && tip.saving > 0 && (
                    <div className="opt-tip-saving">
                      <div style={{ fontSize: 10, color: "var(--green)", textTransform: "uppercase", fontWeight: 700 }}>Économie</div>
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
    <Layout title="Optimisation fiscale" subtitle={`Conseils personnalisés · ${fiscalYear}`}>
      {body}
    </Layout>
  );
}
