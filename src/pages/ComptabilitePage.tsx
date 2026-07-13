import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FixedAsset } from "../engine";
import {
  calculateAmortization, calculateTotalDotation, getCategoriesByType,
} from "../engine";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useApp } from "../context/AppContext";
import { formatMAD, formatDateShort } from "../lib/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import type { RecurringRule } from "../lib/recurringTransactions";

// ── Constants ──────────────────────────────────────────────────────────────────

// Taux d'amortissement usuels admis par l'administration fiscale marocaine —
// utilisés comme référence lors d'un contrôle (barème DGI / usages professionnels).
// Chaque entrée porte le taux conseillé, la fourchette admise et sa base.
// Le médecin peut toujours saisir un autre taux.
interface AmortSuggestion { subcat: string; rate: number; note: string; }
const AMORT_SUGGESTIONS: AmortSuggestion[] = [
  { subcat: "Matériel médical",      rate: 0.15, note: "Matériel & outillage — usuel 10 à 15 %" },
  { subcat: "Matériel informatique", rate: 0.15, note: "Micro-ordinateurs, périphériques & logiciels — 15 % (gros matériel 10 %)" },
  { subcat: "Mobilier et bureau",    rate: 0.10, note: "Mobilier de bureau — usuel 10 % (jusqu'à 20 %)" },
  { subcat: "Agencements / travaux", rate: 0.10, note: "Installations, aménagements & agencements — usuel 10 %" },
  { subcat: "Véhicule",              rate: 0.20, note: "Matériel de transport — 20 à 25 % · base plafonnée à 300 000 MAD (Art. 10-II CGI)" },
  { subcat: "Logiciel",              rate: 0.20, note: "Logiciels — 20 à 33 % (amortis sur 3 à 5 ans)" },
  { subcat: "Constructions",         rate: 0.05, note: "Construction — 4 % (habitation/commerce), 5 % (industriel dur), 10 % (léger)" },
];
const SUBCATEGORY_SUGGESTIONS = AMORT_SUGGESTIONS.map(s => s.subcat);

function amortSuggestionFor(subcat: string): AmortSuggestion | undefined {
  const q = subcat.trim().toLowerCase();
  return AMORT_SUGGESTIONS.find(s => s.subcat.toLowerCase() === q);
}

const FREQ_MULTIPLIER: Record<RecurringRule["frequency"], number> = {
  monthly: 12, quarterly: 4, yearly: 1,
};

// ── Asset modal ────────────────────────────────────────────────────────────────

interface AssetModalProps {
  initial?: FixedAsset;
  onSave: (a: Omit<FixedAsset, "id">) => void;
  onClose: () => void;
}

function AssetModal({ initial, onSave, onClose }: AssetModalProps) {
  const { t } = useTranslation();
  const [label,    setLabel]   = useState(initial?.label    ?? "");
  const [category, setCat]     = useState<FixedAsset["category"]>(initial?.category ?? "immobilisation_corporelle");
  const [subcat,   setSubcat]  = useState(initial?.subcategory  ?? "");
  const [date,     setDate]    = useState(initial?.acquisitionDate   ?? "");
  const [amount,   setAmount]  = useState(String(initial?.acquisitionAmount ?? ""));
  const [rate,     setRate]    = useState(String(Math.round((initial?.amortizationRate ?? 0.20) * 100)));
  const [notes,    setNotes]   = useState(initial?.notes ?? "");

  const CATEGORY_OPTS: { id: FixedAsset["category"]; label: string }[] = [
    { id: "immobilisation_corporelle",   label: "Immobilisation corporelle" },
    { id: "immobilisation_incorporelle", label: "Immobilisation incorporelle" },
    { id: "non_valeur",                  label: "Non-valeur" },
  ];

  const RATE_PRESETS: { label: string; value: number }[] = [
    { label: `10% (10 ${t("comptabilite.amortYears")})`,  value: 0.10 },
    { label: `20% (5 ${t("comptabilite.amortYears")})`,   value: 0.20 },
    { label: `25% (4 ${t("comptabilite.amortYears")})`,   value: 0.25 },
    { label: `33% (3 ${t("comptabilite.amortYears")})`,   value: 0.3333 },
  ];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const r   = parseFloat(rate) / 100;
    if (!label.trim() || isNaN(amt) || amt <= 0 || isNaN(r) || r <= 0 || !date) return;
    onSave({
      label: label.trim(),
      category,
      subcategory: subcat.trim() || category,
      acquisitionDate: date,
      acquisitionAmount: amt,
      amortizationRate: r,
      amortizationMethod: "linear",
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {initial ? t("comptabilite.assetModalEdit") : t("comptabilite.assetModalNew")}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">{t("comptabilite.labelField")}</label>
              <input className="form-input" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="ex. Échographe Mindray" required autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("comptabilite.categoryField")}</label>
                <select className="form-select" value={category}
                  onChange={e => setCat(e.target.value as FixedAsset["category"])}>
                  {CATEGORY_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t("comptabilite.subcategoryField")}</label>
                <input className="form-input" value={subcat}
                  onChange={e => {
                    const v = e.target.value;
                    setSubcat(v);
                    // Pick an asset type → apply its legally-usual rate as a suggestion.
                    const s = amortSuggestionFor(v);
                    if (s) setRate(String(Math.round(s.rate * 100)));
                  }}
                  placeholder="Matériel médical" list="subcat-list" />
                <datalist id="subcat-list">
                  {SUBCATEGORY_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("comptabilite.acquisitionDate")}</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t("comptabilite.acquisitionValue")}</label>
                <input className="form-input" type="number" min="1" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("comptabilite.amortRate")}</label>
              <div className="asset-rate-presets">
                {RATE_PRESETS.map(p => (
                  <button key={p.value} type="button"
                    className={`asset-rate-btn${parseFloat(rate) / 100 === p.value ? " active" : ""}`}
                    onClick={() => setRate(String(Math.round(p.value * 100)))}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input className="form-input" type="number" min="1" max="100" step="0.01"
                  value={rate} onChange={e => setRate(e.target.value)}
                  style={{ width: 90, textAlign: "center" }} />
                <span style={{ color: "var(--muted)", fontSize: 13 }}>%</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  = {rate ? `${Math.round(100 / parseFloat(rate))} ${t("comptabilite.amortYears")}` : "—"}
                </span>
              </div>
              {(() => {
                const s = amortSuggestionFor(subcat);
                if (!s) return null;
                const applied = Math.round(parseFloat(rate)) === Math.round(s.rate * 100);
                return (
                  <div className="asset-amort-hint">
                    <span className="asset-amort-hint-badge">{t("comptabilite.amortLegalRate")}</span>
                    <span>{s.note}.</span>
                    {!applied && (
                      <button type="button" className="asset-amort-hint-apply"
                        onClick={() => setRate(String(Math.round(s.rate * 100)))}>
                        {t("comptabilite.amortApply", { rate: Math.round(s.rate * 100) })}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="form-group">
              <label className="form-label">{t("comptabilite.notesField")}</label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t("comptabilite.notesPlaceholder")} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("common.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Recurring rule modal ───────────────────────────────────────────────────────

interface RuleModalProps {
  initial?: RecurringRule;
  fiscalYear: number;
  onSave: (r: Omit<RecurringRule, "id">) => void;
  onClose: () => void;
}

function RuleModal({ initial, fiscalYear, onSave, onClose }: RuleModalProps) {
  const { t } = useTranslation();
  const chargeCategories = useMemo(
    () => getCategoriesByType(fiscalYear, "CHARGE"),
    [fiscalYear],
  );

  const [label,     setLabel]    = useState(initial?.label ?? "");
  const [amount,    setAmount]   = useState(String(initial?.templateTransaction.amount ?? ""));
  const [catId,     setCatId]    = useState(initial?.templateTransaction.category ?? chargeCategories[0]?.id ?? "");
  const [freq,      setFreq]     = useState<RecurringRule["frequency"]>(initial?.frequency ?? "monthly");
  const [day,       setDay]      = useState(String(initial?.dayOfMonth ?? 1));
  const [startDate, setStart]    = useState(initial?.startDate ?? `${fiscalYear}-01-01`);
  const [endDate,   setEnd]      = useState(initial?.endDate ?? "");
  const [active,    setActive]   = useState(initial?.active ?? true);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!label.trim() || isNaN(amt) || amt <= 0 || !catId) return;
    onSave({
      label: label.trim(),
      frequency: freq,
      dayOfMonth: Math.max(1, Math.min(28, parseInt(day, 10) || 1)),
      startDate,
      endDate: endDate || undefined,
      active,
      templateTransaction: {
        type: "CHARGE",
        amount: amt,
        category: catId,
        deductibilityStatus: "FULLY_DEDUCTIBLE",
        professionalUseRatio: 1,
        description: label.trim(),
      },
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {initial ? t("comptabilite.ruleModalEdit") : t("comptabilite.ruleModalNew")}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">{t("comptabilite.labelField")}</label>
              <input className="form-input" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="ex. Loyer cabinet" required autoFocus />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("comptabilite.amountField")}</label>
                <input className="form-input" type="number" min="1" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t("comptabilite.frequencyField")}</label>
                <select className="form-select" value={freq}
                  onChange={e => setFreq(e.target.value as RecurringRule["frequency"])}>
                  <option value="monthly">{t("comptabilite.freqMonthly")}</option>
                  <option value="quarterly">{t("comptabilite.freqQuarterly")}</option>
                  <option value="yearly">{t("comptabilite.freqYearly")}</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("comptabilite.categoryField")}</label>
                <select className="form-select" value={catId} onChange={e => setCatId(e.target.value)}>
                  {chargeCategories.map(c => <option key={c.id} value={c.id}>{c.labelFr}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t("comptabilite.dayOfMonth")}</label>
                <input className="form-input" type="number" min="1" max="28"
                  value={day} onChange={e => setDay(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("comptabilite.startDate")}</label>
                <input className="form-input" type="date" value={startDate} onChange={e => setStart(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t("comptabilite.endDate")}</label>
                <input className="form-input" type="date" value={endDate} onChange={e => setEnd(e.target.value)} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              {t("comptabilite.ruleActive")}
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("common.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ComptabilitePage() {
  const { t } = useTranslation();
  const {
    assets, addAsset, updateAsset, deleteAsset,
    recurringRules, addRecurringRule, deleteRecurringRule,
    fiscalYear,
  } = useApp();

  const [tab,        setTab]        = useState<"assets" | "rules">("assets");
  const [assetModal, setAssetModal] = useState<{ asset?: FixedAsset } | null>(null);
  const [ruleModal,  setRuleModal]  = useState<{ rule?: RecurringRule } | null>(null);

  const showToast = useToast();

  const CATEGORY_OPTS: { id: FixedAsset["category"]; label: string }[] = [
    { id: "immobilisation_corporelle",   label: "Immobilisation corporelle" },
    { id: "immobilisation_incorporelle", label: "Immobilisation incorporelle" },
    { id: "non_valeur",                  label: "Non-valeur" },
  ];

  const FREQ_LABELS: Record<RecurringRule["frequency"], string> = {
    monthly:   t("comptabilite.freqMonthly"),
    quarterly: t("comptabilite.freqQuarterly"),
    yearly:    t("comptabilite.freqYearly"),
  };

  const schedules = useMemo(
    () => assets.map(a => ({
      asset:    a,
      schedule: calculateAmortization(a, fiscalYear),
    })),
    [assets, fiscalYear],
  );

  const { totalDotation } = useMemo(
    () => calculateTotalDotation(assets, fiscalYear),
    [assets, fiscalYear],
  );

  const totalVBA = useMemo(
    () => assets.reduce((s, a) => s + a.acquisitionAmount, 0),
    [assets],
  );

  const totalVNC = useMemo(
    () => schedules.reduce((s, { schedule }) => s + schedule.netBookValue, 0),
    [schedules],
  );

  const annualCostByRule = useMemo(() =>
    recurringRules.map(r => ({
      rule: r,
      annual: r.active
        ? r.templateTransaction.amount * FREQ_MULTIPLIER[r.frequency]
        : 0,
    })),
    [recurringRules],
  );

  const totalAnnualRecurring = useMemo(
    () => annualCostByRule.reduce((s, r) => s + r.annual, 0),
    [annualCostByRule],
  );

  const chargeCategories = useMemo(
    () => getCategoriesByType(fiscalYear, "CHARGE"),
    [fiscalYear],
  );

  const catLabel = (id: string) => chargeCategories.find(c => c.id === id)?.labelFr ?? id;

  return (
    <Layout
      title={t("comptabilite.title")}
      subtitle={t("comptabilite.subtitle")}
      actions={
        tab === "assets" ? (
          <button className="btn btn-primary" onClick={() => setAssetModal({})}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t("comptabilite.addAsset")}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setRuleModal({})}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t("comptabilite.newRule")}
          </button>
        )
      }
    >
      <div className="compta-tabs">
        <button className={`compta-tab${tab === "assets" ? " active" : ""}`} onClick={() => setTab("assets")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M4 3V2M10 3V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {t("comptabilite.tabAssets")}
          <span className="compta-tab-badge">{assets.length}</span>
        </button>
        <button className={`compta-tab${tab === "rules" ? " active" : ""}`} onClick={() => setTab("rules")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/>
            <circle cx="7" cy="7" r="1" fill="currentColor"/>
          </svg>
          {t("comptabilite.tabRules")}
          <span className="compta-tab-badge">{recurringRules.filter(r => r.active).length}</span>
        </button>
      </div>

      {tab === "assets" && (
        <>
          <div className="compta-kpi-row">
            <div className="compta-kpi">
              <div className="compta-kpi-lbl">{t("comptabilite.kpiVba")}</div>
              <div className="compta-kpi-val"><AnimatedNumber value={totalVBA} format={formatMAD} /></div>
              <div className="compta-kpi-sub">
                {t("comptabilite.kpiVbaSub", { n: assets.length, s: assets.length !== 1 ? "s" : "" })}
              </div>
            </div>
            <div className="compta-kpi">
              <div className="compta-kpi-lbl">{t("comptabilite.kpiVnc")}</div>
              <div className="compta-kpi-val"><AnimatedNumber value={totalVNC} format={formatMAD} /></div>
              <div className="compta-kpi-sub">{t("comptabilite.kpiVncSub", { year: fiscalYear })}</div>
            </div>
            <div className="compta-kpi compta-kpi-highlight">
              <div className="compta-kpi-lbl">{t("comptabilite.kpiDotation", { year: fiscalYear })}</div>
              <div className="compta-kpi-val rpt-coral"><AnimatedNumber value={totalDotation} format={formatMAD} /></div>
              <div className="compta-kpi-sub">{t("comptabilite.kpiDotationSub")}</div>
            </div>
          </div>

          {assets.length === 0 ? (
            <div className="compta-empty">
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏥</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("comptabilite.emptyAssets")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                {t("comptabilite.emptyAssetsSub")}
              </div>
              <button className="btn btn-primary" onClick={() => setAssetModal({})}>
                {t("comptabilite.addAsset")}
              </button>
            </div>
          ) : (
            <div className="compta-table-wrap">
              <table className="compta-table">
                <thead>
                  <tr>
                    <th>{t("comptabilite.colLabel")}</th>
                    <th>{t("comptabilite.colSubcat")}</th>
                    <th>{t("comptabilite.colAcquisition")}</th>
                    <th className="ta-r">{t("comptabilite.colVba")}</th>
                    <th className="ta-r">{t("comptabilite.colRate")}</th>
                    <th className="ta-r">{t("comptabilite.colDotation", { year: fiscalYear })}</th>
                    <th className="ta-r">{t("comptabilite.colVnc")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(({ asset, schedule }) => {
                    const fullyAmortized = schedule.netBookValue <= 0;
                    return (
                      <tr key={asset.id} style={{ opacity: fullyAmortized ? 0.5 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{asset.label}</div>
                          {asset.notes && <div style={{ fontSize: 12, color: "var(--muted)" }}>{asset.notes}</div>}
                        </td>
                        <td>
                          <span className="compta-cat-badge">
                            {asset.subcategory || CATEGORY_OPTS.find(c => c.id === asset.category)?.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--muted)" }}>
                          {formatDateShort(asset.acquisitionDate)}
                        </td>
                        <td className="ta-r">{formatMAD(asset.acquisitionAmount, { showCurrency: false })}</td>
                        <td className="ta-r" style={{ color: "var(--muted)" }}>
                          {Math.round(asset.amortizationRate * 100)}%
                        </td>
                        <td className="ta-r rpt-coral">
                          {fullyAmortized
                            ? <span style={{ color: "var(--green)", fontSize: 12 }}>{t("comptabilite.amortized")}</span>
                            : formatMAD(schedule.currentYearDotation, { showCurrency: false })}
                        </td>
                        <td className="ta-r" style={{ fontWeight: 700 }}>
                          {formatMAD(schedule.netBookValue, { showCurrency: false })}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="appt-edit-btn" onClick={() => setAssetModal({ asset })}>
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button className="tx-delete" onClick={() => {
                              if (confirm(t("comptabilite.deleteAssetConfirm", { label: asset.label }))) {
                                deleteAsset(asset.id);
                                showToast(t("comptabilite.toastAssetDeleted"));
                              }
                            }}>
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="compta-tfoot">
                    <td colSpan={3}><strong>{t("comptabilite.totalRow")}</strong></td>
                    <td className="ta-r"><strong>{formatMAD(totalVBA, { showCurrency: false })}</strong></td>
                    <td></td>
                    <td className="ta-r rpt-coral"><strong>{formatMAD(totalDotation, { showCurrency: false })}</strong></td>
                    <td className="ta-r"><strong>{formatMAD(totalVNC, { showCurrency: false })}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="compta-kpi-row">
            <div className="compta-kpi">
              <div className="compta-kpi-lbl">{t("comptabilite.kpiRecurring")}</div>
              <div className="compta-kpi-val">{recurringRules.filter(r => r.active).length}</div>
              <div className="compta-kpi-sub">
                {t("comptabilite.kpiRecurringSub", { n: recurringRules.length, s: recurringRules.length !== 1 ? "s" : "" })}
              </div>
            </div>
            <div className="compta-kpi compta-kpi-highlight">
              <div className="compta-kpi-lbl">{t("comptabilite.kpiAnnualCost")}</div>
              <div className="compta-kpi-val rpt-coral">{formatMAD(totalAnnualRecurring)}</div>
              <div className="compta-kpi-sub">{t("comptabilite.kpiAnnualCostSub", { year: fiscalYear })}</div>
            </div>
            <div className="compta-kpi">
              <div className="compta-kpi-lbl">{t("comptabilite.kpiMonthlyCost")}</div>
              <div className="compta-kpi-val">{formatMAD(totalAnnualRecurring / 12)}</div>
              <div className="compta-kpi-sub">{t("comptabilite.kpiMonthlyCostSub")}</div>
            </div>
          </div>

          {recurringRules.length === 0 ? (
            <div className="compta-empty">
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔁</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("comptabilite.emptyRules")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                {t("comptabilite.emptyRulesSub")}
              </div>
              <button className="btn btn-primary" onClick={() => setRuleModal({})}>
                {t("comptabilite.addRuleBtn")}
              </button>
            </div>
          ) : (
            <div className="compta-table-wrap">
              <table className="compta-table">
                <thead>
                  <tr>
                    <th>{t("comptabilite.colLabel")}</th>
                    <th>{t("comptabilite.colCategory")}</th>
                    <th>{t("comptabilite.colFrequency")}</th>
                    <th className="ta-r">{t("comptabilite.colAmount")}</th>
                    <th className="ta-r">{t("comptabilite.colAnnual")}</th>
                    <th>{t("comptabilite.colPeriod")}</th>
                    <th>{t("comptabilite.colStatus")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {annualCostByRule.map(({ rule, annual }) => (
                    <tr key={rule.id} style={{ opacity: rule.active ? 1 : 0.45 }}>
                      <td style={{ fontWeight: 600 }}>{rule.label}</td>
                      <td>
                        <span className="compta-cat-badge">
                          {catLabel(rule.templateTransaction.category)}
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>
                        {FREQ_LABELS[rule.frequency]}
                      </td>
                      <td className="ta-r">
                        {formatMAD(rule.templateTransaction.amount, { showCurrency: false })}
                      </td>
                      <td className="ta-r rpt-coral" style={{ fontWeight: 600 }}>
                        {rule.active ? formatMAD(annual, { showCurrency: false }) : "—"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {formatDateShort(rule.startDate)}
                        {rule.endDate ? ` → ${formatDateShort(rule.endDate)}` : " → …"}
                      </td>
                      <td>
                        <span className="compta-status" style={{
                          background: rule.active ? "var(--green-soft)" : "var(--surface-alt)",
                          color:      rule.active ? "var(--green)"      : "var(--muted)",
                        }}>
                          {rule.active ? t("comptabilite.statusActive") : t("comptabilite.statusInactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="appt-edit-btn" onClick={() => setRuleModal({ rule })}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button className="tx-delete" onClick={() => {
                            if (confirm(t("comptabilite.deleteRuleConfirm", { label: rule.label }))) {
                              deleteRecurringRule(rule.id);
                              showToast(t("comptabilite.toastRuleDeleted"));
                            }
                          }}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="compta-tfoot">
                    <td colSpan={4}><strong>{t("comptabilite.totalAnnualRow")}</strong></td>
                    <td className="ta-r rpt-coral"><strong>{formatMAD(totalAnnualRecurring, { showCurrency: false })}</strong></td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {assetModal !== null && (
        <AssetModal
          initial={assetModal.asset}
          onSave={a => {
            if (assetModal.asset) { updateAsset(assetModal.asset.id, a); showToast(t("comptabilite.toastAssetModified")); }
            else { addAsset(a); showToast(t("comptabilite.toastAssetAdded")); }
          }}
          onClose={() => setAssetModal(null)}
        />
      )}

      {ruleModal !== null && (
        <RuleModal
          initial={ruleModal.rule}
          fiscalYear={fiscalYear}
          onSave={r => {
            if (ruleModal.rule) {
              deleteRecurringRule(ruleModal.rule.id);
              addRecurringRule(r);
              showToast(t("comptabilite.toastRuleModified"));
            } else {
              addRecurringRule(r);
              showToast(t("comptabilite.toastRuleAdded"));
            }
          }}
          onClose={() => setRuleModal(null)}
        />
      )}

    </Layout>
  );
}
