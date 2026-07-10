import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Patient, Appointment } from "../lib/cabinetTypes";
import {
  ageYearsAt, midParentalHeight, percentileBands, hasReferenceBands,
  type GrowthMetric, type GrowthSex,
} from "../lib/growthReference";

// Pediatric growth curve for Suivi & analyses: plots the child's recorded
// height / weight / BMI / head-circumference against AGE (the pediatric-standard
// x-axis). Reference percentile bands are overlaid only when a verified GFA/WHO
// dataset is embedded (see growthReference.ts) — never fabricated. The height
// chart also marks the mid-parental target adult height when parent heights
// were recorded (croissance_parents bilan).

interface Pt { age: number; value: number; date: string }

const METRICS: { key: GrowthMetric; unitKey: string }[] = [
  { key: "height",   unitKey: "cm" },
  { key: "weight",   unitKey: "kg" },
  { key: "bmi",      unitKey: "kg/m²" },
  { key: "headCirc", unitKey: "cm" },
];

function num(raw: unknown): number | null {
  const n = parseFloat(String(raw ?? "").replace(",", ".").replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : null;
}

function MetricChart({
  metric, unit, label, points, sex, targetHeight,
}: {
  metric: GrowthMetric; unit: string; label: string;
  points: Pt[]; sex: GrowthSex; targetHeight: number | null;
}) {
  const { t } = useTranslation();
  if (points.length === 0) return null;

  const bands = percentileBands(metric, sex); // null until official data embedded
  const W = 320, H = 150, PAD = { t: 10, r: 26, b: 26, l: 34 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const ages = points.map((p) => p.age);
  const bandAges = bands ? bands.flatMap((c) => c.points.map((p) => p.age)) : [];
  const aMin = Math.max(0, Math.min(...ages, ...(bandAges.length ? bandAges : ages)) - 0.5);
  const aMax = Math.max(...ages, ...(bandAges.length ? bandAges : ages)) + 0.5;

  const vals = points.map((p) => p.value);
  const bandVals = bands ? bands.flatMap((c) => c.points.filter((p) => p.age >= aMin && p.age <= aMax).map((p) => p.value)) : [];
  const extra = targetHeight != null && metric === "height" ? [targetHeight] : [];
  let vMin = Math.min(...vals, ...bandVals, ...extra);
  let vMax = Math.max(...vals, ...bandVals, ...extra);
  const pad = ((vMax - vMin) || Math.abs(vMax) || 1) * 0.12;
  vMin -= pad; vMax += pad;

  const toX = (a: number) => PAD.l + ((a - aMin) / (aMax - aMin || 1)) * iW;
  const toY = (v: number) => PAD.t + iH - ((v - vMin) / (vMax - vMin || 1)) * iH;

  const last = points[points.length - 1];
  const fmt = (v: number) => (vMax - vMin) >= 20 ? Math.round(v).toString() : v.toFixed(1);

  return (
    <div className="growth-chart-wrap">
      <div className="growth-chart-label">{label} <span className="growth-chart-unit">({unit})</span></div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* Reference percentile bands (only when a verified dataset is present) */}
        {bands?.map((c) => (
          <polyline
            key={c.centile}
            points={c.points.filter((p) => p.age >= aMin && p.age <= aMax).map((p) => `${toX(p.age)},${toY(p.value)}`).join(" ")}
            fill="none" stroke="var(--border)"
            strokeWidth={c.centile === 50 ? 1 : 0.6}
            strokeDasharray={c.centile === 50 ? "" : "2 2"}
          />
        ))}
        {/* Horizontal grid + y labels */}
        {[0, 0.5, 1].map((f) => {
          const y = PAD.t + iH * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y} stroke="var(--border)" strokeWidth="0.5" />
              <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="var(--tertiary)">{fmt(vMin + (vMax - vMin) * f)}</text>
            </g>
          );
        })}
        {/* Age axis ticks (whole years) */}
        {Array.from({ length: Math.floor(aMax) - Math.ceil(aMin) + 1 }, (_, k) => Math.ceil(aMin) + k)
          .filter((yr) => yr >= aMin && yr <= aMax)
          .map((yr) => (
            <text key={yr} x={toX(yr)} y={H - 14} textAnchor="middle" fontSize="8" fill="var(--muted)">{yr}</text>
          ))}
        <text x={PAD.l + iW / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="var(--tertiary)">{t("growth.ageAxis")}</text>

        {/* Mid-parental target height marker (height chart only) */}
        {targetHeight != null && metric === "height" && targetHeight >= vMin && targetHeight <= vMax && (
          <g>
            <line x1={PAD.l} y1={toY(targetHeight)} x2={PAD.l + iW} y2={toY(targetHeight)} stroke="var(--green)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PAD.l + iW} y={toY(targetHeight) - 3} textAnchor="end" fontSize="8" fontWeight="700" fill="var(--green)">{t("growth.target")} {Math.round(targetHeight)}</text>
          </g>
        )}

        {/* Child's measured curve */}
        {points.length > 1 && (
          <polyline points={points.map((p) => `${toX(p.age)},${toY(p.value)}`).join(" ")} fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinejoin="round" />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={toX(p.age)} cy={toY(p.value)} r={3.5} fill="var(--blue)" />
        ))}
        <text x={toX(last.age) + 6} y={toY(last.value)} fontSize="9" fontWeight="700" fill="var(--blue)" dominantBaseline="middle">{fmt(last.value)}</text>
      </svg>
    </div>
  );
}

export function GrowthCurve({ patient, appointments }: { patient: Patient; appointments: Appointment[] }) {
  const { t } = useTranslation();
  const sex: GrowthSex = patient.gender === "F" ? "F" : "M";

  const { series, target } = useMemo(() => {
    const dob = patient.dateOfBirth;
    const acc: Record<GrowthMetric, Pt[]> = { height: [], weight: [], bmi: [], headCirc: [] };
    let fatherH: number | null = null, motherH: number | null = null;

    const appts = [...appointments]
      .filter((a) => a.patientId === patient.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const a of appts) {
      const age = dob ? ageYearsAt(dob, a.date) : null;
      const ef = a.consultationNote?.extraFields ?? {};
      // Parent heights (target) — take the most recent recorded values.
      const fp = num(ef["bl_crp_pere"]); if (fp) fatherH = fp;
      const mp = num(ef["bl_crp_mere"]); if (mp) motherH = mp;
      if (age == null) continue;

      const h = num(ef["bl_cr_taille"]) ?? (a.vitalSigns?.height ?? null);
      const w = num(ef["bl_cr_poids"])  ?? (a.vitalSigns?.weight ?? null);
      const pc = num(ef["bl_cr_pc"]);
      let bmi = num(ef["bl_cr_imc"]);
      if (bmi == null && h && w && h > 0) bmi = Math.round((w / ((h / 100) ** 2)) * 10) / 10;

      if (h  != null) acc.height.push({ age, value: h,  date: a.date });
      if (w  != null) acc.weight.push({ age, value: w,  date: a.date });
      if (bmi != null) acc.bmi.push({ age, value: bmi, date: a.date });
      if (pc != null) acc.headCirc.push({ age, value: pc, date: a.date });
    }

    return {
      series: acc,
      target: fatherH && motherH ? midParentalHeight(fatherH, motherH, sex) : null,
    };
  }, [patient.id, patient.dateOfBirth, appointments, sex]);

  const anyData = METRICS.some((m) => series[m.key].length > 0);
  if (!patient.dateOfBirth) return <div className="growth-empty">{t("growth.needDob")}</div>;
  if (!anyData) return <div className="growth-empty">{t("growth.noData")}</div>;

  const anyBands = METRICS.some((m) => hasReferenceBands(m.key, sex));

  return (
    <div>
      <div className="growth-charts-grid">
        {METRICS.map((m) => (
          <MetricChart
            key={m.key}
            metric={m.key}
            unit={m.unitKey}
            label={t(`growth.metric.${m.key}`)}
            points={series[m.key]}
            sex={sex}
            targetHeight={target}
          />
        ))}
      </div>
      <div className={anyBands ? "growth-caption" : "growth-note"}>{anyBands ? t("growth.refWho") : t("growth.bandsPending")}</div>
    </div>
  );
}
