// Shared evolution chart for a measured value over time — a compact SVG line chart
// with gridlines, an optional danger zone, per-point date labels and a trailing
// last-value tag. Used by the patient file and the consultation "Mesures & bilan".

export interface TrendPoint { date: string; val: number; bad: boolean; }

export function TrendChart({
  points, unit, label, yMin, yMax, dangerHigh, dangerLow, warnHigh,
}: {
  points: TrendPoint[];
  unit: string; label: string;
  yMin: number; yMax: number;
  dangerHigh?: number; dangerLow?: number; warnHigh?: number;
}) {
  if (points.length === 0) return null;
  const W = 320, H = 100, PAD = { t: 10, r: 8, b: 24, l: 36 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  // Adaptive precision so decimal lab values (glucose, HbA1c…) aren't rounded to int.
  const span = yMax - yMin;
  const fmt = (v: number) => span >= 20 ? Math.round(v).toString() : span >= 2 ? v.toFixed(1) : v.toFixed(2);
  const clamp = (v: number) => Math.max(yMin, Math.min(yMax, v));
  const toX = (i: number) =>
    points.length === 1 ? PAD.l + iW / 2 : PAD.l + (i / (points.length - 1)) * iW;
  const toY = (v: number) =>
    PAD.t + iH - ((clamp(v) - yMin) / (yMax - yMin)) * iH;

  const polyline = points.map((p, i) => `${toX(i)},${toY(p.val)}`).join(" ");

  const dotColor = (p: TrendPoint) =>
    p.bad ? "var(--coral)"
    : warnHigh && p.val > warnHigh ? "var(--gold)"
    : "var(--green)";

  return (
    <div className="vitals-chart-wrap">
      <div className="vitals-chart-label">{label} <span className="vitals-chart-unit">({unit})</span></div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* Danger zone fill */}
        {dangerHigh != null && dangerHigh < yMax && (
          <rect x={PAD.l} y={PAD.t} width={iW} height={toY(dangerHigh) - PAD.t} fill="rgba(232,91,91,0.07)" />
        )}
        {dangerLow != null && dangerLow > yMin && (
          <rect x={PAD.l} y={toY(dangerLow)} width={iW} height={PAD.t + iH - toY(dangerLow)} fill="rgba(232,91,91,0.07)" />
        )}
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD.t + iH * (1 - f);
          const v = yMin + (yMax - yMin) * f;
          return (
            <g key={f}>
              <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y} stroke="var(--border)" strokeWidth="0.5" />
              <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="var(--tertiary)">{fmt(v)}</text>
            </g>
          );
        })}
        {/* Line */}
        {points.length > 1 && (
          <polyline points={polyline} fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round" />
        )}
        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.val)} r={4} fill={dotColor(p)} />
            <text x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--muted)">
              {p.date.slice(5).replace("-", "/")}
            </text>
          </g>
        ))}
        {/* Last value */}
        <text
          x={toX(points.length - 1) + 8} y={toY(points[points.length - 1].val)}
          fontSize="9" fontWeight="700" fill={dotColor(points[points.length - 1])} dominantBaseline="middle"
        >
          {fmt(points[points.length - 1].val)} {unit}
        </text>
      </svg>
    </div>
  );
}
