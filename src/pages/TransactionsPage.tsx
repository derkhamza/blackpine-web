import { confirmDialog } from "../lib/confirm";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCategoryById } from "../engine";
import type { Transaction } from "../engine";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { isBlockType } from "../lib/cabinetTypes";
import { formatMAD, formatDateShort, todayIso } from "../lib/format";
import { clickable } from "../lib/a11y";
import { AnimatedNumber } from "../components/AnimatedNumber";

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

// A row shown in the list — either a real ledger entry or a read-only row derived
// from another module (e.g. a purchase order). Derived rows can't be edited or
// deleted here; they reflect their source live and always stay in sync.
type DisplayTx = Transaction & { derived?: boolean; originLabel?: string; originLink?: string };

function applyFilters(txs: DisplayTx[], f: FilterState): DisplayTx[] {
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
  const { t } = useTranslation();
  const up = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const active = isFiltersActive(filters);
  // Keep the advanced filters (dates + categories) tucked away by default so the
  // bar reads as one clean row — open automatically if a filter is already set.
  const [showAdv, setShowAdv] = useState(() => !!(filters.dateFrom || filters.dateTo || filters.category));

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
            placeholder={t("transactions.searchPlaceholder")}
            value={filters.query}
            onChange={(e) => up({ query: e.target.value })}
          />
          {filters.query && (
            <button className="tx-search-clear" onClick={() => up({ query: "" })}>×</button>
          )}
        </div>

        {/* Type chips */}
        <div className="tx-type-chips">
          {(["ALL", "RECETTE", "CHARGE"] as TypeFilter[]).map((typ) => (
            <button
              key={typ}
              className={`tx-chip${filters.typeFilter === typ ? " active" : ""}${
                typ === "RECETTE" ? " recette" : typ === "CHARGE" ? " charge" : ""
              }`}
              onClick={() => up({ typeFilter: typ, category: null })}
            >
              {typ === "ALL" ? t("transactions.filterAll") : typ === "RECETTE" ? t("transactions.filterRecettes") : t("transactions.filterCharges")}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="tx-sort-wrap">
          <button
            className="tx-sort-btn"
            title={t("transactions.sortToggleTitle")}
            onClick={() => up({ sortField: filters.sortField === "date" ? "amount" : "date" })}
          >
            {filters.sortField === "date" ? t("transactions.sortByDate") : t("transactions.sortByAmount")}
          </button>
          <button
            className="tx-sort-btn tx-sort-dir"
            title={t("transactions.sortDirTitle")}
            onClick={() => up({ sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" })}
          >
            {filters.sortOrder === "desc" ? "↓" : "↑"}
          </button>
          <button
            className={`tx-sort-btn${showAdv ? " active" : ""}`}
            onClick={() => setShowAdv(a => !a)}
            title={t("transactions.filters")}
          >
            {t("transactions.filters")}
          </button>
        </div>
      </div>

      {/* ── Row 2: date range (advanced) + result count (always visible) ── */}
      <div className="tx-filter-row tx-filter-row-dates">
        {showAdv && <div className="tx-date-range">
          <label className="tx-date-label">{t("transactions.dateFrom")}</label>
          <input
            className="tx-date-input"
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => up({ dateFrom: e.target.value || null })}
          />
          <label className="tx-date-label">{t("transactions.dateTo")}</label>
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
        </div>}

        {/* Result count + reset */}
        <div className="tx-filter-result">
          {active ? (
            <>
              <span className="tx-filter-count">
                {t("transactions.filteredResults", { n: filteredCount, s: filteredCount !== 1 ? "s" : "", total: totalCount })}
              </span>
              <button className="tx-filter-reset" onClick={() => onChange(DEFAULT_FILTERS)}>
                {t("transactions.reset")}
              </button>
            </>
          ) : (
            <span className="tx-filter-count-neutral">
              {t("transactions.totalOps", { n: totalCount, s: totalCount !== 1 ? "s" : "" })}
            </span>
          )}
        </div>
      </div>

      {/* ── Row 3: category chips (advanced, only when a type is selected) ── */}
      {showAdv && catList && (
        <div className="tx-filter-row tx-cat-row">
          <button
            className={`tx-cat-chip${filters.category === null ? " active" : ""}`}
            onClick={() => up({ category: null })}
          >
            {t("transactions.allCategories")}
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
  const { t } = useTranslation();
  const [type,     setType]     = useState<"RECETTE" | "CHARGE">(initial?.type ?? initialType ?? "RECETTE");
  const [amount,   setAmount]   = useState(initial?.amount ? String(initial.amount) : "");
  const [date,     setDate]     = useState(initial?.date ?? todayIso());
  const [category, setCategory] = useState(initial?.category ?? (type === "RECETTE" ? "consultation" : "loyer_cabinet"));
  const [deduct,   setDeduct]   = useState<Transaction["deductibilityStatus"]>(
    initial?.deductibilityStatus ?? "FULLY_DEDUCTIBLE"
  );
  const [proRatio, setProRatio] = useState(initial?.professionalUseRatio ?? 1);
  const [notes,    setNotes]    = useState(initial?.description ?? "");

  const handleTypeChange = (tp: "RECETTE" | "CHARGE") => {
    setType(tp);
    setCategory(tp === "RECETTE" ? "consultation" : "loyer_cabinet");
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
          <h2 className="modal-title">{initial?.id ? t("transactions.modalTitleEdit") : t("transactions.modalTitleNew")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["RECETTE", "CHARGE"] as const).map((tp) => (
                <button
                  key={tp} type="button"
                  className={`tx-chip${type === tp ? " active" : ""}${tp === "RECETTE" ? " recette" : " charge"}`}
                  style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700,
                    background: type === tp ? (tp === "RECETTE" ? "var(--green)" : "var(--coral)") : undefined,
                    borderColor: type === tp ? "transparent" : undefined,
                    color: type === tp ? "#fff" : undefined }}
                  onClick={() => handleTypeChange(tp)}
                >
                  {tp === "RECETTE" ? t("transactions.btnRecette") : t("transactions.btnCharge")}
                </button>
              ))}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("transactions.amountLabel")}</label>
                <input
                  className="form-input" type="number" min="0.01" step="0.01"
                  placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)} required autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("transactions.dateLabel")}</label>
                <input
                  className="form-input" type="date"
                  value={date} onChange={(e) => setDate(e.target.value)} required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t("transactions.categoryLabel")}</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {/* Deductibility — charges only */}
            {isCharge && (
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">{t("transactions.deductLabel")}</label>
                  <select
                    className="form-select"
                    value={deduct}
                    onChange={(e) => setDeduct(e.target.value as Transaction["deductibilityStatus"])}
                  >
                    <option value="FULLY_DEDUCTIBLE">{t("transactions.deductFull")}</option>
                    <option value="PARTIALLY_DEDUCTIBLE">{t("transactions.deductPartial")}</option>
                    <option value="NON_DEDUCTIBLE">{t("transactions.deductNone")}</option>
                  </select>
                </div>
                {deduct === "PARTIALLY_DEDUCTIBLE" && (
                  <div className="form-group">
                    <label className="form-label">{t("transactions.proRatioLabel")}</label>
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
              <label className="form-label">{t("transactions.notesLabel")} <span className="form-label-hint">{t("transactions.notesOptional")}</span></label>
              <input
                className="form-input"
                placeholder={t("transactions.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button
              type="submit" className="btn btn-primary"
              style={{ background: type === "RECETTE" ? "var(--green)" : "var(--coral)" }}
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function DeductBadge({ status }: { status: Transaction["deductibilityStatus"] }) {
  const { t } = useTranslation();
  if (!status || status === "FULLY_DEDUCTIBLE") return null;
  const partial = status === "PARTIALLY_DEDUCTIBLE";
  return (
    <span className="tx-deduct-badge" style={{
      background: partial ? "var(--gold-soft)" : "var(--coral-soft)",
      color:      partial ? "var(--gold)"      : "var(--coral)",
    }}>
      {partial ? t("transactions.deductBadgePartial") : t("transactions.deductBadgeNone")}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TransactionsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t } = useTranslation();
  const { transactions, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX,
          addTransaction, updateTransaction, deleteTransaction } = useApp();
  const { purchaseOrders, appointments } = useCabinet();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters,  setFilters]  = useState<FilterState>({
    ...DEFAULT_FILTERS,
    typeFilter: (searchParams.get("filter") as TypeFilter | null) ?? "ALL",
  });
  const [modal,    setModal]    = useState<{ tx?: Transaction; type?: "RECETTE" | "CHARGE" } | null>(null);

  // Consume ?filter= and ?openAdd= params on navigation
  useEffect(() => {
    const f  = searchParams.get("filter") as TypeFilter | null;
    const oa = searchParams.get("openAdd") as "RECETTE" | "CHARGE" | null;
    if (f)  setFilters((prev) => ({ ...prev, typeFilter: f }));
    if (oa) setModal({ type: oa });
  }, [searchParams]);

  const showToast = useToast();

  // Money recorded in the cabinet store that never posts a real ledger entry is
  // surfaced here as read-only "auto" rows, so the tab reflects EVERY charge and
  // income — not just manual entries. Payroll already posts real transactions.
  const derivedTx = useMemo<DisplayTx[]>(() => {
    const rows: DisplayTx[] = [];

    // (1) Purchase orders → charges. POs never post to the ledger.
    for (const po of purchaseOrders) {
      if (!(po.status === "ordered" || po.status === "partial" || po.status === "received")) continue;
      const amount = po.lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice ?? 0), 0);
      const date = (po.receivedAt || po.orderedAt || po.createdAt || "").slice(0, 10);
      if (amount <= 0 || !date) continue;
      rows.push({
        id: "po:" + po.id, type: "CHARGE", amount, date,
        category: "consommables_medicaux",
        description: `${t("transactions.autoPurchase")}${po.supplierName ? " — " + po.supplierName : ""}`,
        deductibilityStatus: "FULLY_DEDUCTIBLE",
        derived: true, originLabel: t("transactions.autoBadge"), originLink: "/stocks",
      });
    }

    // (2) Billing income that was collected but never booked — cash taken in a
    // secretary session, or a deferred balance later collected. We recognise the
    // cash actually collected (paidAmount) and subtract whatever the ledger already
    // holds for that patient on that day, so a normal doctor-billed visit (already
    // posted) nets to zero and only the un-booked remainder shows. No double count,
    // no data migration — it's recomputed live.
    const recetteByDate = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      if (tx.type !== "RECETTE") continue;
      const list = recetteByDate.get(tx.date);
      if (list) list.push(tx); else recetteByDate.set(tx.date, [tx]);
    }
    for (const a of appointments) {
      if (!a.billedAt || isBlockType(a.type)) continue;
      const cash = a.paidAmount ?? a.billedAmount ?? 0;
      if (cash <= 0) continue;
      const name = (a.patientName || "").trim();
      const sameDay = recetteByDate.get(a.date) ?? [];
      const booked = sameDay.reduce((s, tx) =>
        (name && (tx.description ?? "").includes(name)) ? s + tx.amount : s, 0);
      const shortfall = cash - booked;
      if (shortfall <= 0.5) continue;
      rows.push({
        id: "appt:" + a.id, type: "RECETTE", amount: shortfall, date: a.date,
        category: a.type === "procedure" ? "acte_chirurgical" : "consultation",
        description: `${t("transactions.autoBilling")}${name ? " — " + name : ""}`,
        deductibilityStatus: "FULLY_DEDUCTIBLE",
        derived: true, originLabel: t("transactions.autoBadge"), originLink: "/agenda/" + a.id,
      });
    }

    return rows;
  }, [purchaseOrders, appointments, transactions, t]);

  const yearTx   = useMemo<DisplayTx[]>(
    () => [...transactions, ...derivedTx].filter((tx) => tx.date.startsWith(String(fiscalYear))),
    [transactions, derivedTx, fiscalYear]
  );
  const filtered = useMemo(() => applyFilters(yearTx, filters), [yearTx, filters]);

  const recettes  = filtered.filter((tx) => tx.type === "RECETTE");
  const charges   = filtered.filter((tx) => tx.type === "CHARGE");
  const totalRec  = recettes.reduce((s, tx) => s + tx.amount, 0);
  const totalChg  = charges.reduce((s, tx) => s + tx.amount, 0);

  const handleAdd = (tx: Omit<Transaction, "id">) => {
    if (modal?.tx) { updateTransaction(modal.tx.id, tx); showToast(t("transactions.modified")); }
    else           { addTransaction(tx);                  showToast(t("transactions.saved")); }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog(t("transactions.deleteConfirm"))) return;
    deleteTransaction(id);
    showToast(t("transactions.deleted"));
  };

  const fabs = (
    <div className="fabs">
      <button className="fab fab-recette" onClick={() => setModal({ type: "RECETTE" })}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        {t("transactions.addRecette")}
      </button>
      <button className="fab fab-charge" onClick={() => setModal({ type: "CHARGE" })}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        {t("transactions.addCharge")}
      </button>
    </div>
  );

  const content = (
    <>
      {noLayout && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>{fabs}</div>
      )}
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
          <div className="year-sub">{t("transactions.fiscalYear")}</div>
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
          <div className="tx-summary-label" style={{ color: "var(--green)" }}>{t("transactions.recettes")}</div>
          <div className="tx-summary-value" style={{ color: "var(--green)" }}><AnimatedNumber value={totalRec} format={formatMAD} /></div>
          <div className="tx-summary-count">{t("transactions.ops", { n: recettes.length, s: recettes.length !== 1 ? "s" : "" })}</div>
        </div>
        <div className="tx-summary-card" style={{ borderLeftColor: "var(--coral)" }}>
          <div className="tx-summary-label" style={{ color: "var(--coral)" }}>{t("transactions.charges")}</div>
          <div className="tx-summary-value" style={{ color: "var(--coral)" }}><AnimatedNumber value={totalChg} format={formatMAD} /></div>
          <div className="tx-summary-count">{t("transactions.ops", { n: charges.length, s: charges.length !== 1 ? "s" : "" })}</div>
        </div>
      </div>

      {/* ── Transaction list ── */}
      {filtered.length === 0 ? (
        <div className="tx-empty">
          <div className="tx-empty-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 14l3-3 2.5 2 4.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {isFiltersActive(filters) ? t("transactions.emptyFiltered") : t("transactions.emptyTitle")}
          </div>
          <div style={{ marginBottom: 16 }}>
            {isFiltersActive(filters) ? t("transactions.emptyFilterHint") : t("transactions.emptyHint")}
          </div>
          {isFiltersActive(filters) && (
            <button className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              {t("transactions.resetFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="tx-list">
          {filtered.map((tx) => {
            const isRec = tx.type === "RECETTE";
            const derived = !!tx.derived;
            // Derived rows (e.g. purchase orders) are read-only here: clicking
            // opens their source module; editing/deleting happens there.
            const onRowClick = derived
              ? () => navigate(tx.originLink || "/stocks")
              : () => setModal({ tx });
            return (
              <div key={tx.id} className="tx-row" {...clickable(onRowClick, tx.description || tx.category)} style={{ cursor: "pointer" }}>
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
                    {derived && <span className="tx-auto-badge">{tx.originLabel}</span>}
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
                {derived ? (
                  <span className="tx-auto-arrow" aria-hidden title={t("transactions.autoOpenSource")}>›</span>
                ) : (
                  <button
                    className="tx-delete" title={t("transactions.deleteBtnTitle")}
                    onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 3h10M5 3V2h4v1M4 3v9h6V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
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

    </>
  );

  return noLayout ? content : (
    <Layout
      title={t("transactions.title")}
      subtitle={t("transactions.subtitle", { year: fiscalYear, n: yearTx.length, s: yearTx.length !== 1 ? "s" : "" })}
      actions={fabs}
    >
      {content}
    </Layout>
  );
}
