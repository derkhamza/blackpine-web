import type { MonthlyData } from "../lib/chartHelpers";
import { formatMAD } from "../lib/format";

interface Props {
  data: MonthlyData[];
  fiscalYear: number;
}

export function MonthlyChart({ data, fiscalYear }: Props) {
  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "32px 0" }}>
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-sub">Pas encore de données pour {fiscalYear}</div>
      </div>
    );
  }

  const maxVal = Math.max(...data.flatMap((m) => [m.recettes, m.charges]), 1);
  const BAR_H  = 120;
  const toH    = (v: number) => Math.max(4, Math.round((v / maxVal) * BAR_H));

  return (
    <div>
      <div className="chart-legend">
        <div className="chart-legend-item">
          <div className="chart-legend-dot" style={{ background: "var(--green)" }} />
          Recettes
        </div>
        <div className="chart-legend-item">
          <div className="chart-legend-dot" style={{ background: "var(--coral)" }} />
          Charges
        </div>
      </div>

      <div className="chart-wrap">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: 0 }}>
          {data.map((m) => (
            <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 32 }}>
              {/* Bars */}
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: BAR_H }}>
                <div
                  title={`Recettes ${m.label}: ${formatMAD(m.recettes)}`}
                  style={{ width: 10, height: toH(m.recettes), background: "var(--green)", borderRadius: "2px 2px 0 0", transition: "height 0.3s ease" }}
                />
                <div
                  title={`Charges ${m.label}: ${formatMAD(m.charges)}`}
                  style={{ width: 10, height: toH(m.charges), background: "var(--coral)", borderRadius: "2px 2px 0 0", transition: "height 0.3s ease" }}
                />
              </div>
              {/* Label */}
              <div style={{ fontSize: 10, color: "var(--tertiary)", fontWeight: 600 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
