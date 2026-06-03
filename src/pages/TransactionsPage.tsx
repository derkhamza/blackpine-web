import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCategoryById } from "blackpine-engine";
import type { Transaction } from "blackpine-engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { formatMAD, formatDateShort, todayIso } from "../lib/format";

// ── Categories list (common) ───────────────────────────────────────────────
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

// ── Add/Edit modal ─────────────────────────────────────────────────────────
interface ModalProps {
  initial?: Partial<Transaction>;
  initialType?: "RECETTE" | "CHARGE";
  onSave: (tx: Omit<Transaction, "id">) => void;
  onClose: () => void;
}

function TxModal({ initial, initialType, onSave, onClose }: ModalProps) {
  const [type, setType]         = useState<"RECETTE" | "CHARGE">(initial?.type ?? initialType ?? "RECETTE");
  const [amount, setAmount]     = useState(initial?.amount ? String(initial.amount) : "");
  const [date, setDate]         = useState(initial?.date ?? todayIso());
  const [category, setCategory] = useState(initial?.category ?? (type === "RECETTE" ? "consultation" : "loyer_cabinet"));

  // Reset category when type toggles
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
      type,
      amount: amt,
      date,
      category,
      deductibilityStatus: "FULLY_DEDUCTIBLE",
      professionalUseRatio: 1,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{initial?.id ? "Modifier" : "Nouvelle"} transaction</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["RECETTE", "CHARGE"] as const).map((t) => (
                <button
                  key={t} type="button"
                  className={`filter-btn${type === t ? " active" : ""}`}
                  style={{ flex: 1, background: type === t ? (t === "RECETTE" ? "var(--green)" : "var(--coral)") : undefined,
                           borderColor: type === t ? "transparent" : undefined }}
                  onClick={() => handleTypeChange(t)}
                >
                  {t === "RECETTE" ? "Recette" : "Charge"}
                </button>
              ))}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant (MAD)</label>
                <input
                  className="form-input" type="number" min="0" step="0.01"
                  placeholder="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)} required
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

          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button
              type="submit"
              className="btn btn-primary"
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

// ── Page ───────────────────────────────────────────────────────────────────
export function TransactionsPage() {
  const { transactions, fiscalYear, addTransaction, deleteTransaction } = useApp();
  const [searchParams] = useSearchParams();

  const [filter, setFilter]   = useState<"ALL" | "RECETTE" | "CHARGE">(
    (searchParams.get("filter") as any) ?? "ALL"
  );
  const [modal, setModal]     = useState<{ type: "RECETTE" | "CHARGE" } | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  useEffect(() => {
    const f = searchParams.get("filter") as any;
    if (f) setFilter(f);
  }, [searchParams]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // Filter to fiscal year
  const yearTx   = transactions.filter((t) => t.date.startsWith(String(fiscalYear)));
  const filtered = filter === "ALL" ? yearTx : yearTx.filter((t) => t.type === filter);

  const recettes = filtered.filter((t) => t.type === "RECETTE");
  const charges  = filtered.filter((t) => t.type === "CHARGE");
  const totalRec = recettes.reduce((s, t) => s + t.amount, 0);
  const totalChg = charges.reduce((s, t) => s + t.amount, 0);

  const handleAdd = (tx: Omit<Transaction, "id">) => {
    addTransaction(tx);
    showToast("Transaction enregistrée");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Supprimer cette transaction ?")) return;
    deleteTransaction(id);
    showToast("Transaction supprimée");
  };

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

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
      {/* Filters */}
      <div className="tx-filters">
        {(["ALL", "RECETTE", "CHARGE"] as const).map((f) => (
          <button
            key={f}
            className={`filter-btn${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "Tout" : f === "RECETTE" ? "Recettes" : "Charges"}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="tx-summary">
        <div className="tx-summary-card" style={{ borderLeftColor: "var(--green)" }}>
          <div className="tx-summary-label" style={{ color: "var(--green)" }}>Recettes filtrées</div>
          <div className="tx-summary-value" style={{ color: "var(--green)" }}>{formatMAD(totalRec)}</div>
          <div className="tx-summary-count">{recettes.length} opération{recettes.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="tx-summary-card" style={{ borderLeftColor: "var(--coral)" }}>
          <div className="tx-summary-label" style={{ color: "var(--coral)" }}>Charges filtrées</div>
          <div className="tx-summary-value" style={{ color: "var(--coral)" }}>{formatMAD(totalChg)}</div>
          <div className="tx-summary-count">{charges.length} opération{charges.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>{filter === "RECETTE" ? "💰" : filter === "CHARGE" ? "📋" : "📊"}</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucune transaction</div>
          <div>Utilisez les boutons ci-dessus pour en ajouter.</div>
        </div>
      ) : (
        <div className="tx-list">
          {sorted.map((tx) => {
            const isRec = tx.type === "RECETTE";
            return (
              <div key={tx.id} className="tx-row">
                <div
                  className="tx-type-badge"
                  style={{
                    background: isRec ? "var(--green-soft)" : "var(--coral-soft)",
                    color: isRec ? "var(--green)" : "var(--coral)",
                  }}
                >
                  {isRec ? "REC" : "CHG"}
                </div>
                <div className="tx-main">
                  <div className="tx-category">{categoryLabel(tx.type, tx.category)}</div>
                  <div className="tx-date">{formatDateShort(tx.date)}</div>
                </div>
                <div className="tx-amount" style={{ color: isRec ? "var(--green)" : "var(--coral)" }}>
                  {isRec ? "+" : "−"}{formatMAD(tx.amount, { showCurrency: false })}
                </div>
                <button
                  className="tx-delete"
                  title="Supprimer"
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
          initialType={modal.type}
          onSave={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
