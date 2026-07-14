import { confirmDialog } from "../lib/confirm";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD } from "../lib/format";

export function InvoiceHistorySection() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { invoices, deleteInvoice } = useCabinet();
  const [search, setSearch] = useState("");

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...invoices].sort(
      (a, b) => b.issuedAt.localeCompare(a.issuedAt),
    );
    if (!q) return sorted;
    return sorted.filter(
      inv =>
        inv.patientName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.actLabel.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const total = useMemo(
    () => filtered.reduce((s, inv) => s + inv.amount, 0),
    [filtered],
  );

  if (invoices.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <div className="empty-state-title">{t("invoiceHistory.emptyTitle")}</div>
        <div className="empty-state-sub">{t("invoiceHistory.emptySub")}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Search + KPI */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="form-input"
          style={{ maxWidth: 280, flex: 1 }}
          type="text"
          placeholder={t("invoiceHistory.searchPlaceholder")}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ fontSize: 13, color: "var(--muted)", marginLeft: "auto" }}>
          {t("invoiceHistory.count", { n: filtered.length, s: filtered.length !== 1 ? "s" : "" })}
          {filtered.length > 0 && (
            <span> · <strong style={{ color: "var(--green)" }}>{formatMAD(total)}</strong></span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("invoiceHistory.colNum")}</th>
              <th>{t("invoiceHistory.colDate")}</th>
              <th>{t("invoiceHistory.colPatient")}</th>
              <th>{t("invoiceHistory.colAct")}</th>
              <th>{t("invoiceHistory.colCnops")}</th>
              <th>{t("invoiceHistory.colAmount")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 700, fontSize: 12, fontFamily: "monospace" }}>
                  {inv.invoiceNumber}
                </td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(inv.issuedAt)}</td>
                <td style={{ fontWeight: 600 }}>{inv.patientName}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{inv.actLabel}</td>
                <td style={{ fontSize: 12 }}>
                  {inv.cnopsNumber
                    ? <span style={{ color: "#6b46c1", fontWeight: 600 }}>{inv.cnopsNumber}</span>
                    : <span style={{ color: "var(--muted)" }}>—</span>
                  }
                </td>
                <td style={{ fontWeight: 700, color: "var(--green)" }}>
                  {formatMAD(inv.amount)}
                </td>
                <td>
                  <button
                    className="tx-delete"
                    title={t("invoiceHistory.deleteTitle")}
                    onClick={async () => {
                      if (await confirmDialog(t("invoiceHistory.deleteConfirm", { num: inv.invoiceNumber }))) {
                        deleteInvoice(inv.id);
                      }
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
