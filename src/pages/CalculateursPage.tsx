import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { ActionIcon } from "../components/ActionIcon";

// ══════════════════════════════════════════════════════════════════
// CALCULATOR ENGINES — label fields are i18n key strings
// ══════════════════════════════════════════════════════════════════

function calcImc(weightKg: number, heightCm: number) {
  const imc = weightKg / Math.pow(heightCm / 100, 2);
  const cat =
    imc < 16.0  ? { label: "calculateurs.imcCatSevDenut", color: "#e53e3e" }
    : imc < 17.0 ? { label: "calculateurs.imcCatModDenut", color: "#dd6b20" }
    : imc < 18.5 ? { label: "calculateurs.imcCatMaigreur", color: "#d69e2e" }
    : imc < 25.0 ? { label: "calculateurs.imcCatNormal",   color: "#38a169" }
    : imc < 30.0 ? { label: "calculateurs.imcCatSurpoids", color: "#d69e2e" }
    : imc < 35.0 ? { label: "calculateurs.imcCatOb1",      color: "#dd6b20" }
    : imc < 40.0 ? { label: "calculateurs.imcCatOb2",      color: "#e53e3e" }
    :              { label: "calculateurs.imcCatOb3",       color: "#c53030" };
  const minNormal = 18.5 * Math.pow(heightCm / 100, 2);
  const maxNormal = 24.9 * Math.pow(heightCm / 100, 2);
  return { imc, cat, minNormal, maxNormal };
}

function creatMgDlToUmol(mg: number) { return mg * 88.42; }
function creatUmolToMgDl(umol: number) { return umol / 88.42; }

function calcDfg(creatUmolL: number, age: number, female: boolean) {
  const cr    = creatUmolToMgDl(creatUmolL);
  const kap   = female ? 0.7 : 0.9;
  const alp   = female ? -0.241 : -0.302;
  const crKap = cr / kap;
  const part1 = Math.min(crKap, 1) ** alp;
  const part2 = Math.max(crKap, 1) ** -1.200;
  const sex   = female ? 1.012 : 1.0;
  const gfr   = 142 * part1 * part2 * (0.9938 ** age) * sex;
  const stage =
    gfr >= 90 ? { label: "calculateurs.dfgG1", color: "#38a169" }
    : gfr >= 60 ? { label: "calculateurs.dfgG2", color: "#68d391" }
    : gfr >= 45 ? { label: "calculateurs.dfgG3a", color: "#d69e2e" }
    : gfr >= 30 ? { label: "calculateurs.dfgG3b", color: "#dd6b20" }
    : gfr >= 15 ? { label: "calculateurs.dfgG4",  color: "#e53e3e" }
    :             { label: "calculateurs.dfgG5",   color: "#c53030" };
  return { gfr, stage };
}

function calcRisqueCv(
  age: number, female: boolean, smoker: boolean,
  pasSys: number, cholTotal: number, hdl: number,
) {
  const nonHdl = cholTotal - hdl;
  let score = 0;
  score += Math.max(0, Math.floor((age - 40) / 10)) * (female ? 6 : 8);
  if (smoker) score += female ? 9 : 8;
  if (pasSys >= 160) score += female ? 13 : 10;
  else if (pasSys >= 140) score += female ? 9 : 7;
  else if (pasSys >= 120) score += female ? 4 : 3;
  if (nonHdl >= 5.7) score += 11;
  else if (nonHdl >= 4.9) score += 8;
  else if (nonHdl >= 4.1) score += 5;
  else if (nonHdl >= 3.4) score += 3;
  const pct = Math.min(60, Math.round(score * 0.4));
  const cat =
    pct < 5  ? { label: "calculateurs.cvCatFaible",    color: "#38a169" }
    : pct < 10 ? { label: "calculateurs.cvCatModere",   color: "#d69e2e" }
    : pct < 20 ? { label: "calculateurs.cvCatEleve",    color: "#dd6b20" }
    :             { label: "calculateurs.cvCatTresEleve", color: "#e53e3e" };
  return { pct, cat, nonHdl };
}

function calcGrossesse(ddr: string) {
  const ddrDate = new Date(ddr + "T12:00:00");
  const now     = new Date();
  const diffMs  = now.getTime() - ddrDate.getTime();
  const days    = Math.floor(diffMs / 86400000);
  const sa      = Math.floor(days / 7);
  const saRest  = days % 7;
  const dpa     = new Date(ddrDate.getTime() + 280 * 86400000);
  const termeDays = Math.round((dpa.getTime() - now.getTime()) / 86400000);
  const trimestre = sa < 14 ? 1 : sa < 28 ? 2 : 3;
  return { sa, saRest, dpa, termeDays, trimestre, days };
}

function calcPoidsIdeal(heightCm: number, female: boolean) {
  const devine = female
    ? 45.5 + 0.91 * (heightCm - 152.4)
    : 50.0 + 0.91 * (heightCm - 152.4);
  const h = heightCm / 100;
  return { devine: Math.max(0, devine), min: 18.5 * h * h, max: 25 * h * h };
}

// HbA1c → estimated average glucose (ADAG: eAG mg/dL = 28.7·A1c − 46.7).
function calcHba1c(a1c: number) {
  const eagMgDl = 28.7 * a1c - 46.7;
  const eagGL   = eagMgDl / 100;    // g/L — the unit Moroccan labs report
  const eagMmol = eagMgDl / 18.0;   // mmol/L
  const ctrl =
    a1c < 6.5 ? { label: "calculateurs.hbCtrlGood",      color: "#38a169" }
    : a1c < 7.0 ? { label: "calculateurs.hbCtrlTarget",   color: "#68d391" }
    : a1c < 8.0 ? { label: "calculateurs.hbCtrlAbove",    color: "#d69e2e" }
    : a1c < 9.0 ? { label: "calculateurs.hbCtrlHigh",     color: "#dd6b20" }
    :             { label: "calculateurs.hbCtrlVeryHigh", color: "#e53e3e" };
  return { eagGL, eagMgDl, eagMmol, ctrl };
}

// Cockcroft-Gault creatinine clearance (mL/min) — the estimate drug dosing still
// uses. Distinct from CKD-EPI/DFG (a GFR estimate) — it needs the patient weight.
function calcCockcroft(creatUmolL: number, age: number, weightKg: number, female: boolean) {
  const crMgDl = creatUmolToMgDl(creatUmolL);
  const clcr = ((140 - age) * weightKg * (female ? 0.85 : 1)) / (72 * crMgDl);
  const stage =
    clcr >= 90 ? { label: "calculateurs.ccG1", color: "#38a169" }
    : clcr >= 60 ? { label: "calculateurs.ccG2", color: "#68d391" }
    : clcr >= 30 ? { label: "calculateurs.ccG3", color: "#d69e2e" }
    : clcr >= 15 ? { label: "calculateurs.ccG4", color: "#dd6b20" }
    :              { label: "calculateurs.ccG5", color: "#e53e3e" };
  return { clcr, stage };
}

// Body-surface area — Mosteller (primary) and Du Bois, for dosing (chemo, peds…).
function calcBsa(weightKg: number, heightCm: number) {
  const mosteller = Math.sqrt((weightKg * heightCm) / 3600);
  const dubois    = 0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725);
  return { mosteller, dubois };
}

// ══════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════

function num(v: string): number { return parseFloat(v.replace(",", ".")); }

function ResultCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="calc-result-card" style={{ borderColor: color }}>
      <div className="calc-result-val" style={{ color: color ?? "var(--text)" }}>{value}</div>
      <div className="calc-result-label">{label}</div>
      {sub && <div className="calc-result-sub">{sub}</div>}
    </div>
  );
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <div className="calc-hint">{hint}</div>}
    </div>
  );
}

function SexToggle({ female, onChange }: { female: boolean; onChange: (f: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {([false, true] as const).map(v => (
        <button key={String(v)} type="button"
          className={`calc-sex-btn${female === v ? " active" : ""}`}
          onClick={() => onChange(v)}>
          {v ? t("calculateurs.female") : t("calculateurs.male")}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// INDIVIDUAL CALCULATORS
// ══════════════════════════════════════════════════════════════════

function ImcCalc() {
  const { t } = useTranslation();
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const w = num(weight), h = num(height);
  const valid = w > 0 && w < 500 && h > 50 && h < 280;
  const res = valid ? calcImc(w, h) : null;

  const refRows: [string, string, string][] = [
    [t("calculateurs.imcRef0"),       t("calculateurs.imcRefLabelMaigreur"), "#d69e2e"],
    [t("calculateurs.imcRefNormal"),  t("calculateurs.imcRefLabelNormal"),   "#38a169"],
    [t("calculateurs.imcRefSurpoids"),t("calculateurs.imcRefLabelSurpoids"), "#d69e2e"],
    [t("calculateurs.imcRefOb1"),     t("calculateurs.imcRefLabelOb1"),      "#dd6b20"],
    [t("calculateurs.imcRefOb2"),     t("calculateurs.imcRefLabelOb2"),      "#e53e3e"],
    [t("calculateurs.imcRefOb3"),     t("calculateurs.imcRefLabelOb3"),      "#c53030"],
  ];

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row">
          <Field label={t("calculateurs.imcWeight")}>
            <input className="form-input" type="number" min="1" max="500" step="0.1"
              placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.imcHeight")}>
            <input className="form-input" type="number" min="50" max="280" step="0.5"
              placeholder="170" value={height} onChange={e => setHeight(e.target.value)} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label={t("calculateurs.imcResult")}
            value={`${res.imc.toFixed(1)} kg/m²`}
            sub={t(res.cat.label)}
            color={res.cat.color}
          />
          <ResultCard
            label={t("calculateurs.imcNormalRange")}
            value={`${res.minNormal.toFixed(0)} – ${res.maxNormal.toFixed(0)} kg`}
            sub={t("calculateurs.imcNormalSub", { h })}
          />
        </div>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">{t("calculateurs.imcRefTitle")}</div>
        <div className="calc-ref-grid">
          {refRows.map(([range, label, color]) => (
            <div key={range} className="calc-ref-row">
              <span className="calc-ref-range">{range}</span>
              <span className="calc-ref-label" style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DfgCalc() {
  const { t } = useTranslation();
  const [creat,  setCreat]  = useState("");
  const [unit,   setUnit]   = useState<"umol" | "mgdl">("umol");
  const [age,    setAge]    = useState("");
  const [female, setFemale] = useState(false);

  const rawCr  = num(creat);
  const ageVal = num(age);
  const crUmol = unit === "umol" ? rawCr : creatMgDlToUmol(rawCr);
  const valid  = crUmol > 0 && crUmol < 10000 && ageVal >= 18 && ageVal <= 120;
  const res    = valid ? calcDfg(crUmol, ageVal, female) : null;

  const refRows: [string, string, string][] = [
    ["≥ 90",    t("calculateurs.dfgG1"),  "#38a169"],
    ["60 – 89", t("calculateurs.dfgG2"),  "#68d391"],
    ["45 – 59", t("calculateurs.dfgG3a"), "#d69e2e"],
    ["30 – 44", t("calculateurs.dfgG3b"), "#dd6b20"],
    ["15 – 29", t("calculateurs.dfgG4"),  "#e53e3e"],
    ["< 15",    t("calculateurs.dfgG5"),  "#c53030"],
  ];

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <Field
            label={t("calculateurs.dfgCreatinine", { unit: unit === "umol" ? "µmol/L" : "mg/dL" })}
            hint={t("calculateurs.dfgHint")}>
            <input className="form-input" type="number" min="0" step="0.01"
              placeholder={unit === "umol" ? "80" : "0.9"}
              value={creat} onChange={e => setCreat(e.target.value)} />
          </Field>
          <div className="form-group">
            <label className="form-label">{t("calculateurs.dfgUnit")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["umol", "mgdl"] as const).map(u => (
                <button key={u} type="button"
                  className={`calc-sex-btn${unit === u ? " active" : ""}`}
                  onClick={() => { setUnit(u); setCreat(""); }}>
                  {u === "umol" ? "µmol/L" : "mg/dL"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-row">
          <Field label={t("calculateurs.dfgAge")}>
            <input className="form-input" type="number" min="18" max="120"
              placeholder="45" value={age} onChange={e => setAge(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.dfgSex")}>
            <SexToggle female={female} onChange={setFemale} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label={t("calculateurs.dfgResult")}
            value={`${res.gfr.toFixed(0)} mL/min/1.73 m²`}
            sub={t(res.stage.label)}
            color={res.stage.color}
          />
        </div>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">{t("calculateurs.dfgRefTitle")}</div>
        <div className="calc-ref-grid">
          {refRows.map(([range, label, color]) => (
            <div key={range} className="calc-ref-row">
              <span className="calc-ref-range">{range}</span>
              <span className="calc-ref-label" style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="calc-disclaimer">{t("calculateurs.dfgDisclaimer")}</p>
    </div>
  );
}

function RisqueCvCalc() {
  const { t } = useTranslation();
  const [age,    setAge]    = useState("");
  const [female, setFemale] = useState(false);
  const [smoker, setSmoker] = useState(false);
  const [pas,    setPas]    = useState("");
  const [chol,   setChol]   = useState("");
  const [hdl,    setHdl]    = useState("");

  const ageVal  = num(age);
  const pasVal  = num(pas);
  const cholVal = num(chol);
  const hdlVal  = num(hdl);

  const valid =
    ageVal >= 40 && ageVal <= 80 &&
    pasVal >= 80 && pasVal <= 220 &&
    cholVal > 0 && hdlVal > 0 && hdlVal < cholVal;

  const res = valid ? calcRisqueCv(ageVal, female, smoker, pasVal, cholVal, hdlVal) : null;

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row">
          <Field label={t("calculateurs.cvAge")}>
            <input className="form-input" type="number" min="40" max="80"
              placeholder="55" value={age} onChange={e => setAge(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.cvSex")}>
            <SexToggle female={female} onChange={setFemale} />
          </Field>
        </div>

        <div className="form-row">
          <Field label={t("calculateurs.cvSbp")}>
            <input className="form-input" type="number" min="80" max="220"
              placeholder="130" value={pas} onChange={e => setPas(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.cvSmoking")}>
            <div style={{ display: "flex", gap: 8 }}>
              {([false, true] as const).map(v => (
                <button key={String(v)} type="button"
                  className={`calc-sex-btn${smoker === v ? " active" : ""}`}
                  onClick={() => setSmoker(v)}>
                  {v ? t("common.yes") : t("common.no")}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="form-row">
          <Field label={t("calculateurs.cvChol")} hint={t("calculateurs.cvCholHint")}>
            <input className="form-input" type="number" min="1" max="15" step="0.1"
              placeholder="5.2" value={chol} onChange={e => setChol(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.cvHdl")}>
            <input className="form-input" type="number" min="0.1" max="5" step="0.1"
              placeholder="1.3" value={hdl} onChange={e => setHdl(e.target.value)} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label={t("calculateurs.cvResult")}
            value={`~${res.pct} %`}
            sub={t(res.cat.label)}
            color={res.cat.color}
          />
          <ResultCard
            label={t("calculateurs.cvNonHdl")}
            value={`${res.nonHdl.toFixed(1)} mmol/L`}
            sub={t("calculateurs.cvNonHdlSub")}
          />
        </div>
      )}

      {!valid && (ageVal < 40 || ageVal > 80) && age !== "" && (
        <p className="calc-disclaimer" style={{ color: "var(--coral)" }}>
          {t("calculateurs.cvAgeWarn")}
        </p>
      )}

      <p className="calc-disclaimer">{t("calculateurs.cvDisclaimer")}</p>
    </div>
  );
}

function GrossesseCalc() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const [ddr, setDdr] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);
  const valid    = ddr && ddr <= todayIso;
  const res      = valid ? calcGrossesse(ddr) : null;

  const dpaStr = res
    ? res.dpa.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : null;

  const trimLabel = res
    ? res.trimestre === 1 ? t("calculateurs.grossTrim1")
    : res.trimestre === 2 ? t("calculateurs.grossTrim2")
    : t("calculateurs.grossTrim3")
    : null;

  const milestones: [string, string][] = [
    ["SA 12",  "Fin du 1er trimestre · écho T1"],
    ["SA 22",  "Début viabilité fœtale"],
    ["SA 28",  "Fin du 2e trimestre · écho T2"],
    ["SA 37",  "Terme prématuré / prématurité tardive"],
    ["SA 39",  "Terme idéal (naissance à terme complète)"],
    ["SA 41",  "Terme dépassé → surveillance renforcée"],
  ];

  return (
    <div className="calc-body">
      <div className="calc-form">
        <Field label={t("calculateurs.grossDdr")} hint={t("calculateurs.grossDdrHint")}>
          <input className="form-input" type="date" max={todayIso}
            value={ddr} onChange={e => setDdr(e.target.value)} />
        </Field>
      </div>

      {res && res.days >= 0 && (
        <div className="calc-results">
          <ResultCard
            label={t("calculateurs.grossAge")}
            value={`${res.sa} SA + ${res.saRest} j`}
            sub={trimLabel ?? undefined}
            color="var(--blue)"
          />
          <ResultCard
            label={t("calculateurs.grossDpa")}
            value={dpaStr ?? ""}
            sub={res.termeDays >= 0
              ? t("calculateurs.grossInDays", { n: res.termeDays })
              : t("calculateurs.grossOverdue", { n: Math.abs(res.termeDays) })}
            color={res.termeDays < 0 ? "var(--coral)" : undefined}
          />
        </div>
      )}
      {res && res.days < 0 && (
        <p className="calc-disclaimer" style={{ color: "var(--coral)" }}>
          {t("calculateurs.grossFuture")}
        </p>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">{t("calculateurs.grossMilestones")}</div>
        {milestones.map(([sa, label]) => (
          <div key={sa} className="calc-ref-row">
            <span className="calc-ref-range">{sa}</span>
            <span className="calc-ref-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoidsIdealCalc() {
  const { t } = useTranslation();
  const [height, setHeight] = useState("");
  const [female, setFemale] = useState(false);
  const [weight, setWeight] = useState("");

  const h = num(height);
  const w = num(weight);
  const valid = h >= 100 && h <= 250;
  const res = valid ? calcPoidsIdeal(h, female) : null;
  const currImc = valid && w > 0 ? w / Math.pow(h / 100, 2) : null;

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row">
          <Field label={t("calculateurs.poidsHeight")}>
            <input className="form-input" type="number" min="100" max="250" step="0.5"
              placeholder="170" value={height} onChange={e => setHeight(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.poidsSex")}>
            <SexToggle female={female} onChange={setFemale} />
          </Field>
        </div>
        <Field label={t("calculateurs.poidsCurrent")} hint={t("calculateurs.poidsCurrentHint")}>
          <input className="form-input" type="number" min="1" max="500" step="0.1"
            placeholder="—" value={weight} onChange={e => setWeight(e.target.value)} />
        </Field>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label={t("calculateurs.poidsResult")}
            value={`${res.devine.toFixed(1)} kg`}
            sub={female ? t("calculateurs.poidsSubFemale") : t("calculateurs.poidsSubMale")}
          />
          <ResultCard
            label={t("calculateurs.poidsRange")}
            value={`${res.min.toFixed(0)} – ${res.max.toFixed(0)} kg`}
            sub={t("calculateurs.poidsRangeSub", { h })}
          />
          {currImc !== null && (
            <ResultCard
              label={t("calculateurs.poidsImcCurrent")}
              value={`${currImc.toFixed(1)} kg/m²`}
              sub={w > res.max
                ? t("calculateurs.poidsExcess", { n: (w - res.max).toFixed(0) })
                : w < res.min
                ? t("calculateurs.poidsDeficit", { n: (res.min - w).toFixed(0) })
                : t("calculateurs.poidsWithinNorm")}
              color={
                currImc < 18.5 || currImc >= 30 ? "var(--coral)"
                : currImc >= 25 ? "var(--gold)"
                : "var(--green)"
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function Hba1cCalc() {
  const { t } = useTranslation();
  const [a1c, setA1c] = useState("");
  const v = num(a1c);
  const valid = v >= 3 && v <= 20;
  const res = valid ? calcHba1c(v) : null;

  const refRows: [string, string, string][] = [
    ["< 6.5 %",   t("calculateurs.hbCtrlGood"),     "#38a169"],
    ["6.5 – 7 %", t("calculateurs.hbCtrlTarget"),   "#68d391"],
    ["7 – 8 %",   t("calculateurs.hbCtrlAbove"),    "#d69e2e"],
    ["8 – 9 %",   t("calculateurs.hbCtrlHigh"),     "#dd6b20"],
    ["≥ 9 %",     t("calculateurs.hbCtrlVeryHigh"), "#e53e3e"],
  ];

  return (
    <div className="calc-body">
      <div className="calc-form">
        <Field label={t("calculateurs.hbA1c")} hint={t("calculateurs.hbHint")}>
          <input className="form-input" type="number" min="3" max="20" step="0.1"
            placeholder="7.5" value={a1c} onChange={e => setA1c(e.target.value)} />
        </Field>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard label={t("calculateurs.hbEag")} value={`${res.eagGL.toFixed(2)} g/L`}
            sub={t(res.ctrl.label)} color={res.ctrl.color} />
          <ResultCard label={t("calculateurs.hbEagAlt")}
            value={`${res.eagMmol.toFixed(1)} mmol/L · ${res.eagMgDl.toFixed(0)} mg/dL`} />
        </div>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">{t("calculateurs.hbRefTitle")}</div>
        <div className="calc-ref-grid">
          {refRows.map(([range, label, color]) => (
            <div key={range} className="calc-ref-row">
              <span className="calc-ref-range">{range}</span>
              <span className="calc-ref-label" style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="calc-disclaimer">{t("calculateurs.hbDisclaimer")}</p>
    </div>
  );
}

function CockcroftCalc() {
  const { t } = useTranslation();
  const [creat, setCreat] = useState("");
  const [unit, setUnit] = useState<"umol" | "mgdl">("umol");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [female, setFemale] = useState(false);

  const rawCr = num(creat), ageVal = num(age), wVal = num(weight);
  const crUmol = unit === "umol" ? rawCr : creatMgDlToUmol(rawCr);
  const valid = crUmol > 0 && crUmol < 10000 && ageVal >= 18 && ageVal <= 120 && wVal > 20 && wVal < 300;
  const res = valid ? calcCockcroft(crUmol, ageVal, wVal, female) : null;

  const refRows: [string, string, string][] = [
    ["≥ 90",    t("calculateurs.ccG1"), "#38a169"],
    ["60 – 89", t("calculateurs.ccG2"), "#68d391"],
    ["30 – 59", t("calculateurs.ccG3"), "#d69e2e"],
    ["15 – 29", t("calculateurs.ccG4"), "#dd6b20"],
    ["< 15",    t("calculateurs.ccG5"), "#e53e3e"],
  ];

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <Field label={t("calculateurs.ccCreatinine", { unit: unit === "umol" ? "µmol/L" : "mg/dL" })} hint={t("calculateurs.ccHint")}>
            <input className="form-input" type="number" min="0" step="0.01"
              placeholder={unit === "umol" ? "80" : "0.9"} value={creat} onChange={e => setCreat(e.target.value)} />
          </Field>
          <div className="form-group">
            <label className="form-label">{t("calculateurs.dfgUnit")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["umol", "mgdl"] as const).map(u => (
                <button key={u} type="button" className={`calc-sex-btn${unit === u ? " active" : ""}`}
                  onClick={() => { setUnit(u); setCreat(""); }}>{u === "umol" ? "µmol/L" : "mg/dL"}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="form-row">
          <Field label={t("calculateurs.ccAge")}>
            <input className="form-input" type="number" min="18" max="120" placeholder="65" value={age} onChange={e => setAge(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.ccWeight")}>
            <input className="form-input" type="number" min="20" max="300" step="0.5" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          </Field>
        </div>
        <Field label={t("calculateurs.ccSex")}>
          <SexToggle female={female} onChange={setFemale} />
        </Field>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard label={t("calculateurs.ccResult")} value={`${res.clcr.toFixed(0)} mL/min`}
            sub={t(res.stage.label)} color={res.stage.color} />
        </div>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">{t("calculateurs.ccRefTitle")}</div>
        <div className="calc-ref-grid">
          {refRows.map(([range, label, color]) => (
            <div key={range} className="calc-ref-row">
              <span className="calc-ref-range">{range}</span>
              <span className="calc-ref-label" style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="calc-disclaimer">{t("calculateurs.ccDisclaimer")}</p>
    </div>
  );
}

function BsaCalc() {
  const { t } = useTranslation();
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const w = num(weight), h = num(height);
  const valid = w > 0 && w < 500 && h > 30 && h < 280;
  const res = valid ? calcBsa(w, h) : null;

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row">
          <Field label={t("calculateurs.bsaWeight")}>
            <input className="form-input" type="number" min="1" max="500" step="0.1"
              placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          </Field>
          <Field label={t("calculateurs.bsaHeight")}>
            <input className="form-input" type="number" min="30" max="280" step="0.5"
              placeholder="170" value={height} onChange={e => setHeight(e.target.value)} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard label={t("calculateurs.bsaMosteller")} value={`${res.mosteller.toFixed(2)} m²`}
            sub={t("calculateurs.bsaMostellerSub")} color="var(--blue)" />
          <ResultCard label={t("calculateurs.bsaDubois")} value={`${res.dubois.toFixed(2)} m²`}
            sub={t("calculateurs.bsaDuboisSub")} />
        </div>
      )}
      <p className="calc-disclaimer">{t("calculateurs.bsaDisclaimer")}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

type CalcKey = "imc" | "dfg" | "cv" | "grossesse" | "poids" | "hba1c" | "cockcroft" | "bsa";

export function CalculateursPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState<CalcKey>("imc");

  const CALCS: { key: CalcKey; label: string; icon: string; subtitle: string }[] = [
    { key: "imc",       label: t("calculateurs.navImc"),       icon: "scale",       subtitle: t("calculateurs.navImcSub") },
    { key: "dfg",       label: t("calculateurs.navDfg"),       icon: "kidney",      subtitle: t("calculateurs.navDfgSub") },
    { key: "cv",        label: t("calculateurs.navCv"),        icon: "heart",       subtitle: t("calculateurs.navCvSub") },
    { key: "grossesse", label: t("calculateurs.navGrossesse"), icon: "pregnant",    subtitle: t("calculateurs.navGrossesseSub") },
    { key: "poids",     label: t("calculateurs.navPoids"),     icon: "ruler",       subtitle: t("calculateurs.navPoidsSub") },
    { key: "hba1c",     label: t("calculateurs.navHba1c"),     icon: "flask",       subtitle: t("calculateurs.navHba1cSub") },
    { key: "cockcroft", label: t("calculateurs.navCockcroft"), icon: "kidney",      subtitle: t("calculateurs.navCockcroftSub") },
    { key: "bsa",       label: t("calculateurs.navBsa"),       icon: "ruler",       subtitle: t("calculateurs.navBsaSub") },
  ];

  const cur = CALCS.find(c => c.key === active)!;

  return (
    <Layout title={t("calculateurs.title")} subtitle={t("calculateurs.subtitle")}>
      <div className="calc-page">
        <div className="calc-sidebar">
          {CALCS.map(c => (
            <button key={c.key}
              className={`calc-nav-btn${active === c.key ? " active" : ""}`}
              onClick={() => setActive(c.key)}>
              <span className="calc-nav-icon"><ActionIcon name={c.icon} /></span>
              <div>
                <div className="calc-nav-label">{c.label}</div>
                <div className="calc-nav-sub">{c.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="calc-main">
          <div className="calc-header">
            <span className="calc-header-icon"><ActionIcon name={cur.icon} /></span>
            <div>
              <div className="calc-header-title">{cur.label}</div>
              <div className="calc-header-sub">{cur.subtitle}</div>
            </div>
          </div>

          {active === "imc"       && <ImcCalc />}
          {active === "dfg"       && <DfgCalc />}
          {active === "cv"        && <RisqueCvCalc />}
          {active === "grossesse" && <GrossesseCalc />}
          {active === "poids"     && <PoidsIdealCalc />}
          {active === "hba1c"     && <Hba1cCalc />}
          {active === "cockcroft" && <CockcroftCalc />}
          {active === "bsa"       && <BsaCalc />}
        </div>
      </div>
    </Layout>
  );
}
