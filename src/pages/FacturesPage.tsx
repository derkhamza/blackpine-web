import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { APPT_TYPE_LABELS } from "../lib/cabinetTypes";
import { nextInvoiceNumber, printFacture } from "../lib/facturePrinter";
import { todayIso, formatMAD } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function yearOf(iso: string) {
  return iso.slice(0, 4);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FacturesPage() {
  const { appointments, patients, updateAppointment, doctorProfile } = useCabinet();

  const today = todayIso();
  const currentYear = today.slice(0, 4);

  const [selYear, setSelYear] = useState(currentYear);
  const [search,  setSearch]  = useState("");

  // All billed appointments (have billedAt set)
  const billed = useMemo(
    () => [...appointments]
      .filter(a => !!a.billedAt)
      .sort((a, b) => b.billedAt!.localeCompare(a.billedAt!)),
    [appointments],
  );

  // Available years for filter
  const years = useMemo(() => {
    const ys = new Set(billed.map(a => yearOf(a.billedAt!)));
    ys.add(currentYear);
    return [...ys].sort((a, b) => b.localeCompare(a));
  }, [billed, currentYear]);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return billed.filter(a => {
      if (yearOf(a.billedAt!) !== selYear) return false;
      if (q && !a.patientName.toLowerCase().includes(q) &&
               !(a.invoiceNumber ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [billed, selYear, search]);

  // KPIs
  const kpis = useMemo(() => {
    const withInv   = filtered.filter(a => !!a.invoiceNumber);
    const withoutInv = filtered.filter(a => !a.invoiceNumber);
    const total     = filtered.reduce((s, a) => s + (a.billedAmount ?? 0), 0);
    return {
      total:     filtered.length,
      withInv:   withInv.length,
      withoutInv: withoutInv.length,
      totalMAD:  total,
    };
  }, [filtered]);

  // Emit invoice for an appointment
  const emitInvoice = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const invNum     = nextInvoiceNumber();
    const issuedAt   = new Date().toISOString();
    const patient    = patients.find(p => p.id === appt.patientId);

    updateAppointment({
      ...appt,
      invoiceNumber:   invNum,
      invoiceIssuedAt: issuedAt,
    });

    printFacture({
      invoiceNumber:  invNum,
      invoiceDate:    today,
      patientName:    appt.patientName,
      patientCnops:   patient?.cnopsNumber,
      serviceLabel:   APPT_TYPE_LABELS[appt.type] + " médicale",
      serviceDate:    appt.date,
      amount:         appt.billedAmount ?? 0,
      doctorProfile,
    });
  };

  // Reprint existing invoice
  const reprintInvoice = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt?.invoiceNumber) return;
    const patient = patients.find(p => p.id === appt.patientId);
    printFacture({
      invoiceNumber:  appt.invoiceNumber,
      invoiceDate:    appt.invoiceIssuedAt ? appt.invoiceIssuedAt.slice(0, 10) : appt.date,
      patientName:    appt.patientName,
      patientCnops:   patient?.cnopsNumber,
      serviceLabel:   APPT_TYPE_LABELS[appt.type] + " médicale",
      serviceDate:    appt.date,
      amount:         appt.billedAmount ?? 0,
      doctorProfile,
    });
  };

  return (
    <Layout
      title="Factures"
      subtitle={`${kpis.total} consultation${kpis.total !== 1 ? "s" : ""} facturée${kpis.total !== 1 ? "s" : ""} · ${selYear}`}
    >
      {/* KPI strip */}
      <div className="fac-kpi-strip">
        <div className="fac-kpi" style={{ borderTopColor: "var(--blue)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--blue)" }}>{kpis.total}</div>
          <div className="fac-kpi-lbl">Consultations facturées</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--green)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--green)" }}>{kpis.withInv}</div>
          <div className="fac-kpi-lbl">Factures émises</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--gold)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--gold)" }}>{kpis.withoutInv}</div>
          <div className="fac-kpi-lbl">Sans facture</div>
        </div>
        <div className="fac-kpi" style={{ borderTopColor: "var(--navy)" }}>
          <div className="fac-kpi-val" style={{ color: "var(--navy)", fontSize: 18 }}>
            {formatMAD(kpis.totalMAD)}
          </div>
          <div className="fac-kpi-lbl">Total facturé</div>
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
        <div className="rmb-search-wrap" style={{ marginLeft: "auto" }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="rmb-search"
            placeholder="Patient ou N° facture…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucune consultation facturée pour {selYear}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Les factures apparaissent ici une fois la consultation réglée depuis l'agenda.
          </div>
        </div>
      ) : (
        <div className="fac-table-wrap">
          <table className="fac-table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Patient</th>
                <th>Date RDV</th>
                <th>Type</th>
                <th className="fac-r">Montant</th>
                <th className="fac-r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    {a.invoiceNumber
                      ? <span className="fac-inv-num">{a.invoiceNumber}</span>
                      : <span className="fac-no-inv">— Non émise</span>
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
                    <span className="fac-type-chip">{APPT_TYPE_LABELS[a.type]}</span>
                  </td>
                  <td className="fac-r fac-amount">
                    {a.billedAmount != null ? formatMAD(a.billedAmount) : "—"}
                  </td>
                  <td className="fac-r">
                    <div className="fac-actions">
                      {a.invoiceNumber
                        ? <button className="fac-reprint-btn" onClick={() => reprintInvoice(a.id)}>
                            Réimprimer
                          </button>
                        : <button className="fac-emit-btn" onClick={() => emitInvoice(a.id)}>
                            📄 Émettre
                          </button>
                      }
                      <Link to={`/agenda/${a.id}`} className="fac-rdv-link">RDV →</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="fac-total-label">
                  Total ({filtered.length} consultation{filtered.length !== 1 ? "s" : ""})
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
    </Layout>
  );
}
