import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCategoryById } from "blackpine-engine";
import type { Transaction } from "blackpine-engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { formatMAD, formatDateShort, todayIso } from "../lib/format";

// ── Categories ────────────────────────────────────────────────────────────────

const RECETTE_CATS = [
  { id: "consultation",        label: "Consultation" },
  { id: "acte_chirurgical",    label: "Acte chirurgical" },
  { id: "radiologie",          label: "Radiologie / Imagerie" },
  { id: "analyses",            label: "Analyses de laboratoire" },
  { id: "autres_recettes",     label: "Autres recettes" },
];
const CHARGE_CATS = [
  { id: "loyer_cabinet",           label: "Loyer cabinet" },
  { id: "salaires_personnel",      label: "Salaires personnel" },
  { id: "consommables_medicaux",   label: "Consommables médicaux" },
  { id: "electricite_eau",         label: "Électricité / Eau" },
  { id: "telephonie_internet",     label: "Téléphonie / Internet" },
  { id: "carburant",               label: "Carburant" },
  { id: "fournitures_bureau",      label: "Fournitures de bureau" },
  { id: "honoraires_comptable",    label: "Honoraires comptable" },
  { id: "assurance_rc_pro",        label: "Assurance RC Pro" },
  { id: "rc_pro",                  label: "RC professionnelle" },
  { id: "formation_continue",      label: "Formation continue" },
  { id: "entretien_materiel",      label: "Entretien matériel" },
  { id: "frais_bancaires",         label: "Frais bancaires" },
  { id: "publicite_communication", label: "Publicité / Communication" },
  { id: "autres_charges",          label: "Autres charges" },
];

function categoryLabel(type: Transaction["type"], catId: string): string {
  const list = type === "RECETTE" ? RECETTE_CATS : CHARGE_CATS;
  return list.find((c) => c.id === catId)?.label
    ?? getCategoryById(2026, catId)?.labelFr
    ?? catId;
}

// ── Filter state + logic ──────────────────────────────────────────────────────

type TypeFilter = "ALL" | "RECETTE" | "CHARGE";
type SortField  = "date" | "amount";
type SortOrder  = "asc" | "desc";

interface FilterState {
  query:      string;
  typeFilter: TypeFilter;
  sortField:  SortField;
  sortOrder:  SortOrder;
  dateFrom:   string | null;
  dateTo:     string | null;
  category:   string | null;
}

const DEFAULT_FILTERS: FilterState = {
  query: "", typeFilter: "ALL", sortField: "date", sortOrder: "desc",
  dateFrom: null, dateTo: null, category: null,
};

function applyFilters(txs: Transaction[], f: FilterState): Transaction[] {
  let result = [...txs];
  if (f.typeFilter !== "ALL") result = result.filter((t) => t.type === f.typeFilter);
  if (f.category) result = result.filter((t) => t.category === f.category);
  if (f.dateFrom) result = result.filter((t) => t.date >= f.dateFrom!);
  if (f.dateTo)   result = result.filter((t) => t.date <= f.dateTo!);
  if (f.query.trim()) {
    const q = f.query.toLowerCase().trim();
    result = result.filter((t) => {
      const cat    = getCategoryById(2026, t.category);
      const label  = cat?.labelFr?.toLowerCase() ?? categoryLabel(t.type, t.category).toLowerCase();
      const desc   = (t.description ?? "").toLowerCase();
      return label.includes(q) || t.category.toLowerCase().includes(q)
          || String(t.amount).includes(q) || desc.includes(q);
    });
  }
  result.sort((a, b) => {
    const cmp = f.sortField === "date"
      ? a.date.localeCompare(b.date)
      : a.amount - b.amount;
    return f.sortOrder === "desc" ? -cmp : cmp;
  });
  return result;
}

function isFiltersActive(f: FilterState): boolean {
  return f.query !== "" || f.typeFilter !== "ALL" || f.category !== null
      || f.dateFrom !== null || f.dateTo !== null;
}

// ── Filter bar component ──────────────────────────────────────────────────────

function FilterBar({
  filters, onChange, totalCount, filteredCount,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const up = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const active = isFiltersActive(filters);

  const catList = filters.typeFilter === "RECETTE" ? RECETTE_CATS
                : filters.typeFilter === "CHARGE"  ? CHARGE_CATS
                : null;

  return (
    <div className="tx-filter-bar">
      {/* ── Row 1: search + type + sort ── */}
      <div className="tx-filter-row">
        {/* Search */}
        <div className="tx-search-wrap">
          <svg className="tx-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="tx-search-input"
            type="text"
            placeholder="Rechercher (catégorie, montant…)"
            value={filters.query}
            onChange={(e) => up({ query: e.target.value })}
          />
          {filters.query && (
            <button className="tx-search-clear" onClick={() => up({ query: "" })}>×</button>
          )}
        </div>

        {/* Type chips */}
        <div className="tx-type-chips">
          {(["ALL", "RECETTE", "CHARGE"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              className={`tx-chip${filters.typeFilter === t ? " active" : ""}${
                t === "RECETTE" ? " recette" : t === "CHARGE" ? " charge" : ""
              }`}
              onClick={() => up({ typeFilter: t, category: null })}
            >
              {t === "ALL" ? "Tout" : t === "RECETTE" ? "Recettes" : "Charges"}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="tx-sort-wrap">
          <button
            className="tx-sort-btn"
            title="Basculer tri par date / montant"
            onClick={() => up({ sortField: filters.sortField === "date" ? "amount" : "date" })}
          >
            {filters.sortField === "date" ? "Trier : Date" : "Trier : Montant"}
          </button>
          <button
            className="tx-sort-btn tx-sort-dir"
            title="Inverser l'ordre"
            onClick={() => up({ sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" })}
          >
            {filters.sortOrder === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>

      {/* ── Row 2: date range ── */}
      <div className="tx-filter-row tx-filter-row-dates">
        <div className="tx-date-range">
          <label className="tx-date-label">De</label>
          <input
            className="tx-date-input"
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => up({ dateFrom: e.target.value || null })}
          />
          <label className="tx-date-label">À</label>
          <input
            className="tx-date-input"
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => up({ dateTo: e.target.value || null })}
          />
          {(filters.dateFrom || filters.dateTo) && (
            <button
              className="tx-date-clear"
              onClick={() => up({ dateFrom: null, dateTo: null })}
            >
              ×
            </button>
          )}
        </div>

        {/* Result count + reset */}
        <div className="tx-filter-result">
          {active ? (
            <>
              <span className="tx-filter-count">
                {filteredCount} résultat{filteredCount !== 1 ? "s" : ""} sur {totalCount}
              </span>
              <button className="tx-filter-reset" onClick={() => onChange(DEFAULT_FILTERS)}>
                Réinitialiser
              </button>
            </>
          ) : (
            <span className="tx-filter-count-neutral">
              {totalCount} opération{totalCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 3: category chips (only when type is selected) ── */}
      {catList && (
        <div className="tx-filter-row tx-cat-row">
          <button
            className={`tx-cat-chip${filters.category === null ? " active" : ""}`}
            onClick={() => up({ category: null })}
          >
            Toutes catégories
          </button>
          {catList.map((c) => (
            <button
              key={c.id}
              className={`tx-cat-chip${filters.category === c.id ? " active" : ""}`}
              onClick={() => up({ category: filters.category === c.id ? null : c.id })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface ModalProps {
  initial?: Partial<Transaction>;
  initialType?: "RECETTE" | "CHARGE";
  onSave: (tx: Omit<Transaction, "id">) => void;
  onClose: () => void;
}

function TxModal({ initial, initialType, onSave, onClose }: ModalProps) {
  const [type,     setType]     = useState<"RECETTE" | "CHARGE">(initial?.type ?? initialType ?? "RECETTE");
  const [amount,   setAmount]   = useState(initial?.amount ? String(initial.amount) : "");
  const [date,     setDate]     = useState(initial?.date ?? todayIso());
  const [category, setCategory] = useState(initial?.category ?? (type === "RECETTE" ? "consultation" : "loyer_cabinet"));
  const [deduct,   setDeduct]   = useState<Transaction["deductibilityStatus"]>(
    initial?.deductibilityStatus ?? "FULLY_DEDUCTIBLE"
  );
  const [proRatio, setProRatio] = useState(initial?.professionalUseRatio ?? 1);
  const [notes,    setNotes]    = useState(initial?.description ?? "");

  const handleTypeChange = (t: "RECETTE" | "CHARGE") => {
    setType(t);
    setCategory(t === "RECETTE" ? "consultation" : "loyer_cabinet");
  };

  const cats = type === "RECETTE" ? RECETTE_CATS : CHARGE_CATS;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    onSave({
      type, amount: amt, date, category,
      deductibilityStatus: deduct,
      professionalUseRatio: proRatio,
      description: notes.trim() || undefined,
    });
    onClose();
  };

  const isCharge = type === "CHARGE";

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial?.id ? "Modifier" : "Nouvelle"} transaction</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["RECETTE", "CHARGE"] as const).map((t) => (
                <button
                  key={t} type="button"
                  className={`tx-chip${type === t ? " active" : ""}${t === "RECETTE" ? " recette" : " charge"}`}
                  style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700,
                    background: type === t ? (t === "RECETTE" ? "var(--green)" : "var(--coral)") : undefined,
                    borderColor: type === t ? "transparent" : undefined,
                    color: type === t ? "#fff" : undefined }}
                  onClick={() => handleTypeChange(t)}
                >
                  {t === "RECETTE" ? "+ Recette" : "− Charge"}
                </button>
              ))}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant (MAD)</label>
                <input
                  className="form-input" type="number" min="0.01" step="0.01"
                  placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)} required autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  className="form-input" type="date"
                  value={date} onChange={(e) => setDate(e.target.value)} required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Catégorie</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {/* Deductibility — charges only */}
            {isCharge && (
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Déductibilité</label>
                  <select
                    className="form-select"
                    value={deduct}
                    onChange={(e) => setDeduct(e.target.value as Transaction["deductibilityStatus"])}
                  >
                    <option value="FULLY_DEDUCTIBLE">Totalement déductible</option>
                    <option value="PARTIALLY_DEDUCTIBLE">Partiellement déductible</option>
                    <option value="NON_DEDUCTIBLE">Non déductible</option>
                  </select>
                </div>
                {deduct === "PARTIALLY_DEDUCTIBLE" && (
                  <div className="form-group">
                    <label className="form-label">Usage pro (%)</label>
                    <input
                      className="form-input" type="number" min="1" max="100"
                      value={Math.round(proRatio * 100)}
                      onChange={(e) => setProRatio(Math.min(1, Math.max(0, Number(e.target.value) / 100)))}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes <span className="form-label-hint">(optionnel)</span></label>
              <input
                className="form-input"
                placeholder="Description libre…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button
              type="submit" className="btn btn-primary"
              style={{ background: type === "RECETTE" ? "var(--green)" : "var(--coral)" }}
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function DeductBadge({ status }: { status: Transaction["deductibilityStatus"] }) {
  if (!status || status === "FULLY_DEDUCTIBLE") return null;
  const partial = status === "PARTIALLY_DEDUCTIBLE";
  return (
    <span className="tx-deduct-badge" style={{
      background: partial ? "var(--gold-soft)" : "var(--coral-soft)",
      color:      partial ? "var(--gold)"      : "var(--coral)",
    }}>
      {partial ? "Partiel" : "Non déd."}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TransactionsPage() {
  const { transactions, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX,
          addTransaction, updateTransaction, deleteTransaction } = useApp();
  const [searchParams] = useSearchParams();
  const [filters,  setFilters]  = useState<FilterState>({
    ...DEFAULT_FILTERS,
    typeFilter: (searchParams.get("filter") as TypeFilter | null) ?? "ALL",
  });
  const [modal,    setModal]    = useState<{ tx?: Transaction; type?: "RECETTE" | "CHARGE" } | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  // Consume ?filter= and ?openAdd= params on navigation
  useEffect(() => {
    const f  = searchParams.get("filter") as TypeFilter | null;
    const oa = searchParams.get("openAdd") as "RECETTE" | "CHARGE" | null;
    if (f)  setFilters((prev) => ({ ...prev, typeFilter: f }));
    if (oa) setModal({ type: oa });
  }, [searchParams]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const yearTx   = useMemo(
    () => transactions.filter((t) => t.date.startsWith(String(fiscalYear))),
    [transactions, fiscalYear]
  );
  const filtered = useMemo(() => applyFilters(yearTx, filters), [yearTx, filters]);

  const recettes  = filtered.filter((t) => t.type === "RECETTE");
  const charges   = filtered.filter((t) => t.type === "CHARGE");
  const totalRec  = recettes.reduce((s, t) => s + t.amount, 0);
  const totalChg  = charges.reduce((s, t) => s + t.amount, 0);

  const handleAdd = (tx: Omit<Transaction, "id">) => {
    if (modal?.tx) { updateTransaction(modal.tx.id, tx); showToast("Transaction modifiée"); }
    else           { addTransaction(tx);                  showToast("Transaction enregistrée"); }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Supprimer cette transaction ?")) return;
    deleteTransaction(id);
    showToast("Transaction supprimée");
  };

  return (
    <Layout
      title="Transactions"
      subtitle={`${fiscalYear} · ${yearTx.length} opération${yearTx.length !== 1 ? "s" : ""}`}
      actions={
        <div className="fabs">
          <button className="fab fab-recette" onClick={() => setModal({ type: "RECETTE" })}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Recette
          </button>
          <button className="fab fab-charge" onClick={() => setModal({ type: "CHARGE" })}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            Charge
          </button>
        </div>
      }
    >
      {/* ── Year picker ── */}
      <div className="year-picker" style={{ marginBottom: 16 }}>
        <button className="year-btn" disabled={fiscalYear <= FISCAL_MIN}
          onClick={() => setFiscalYear(fiscalYear - 1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <div className="year-label">{fiscalYear}</div>
          <div className="year-sub">Exercice fiscal</div>
        </div>
        <button className="year-btn" disabled={fiscalYear >= FISCAL_MAX}
          onClick={() => setFiscalYear(fiscalYear + 1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Filter bar ── */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={yearTx.length}
        filteredCount={filtered.length}
      />

      {/* ── Summary cards ── */}
      <div className="tx-summary">
        <div className="tx-summary-card" style={{ borderLeftColor: "var(--green)" }}>
          <div className="tx-summary-label" style={{ color: "var(--green)" }}>Recettes</div>
          <div className="tx-summary-value" style={{ color: "var(--green)" }}>{formatMAD(totalRec)}</div>
          <div className="tx-summary-count">{recettes.length} opération{recettes.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="tx-summary-card" style={{ borderLeftColor: "var(--coral)" }}>
          <div className="tx-summary-label" style={{ color: "var(--coral)" }}>Charges</div>
          <div className="tx-summary-value" style={{ color: "var(--coral)" }}>{formatMAD(totalChg)}</div>
          <div className="tx-summary-count">{charges.length} opération{charges.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* ── Transaction list ── */}
      {filtered.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {isFiltersActive(filters) ? "🔍" : filters.typeFilter === "RECETTE" ? "💰" : filters.typeFilter === "CHARGE" ? "📋" : "📊"}
          </div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {isFiltersActive(filters) ? "Aucun résultat" : "Aucune transaction"}
          </div>
          <div style={{ marginBottom: 16 }}>
            {isFiltersActive(filters)
              ? "Essayez de modifier ou réinitialiser les filtres."
              : "Utilisez les boutons ci-dessus pour en ajouter."}
          </div>
          {isFiltersActive(filters) && (
            <button className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="tx-list">
          {filtered.map((tx) => {
            const isRec = tx.type === "RECETTE";
            return (
              <div key={tx.id} className="tx-row" onClick={() => setModal({ tx })} style={{ cursor: "pointer" }}>
                <div
                  className="tx-type-badge"
                  style={{
                    background: isRec ? "var(--green-soft)" : "var(--coral-soft)",
                    color:      isRec ? "var(--green)"      : "var(--coral)",
                  }}
                >
                  {isRec ? "REC" : "CHG"}
                </div>
                <div className="tx-main">
                  <div className="tx-category">
                    {categoryLabel(tx.type, tx.category)}
                    <DeductBadge status={tx.deductibilityStatus} />
                  </div>
                  <div className="tx-date">
                    {formatDateShort(tx.date)}
                    {tx.description && (
                      <span className="tx-notes"> · {tx.description}</span>
                    )}
                  </div>
                </div>
                <div className="tx-amount" style={{ color: isRec ? "var(--green)" : "var(--coral)" }}>
                  {isRec ? "+" : "−"}{formatMAD(tx.amount, { showCurrency: false })}
                </div>
                <button
                  className="tx-delete" title="Supprimer"
                  onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 3h10M5 3V2h4v1M4 3v9h6V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <TxModal
          initial={modal.tx}
          initialType={modal.type}
          onSave={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
