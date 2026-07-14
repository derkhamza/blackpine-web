import { confirmDialog } from "../lib/confirm";
import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import type {
  Supplier, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus,
} from "../lib/cabinetTypes";
import { PO_STATUS_LABELS, PO_STATUS_COLORS } from "../lib/cabinetTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

const PO_STATUSES: PurchaseOrderStatus[] = ["draft", "ordered", "partial", "received", "cancelled"];

function orderTotal(lines: PurchaseOrderLine[]): number {
  return lines.reduce((s, l) => s + (l.unitPrice ?? 0) * l.quantity, 0);
}

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Supplier modal ─────────────────────────────────────────────────────────────

interface SupplierModalProps {
  initial?: Partial<Supplier>;
  onSave:  (s: Omit<Supplier, "id" | "createdAt">) => void;
  onClose: () => void;
}

function SupplierModal({ initial, onSave, onClose }: SupplierModalProps) {
  const { t } = useTranslation();
  const [name,     setName]     = useState(initial?.name     ?? "");
  const [phone,    setPhone]    = useState(initial?.phone    ?? "");
  const [email,    setEmail]    = useState(initial?.email    ?? "");
  const [address,  setAddress]  = useState(initial?.address  ?? "");
  const [products, setProducts] = useState(initial?.products ?? "");
  const [notes,    setNotes]    = useState(initial?.notes    ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name:     name.trim(),
      phone:    phone.trim()    || undefined,
      email:    email.trim()    || undefined,
      address:  address.trim()  || undefined,
      products: products.trim() || undefined,
      notes:    notes.trim()    || undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {initial?.id ? t("fournisseurs.supModalEdit") : t("fournisseurs.supModalNew")}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">{t("fournisseurs.nameField")}</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex : Pharma Maroc SARL" autoFocus required />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("fournisseurs.phoneField")}</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+212 5…" type="tel" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("fournisseurs.emailField")}</label>
                <input className="form-input" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="contact@…" type="email" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("fournisseurs.addressField")}</label>
              <input className="form-input" value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Rue, ville…" />
            </div>
            <div className="form-group">
              <label className="form-label">{t("fournisseurs.productsField")}</label>
              <input className="form-input" value={products} onChange={e => setProducts(e.target.value)}
                placeholder={t("fournisseurs.productsPlaceholder")} />
            </div>
            <div className="form-group">
              <label className="form-label">{t("fournisseurs.notesField")}</label>
              <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} placeholder={t("fournisseurs.notesPlaceholder")} />
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

// ── Purchase order modal ───────────────────────────────────────────────────────

interface POModalProps {
  initial?:   Partial<PurchaseOrder>;
  suppliers:  Supplier[];
  stockItems: { id: string; name: string; unit: string }[];
  onSave:     (o: Omit<PurchaseOrder, "id" | "createdAt">) => void;
  onClose:    () => void;
}

function POModal({ initial, suppliers, stockItems, onSave, onClose }: POModalProps) {
  const { t } = useTranslation();
  const [supplierId,  setSupplierId]  = useState(initial?.supplierId  ?? "");
  const [status,      setStatus]      = useState<PurchaseOrderStatus>(initial?.status ?? "draft");
  const [orderedAt,   setOrderedAt]   = useState(initial?.orderedAt   ?? "");
  const [expectedAt,  setExpectedAt]  = useState(initial?.expectedAt  ?? "");
  const [notes,       setNotes]       = useState(initial?.notes       ?? "");
  const [lines, setLines] = useState<PurchaseOrderLine[]>(
    initial?.lines?.length
      ? initial.lines
      : [{ itemName: "", quantity: 1, unitPrice: undefined, stockItemId: undefined }]
  );

  const addLine    = () => setLines(prev => [...prev, { itemName: "", quantity: 1, unitPrice: undefined, stockItemId: undefined }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, j) => j !== i));
  const updateLine = (i: number, patch: Partial<PurchaseOrderLine>) =>
    setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));

  const handleStockLink = (i: number, stockId: string) => {
    const si = stockItems.find(s => s.id === stockId);
    updateLine(i, { stockItemId: stockId || undefined, itemName: si ? si.name : lines[i].itemName });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter(l => l.itemName.trim() && l.quantity > 0);
    if (validLines.length === 0) return;
    const sup = suppliers.find(s => s.id === supplierId);
    onSave({
      supplierId:   supplierId   || undefined,
      supplierName: sup?.name,
      lines:        validLines,
      status,
      orderedAt:    orderedAt   || undefined,
      expectedAt:   expectedAt  || undefined,
      notes:        notes.trim() || undefined,
    });
  };

  const total  = orderTotal(lines);
  const isEdit = !!initial?.id;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? t("fournisseurs.poModalEdit") : t("fournisseurs.poModalNew")}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("fournisseurs.supplierField")}</label>
                <select className="form-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                  <option value="">{t("fournisseurs.supplierSelect")}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: "0 0 170px" }}>
                <label className="form-label">{t("fournisseurs.statusField")}</label>
                <select className="form-input" value={status} onChange={e => setStatus(e.target.value as PurchaseOrderStatus)}>
                  {PO_STATUSES.map(s => <option key={s} value={s}>{PO_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("fournisseurs.orderedAtField")}</label>
                <input className="form-input" type="date" value={orderedAt} onChange={e => setOrderedAt(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("fournisseurs.expectedAtField")}</label>
                <input className="form-input" type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t("fournisseurs.itemsField")}</label>
              <div className="po-lines">
                {lines.map((line, i) => (
                  <div key={i} className="po-line">
                    <select className="form-input po-line-stock"
                      value={line.stockItemId ?? ""}
                      onChange={e => handleStockLink(i, e.target.value)}>
                      <option value="">{t("fournisseurs.itemFree")}</option>
                      {stockItems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                    </select>
                    <input className="form-input po-line-name" value={line.itemName}
                      onChange={e => updateLine(i, { itemName: e.target.value })}
                      placeholder={t("fournisseurs.itemNamePlaceholder")} required />
                    <input className="form-input po-line-qty" type="number" min="1" step="1"
                      value={line.quantity || ""}
                      onChange={e => updateLine(i, { quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      placeholder="Qté" />
                    <input className="form-input po-line-price" type="number" min="0" step="0.01"
                      value={line.unitPrice ?? ""}
                      onChange={e => updateLine(i, { unitPrice: parseFloat(e.target.value) || undefined })}
                      placeholder="PU (MAD)" />
                    {lines.length > 1 && (
                      <button type="button" className="po-line-remove" onClick={() => removeLine(i)}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="po-add-line-btn" onClick={addLine}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {t("fournisseurs.addLine")}
                </button>
              </div>
              {total > 0 && (
                <div className="po-lines-total">
                  {t("fournisseurs.totalEst", { total: total.toLocaleString("fr-MA") })}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{t("fournisseurs.poNotesField")}</label>
              <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} placeholder={t("fournisseurs.poNotesPlaceholder")} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? t("common.save") : t("fournisseurs.createOrder")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Receive modal ──────────────────────────────────────────────────────────────

function ReceiveModal({ order, onReceive, onClose }: {
  order:      PurchaseOrder;
  onReceive:  (lines: PurchaseOrderLine[]) => void;
  onClose:    () => void;
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<PurchaseOrderLine[]>(
    order.lines.map(l => ({ ...l, receivedQty: l.receivedQty ?? l.quantity }))
  );

  const setReceivedQty = (i: number, qty: number) =>
    setLines(prev => prev.map((l, j) => j === i ? { ...l, receivedQty: Math.max(0, qty) } : l));

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t("fournisseurs.receiveTitle")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {t("fournisseurs.receiveHint")}
          </div>
          <div className="po-receive-list">
            {lines.map((line, i) => (
              <div key={i} className="po-receive-row">
                <div className="po-receive-name">
                  {line.itemName}
                  {line.stockItemId && (
                    <span className="po-stock-linked">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 5l6-3 4 2v4l-4 2-6-3V5Z" stroke="var(--green)" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                      {t("fournisseurs.linkedStock")}
                    </span>
                  )}
                </div>
                <div className="po-receive-qty-row">
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {t("fournisseurs.receiveOrdered", { n: line.quantity })}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{t("fournisseurs.receiveLabel")}</span>
                    <input className="form-input" type="number" min="0" max={line.quantity}
                      value={line.receivedQty ?? line.quantity}
                      onChange={e => setReceivedQty(i, parseInt(e.target.value, 10) || 0)}
                      style={{ width: 70, textAlign: "center", fontWeight: 700 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" style={{ background: "var(--green)" }}
            onClick={() => onReceive(lines)}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t("fournisseurs.confirmReceive")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = "suppliers" | "orders";

export function FournisseursPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const today = todayIso();
  const {
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receiveOrder,
    stockItems,
  } = useCabinet();

  const [tab,           setTab]          = useState<Tab>("suppliers");
  const [supModal,      setSupModal]      = useState<{ sup?: Supplier } | null>(null);
  const [poModal,       setPoModal]       = useState<{ order?: PurchaseOrder } | null>(null);
  const [receiveModal,  setReceiveModal]  = useState<PurchaseOrder | null>(null);
  const [filterStatus,  setFilterStatus]  = useState<PurchaseOrderStatus | "all">("all");
  const [filterSup,     setFilterSup]     = useState<string>("all");
  const [search,        setSearch]        = useState("");

  const showToast = useToast();

  const kpi = useMemo(() => {
    const thisMonth = today.slice(0, 7);
    return {
      suppliers:  suppliers.length,
      totalOrders: purchaseOrders.length,
      pending:    purchaseOrders.filter(o => o.status === "ordered" || o.status === "partial" || o.status === "draft").length,
      receivedThisMonth: purchaseOrders.filter(o => o.status === "received" && (o.receivedAt ?? "").startsWith(thisMonth)).length,
      overdueCnt: purchaseOrders.filter(o =>
        (o.status === "ordered" || o.status === "partial") && o.expectedAt && o.expectedAt < today
      ).length,
    };
  }, [suppliers, purchaseOrders, today]);

  const filteredOrders = useMemo(() =>
    purchaseOrders
      .filter(o =>
        (filterStatus === "all" || o.status === filterStatus) &&
        (filterSup === "all" || o.supplierId === filterSup) &&
        (search === "" || (o.supplierName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          o.lines.some(l => l.itemName.toLowerCase().includes(search.toLowerCase())))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [purchaseOrders, filterStatus, filterSup, search]);

  const filteredSuppliers = useMemo(() =>
    suppliers.filter(s =>
      search === "" ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone ?? "").includes(search) ||
      (s.products ?? "").toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers, search]);

  const fourActions = tab === "suppliers"
    ? (
      <button className="btn btn-primary" onClick={() => setSupModal({})}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        {t("fournisseurs.newSupplier")}
      </button>
    ) : (
      <button className="btn btn-primary" onClick={() => setPoModal({})}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        {t("fournisseurs.newOrder")}
      </button>
    );

  const body = (
    <>
      {noLayout && <div className="inline-actions">{fourActions}</div>}

      <div className="stock-kpi-strip">
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpi.suppliers}</div>
          <div className="stock-kpi-lbl">{t("fournisseurs.kpiSuppliers")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--blue)" }}>{kpi.totalOrders}</div>
          <div className="stock-kpi-lbl">{t("fournisseurs.kpiOrders")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: kpi.overdueCnt > 0 ? "var(--coral)" : "var(--gold)" }}>
            {kpi.pending}
          </div>
          <div className="stock-kpi-lbl">
            {t("fournisseurs.kpiPending")}
            {kpi.overdueCnt > 0 && (
              <span> {t("fournisseurs.kpiPendingLate", { n: kpi.overdueCnt })}</span>
            )}
          </div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--green)" }}>{kpi.receivedThisMonth}</div>
          <div className="stock-kpi-lbl">{t("fournisseurs.kpiReceived")}</div>
        </div>
      </div>

      <div className="four-tabs">
        <button className={`four-tab${tab === "suppliers" ? " active" : ""}`} onClick={() => setTab("suppliers")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M10 7.5l1.5 1.5L14 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t("fournisseurs.tabSuppliers")}
          <span className="stock-pill-count">{suppliers.length}</span>
        </button>
        <button className={`four-tab${tab === "orders" ? " active" : ""}`} onClick={() => setTab("orders")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 5h6M4 7.5h4M4 10h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("fournisseurs.tabOrders")}
          <span className="stock-pill-count">{purchaseOrders.length}</span>
          {kpi.pending > 0 && <span className="nav-badge">{kpi.pending}</span>}
        </button>
      </div>

      <div className="four-toolbar">
        {tab === "orders" && (
          <>
            <div className="stock-filter-pills">
              <button className={`stock-filter-pill${filterStatus === "all" ? " active" : ""}`}
                onClick={() => setFilterStatus("all")}>
                {t("fournisseurs.filterAll")} <span className="stock-pill-count">{purchaseOrders.length}</span>
              </button>
              {(["draft", "ordered", "partial", "received", "cancelled"] as PurchaseOrderStatus[]).map(s => {
                const cnt = purchaseOrders.filter(o => o.status === s).length;
                if (!cnt && filterStatus !== s) return null;
                return (
                  <button key={s}
                    className={`stock-filter-pill${filterStatus === s ? " active" : ""}`}
                    style={filterStatus === s ? { borderColor: PO_STATUS_COLORS[s], color: PO_STATUS_COLORS[s] } : {}}
                    onClick={() => setFilterStatus(s)}>
                    {PO_STATUS_LABELS[s]} <span className="stock-pill-count">{cnt}</span>
                  </button>
                );
              })}
            </div>
            <select className="form-input" style={{ flex: "0 0 180px", fontSize: 12 }}
              value={filterSup} onChange={e => setFilterSup(e.target.value)}>
              <option value="all">{t("fournisseurs.filterAllSuppliers")}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </>
        )}
        <div className="stock-search-wrap">
          <svg className="stock-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input className="stock-search-input"
            placeholder={tab === "suppliers" ? t("fournisseurs.searchSupplier") : t("fournisseurs.searchOrder")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {tab === "suppliers" && (
        filteredSuppliers.length === 0 ? (
          <div className="agenda-empty" style={{ marginTop: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {suppliers.length === 0 ? t("fournisseurs.emptySuppliers") : t("fournisseurs.emptyNoResults")}
            </div>
            {suppliers.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setSupModal({})}>
                {t("fournisseurs.addSupplierBtn")}
              </button>
            )}
          </div>
        ) : (
          <div className="four-supplier-list">
            {filteredSuppliers.map(s => {
              const orderCount   = purchaseOrders.filter(o => o.supplierId === s.id).length;
              const pendingCount = purchaseOrders.filter(o => o.supplierId === s.id && (o.status === "ordered" || o.status === "partial")).length;
              return (
                <div key={s.id} className="four-supplier-row">
                  <div className="four-supplier-avatar">{s.name[0].toUpperCase()}</div>
                  <div className="four-supplier-info">
                    <div className="four-supplier-name">{s.name}</div>
                    <div className="four-supplier-meta">
                      {s.phone    && <span>{s.phone}</span>}
                      {s.email    && <span>{s.email}</span>}
                      {s.products && <span style={{ color: "var(--blue)" }}>{s.products}</span>}
                    </div>
                    {s.address && <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.address}</div>}
                  </div>
                  <div className="four-supplier-stats">
                    <div className="four-sup-stat">
                      <span className="four-sup-stat-val">{orderCount}</span>
                      <span className="four-sup-stat-lbl">{t("fournisseurs.ordersLabel")}</span>
                    </div>
                    {pendingCount > 0 && (
                      <div className="four-sup-stat">
                        <span className="four-sup-stat-val" style={{ color: "var(--gold)" }}>{pendingCount}</span>
                        <span className="four-sup-stat-lbl">{t("fournisseurs.pendingLabel")}</span>
                      </div>
                    )}
                  </div>
                  <div className="four-supplier-actions">
                    <button className="tele-action-btn primary"
                      onClick={() => { setPoModal({ order: { supplierId: s.id, supplierName: s.name } as PurchaseOrder }); setTab("orders"); }}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button className="tele-action-btn" onClick={() => setSupModal({ sup: s })}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button className="tx-delete"
                      onClick={async () => {
                        if (await confirmDialog(t("fournisseurs.deleteSupConfirm", { name: s.name }))) {
                          deleteSupplier(s.id);
                          showToast(t("fournisseurs.toastSupDeleted"));
                        }
                      }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "orders" && (
        filteredOrders.length === 0 ? (
          <div className="agenda-empty" style={{ marginTop: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {purchaseOrders.length === 0 ? t("fournisseurs.emptyOrders") : t("fournisseurs.emptyNoResults")}
            </div>
            {purchaseOrders.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setPoModal({})}>
                {t("fournisseurs.addOrderBtn")}
              </button>
            )}
          </div>
        ) : (
          <div className="four-order-list">
            {filteredOrders.map(order => {
              const total  = orderTotal(order.lines);
              const sc     = PO_STATUS_COLORS[order.status];
              const isLate = (order.status === "ordered" || order.status === "partial") &&
                             order.expectedAt && order.expectedAt < today;
              return (
                <div key={order.id} className={`four-order-row${isLate ? " overdue" : ""}`}>
                  <div className="four-order-accent" style={{ background: sc }} />
                  <div className="four-order-info">
                    <div className="four-order-header">
                      <span className="four-order-supplier">
                        {order.supplierName ?? t("fournisseurs.supplierUnknown")}
                      </span>
                      <span className="four-order-status" style={{ background: sc + "22", color: sc }}>
                        {PO_STATUS_LABELS[order.status]}
                      </span>
                      {isLate && (
                        <span className="four-order-late">{t("fournisseurs.lateLabel")}</span>
                      )}
                    </div>
                    <div className="four-order-lines-preview">
                      {order.lines.slice(0, 3).map((l, i) => (
                        <span key={i} className="four-order-line-chip">
                          {l.itemName} ×{l.quantity}
                          {l.stockItemId && (
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 2 }}>
                              <path d="M2 5l6-3 4 2v4l-4 2-6-3V5Z" stroke="var(--green)" strokeWidth="1.3" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                      ))}
                      {order.lines.length > 3 && (
                        <span className="four-order-line-chip">+{order.lines.length - 3}</span>
                      )}
                    </div>
                    <div className="four-order-meta">
                      {order.orderedAt  && <span>{t("fournisseurs.orderedOn",  { date: fmtDate(order.orderedAt,  locale) })}</span>}
                      {order.expectedAt && <span style={{ color: isLate ? "var(--coral)" : "var(--muted)" }}>{t("fournisseurs.expectedOn", { date: fmtDate(order.expectedAt, locale) })}</span>}
                      {order.receivedAt && <span style={{ color: "var(--green)" }}>{t("fournisseurs.receivedOn",  { date: fmtDate(order.receivedAt, locale) })}</span>}
                      {total > 0 && <span style={{ fontWeight: 600 }}>{total.toLocaleString("fr-MA")} MAD</span>}
                    </div>
                  </div>
                  <div className="four-order-actions">
                    {(order.status === "ordered" || order.status === "partial" || order.status === "draft") && (
                      <button className="tele-action-btn primary" onClick={() => setReceiveModal(order)}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                    <button className="tele-action-btn" onClick={() => setPoModal({ order })}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button className="tx-delete"
                      onClick={async () => {
                        if (await confirmDialog(t("fournisseurs.deleteOrderConfirm"))) {
                          deletePurchaseOrder(order.id);
                          showToast(t("fournisseurs.toastOrderDeleted"));
                        }
                      }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {supModal !== null && (
        <SupplierModal initial={supModal.sup}
          onSave={s => {
            if (supModal.sup) { updateSupplier({ ...supModal.sup, ...s }); showToast(t("fournisseurs.toastSupModified")); }
            else { addSupplier(s); showToast(t("fournisseurs.toastSupAdded")); }
            setSupModal(null);
          }}
          onClose={() => setSupModal(null)}
        />
      )}

      {poModal !== null && (
        <POModal initial={poModal.order} suppliers={suppliers} stockItems={stockItems}
          onSave={o => {
            if (poModal.order?.id) {
              updatePurchaseOrder({ ...poModal.order, ...o, id: poModal.order.id, createdAt: poModal.order.createdAt });
              showToast(t("fournisseurs.toastOrderModified"));
            } else {
              addPurchaseOrder(o);
              showToast(t("fournisseurs.toastOrderAdded"));
            }
            setPoModal(null);
          }}
          onClose={() => setPoModal(null)}
        />
      )}

      {receiveModal && (
        <ReceiveModal order={receiveModal}
          onReceive={lines => {
            receiveOrder(receiveModal.id, lines);
            setReceiveModal(null);
            showToast(t("fournisseurs.toastReceived"));
          }}
          onClose={() => setReceiveModal(null)}
        />
      )}

    </>
  );

  if (noLayout) return body;
  return (
    <Layout
      title={t("fournisseurs.title")}
      subtitle={t("fournisseurs.subtitle", {
        n: suppliers.length,  s:  suppliers.length !== 1 ? "s" : "",
        m: purchaseOrders.length, ms: purchaseOrders.length !== 1 ? "s" : "",
      })}
      actions={fourActions}
    >
      {body}
    </Layout>
  );
}
