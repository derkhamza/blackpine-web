import { useTranslation } from "react-i18next";
import type { TraceEvent } from "../engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { formatMAD } from "../lib/format";

// ── Event kind config ──────────────────────────────────────────────────────
function kindMeta(kind: TraceEvent["kind"], t: (k: string) => string) {
  switch (kind) {
    case "INPUT":       return { label: t("explainKind.input"),        bg: "var(--blue-soft)",   color: "var(--blue)" };
    case "COMPUTATION": return { label: t("explainKind.computation"),  bg: "var(--blue-soft)",   color: "var(--navy-mid)" };
    case "RULE_APPLIED":return { label: t("explainKind.ruleApplied"),  bg: "var(--gold-soft)",   color: "var(--gold)" };
    case "COMPARISON":  return { label: t("explainKind.comparison"),   bg: "var(--surface-alt)", color: "var(--muted)" };
    case "CONCLUSION":  return { label: t("explainKind.conclusion"),   bg: "var(--green-soft)",  color: "var(--green)" };
    case "WARNING":     return { label: t("explainKind.warning"),      bg: "#FFF3CD",            color: "#856404" };
    default:            return { label: t("explainKind.info"),         bg: "var(--bg)",          color: "var(--muted)" };
  }
}

export function ExplainPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { result, fiscalYear } = useApp();

  // Group events by SECTION marker
  const sections: { title: string; events: TraceEvent[] }[] = [];
  let current: { title: string; events: TraceEvent[] } | null = null;
  for (const ev of result.events) {
    if (ev.kind === "SECTION") {
      if (current) sections.push(current);
      current = { title: ev.title, events: [] };
    } else if (current) {
      current.events.push(ev);
    }
  }
  if (current) sections.push(current);

  const irNet = Math.max(0, result.tax.ir.grossIR - result.tax.familyDeduction);

  const body = (
    <>
      {/* ── Hero ── */}
      <div className="explain-hero">
        <div className="explain-hero-label">{t("explain.heroLabel", { year: fiscalYear })}</div>
        <div className="explain-hero-amount">{formatMAD(result.tax.taxDue)}</div>
        <div className="explain-chips">
          <div className="explain-chip">{result.tax.regime}</div>
          <div className="explain-chip">{result.tax.payableRule}</div>
        </div>
      </div>

      {/* ── Summary row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { labelKey: "explain.kpiRecettes", value: result.breakdown.totalRecettes,  color: "var(--green)" },
          { labelKey: "explain.kpiFiscal",   value: result.breakdown.resultatFiscal, color: "var(--text)" },
          { labelKey: "explain.kpiIrBrut",   value: result.tax.ir.grossIR,           color: "var(--navy)" },
        ].map(({ labelKey, value, color }) => (
          <div key={labelKey} className="card" style={{ textAlign: "center" }}>
            <div className="card-title" style={{ marginBottom: 6 }}>{t(labelKey)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{formatMAD(value)}</div>
          </div>
        ))}
      </div>

      {/* ── Key figures ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">{t("explain.summaryTitle")}</div>
        {[
          [t("explain.rowRecettes"),                  formatMAD(result.breakdown.totalRecettes),       "var(--green)"],
          [t("explain.rowCharges"),                   "− " + formatMAD(result.breakdown.totalChargesDeductibles), "var(--muted)"],
          ...(result.breakdown.totalReintegrations > 0
            ? [[t("explain.rowReintegrations"),       "+ " + formatMAD(result.breakdown.totalReintegrations), "var(--gold)"]]
            : []),
          [t("explain.rowFiscal"),                    formatMAD(result.breakdown.resultatFiscal),       "var(--text)"],
          [t("explain.rowIrBrut"),                    formatMAD(result.tax.ir.grossIR),                 "var(--navy)"],
          ...(result.tax.familyDeduction > 0
            ? [[t("explain.rowFamilial"),             "− " + formatMAD(result.tax.familyDeduction),     "var(--blue)"]]
            : []),
          [t("explain.rowIrNet"),                     formatMAD(irNet),                                 "var(--navy)"],
          [t("explain.rowCM"),                        formatMAD(result.tax.cm.cmDue),                  "var(--muted)"],
          [t("explain.rowTaxDue", { rule: result.tax.payableRule }), formatMAD(result.tax.taxDue),      "var(--gold)"],
        ].map(([label, value, color], i, arr) => (
          <div
            key={label as string}
            className="breakdown-row"
            style={{ fontWeight: i === arr.length - 1 ? 700 : undefined }}
          >
            <span>{label as string}</span>
            <span style={{ color: color as string }}>{value as string}</span>
          </div>
        ))}
      </div>

      {/* ── Event trace ── */}
      {sections.map(({ title, events }) => (
        <div key={title}>
          <div className="event-section-title">{title}</div>
          {events.filter((e) => e.kind !== "SECTION").map((ev, i) => {
            const meta = kindMeta(ev.kind, t);
            return (
              <div key={i} className="event-card">
                <div className="event-kind" style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </div>
                <div className="event-title">{ev.title}</div>
                {ev.value !== undefined && (
                  <div className="event-value">{formatMAD(ev.value)}</div>
                )}
                {ev.formula && (
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)", marginBottom: 3 }}>
                    {ev.formula}
                  </div>
                )}
                {ev.detail && <div className="event-detail">{ev.detail}</div>}
              </div>
            );
          })}
        </div>
      ))}

      <p style={{ fontSize: 12, color: "var(--tertiary)", textAlign: "center", marginTop: 24, lineHeight: 1.7 }}>
        {t("explain.disclaimer")}
      </p>
    </>
  );
  if (noLayout) return body;
  return (
    <Layout title={t("explain.title")} subtitle={t("explain.subtitle", { year: fiscalYear })}>
      {body}
    </Layout>
  );
}
