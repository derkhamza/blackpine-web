import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useContextMenu, type CtxItem } from "../components/ContextMenu";
import { ActionIcon } from "../components/ActionIcon";
import { useCabinet } from "../context/CabinetContext";
import { apptTypeLabel } from "../lib/cabinetTypes";
import { nextInvoiceNumber, printFacture } from "../lib/facturePrinter";
import { paymentSummary, lineGross, lineDiscount, billLineDiscounts } from "../lib/billing";
import { todayIso, formatMAD } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearOf(iso: string) {
  return iso.slice(0, 4);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FacturesPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const { appointments, patients, updateAppointment, doctorProfile } = useCabinet();
  const facCtx = useContextMenu();
  const navigate = useNavigate();

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
  };

  // Remove a facture: void the billing so the appointment reverts to unbilled.
  // Fields are cleared with null (not undefined) so the clear also survives the
  // secretary whitelist merge, which only copies keys that are actually present.
  const removeInvoice = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    if (!confirm(t("factures.removeConfirm", { name: appt.patientName }))) return;
    const cleared: any = {
      ...appt,
      billedAt: null, billedAmount: null,
      invoiceNumber: null, invoiceIssuedAt: null,
      billedItems: null, billedReduction: null,
      paidAmount: null, payments: null,
    };
    updateAppointment(cleared);
  };

  const body = (
    <>
      {/* À encaisser — factures the doctor prepared, awaiting payment at the desk.
          Visible to the secretary; walk-ins with no patient record included. */}
      {prepared.length > 0 && (
        <div className="fac-toemit-box">
          <div className="fac-toemit-head">
            <span className="fac-toemit-title">{t("factures.toCollectTitle")}</span>
            <span className="fac-toemit-count">{prepared.length}</span>
          </div>
          <div className="fac-toemit-list">
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
          </div>
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
