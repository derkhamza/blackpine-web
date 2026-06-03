import type { TraceEvent } from "blackpine-engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { formatMAD } from "../lib/format";

// ── Event kind config ──────────────────────────────────────────────────────
function kindMeta(kind: TraceEvent["kind"]) {
  switch (kind) {
    case "INPUT":      return { label: "Données", bg: "var(--blue-soft)",   color: "var(--blue)" };
    case "COMPUTATION":return { label: "Calcul",  bg: "var(--blue-soft)",   color: "var(--navy-mid)" };
    case "RULE_APPLIED":return{ label: "Règle fiscale", bg: "var(--gold-soft)", color: "var(--gold)" };
    case "COMPARISON": return { label: "Comparaison", bg: "var(--surface-alt)", color: "var(--muted)" };
    case "CONCLUSION": return { label: "Conclusion", bg: "var(--green-soft)",  color: "var(--green)" };
    case "WARNING":    return { label: "Avertissement", bg: "#FFF3CD",     color: "#856404" };
    default:           return { label: "Info", bg: "var(--bg)", color: "var(--muted)" };
  }
}

export function ExplainPage() {
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

  return (
    <Layout title="Calcul fiscal" subtitle={`Estimation IR/CM · ${fiscalYear}`}>

      {/* ── Hero ── */}
      <div className="explain-hero">
        <div className="explain-hero-label">Impôt à payer · {fiscalYear}</div>
        <div className="explain-hero-amount">{formatMAD(result.tax.taxDue)}</div>
        <div className="explain-chips">
          <div className="explain-chip">{result.tax.regime}</div>
          <div className="explain-chip">{result.tax.payableRule}</div>
        </div>
      </div>

      {/* ── Summary row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Recettes",       value: result.breakdown.totalRecettes,  color: "var(--green)" },
          { label: "Résultat fiscal",value: result.breakdown.resultatFiscal, color: "var(--text)" },
          { label: "IR brut",        value: result.tax.ir.grossIR,           color: "var(--navy)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign: "center" }}>
            <div className="card-title" style={{ marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{formatMAD(value)}</div>
          </div>
        ))}
      </div>

      {/* ── Key figures ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Récapitulatif</div>
        {[
          ["Total recettes",                  formatMAD(result.breakdown.totalRecettes),       "var(--green)"],
          ["Charges déductibles",             "− " + formatMAD(result.breakdown.totalChargesDeductibles), "var(--muted)"],
          ...(result.breakdown.totalReintegrations > 0
            ? [["Réintégrations fiscales",    "+ " + formatMAD(result.breakdown.totalReintegrations), "var(--gold)"]]
            : []),
          ["Résultat fiscal",                 formatMAD(result.breakdown.resultatFiscal),       "var(--text)"],
          ["IR brut",                         formatMAD(result.tax.ir.grossIR),                 "var(--navy)"],
          ...(result.tax.familyDeduction > 0
            ? [["Déduction familiale",        "− " + formatMAD(result.tax.familyDeduction),     "var(--blue)"]]
            : []),
          ["IR net",                          formatMAD(irNet),                                 "var(--navy)"],
          ["Cotisation minimale (CM)",         formatMAD(result.tax.cm.cmDue),                  "var(--muted)"],
          ["Impôt payable (" + result.tax.payableRule + ")", formatMAD(result.tax.taxDue),      "var(--gold)"],
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
            const meta = kindMeta(ev.kind);
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
        Ces calculs sont des estimations basées sur les barèmes officiels.
        Ils ne remplacent pas l'avis d'un expert-comptable agréé.
      </p>
    </Layout>
  );
}
