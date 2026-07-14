import { confirmDialog } from "../lib/confirm";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useContextMenu, type CtxItem } from "../components/ContextMenu";
import { ActionIcon } from "../components/ActionIcon";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { apptTypeLabel } from "../lib/cabinetTypes";
import type { Appointment, BillingLine } from "../lib/cabinetTypes";
import { nextInvoiceNumber, printFacture } from "../lib/facturePrinter";
import { paymentSummary, lineGross, lineNet, lineDiscount, billNet, billSubtotal, billLineDiscounts } from "../lib/billing";
import { todayIso, formatMAD } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearOf(iso: string) {
  return iso.slice(0, 4);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FacturesPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const { appointments, patients, updateAppointment, doctorProfile, viewAsSecretary } = useCabinet();
  const { transactions, addTransaction, deleteTransaction } = useApp();
  const facCtx = useContextMenu();
  const navigate = useNavigate();
  // Facture correction happens right here (a modal), instead of jumping to the RDV.
  const [correctAppt, setCorrectAppt] = useState<Appointment | null>(null);

  const today = todayIso();
  const currentYear = today.slice(0, 4);

  function fmtDate(iso: string) {
    return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  const [selYear, setSelYear] = useState(currentYear);
  const [search,  setSearch]  = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "emitted" | "toemit">("all");
  const [sortKey, setSortKey] = useState<"date" | "name" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // "À encaisser" panel: collapsed state persists (a preference); dismissed hides
  // it for the session only, so unpaid prepared bills resurface on the next visit.
  // Collapsed by DEFAULT (it's a secondary reminder, not the main table) — only
  // expanded when the doctor explicitly opened it before (stored "0").
  const [toCollectCollapsed, setToCollectCollapsed] = useState(
    () => localStorage.getItem("bp.facToCollectCollapsed") !== "0");
  const [toCollectDismissed, setToCollectDismissed] = useState(
    () => sessionStorage.getItem("bp.facToCollectDismissed") === "1");

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Click a sortable header: same key flips direction, new key resets to desc.
  const sortBy = (key: "date" | "name" | "amount") => {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortArrow = (key: "date" | "name" | "amount") =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const billed = useMemo(
    () => appointments.filter(a => !!a.billedAt),
    [appointments],
  );

  // Factures the doctor PREPARED but nobody has cashed yet (awaiting
  // encaissement at the desk). These have preparedItems and no billedAt — they
  // never had a billedAt, so they don't show in the billed table. Surfaced here
  // so the secretary can find and cash them (walk-ins with no patient record
  // included). Newest first.
  const prepared = useMemo(
    () => appointments
      .filter(a => !a.billedAt && (a.preparedItems?.length ?? 0) > 0)
      .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)),
    [appointments],
  );
  const preparedNet = (a: typeof appointments[number]) => {
    const sub = (a.preparedItems ?? []).reduce((s, l) => s + l.qty * l.unitPrice, 0);
    return Math.max(0, sub - (a.preparedReduction ?? 0));
  };

  const years = useMemo(() => {
    const ys = new Set(billed.map(a => yearOf(a.billedAt!)));
    ys.add(currentYear);
    return [...ys].sort((a, b) => b.localeCompare(a));
  }, [billed, currentYear]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = billed.filter(a => {
      if (yearOf(a.billedAt!) !== selYear) return false;
      if (q && !a.patientName.toLowerCase().includes(q) &&
               !(a.invoiceNumber ?? "").toLowerCase().includes(q)) return false;
      if (unpaidOnly && paymentSummary(a).balance <= 0) return false;
      if (statusFilter === "emitted" && !a.invoiceNumber) return false;
      if (statusFilter === "toemit"  &&  a.invoiceNumber) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")        cmp = a.patientName.localeCompare(b.patientName);
      else if (sortKey === "amount") cmp = (a.billedAmount ?? 0) - (b.billedAmount ?? 0);
      else /* date */                cmp = (a.billedAt ?? "").localeCompare(b.billedAt ?? "");
      if (cmp === 0) cmp = (a.billedAt ?? "").localeCompare(b.billedAt ?? "");
      return cmp * dir;
    });
    return rows;
  }, [billed, selYear, search, unpaidOnly, statusFilter, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const withInv    = filtered.filter(a => !!a.invoiceNumber);
    const withoutInv = filtered.filter(a => !a.invoiceNumber);
    const total      = filtered.reduce((s, a) => s + (a.billedAmount ?? 0), 0);
    const outstanding = filtered.reduce((s, a) => s + paymentSummary(a).balance, 0);
    return {
      total:     filtered.length,
      withInv:   withInv.length,
      withoutInv: withoutInv.length,
      totalMAD:  total,
      outstanding,
    };
  }, [filtered]);

  const emitInvoice = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const invNum   = nextInvoiceNumber();
    const issuedAt = new Date().toISOString();
    const patient  = patients.find(p => p.id === appt.patientId);
    updateAppointment({ ...appt, invoiceNumber: invNum, invoiceIssuedAt: issuedAt });
    printFacture({
      invoiceNumber: invNum,
      invoiceDate:   today,
      patientName:   appt.patientName,
      patientCnops:  patient?.cnopsNumber,
      serviceLabel:  apptTypeLabel(appt.type) + " médicale",
      serviceDate:   appt.date,
      amount:        appt.billedAmount ?? 0,
      items:         appt.billedItems,
      reduction:     appt.billedReduction,
      doctorProfile,
    });
    showToast(t("factures.toastEmitted", { num: invNum, defaultValue: "Facture N° {{num}} émise" }));
  };

  const reprintInvoice = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt?.invoiceNumber) return;
    const patient = patients.find(p => p.id === appt.patientId);
    printFacture({
      invoiceNumber: appt.invoiceNumber,
      invoiceDate:   appt.invoiceIssuedAt ? appt.invoiceIssuedAt.slice(0, 10) : appt.date,
      patientName:   appt.patientName,
      patientCnops:  patient?.cnopsNumber,
      serviceLabel:  apptTypeLabel(appt.type) + " médicale",
      serviceDate:   appt.date,
      amount:        appt.billedAmount ?? 0,
      items:         appt.billedItems,
      reduction:     appt.billedReduction,
      doctorProfile,
    });
    showToast(t("factures.toastReprinted", { defaultValue: "Facture réimprimée" }));
  };

  // Remove a facture: void the billing so the appointment reverts to unbilled.
  // Fields are cleared with null (not undefined) so the clear also survives the
  // secretary whitelist merge, which only copies keys that are actually present.
  const removeInvoice = async (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    if (!await confirmDialog(t("factures.removeConfirm", { name: appt.patientName }))) return;
    // Reverse the ledger income this facture created (linked row + its instalment
    // rows, matched by exact auto-description so manual entries stay untouched).
    const billDesc = `${apptTypeLabel(appt.type)} – ${appt.patientName}`;
    const payDesc  = `${t("apptDetail.payLedgerNote")} – ${appt.patientName}`;
    const ids = new Set<string>();
    if (appt.billTxnId) ids.add(appt.billTxnId);
    for (const x of transactions) {
      if (x.type === "RECETTE" && x.date === appt.date && (x.description === billDesc || x.description === payDesc)) ids.add(x.id);
    }
    ids.forEach((id) => deleteTransaction(id));
    const cleared: any = {
      ...appt,
      billedAt: null, billedAmount: null,
      invoiceNumber: null, invoiceIssuedAt: null,
      billedItems: null, billedReduction: null,
      paidAmount: null, payments: null, billTxnId: null,
    };
    updateAppointment(cleared);
  };

  const body = (
    <>
      {/* À encaisser — factures the doctor prepared, awaiting payment at the desk.
          Visible to the secretary; walk-ins with no patient record included. */}
      {prepared.length > 0 && !toCollectDismissed && (
        <div className={`fac-toemit-box${toCollectCollapsed ? " collapsed" : ""}`}>
          <div className="fac-toemit-head">
            <button
              type="button"
              className="fac-toemit-toggle"
              onClick={() => setToCollectCollapsed(v => { const n = !v; try { localStorage.setItem("bp.facToCollectCollapsed", n ? "1" : "0"); } catch { /* ignore */ } return n; })}
              aria-expanded={!toCollectCollapsed}
              title={t(toCollectCollapsed ? "common.expand" : "common.collapse")}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                style={{ transform: toCollectCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }}>
                <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="fac-toemit-title">{t("factures.toCollectTitle")}</span>
              <span className="fac-toemit-count">{prepared.length}</span>
            </button>
            <button
              type="button"
              className="fac-toemit-dismiss"
              onClick={() => setToCollectDismissed(() => { try { sessionStorage.setItem("bp.facToCollectDismissed", "1"); } catch { /* ignore */ } return true; })}
              aria-label={t("common.close")}
              title={t("common.hide")}
            >×</button>
          </div>
          {!toCollectCollapsed && <div className="fac-toemit-list">
            {prepared.map(a => (
              <div key={a.id} className="fac-toemit-row">
                <div className="fac-toemit-main">
                  {a.patientId
                    ? <Link to={`/patients/${a.patientId}`} className="fac-patient-link">{a.patientName}</Link>
                    : <span className="fac-toemit-name">{a.patientName || t("factures.walkIn")}</span>}
                  <span className="fac-toemit-meta">{apptTypeLabel(a.type)} · {fmtDate(a.date)}</span>
                </div>
                <span className="fac-toemit-amount">{formatMAD(preparedNet(a))}</span>
                <Link to={`/agenda/${a.id}`} className="fac-emit-btn">{t("factures.collect")}</Link>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* KPI strip */}
      <div className="fac-kpi-strip">
        <div className="fac-kpi" style={{ borderTopColor: "var(--blue)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--blue)" }}>{kpis.total}</div>
          <div className="fac-kpi-lbl">{t("factures.kpiBilled")}</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--green)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--green)" }}>{kpis.withInv}</div>
          <div className="fac-kpi-lbl">{t("factures.kpiEmitted")}</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--gold)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--gold)" }}>{kpis.withoutInv}</div>
          <div className="fac-kpi-lbl">{t("factures.kpiWithout")}</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--navy)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--navy)", fontSize: 18 }}>
            {formatMAD(kpis.totalMAD)}
          </div>
          <div className="fac-kpi-lbl">{t("factures.kpiTotal")}</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--coral)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--coral)", fontSize: 18 }}>
            {formatMAD(kpis.outstanding)}
          </div>
          <div className="fac-kpi-lbl">{t("factures.kpiOutstanding")}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="fac-filter-bar">
        <div className="fac-year-tabs">
          {years.map(y => (
            <button
              key={y}
              className={`fac-year-tab${selYear === y ? " active" : ""}`}
              onClick={() => setSelYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="fac-status-chips" style={{ marginLeft: "auto" }}>
          <button
            className={`fac-year-tab${statusFilter === "all" ? " active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            {t("factures.filterAll")}
          </button>
          <button
            className={`fac-year-tab${statusFilter === "emitted" ? " active" : ""}`}
            onClick={() => setStatusFilter("emitted")}
          >
            {t("factures.filterEmitted")}
          </button>
          <button
            className={`fac-year-tab${statusFilter === "toemit" ? " active" : ""}`}
            onClick={() => setStatusFilter("toemit")}
          >
            {t("factures.filterToEmit")}
          </button>
        </div>
        <button
          className={`fac-year-tab fac-unpaid-toggle${unpaidOnly ? " active" : ""}`}
          onClick={() => setUnpaidOnly(v => !v)}
        >
          {t("factures.unpaidOnly")}
        </button>
        <div className="rmb-search-wrap">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="rmb-search"
            placeholder={t("factures.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("factures.emptyTitle", { year: selYear })}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("factures.emptyHint")}</div>
        </div>
      ) : (
        <div className="fac-table-wrap">
          <table className="fac-table">
            <thead>
              <tr>
                <th className="fac-expand-col"></th>
                <th>{t("factures.colInvoice")}</th>
                <th>
                  <button className="fac-sort-th" onClick={() => sortBy("name")}>
                    {t("factures.colPatient")}{sortArrow("name")}
                  </button>
                </th>
                <th>
                  <button className="fac-sort-th" onClick={() => sortBy("date")}>
                    {t("factures.colDate")}{sortArrow("date")}
                  </button>
                </th>
                <th>{t("factures.colType")}</th>
                <th className="fac-r">
                  <button className="fac-sort-th" onClick={() => sortBy("amount")}>
                    {t("factures.colAmount")}{sortArrow("amount")}
                  </button>
                </th>
                <th className="fac-r">{t("factures.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const items = a.billedItems && a.billedItems.length > 0
                  ? a.billedItems
                  : [{ label: apptTypeLabel(a.type), qty: 1, unitPrice: a.billedAmount ?? 0 }];
                const isOpen = expanded.has(a.id);
                const menu: CtxItem[] = [
                  a.invoiceNumber
                    ? { label: t("ctx.reprintInvoice"), icon: <ActionIcon name="print" />, onClick: () => reprintInvoice(a.id) }
                    : { label: t("ctx.emitInvoice"), icon: <ActionIcon name="file" />, onClick: () => emitInvoice(a.id) },
                  ...(!viewAsSecretary ? [{ label: t("apptDetail.correctFacture"), icon: <ActionIcon name="edit" />, onClick: () => setCorrectAppt(a) }] : []),
                  { label: t("ctx.openAppt"), icon: <ActionIcon name="clipboard" />, onClick: () => navigate(`/agenda/${a.id}`) },
                  ...(a.patientId
                    ? [{ label: t("ctx.patientFile"), icon: <ActionIcon name="user" />, onClick: () => navigate(`/patients/${a.patientId}`) }] : []),
                  { label: t("factures.remove"), icon: <ActionIcon name="trash" />, danger: true, divider: true, onClick: () => removeInvoice(a.id) },
                ];
                return (
                <Fragment key={a.id}>
                <tr className={isOpen ? "fac-row-open" : undefined} onContextMenu={e => facCtx.open(e, menu)}>
                  <td className="fac-expand-col">
                    <button
                      className={`fac-expand-btn${isOpen ? " open" : ""}`}
                      onClick={() => toggleExpand(a.id)}
                      aria-label={t("factures.showActs")}
                      title={t("factures.showActs")}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </td>
                  <td>
                    {a.invoiceNumber
                      ? <span className="fac-inv-num">{a.invoiceNumber}</span>
                      : <span className="fac-no-inv">{t("factures.notEmitted")}</span>
                    }
                  </td>
                  <td>
                    {a.patientId
                      ? <Link to={`/patients/${a.patientId}`} className="fac-patient-link">{a.patientName}</Link>
                      : <span>{a.patientName}</span>
                    }
                  </td>
                  <td className="fac-date">{fmtDate(a.date)}</td>
                  <td>
                    <span className="fac-type-chip">{apptTypeLabel(a.type)}</span>
                  </td>
                  <td className="fac-r fac-amount">
                    {a.billedAmount != null ? formatMAD(a.billedAmount) : "—"}
                    {(() => {
                      const s = paymentSummary(a);
                      if (s.balance <= 0) return null;
                      return (
                        <div className={`pay-badge pay-badge-${s.status}`} style={{ marginTop: 3 }}>
                          {s.status === "deferred"
                            ? t("factures.unpaidBadge", { amount: formatMAD(s.balance) })
                            : t("factures.partialBadge", { amount: formatMAD(s.balance) })}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="fac-r">
                    <div className="fac-actions">
                      {a.invoiceNumber
                        ? <button className="fac-reprint-btn" onClick={() => reprintInvoice(a.id)}>
                            {t("factures.reprint")}
                          </button>
                        : <button className="fac-emit-btn" onClick={() => emitInvoice(a.id)}>
                            {t("factures.emit")}
                          </button>
                      }
                      {!viewAsSecretary && (
                        <button className="fac-correct-btn" title={t("apptDetail.correctFactureTitle")}
                          onClick={() => setCorrectAppt(a)}>
                          {t("factures.correct")}
                        </button>
                      )}
                      <Link to={`/agenda/${a.id}`} className="fac-rdv-link">{t("factures.rdvLink")}</Link>
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="fac-acts-row">
                    <td></td>
                    <td colSpan={6}>
                      <div className="fac-acts-box">
                        <div className="fac-acts-title">{t("factures.actsTitle")}</div>
                        <table className="fac-acts-table">
                          <tbody>
                            {/* Each line shows its GROSS amount; per-act and global
                                discounts are subtracted in the subtotal rows below,
                                mirroring the printed facture so the two reconcile. */}
                            {items.map((it, i) => {
                              const disc = lineDiscount(it);
                              return (
                                <tr key={i}>
                                  <td className="fac-acts-label">
                                    {it.label}
                                    {disc > 0 && (
                                      <span className="fac-acts-remise-tag">
                                        {t("factures.remiseTag", {
                                          detail: it.remiseType === "pct"
                                            ? `${it.remise}%`
                                            : formatMAD(it.remise ?? 0),
                                        })}
                                      </span>
                                    )}
                                  </td>
                                  <td className="fac-acts-qty">×{it.qty}</td>
                                  <td className="fac-acts-unit">{formatMAD(it.unitPrice)}</td>
                                  <td className="fac-acts-sub fac-r">{formatMAD(lineGross(it))}</td>
                                </tr>
                              );
                            })}
                            {billLineDiscounts(items) > 0 ? (
                              <tr className="fac-acts-reduction">
                                <td className="fac-acts-label">{t("factures.actsRemise")}</td>
                                <td></td><td></td>
                                <td className="fac-acts-sub fac-r" style={{ color: "var(--coral)" }}>
                                  −{formatMAD(billLineDiscounts(items))}
                                </td>
                              </tr>
                            ) : null}
                            {a.billedReduction ? (
                              <tr className="fac-acts-reduction">
                                <td className="fac-acts-label">{t("factures.reduction")}</td>
                                <td></td><td></td>
                                <td className="fac-acts-sub fac-r" style={{ color: "var(--coral)" }}>
                                  −{formatMAD(a.billedReduction)}
                                </td>
                              </tr>
                            ) : null}
                            <tr className="fac-acts-total">
                              <td className="fac-acts-label">{t("factures.actsTotal")}</td>
                              <td></td><td></td>
                              <td className="fac-acts-sub fac-r">{formatMAD(a.billedAmount ?? 0)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="fac-total-label">
                  {t("factures.footerTotal", { n: filtered.length, s: filtered.length !== 1 ? "s" : "" })}
                </td>
                <td className="fac-r fac-total-val">
                  {formatMAD(filtered.reduce((s, a) => s + (a.billedAmount ?? 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {facCtx.menu}
      {correctAppt && <FactureCorrectModal appt={correctAppt} onClose={() => setCorrectAppt(null)} />}
    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title={t("factures.title")}
      subtitle={t("factures.subtitle", { n: kpis.total, s: kpis.total !== 1 ? "s" : "", year: selYear })}
    >
      {body}
    </Layout>
  );
}

// Correct a facture WITHOUT leaving Facturation. Self-contained editor mirroring the
// consultation bill modal's correction path (edit acts/prices/remises + collected,
// then reconcile the auto ledger income so revenue isn't double-counted).
function FactureCorrectModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { updateAppointment, doctorProfile } = useCabinet();
  const { transactions, addTransaction, deleteTransaction } = useApp();

  const [items, setItems] = useState<BillingLine[]>(() =>
    appt.billedItems && appt.billedItems.length
      ? appt.billedItems.map(l => ({ ...l }))
      : [{ label: apptTypeLabel(appt.type), qty: 1, unitPrice: appt.billedAmount ?? 0 }]);
  const [reduction, setReduction] = useState(appt.billedReduction ? String(appt.billedReduction) : "");
  const [showRemise, setShowRemise] = useState(!!appt.billedReduction);
  const [collected, setCollected] = useState(String(appt.paidAmount ?? 0));

  const reductionN = Math.max(0, parseFloat(reduction.replace(",", ".")) || 0);
  const subtotal = billSubtotal(items);
  const lineDisc = billLineDiscounts(items);
  const total    = billNet(items, reductionN);

  const update = (i: number, patch: Partial<BillingLine>) => setItems(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const addLine = (line: BillingLine) => setItems(prev => [...prev, line]);

  const save = () => {
    const clean = items.map(l => {
      const out: BillingLine = { label: l.label.trim(), qty: l.qty || 1, unitPrice: l.unitPrice || 0 };
      if (l.remise && l.remise > 0) { out.remise = l.remise; out.remiseType = l.remiseType ?? "mad"; }
      return out;
    }).filter(l => l.label.length > 0);
    if (clean.length === 0) return;
    const tot  = billNet(clean, reductionN);
    const coll = Math.min(tot, Math.max(0, parseFloat(collected.replace(",", ".")) || 0));
    // Ledger reconcile — drop this facture's prior auto RECETTE rows, repost the
    // corrected cash (mirror of AppointmentDetailPage.reconcileBillTxn).
    const cat     = appt.type === "procedure" ? "acte_chirurgical" : "consultation";
    const desc    = `${apptTypeLabel(appt.type)} – ${appt.patientName}`;
    const payDesc = `${t("apptDetail.payLedgerNote")} – ${appt.patientName}`;
    const toRemove = new Set<string>();
    if (appt.billTxnId) toRemove.add(appt.billTxnId);
    for (const x of transactions) {
      if (x.type === "RECETTE" && x.date === appt.date && (x.description === desc || x.description === payDesc)) toRemove.add(x.id);
    }
    toRemove.forEach(id => deleteTransaction(id));
    let billTxnId: string | undefined;
    if (coll > 0) {
      billTxnId = addTransaction({ type: "RECETTE", amount: coll, date: appt.date, category: cat,
        deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1, description: desc });
    }
    const now = new Date().toISOString();
    updateAppointment({
      ...appt,
      billedAmount: tot, billedItems: clean,
      billedReduction: reductionN > 0 ? reductionN : undefined,
      paidAmount: coll,
      payments: coll > 0 ? [{ amount: coll, date: now, method: "cash" }] : [],
      billTxnId,
    });
    toast(t("apptDetail.factureCorrected"));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="modal-header">
          <h2 className="modal-title">{t("apptDetail.correctFacture")}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("common.close")}>×</button>
        </div>
        <div className="modal-body">
          <div className="fac-correct-sub">{appt.patientName} · {appt.invoiceNumber ?? t("factures.notEmitted")}</div>
          <div className="bill-lines">
            {items.map((l, i) => (
              <div className="bill-line bill-line-editable" key={i}>
                <div className="bill-line-main">
                  <input className="form-input bill-line-label" placeholder={t("apptDetail.billItemLabel")} value={l.label} onChange={e => update(i, { label: e.target.value })} />
                  <input className="form-input bill-line-qty" type="number" min="1" step="1" value={l.qty || ""} onChange={e => update(i, { qty: Math.max(0, parseInt(e.target.value, 10) || 0) })} title={t("apptDetail.billQty")} />
                  <input className="form-input bill-line-price" type="number" min="0" step="0.01" value={l.unitPrice || ""} onChange={e => update(i, { unitPrice: parseFloat(e.target.value.replace(",", ".")) || 0 })} title={t("apptDetail.billUnitPrice")} />
                  {l.remise == null ? (
                    <button type="button" className="bill-line-remise-btn" onClick={() => update(i, { remise: 0, remiseType: l.remiseType ?? "mad" })} title={t("apptDetail.billApplyRemise")}>{t("apptDetail.billRemiseShort")}</button>
                  ) : (
                    <>
                      <input className="form-input bill-line-remise-input" type="number" min="0" step="0.01" value={l.remise || ""} onChange={e => update(i, { remise: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
                      <div className="bill-remise-seg" role="group">
                        <button type="button" className={`bill-remise-seg-btn${(l.remiseType ?? "mad") === "mad" ? " active" : ""}`} onClick={() => update(i, { remiseType: "mad" })}>MAD</button>
                        <button type="button" className={`bill-remise-seg-btn${l.remiseType === "pct" ? " active" : ""}`} onClick={() => update(i, { remiseType: "pct" })}>%</button>
                      </div>
                      <button type="button" className="bill-line-remise-clear" onClick={() => update(i, { remise: undefined, remiseType: undefined })} aria-label={t("apptDetail.billRemoveRemise")}>×</button>
                    </>
                  )}
                </div>
                <button type="button" className="bill-line-remove" onClick={() => removeLine(i)} disabled={items.length <= 1} title={t("common.delete")} aria-label={t("common.delete")}>×</button>
              </div>
            ))}
          </div>
          <div className="bill-add-row">
            {doctorProfile.acteCodes && doctorProfile.acteCodes.length > 0 && (
              <select className="form-select bill-act-select" value=""
                onChange={e => { const a = doctorProfile.acteCodes!.find(x => x.id === e.target.value); if (a) addLine({ label: a.label || a.code, qty: 1, unitPrice: a.price ?? 0 }); e.target.value = ""; }}>
                <option value="">{t("apptDetail.billAddAct")}</option>
                {doctorProfile.acteCodes!.map(a => <option key={a.id} value={a.id}>{a.code} · {a.label}{a.price != null ? ` · ${a.price} MAD` : ""}</option>)}
              </select>
            )}
            <button type="button" className="btn btn-ghost bill-add-custom" onClick={() => addLine({ label: "", qty: 1, unitPrice: 0 })}>+ {t("apptDetail.billAddLine")}</button>
          </div>
          {showRemise ? (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">{t("apptDetail.billReduction")}</label>
              <div className="bill-collect-row">
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0" autoFocus value={reduction} onChange={e => setReduction(e.target.value)} />
                <button type="button" className="bill-collect-chip" onClick={() => { setReduction(""); setShowRemise(false); }}>{t("common.delete")}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="bill-add-remise" onClick={() => setShowRemise(true)}>+ {t("apptDetail.billAddReduction")}</button>
          )}
          <div className="bill-totals">
            <div className="bill-total-row"><span>{t("apptDetail.billSubtotal")}</span><span>{formatMAD(subtotal)}</span></div>
            {lineDisc > 0 && <div className="bill-total-row bill-total-reduction"><span>{t("apptDetail.billActRemises")}</span><span>− {formatMAD(lineDisc)}</span></div>}
            {reductionN > 0 && <div className="bill-total-row bill-total-reduction"><span>{t("apptDetail.billReduction")}</span><span>− {formatMAD(reductionN)}</span></div>}
            <div className="bill-total-row bill-total-net"><span>{t("apptDetail.billTotal")}</span><span>{formatMAD(total)}</span></div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">{t("apptDetail.billCollected")}</label>
            <div className="bill-collect-row">
              <input className="form-input" type="number" min="0" step="0.01" value={collected} onChange={e => setCollected(e.target.value)} />
              <button type="button" className="bill-collect-chip" onClick={() => setCollected(String(total))}>{t("apptDetail.billPayFull")}</button>
              <button type="button" className="bill-collect-chip" onClick={() => setCollected("0")}>{t("apptDetail.billDefer")}</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="btn btn-primary">{t("apptDetail.correctSave")}</button>
        </div>
      </form>
    </div>
  );
}
