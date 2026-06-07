import { useState } from "react";
import { Layout } from "../components/Layout";

// ══════════════════════════════════════════════════════════════════
// CALCULATOR ENGINES (pure functions — no side effects)
// ══════════════════════════════════════════════════════════════════

// ── IMC ───────────────────────────────────────────────────────────

function calcImc(weightKg: number, heightCm: number) {
  const imc = weightKg / Math.pow(heightCm / 100, 2);
  const cat =
    imc < 16.0  ? { label: "Dénutrition sévère",    color: "#e53e3e" }
    : imc < 17.0 ? { label: "Dénutrition modérée",   color: "#dd6b20" }
    : imc < 18.5 ? { label: "Maigreur",               color: "#d69e2e" }
    : imc < 25.0 ? { label: "Corpulence normale",     color: "#38a169" }
    : imc < 30.0 ? { label: "Surpoids",               color: "#d69e2e" }
    : imc < 35.0 ? { label: "Obésité modérée (I)",    color: "#dd6b20" }
    : imc < 40.0 ? { label: "Obésité sévère (II)",    color: "#e53e3e" }
    :              { label: "Obésité morbide (III)",   color: "#c53030" };
  const minNormal = 18.5 * Math.pow(heightCm / 100, 2);
  const maxNormal = 24.9 * Math.pow(heightCm / 100, 2);
  return { imc, cat, minNormal, maxNormal };
}

// ── DFG – CKD-EPI 2021 (race-free) ───────────────────────────────

function creatMgDlToUmol(mg: number) { return mg * 88.42; }
function creatUmolToMgDl(umol: number) { return umol / 88.42; }

function calcDfg(creatUmolL: number, age: number, female: boolean) {
  const cr = creatUmolToMgDl(creatUmolL);
  const kap = female ? 0.7 : 0.9;
  const alp = female ? -0.241 : -0.302;
  const crKap = cr / kap;
  const part1 = Math.min(crKap, 1) ** alp;
  const part2 = Math.max(crKap, 1) ** -1.200;
  const sex   = female ? 1.012 : 1.0;
  const gfr   = 142 * part1 * part2 * (0.9938 ** age) * sex;
  const stage =
    gfr >= 90 ? { label: "G1 — Normal ou élevé", color: "#38a169" }
    : gfr >= 60 ? { label: "G2 — Légèrement diminué", color: "#68d391" }
    : gfr >= 45 ? { label: "G3a — Modérément diminué", color: "#d69e2e" }
    : gfr >= 30 ? { label: "G3b — Modérément à sévèrement diminué", color: "#dd6b20" }
    : gfr >= 15 ? { label: "G4 — Sévèrement diminué", color: "#e53e3e" }
    :             { label: "G5 — Insuffisance rénale terminale", color: "#c53030" };
  return { gfr, stage };
}

// ── Risque CV – Score simplifié (basé sur SCORE2) ────────────────
// Note: simplification à 5 facteurs; SCORE2 complet requiert les
// tables ESC par région. Cet estimateur donne une orientation clinique.

function calcRisqueCv(
  age: number,
  female: boolean,
  smoker: boolean,
  pasSys: number,
  cholTotal: number,  // mmol/L
  hdl: number,        // mmol/L
) {
  // Points Framingham simplified for non-HDL
  const nonHdl = cholTotal - hdl;
  let score = 0;

  // Age contribution (per decade over 40)
  score += Math.max(0, Math.floor((age - 40) / 10)) * (female ? 6 : 8);

  // Smoking
  if (smoker) score += female ? 9 : 8;

  // SBP
  if (pasSys >= 160) score += female ? 13 : 10;
  else if (pasSys >= 140) score += female ? 9 : 7;
  else if (pasSys >= 120) score += female ? 4 : 3;

  // Non-HDL
  if (nonHdl >= 5.7) score += 11;
  else if (nonHdl >= 4.9) score += 8;
  else if (nonHdl >= 4.1) score += 5;
  else if (nonHdl >= 3.4) score += 3;

  // Rough % conversion (approximation)
  const pct = Math.min(60, Math.round(score * 0.4));

  const cat =
    pct < 5  ? { label: "Faible",     color: "#38a169" }
    : pct < 10 ? { label: "Modéré",    color: "#d69e2e" }
    : pct < 20 ? { label: "Élevé",     color: "#dd6b20" }
    :             { label: "Très élevé", color: "#e53e3e" };
  return { pct, cat };
}

// ── Âge gestationnel ──────────────────────────────────────────────

function calcGrossesse(ddr: string) {
  const ddrDate = new Date(ddr + "T12:00:00");
  const now     = new Date();
  const diffMs  = now.getTime() - ddrDate.getTime();
  const days    = Math.floor(diffMs / 86400000);
  const sa      = Math.floor(days / 7);
  const saRest  = days % 7;
  // DPA = DDR + 280 jours
  const dpa = new Date(ddrDate.getTime() + 280 * 86400000);
  const termeDays = Math.round((dpa.getTime() - now.getTime()) / 86400000);
  const trimestre = sa < 14 ? 1 : sa < 28 ? 2 : 3;
  return { sa, saRest, dpa, termeDays, trimestre, days };
}

// ── Poids idéal – Devine / fourchette IMC normal ──────────────────

function calcPoidsIdeal(heightCm: number, female: boolean) {
  // Devine formula
  const devine = female
    ? 45.5 + 0.91 * (heightCm - 152.4)
    : 50.0 + 0.91 * (heightCm - 152.4);
  // IMC 20-25 range
  const h = heightCm / 100;
  const min = 20 * h * h;
  const max = 25 * h * h;
  return { devine: Math.max(0, devine), min, max };
}

// ══════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════

function num(v: string): number { return parseFloat(v.replace(",", ".")); }

function ResultCard({
  label, value, sub, color,
}: {
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

function Field({
  label, hint, children,
}: {
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

function SexToggle({
  female, onChange,
}: {
  female: boolean; onChange: (f: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[
        { v: false, label: "♂ Homme" },
        { v: true,  label: "♀ Femme" },
      ].map(({ v, label }) => (
        <button
          key={String(v)}
          type="button"
          className={`calc-sex-btn${female === v ? " active" : ""}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// INDIVIDUAL CALCULATORS
// ══════════════════════════════════════════════════════════════════

function ImcCalc() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const w = num(weight), h = num(height);
  const valid = w > 0 && w < 500 && h > 50 && h < 280;
  const res = valid ? calcImc(w, h) : null;

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row">
          <Field label="Poids (kg)">
            <input className="form-input" type="number" min="1" max="500" step="0.1"
              placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          </Field>
          <Field label="Taille (cm)">
            <input className="form-input" type="number" min="50" max="280" step="0.5"
              placeholder="170" value={height} onChange={e => setHeight(e.target.value)} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label="IMC"
            value={`${res.imc.toFixed(1)} kg/m²`}
            sub={res.cat.label}
            color={res.cat.color}
          />
          <ResultCard
            label="Poids normal pour cette taille"
            value={`${res.minNormal.toFixed(0)} – ${res.maxNormal.toFixed(0)} kg`}
            sub={`IMC 18.5 – 24.9 · Taille ${h} cm`}
          />
        </div>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">Référence OMS</div>
        <div className="calc-ref-grid">
          {[
            ["< 18.5", "Maigreur", "#d69e2e"],
            ["18.5 – 24.9", "Normal", "#38a169"],
            ["25 – 29.9", "Surpoids", "#d69e2e"],
            ["30 – 34.9", "Obésité I", "#dd6b20"],
            ["35 – 39.9", "Obésité II", "#e53e3e"],
            ["≥ 40", "Obésité III", "#c53030"],
          ].map(([range, label, color]) => (
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
  const [creat,  setCreat]  = useState("");
  const [unit,   setUnit]   = useState<"umol" | "mgdl">("umol");
  const [age,    setAge]    = useState("");
  const [female, setFemale] = useState(false);

  const rawCr  = num(creat);
  const ageVal = num(age);
  const crUmol = unit === "umol" ? rawCr : creatMgDlToUmol(rawCr);
  const valid  = crUmol > 0 && crUmol < 10000 && ageVal >= 18 && ageVal <= 120;
  const res    = valid ? calcDfg(crUmol, ageVal, female) : null;

  return (
    <div className="calc-body">
      <div className="calc-form">
        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <Field label={`Créatinine (${unit === "umol" ? "µmol/L" : "mg/dL"})`}
            hint="Valeur sérique à jeun">
            <input className="form-input" type="number" min="0" step="0.01"
              placeholder={unit === "umol" ? "80" : "0.9"}
              value={creat} onChange={e => setCreat(e.target.value)} />
          </Field>
          <div className="form-group">
            <label className="form-label">Unité</label>
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
          <Field label="Âge (ans)">
            <input className="form-input" type="number" min="18" max="120"
              placeholder="45" value={age} onChange={e => setAge(e.target.value)} />
          </Field>
          <Field label="Sexe">
            <SexToggle female={female} onChange={setFemale} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label="DFG estimé (CKD-EPI 2021)"
            value={`${res.gfr.toFixed(0)} mL/min/1.73 m²`}
            sub={res.stage.label}
            color={res.stage.color}
          />
        </div>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">Stades MRC (KDIGO)</div>
        <div className="calc-ref-grid">
          {[
            ["≥ 90",    "G1 — Normal",                   "#38a169"],
            ["60 – 89", "G2 — Légèrement diminué",       "#68d391"],
            ["45 – 59", "G3a — Modérément diminué",      "#d69e2e"],
            ["30 – 44", "G3b — Mod. à sév. diminué",     "#dd6b20"],
            ["15 – 29", "G4 — Sévèrement diminué",       "#e53e3e"],
            ["< 15",    "G5 — Insuffisance terminale",   "#c53030"],
          ].map(([range, label, color]) => (
            <div key={range} className="calc-ref-row">
              <span className="calc-ref-range">{range}</span>
              <span className="calc-ref-label" style={{ color }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="calc-disclaimer">
        Formule CKD-EPI 2021 (sans facteur ethnique). À utiliser sur une créatinine
        stable — pas en insuffisance rénale aiguë.
      </p>
    </div>
  );
}

function RisqueCvCalc() {
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
          <Field label="Âge (40 – 80 ans)">
            <input className="form-input" type="number" min="40" max="80"
              placeholder="55" value={age} onChange={e => setAge(e.target.value)} />
          </Field>
          <Field label="Sexe">
            <SexToggle female={female} onChange={setFemale} />
          </Field>
        </div>

        <div className="form-row">
          <Field label="PA systolique (mmHg)">
            <input className="form-input" type="number" min="80" max="220"
              placeholder="130" value={pas} onChange={e => setPas(e.target.value)} />
          </Field>
          <Field label="Tabagisme actif">
            <div style={{ display: "flex", gap: 8 }}>
              {[false, true].map(v => (
                <button key={String(v)} type="button"
                  className={`calc-sex-btn${smoker === v ? " active" : ""}`}
                  onClick={() => setSmoker(v)}>
                  {v ? "Oui" : "Non"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="form-row">
          <Field label="Cholestérol total (mmol/L)" hint="Diviser mg/dL par 38.67">
            <input className="form-input" type="number" min="1" max="15" step="0.1"
              placeholder="5.2" value={chol} onChange={e => setChol(e.target.value)} />
          </Field>
          <Field label="HDL-cholestérol (mmol/L)">
            <input className="form-input" type="number" min="0.1" max="5" step="0.1"
              placeholder="1.3" value={hdl} onChange={e => setHdl(e.target.value)} />
          </Field>
        </div>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label="Risque CV à 10 ans (estimé)"
            value={`~${res.pct} %`}
            sub={res.cat.label}
            color={res.cat.color}
          />
          <ResultCard
            label="Non-HDL"
            value={`${(num(chol) - num(hdl)).toFixed(1)} mmol/L`}
            sub="Cible : < 4.9 mmol/L (bas risque)"
          />
        </div>
      )}

      {!valid && (ageVal < 40 || ageVal > 80) && age !== "" && (
        <p className="calc-disclaimer" style={{ color: "var(--coral)" }}>
          ⚠️ Cet estimateur s'applique aux patients de 40 à 80 ans.
        </p>
      )}

      <p className="calc-disclaimer">
        Estimation clinique orientative (approche Framingham simplifiée).
        Pour une évaluation précise, utiliser les tables SCORE2 ESC adaptées à la
        région géographique du patient.
      </p>
    </div>
  );
}

function GrossesseCalc() {
  const [ddr, setDdr] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);
  const valid    = ddr && ddr <= todayIso;
  const res      = valid ? calcGrossesse(ddr) : null;

  const dpaStr = res
    ? res.dpa.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const trimLabel = res
    ? res.trimestre === 1 ? "1er trimestre" : res.trimestre === 2 ? "2e trimestre" : "3e trimestre"
    : null;

  return (
    <div className="calc-body">
      <div className="calc-form">
        <Field
          label="Date des dernières règles (DDR)"
          hint="Premier jour des dernières règles"
        >
          <input
            className="form-input"
            type="date"
            max={todayIso}
            value={ddr}
            onChange={e => setDdr(e.target.value)}
          />
        </Field>
      </div>

      {res && res.days >= 0 && (
        <div className="calc-results">
          <ResultCard
            label="Âge gestationnel"
            value={`${res.sa} SA + ${res.saRest} j`}
            sub={trimLabel ?? undefined}
            color="var(--blue)"
          />
          <ResultCard
            label="Date prévue d'accouchement"
            value={dpaStr ?? ""}
            sub={res.termeDays >= 0
              ? `Dans ${res.termeDays} j`
              : `Terme dépassé de ${Math.abs(res.termeDays)} j`}
            color={res.termeDays < 0 ? "var(--coral)" : undefined}
          />
        </div>
      )}
      {res && res.days < 0 && (
        <p className="calc-disclaimer" style={{ color: "var(--coral)" }}>
          ⚠️ La DDR est dans le futur.
        </p>
      )}

      <div className="calc-ref">
        <div className="calc-ref-title">Repères cliniques</div>
        {[
          ["SA 12",  "Fin du 1er trimestre · écho T1"],
          ["SA 22",  "Début viabilité fœtale"],
          ["SA 28",  "Fin du 2e trimestre · écho T2"],
          ["SA 37",  "Terme prématuré / prématurité tardive"],
          ["SA 39",  "Terme idéal (naissance à terme complète)"],
          ["SA 41",  "Terme dépassé → surveillance renforcée"],
        ].map(([sa, label]) => (
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
          <Field label="Taille (cm)">
            <input className="form-input" type="number" min="100" max="250" step="0.5"
              placeholder="170" value={height} onChange={e => setHeight(e.target.value)} />
          </Field>
          <Field label="Sexe">
            <SexToggle female={female} onChange={setFemale} />
          </Field>
        </div>
        <Field label="Poids actuel (kg) — optionnel"
          hint="Pour calculer l'écart par rapport au poids idéal">
          <input className="form-input" type="number" min="1" max="500" step="0.1"
            placeholder="—" value={weight} onChange={e => setWeight(e.target.value)} />
        </Field>
      </div>

      {res && (
        <div className="calc-results">
          <ResultCard
            label="Poids idéal (Devine)"
            value={`${res.devine.toFixed(1)} kg`}
            sub={female ? "Femme · 45.5 + 0.91 × (cm − 152.4)" : "Homme · 50 + 0.91 × (cm − 152.4)"}
          />
          <ResultCard
            label="Fourchette IMC normal (18.5 – 25)"
            value={`${res.min.toFixed(0)} – ${res.max.toFixed(0)} kg`}
            sub={`Taille ${h} cm`}
          />
          {currImc !== null && (
            <ResultCard
              label="IMC actuel"
              value={`${currImc.toFixed(1)} kg/m²`}
              sub={w > res.max
                ? `Excès : +${(w - res.max).toFixed(0)} kg`
                : w < res.min
                ? `Déficit : −${(res.min - w).toFixed(0)} kg`
                : "Dans la norme"}
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

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

type CalcKey = "imc" | "dfg" | "cv" | "grossesse" | "poids";

const CALCS: { key: CalcKey; label: string; icon: string; subtitle: string }[] = [
  { key: "imc",      label: "IMC",              icon: "⚖️",  subtitle: "Indice de masse corporelle" },
  { key: "dfg",      label: "DFG / CKD-EPI",   icon: "🫘",  subtitle: "Débit de filtration glomérulaire" },
  { key: "cv",       label: "Risque CV",         icon: "🫀",  subtitle: "Risque cardiovasculaire à 10 ans" },
  { key: "grossesse",label: "Grossesse",         icon: "🤰",  subtitle: "Âge gestationnel & DPA" },
  { key: "poids",    label: "Poids idéal",       icon: "📏",  subtitle: "Devine · Fourchette IMC normal" },
];

export function CalculateursPage() {
  const [active, setActive] = useState<CalcKey>("imc");
  const cur = CALCS.find(c => c.key === active)!;

  return (
    <Layout title="Calculateurs" subtitle="Outils d'aide à la décision clinique">
      <div className="calc-page">

        {/* ── Sidebar selector ── */}
        <div className="calc-sidebar">
          {CALCS.map(c => (
            <button
              key={c.key}
              className={`calc-nav-btn${active === c.key ? " active" : ""}`}
              onClick={() => setActive(c.key)}
            >
              <span className="calc-nav-icon">{c.icon}</span>
              <div>
                <div className="calc-nav-label">{c.label}</div>
                <div className="calc-nav-sub">{c.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Active calculator ── */}
        <div className="calc-main">
          <div className="calc-header">
            <span className="calc-header-icon">{cur.icon}</span>
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
        </div>
      </div>
    </Layout>
  );
}
