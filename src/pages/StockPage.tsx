import { FormEvent, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import type { StockCategory, StockItem } from "../lib/cabinetTypes";
import { STOCK_CATEGORY_LABELS, STOCK_CATEGORY_COLORS } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function qtyStatus(item: StockItem): "out" | "low" | "ok" {
  if (item.quantity === 0) return "out";
  if (item.quantity <= item.minThreshold) return "low";
  return "ok";
}

const STATUS_COLOR = {
  out: "var(--coral)",
  low: "var(--gold)",
  ok:  "var(--green)",
};

const UNIT_SUGGESTIONS = [
  "boîtes", "flacons", "ampoules", "pièces", "paires", "sachets",
  "rouleaux", "litre", "ml", "kg", "g",
];

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface ItemModalProps {
  initial?: StockItem;
  onSave:  (data: Omit<StockItem, "id" | "updatedAt">) => void;
  onClose: () => void;
}

function ItemModal({ initial, onSave, onClose }: ItemModalProps) {
  const [name,     setName]     = useState(initial?.name         ?? "");
  const [category, setCategory] = useState<StockCategory>(initial?.category ?? "medicament");
  const [qty,      setQty]      = useState(String(initial?.quantity      ?? 0));
  const [unit,     setUnit]     = useState(initial?.unit         ?? "boîtes");
  const [minThresh, setMin]     = useState(String(initial?.minThreshold ?? 5));
  const [supplier, setSupplier] = useState(initial?.supplier    ?? "");
  const [notes,    setNotes]    = useState(initial?.notes        ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty, 10);
    const m = parseInt(minThresh, 10);
    if (!name.trim() || isNaN(q) || isNaN(m)) return;
    onSave({
      name: name.trim(),
      category,
      quantity:     Math.max(0, q),
      unit:         unit.trim() || "pièces",
      minThreshold: Math.max(0, m),
      supplier:     supplier.trim() || undefined,
      notes:        notes.trim()    || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial ? "Modifier l'article" : "Nouvel article"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div className="form-group">
              <label className="form-label">Nom de l'article *</label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Paracétamol 1g, Gants latex M, Seringues 5ml…"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={e => setCategory(e.target.value as StockCategory)}
                >
                  {(Object.keys(STOCK_CATEGORY_LABELS) as StockCategory[]).map(c => (
                    <option key={c} value={c}>{STOCK_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unité</label>
                <input
                  className="form-input"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  list="unit-suggestions"
                  placeholder="boîtes, pièces, ml…"
                />
                <datalist id="unit-suggestions">
                  {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
                </datalist>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantité actuelle *</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Seuil d'alerte</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="1"
                  value={minThresh}
                  onChange={e => setMin(e.target.value)}
                />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                  Alerte en dessous de ce seuil
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fournisseur</label>
              <input
                className="form-input"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="Nom du fournisseur, pharmacie…"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                className="form-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observations, date de péremption…"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Restock modal ─────────────────────────────────────────────────────────────

function RestockModal({
  item, onConfirm, onClose,
}: {
  item: StockItem;
  onConfirm: (delta: number) => void;
  onClose:   () => void;
}) {
  const [amount, setAmount] = useState("10");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(amount, 10);
    if (!isNaN(n) && n > 0) { onConfirm(n); onClose(); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h2 className="modal-title">Réapprovisionnement</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
              <strong>{item.name}</strong> — stock actuel :
              <strong style={{ color: STATUS_COLOR[qtyStatus(item)] }}> {item.quantity} {item.unit}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Quantité à ajouter ({item.unit})</label>
              <input
                className="form-input"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" style={{ background: "var(--green)" }}>
              + Ajouter au stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function StockPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { stockItems, addStockItem, updateStockItem, deleteStockItem, adjustStock } = useCabinet();

  const [catFilter,    setCatFilter]    = useState<StockCategory | "all">("all");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState<{ item?: StockItem } | null>(null);
  const [restock,      setRestock]      = useState<StockItem | null>(null);
  const [alertCollapsed, setAlertCollapsed] = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ── KPI ───────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const out  = stockItems.filter(s => s.quantity === 0).length;
    const low  = stockItems.filter(s => s.quantity > 0 && s.quantity <= s.minThreshold).length;
    const cats = new Set(stockItems.map(s => s.category)).size;
    return { total: stockItems.length, out, low, cats };
  }, [stockItems]);

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alertItems = useMemo(
    () => stockItems.filter(s => s.quantity <= s.minThreshold)
          .sort((a, b) => a.quantity - b.quantity),
    [stockItems]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...stockItems]
      .filter(s =>
        (catFilter === "all" || s.category === catFilter) &&
        (!q || s.name.toLowerCase().includes(q) || (s.supplier ?? "").toLowerCase().includes(q))
      )
      .sort((a, b) => {
        // Sort: out-of-stock first, then low stock, then ok; within each group alphabetically
        const sa = qtyStatus(a), sb = qtyStatus(b);
        const order = { out: 0, low: 1, ok: 2 };
        if (order[sa] !== order[sb]) return order[sa] - order[sb];
        return a.name.localeCompare(b.name);
      });
  }, [stockItems, catFilter, search]);

  // ── Render ────────────────────────────────────────────────────────────────
  const stockActions = (
    <button className="btn btn-primary" onClick={() => setModal({})}>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      Nouvel article
    </button>
  );

  const body = (
    <>
      {noLayout && <div className="inline-actions">{stockActions}</div>}
      {/* ── KPI strip ── */}
      <div className="stock-kpi-strip">
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpi.total}</div>
          <div className="stock-kpi-lbl">Articles</div>
        </div>
        <div className="stock-kpi-card" style={{ borderColor: kpi.out > 0 ? "var(--coral)" : undefined }}>
          <div className="stock-kpi-val" style={{ color: kpi.out > 0 ? "var(--coral)" : "var(--muted)" }}>
            {kpi.out}
          </div>
          <div className="stock-kpi-lbl">Rupture</div>
        </div>
        <div className="stock-kpi-card" style={{ borderColor: kpi.low > 0 ? "var(--gold)" : undefined }}>
          <div className="stock-kpi-val" style={{ color: kpi.low > 0 ? "var(--gold)" : "var(--muted)" }}>
            {kpi.low}
          </div>
          <div className="stock-kpi-lbl">Stock faible</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpi.cats}</div>
          <div className="stock-kpi-lbl">Catégories</div>
        </div>
      </div>

      {/* ── Low-stock alert bar ── */}
      {alertItems.length > 0 && (
        <div className="stock-alert-bar">
          <button
            className="stock-alert-hdr"
            onClick={() => setAlertCollapsed(c => !c)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2L1 12h12L7 2Z" stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M7 6v3M7 10.5v.5" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span>
              {alertItems.length} article{alertItems.length > 1 ? "s" : ""} en alerte
              {kpi.out > 0 && <> · <strong>{kpi.out} en rupture</strong></>}
            </span>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ marginLeft: "auto", transform: alertCollapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.2s" }}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          {!alertCollapsed && (
            <div className="stock-alert-list">
              {alertItems.map(item => {
                const status = qtyStatus(item);
                return (
                  <div key={item.id} className="stock-alert-row">
                    <span
                      className="stock-cat-badge"
                      style={{
                        background: STOCK_CATEGORY_COLORS[item.category] + "22",
                        color:      STOCK_CATEGORY_COLORS[item.category],
                      }}
                    >
                      {STOCK_CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="stock-alert-name">{item.name}</span>
                    <span
                      className="stock-alert-qty"
                      style={{ color: STATUS_COLOR[status] }}
                    >
                      {status === "out" ? "Rupture" : `${item.quantity} ${item.unit} restant${item.quantity > 1 ? "s" : ""}`}
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "3px 10px" }}
                      onClick={() => setRestock(item)}
                    >
                      + Réapprovisionner
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Filter / search bar ── */}
      <div className="stock-toolbar">
        <div className="stock-filter-pills">
          {([
            ["all",         "Tous"],
            ["medicament",  "Médicaments"],
            ["consommable", "Consommables"],
            ["equipement",  "Équipements"],
            ["autre",       "Autre"],
          ] as const).map(([val, lbl]) => (
            <button
              key={val}
              className={`stock-filter-pill${catFilter === val ? " active" : ""}`}
              onClick={() => setCatFilter(val)}
            >
              {lbl}
              {val !== "all" && (
                <span className="stock-pill-count">
                  {stockItems.filter(s => s.category === val).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="stock-search-wrap">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: "var(--muted)", flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="stock-search-input"
            placeholder="Rechercher un article…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              onClick={() => setSearch("")}>×</button>
          )}
        </div>
      </div>

      {/* ── Items list ── */}
      {stockItems.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun article en stock</div>
          <div style={{ marginBottom: 16, color: "var(--muted)" }}>
            Ajoutez vos médicaments, consommables et équipements.
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            Ajouter un article
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontWeight: 700 }}>Aucun résultat</div>
        </div>
      ) : (
        <div className="stock-list">
          {filtered.map(item => {
            const status = qtyStatus(item);
            const color  = STOCK_CATEGORY_COLORS[item.category];
            return (
              <div key={item.id} className={`stock-row${status !== "ok" ? ` stock-row-${status}` : ""}`}>
                {/* Category accent */}
                <div className="stock-row-accent" style={{ background: color }} />

                {/* Name + meta */}
                <div className="stock-row-info">
                  <div className="stock-row-name">{item.name}</div>
                  <div className="stock-row-meta">
                    <span
                      className="stock-cat-badge"
                      style={{ background: color + "20", color }}
                    >
                      {STOCK_CATEGORY_LABELS[item.category]}
                    </span>
                    {item.supplier && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        · {item.supplier}
                      </span>
                    )}
                    {item.notes && (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        · {item.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity controls */}
                <div className="stock-row-qty-area">
                  <button
                    className="stock-adj-btn"
                    onClick={() => {
                      adjustStock(item.id, -1);
                      if (item.quantity - 1 === 0) showToast(`⚠️ ${item.name} — rupture de stock`);
                      else if (item.quantity - 1 <= item.minThreshold) showToast(`⚠️ ${item.name} — stock faible`);
                    }}
                    disabled={item.quantity === 0}
                    title="Retirer 1"
                  >−</button>

                  <div className="stock-qty-display" style={{ color: STATUS_COLOR[status] }}>
                    <span className="stock-qty-val">{item.quantity}</span>
                    <span className="stock-qty-unit">{item.unit}</span>
                  </div>

                  <button
                    className="stock-adj-btn"
                    onClick={() => adjustStock(item.id, 1)}
                    title="Ajouter 1"
                  >+</button>

                  <button
                    className="stock-restock-btn"
                    onClick={() => setRestock(item)}
                    title="Réapprovisionner"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v5M4 4l2-3 2 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 8h8M3 8v2.5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Threshold */}
                <div className="stock-row-threshold">
                  <span style={{ fontSize: 10, color: "var(--tertiary)" }}>
                    seuil : {item.minThreshold} {item.unit}
                  </span>
                </div>

                {/* Actions */}
                <div className="stock-row-actions">
                  <button
                    className="appt-edit-btn"
                    title="Modifier"
                    onClick={() => setModal({ item })}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z"
                        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="tx-delete"
                    title="Supprimer"
                    onClick={() => {
                      if (confirm(`Supprimer « ${item.name} » ?`)) {
                        deleteStockItem(item.id);
                        showToast("Article supprimé");
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 3h10M5 3V2h4v1M4 3v9h6V3"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {modal !== null && (
        <ItemModal
          initial={modal.item}
          onSave={data => {
            if (modal.item) updateStockItem({ ...data, id: modal.item.id, updatedAt: new Date().toISOString() });
            else addStockItem(data);
            showToast(modal.item ? "Article modifié" : "Article ajouté");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {restock && (
        <RestockModal
          item={restock}
          onConfirm={delta => {
            adjustStock(restock.id, delta);
            showToast(`+${delta} ${restock.unit} — ${restock.name}`);
          }}
          onClose={() => setRestock(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title="Stocks"
      subtitle={`${stockItems.length} article${stockItems.length !== 1 ? "s" : ""}`}
      actions={stockActions}
    >
      {body}
    </Layout>
  );
}
