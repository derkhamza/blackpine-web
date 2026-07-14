import { confirmDialog } from "../lib/confirm";
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import type { Certificate, CertificateType } from "../lib/cabinetTypes";
import { CERT_TYPE_LABELS, CERT_TYPE_COLORS } from "../lib/cabinetTypes";
import { PatientPicker, type PickerPatient } from "../components/PatientPicker";
import { todayIso } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateIso(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateLocale(iso: string, locale: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T12:00:00");
  const b = new Date(to   + "T12:00:00");
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

// ── Print functions — intentionally kept in French (official medical documents)

function printCertificate(cert: Certificate, doctor: {
  fullName: string; specialtyLabel?: string; address?: string; phone?: string; inpe?: string;
}) {
  // Escape every free-text field before it is interpolated into the print HTML
  // below. These values can carry patient- or secretary-supplied content (e.g.
  // an online-booking name) that would otherwise inject script into the same-
  // origin print window and exfiltrate the session token.
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string, string>)[m]);
  cert = {
    ...cert,
    patientName:     esc(cert.patientName),
    content:         esc(cert.content),
    specialist:      esc(cert.specialist),
    reason:          esc(cert.reason),
    clinicalSummary: esc(cert.clinicalSummary),
  };
  doctor = {
    ...doctor,
    fullName:       esc(doctor.fullName),
    specialtyLabel: esc(doctor.specialtyLabel),
    address:        esc(doctor.address),
    phone:          esc(doctor.phone),
    inpe:           esc(doctor.inpe),
  };
  let body = "";

  if (cert.type === "medical") {
    body = `
      <p style="margin-bottom:18px;">Je soussigné(e), <strong>${doctor.fullName || "Dr. —"}</strong>${doctor.specialtyLabel ? `, ${doctor.specialtyLabel}` : ""}, certifie avoir examiné :</p>
      <div style="border:1px solid #1890C5;border-radius:8px;padding:14px 20px;margin-bottom:20px;background:#f0f8ff;">
        <strong style="font-size:16px;">${cert.patientName}</strong>
        <div style="font-size:13px;color:#555;margin-top:4px;">Le ${fmtDateIso(cert.date)}</div>
      </div>
      ${cert.content ? `
      <p style="font-size:14px;margin-bottom:12px;"><strong>Constatations cliniques :</strong></p>
      <p style="font-size:14px;line-height:1.7;margin-bottom:24px;">${cert.content}</p>
      ` : ""}
      <p style="font-size:14px;">En foi de quoi, le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>
    `;
  } else if (cert.type === "arret_travail") {
    const days = cert.duration ?? (cert.dateFrom && cert.dateTo ? daysBetween(cert.dateFrom, cert.dateTo) : 0);
    body = `
      <p style="margin-bottom:18px;">Je soussigné(e), <strong>${doctor.fullName || "Dr. —"}</strong>${doctor.specialtyLabel ? `, ${doctor.specialtyLabel}` : ""}, prescris un arrêt de travail à :</p>
      <div style="border:1px solid #E85B5B;border-radius:8px;padding:14px 20px;margin-bottom:20px;background:#fff5f5;">
        <strong style="font-size:16px;">${cert.patientName}</strong>
        <div style="font-size:13px;color:#555;margin-top:4px;">Établi le ${fmtDateIso(cert.date)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:10px 14px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;width:40%;">Période</td>
          <td style="padding:10px 14px;border:1px solid #ddd;">
            Du <strong>${cert.dateFrom ? fmtDateIso(cert.dateFrom) : "—"}</strong>
            au <strong>${cert.dateTo ? fmtDateIso(cert.dateTo) : "—"}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Durée</td>
          <td style="padding:10px 14px;border:1px solid #ddd;"><strong>${days} jour${days > 1 ? "s" : ""}</strong></td>
        </tr>
        ${cert.content ? `
        <tr>
          <td style="padding:10px 14px;border:1px solid #ddd;background:#f9f9f9;font-weight:600;">Diagnostic</td>
          <td style="padding:10px 14px;border:1px solid #ddd;">${cert.content}</td>
        </tr>` : ""}
      </table>
      <p style="font-size:14px;">Tout déplacement est autorisé sauf contre-indication médicale.</p>
    `;
  } else {
    body = `
      <p style="margin-bottom:18px;">Cher(e) Confrère / Consoeur,</p>
      <p style="margin-bottom:18px;font-size:14px;">Je vous adresse mon/ma patient(e) :</p>
      <div style="border:1px solid #9B72D0;border-radius:8px;padding:14px 20px;margin-bottom:20px;background:#faf5ff;">
        <strong style="font-size:16px;">${cert.patientName}</strong>
        <div style="font-size:13px;color:#555;margin-top:4px;">Le ${fmtDateIso(cert.date)}</div>
      </div>
      ${cert.specialist ? `<p style="font-size:14px;margin-bottom:10px;"><strong>Destinataire :</strong> ${cert.specialist}</p>` : ""}
      ${cert.reason ? `<p style="font-size:14px;margin-bottom:10px;"><strong>Motif d'orientation :</strong> ${cert.reason}</p>` : ""}
      ${cert.clinicalSummary ? `
      <div style="background:#f9f9f9;border-left:4px solid #9B72D0;padding:12px 16px;margin-top:16px;margin-bottom:20px;">
        <strong style="font-size:13px;display:block;margin-bottom:6px;">Résumé clinique :</strong>
        <p style="font-size:13px;line-height:1.7;margin:0;">${cert.clinicalSummary}</p>
      </div>` : ""}
      <p style="font-size:14px;">En vous remerciant de votre confraternel accueil, veuillez agréer mes cordiales salutations.</p>
    `;
  }

  const accentColor = CERT_TYPE_COLORS[cert.type];
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${CERT_TYPE_LABELS[cert.type]} — ${cert.patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #122B42; padding: 32px 36px; max-width: 600px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid ${accentColor}; margin-bottom: 22px; }
    .dr-name { font-size: 20px; font-weight: 800; color: ${accentColor}; }
    .dr-specialty { font-size: 13px; color: ${accentColor}; font-weight: 600; margin-top: 2px; opacity: .8; }
    .dr-meta { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.6; }
    .title-bar { text-align: center; letter-spacing: 3px; font-size: 13px; font-weight: 700; color: ${accentColor}; border: 1.5px solid ${accentColor}; padding: 7px 16px; margin-bottom: 22px; text-transform: uppercase; }
    .body { font-size: 14px; line-height: 1.7; }
    .footer { margin-top: 48px; display: flex; justify-content: flex-end; }
    .sig-box { border: 1px solid #ddd; border-radius: 6px; padding: 12px 24px; text-align: center; min-width: 200px; }
    .sig-label { font-size: 11px; color: #888; margin-bottom: 32px; }
    .sig-line { border-top: 1px solid #aaa; padding-top: 6px; font-size: 11px; color: #555; font-weight: 600; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="dr-name">${doctor.fullName || "Dr. —"}</div>
      ${doctor.specialtyLabel ? `<div class="dr-specialty">${doctor.specialtyLabel}</div>` : ""}
      <div class="dr-meta">
        ${doctor.address ? `${doctor.address}<br/>` : ""}
        ${doctor.phone ? `Tél : ${doctor.phone}<br/>` : ""}
        ${doctor.inpe ? `N° INPE : ${doctor.inpe}` : ""}
      </div>
    </div>
    <div style="font-size:11px;color:#aaa;text-align:right;">
      Fait le ${fmtDateIso(cert.date)}
    </div>
  </div>
  <div class="title-bar">${CERT_TYPE_LABELS[cert.type]}</div>
  <div class="body">${body}</div>
  <div class="footer">
    <div class="sig-box">
      <div class="sig-label">Signature et cachet</div>
      <div class="sig-line">${doctor.fullName || ""}</div>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=680,height=860");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Certificate modal ─────────────────────────────────────────────────────────

interface CertModalProps {
  editing?: Certificate;
  patients: PickerPatient[];
  today: string;
  onSave: (c: Omit<Certificate, "id" | "createdAt">) => void;
  onClose: () => void;
}

function CertModal({ editing, patients, today, onSave, onClose }: CertModalProps) {
  const { t } = useTranslation();
  const [type, setType]               = useState<CertificateType>(editing?.type ?? "medical");
  const [patientName, setPatient]     = useState(editing?.patientName ?? "");
  const [patientId,   setPatientId]   = useState<string | undefined>(editing?.patientId);
  const [date, setDate]               = useState(editing?.date ?? today);
  const [content, setContent]         = useState(editing?.content ?? "");
  const [dateFrom, setDateFrom]       = useState(editing?.dateFrom ?? today);
  const [dateTo, setDateTo]           = useState(editing?.dateTo ?? today);
  const [specialist, setSpecialist]   = useState(editing?.specialist ?? "");
  const [reason, setReason]           = useState(editing?.reason ?? "");
  const [summary, setSummary]         = useState(editing?.clinicalSummary ?? "");

  const duration = useMemo(() =>
    dateFrom && dateTo ? daysBetween(dateFrom, dateTo) : 0,
    [dateFrom, dateTo]);

  const handleSave = () => {
    if (!patientName.trim()) return;
    onSave({
      type,
      patientName: patientName.trim(),
      patientId,
      date,
      content:         content.trim() || undefined,
      dateFrom:        type === "arret_travail" ? dateFrom : undefined,
      dateTo:          type === "arret_travail" ? dateTo   : undefined,
      duration:        type === "arret_travail" ? duration : undefined,
      specialist:      type === "orientation"   ? specialist.trim() || undefined : undefined,
      reason:          type === "orientation"   ? reason.trim()     || undefined : undefined,
      clinicalSummary: type === "orientation"   ? summary.trim()    || undefined : undefined,
      source:          editing?.source ?? "standalone",
      appointmentId:   editing?.appointmentId,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cert-modal">
        <div className="modal-header">
          <div className="modal-title">
            {editing ? t("certificats.modalEdit") : t("certificats.modalNew")}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t("certificats.typeLabel")}</label>
            <div className="cert-type-tabs" role="tablist">
              {(["medical", "arret_travail", "orientation"] as CertificateType[]).map(ct => (
                <button
                  key={ct}
                  type="button"
                  className={`cert-type-tab${type === ct ? " active" : ""}`} {...tabProps(type === ct)}
                  style={type === ct ? { borderColor: CERT_TYPE_COLORS[ct], color: CERT_TYPE_COLORS[ct], background: CERT_TYPE_COLORS[ct] + "18" } : {}}
                  onClick={() => setType(ct)}
                >
                  {CERT_TYPE_LABELS[ct]}
                </button>
              ))}
            </div>
          </div>

          <div className="rx-top-row">
            <div style={{ flex: 2 }}>
              <PatientPicker
                value={patientName}
                patientId={patientId}
                patients={patients}
                label={t("certificats.patientLabel")}
                placeholder={t("certificats.patientPlaceholder")}
                listId="cert-patients-list"
                onChange={(name, id) => { setPatient(name); setPatientId(id); }}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{t("certificats.dateLabel")}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {type === "medical" && (
            <div className="form-group">
              <label className="form-label">{t("certificats.clinicalFindings")}</label>
              <textarea
                className="form-input" rows={4}
                placeholder={t("certificats.clinicalPlaceholder")}
                value={content} onChange={e => setContent(e.target.value)}
              />
            </div>
          )}

          {type === "arret_travail" && (
            <>
              <div className="rx-top-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("certificats.arretFrom")}</label>
                  <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("certificats.arretTo")}</label>
                  <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: "0 0 90px" }}>
                  <label className="form-label">{t("certificats.arretDuration")}</label>
                  <div className="cert-duration-badge" style={{ borderColor: CERT_TYPE_COLORS.arret_travail, color: CERT_TYPE_COLORS.arret_travail }}>
                    {duration} j
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t("certificats.diagnosticLabel")}</label>
                <input
                  className="form-input"
                  placeholder={t("certificats.diagnosticPlaceholder")}
                  value={content} onChange={e => setContent(e.target.value)}
                />
              </div>
            </>
          )}

          {type === "orientation" && (
            <>
              <div className="form-group">
                <label className="form-label">{t("certificats.specialistLabel")}</label>
                <input
                  className="form-input"
                  placeholder={t("certificats.specialistPlaceholder")}
                  value={specialist} onChange={e => setSpecialist(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("certificats.reasonLabel")}</label>
                <input
                  className="form-input"
                  placeholder={t("certificats.reasonPlaceholder")}
                  value={reason} onChange={e => setReason(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("certificats.summaryLabel")}</label>
                <textarea
                  className="form-input" rows={4}
                  placeholder={t("certificats.summaryPlaceholder")}
                  value={summary} onChange={e => setSummary(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button
            className="btn btn-primary"
            disabled={!patientName.trim()}
            onClick={handleSave}
          >
            {editing ? t("common.save") : t("certificats.createBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Certificate card ──────────────────────────────────────────────────────────

interface CertCardProps {
  cert: Certificate;
  locale: string;
  doctor: { fullName: string; specialtyLabel?: string; address?: string; phone?: string; inpe?: string };
  onEdit: () => void;
  onDelete: () => void;
}

function CertCard({ cert, locale, doctor, onEdit, onDelete }: CertCardProps) {
  const { t } = useTranslation();
  const color = CERT_TYPE_COLORS[cert.type];
  const label = CERT_TYPE_LABELS[cert.type];

  return (
    <div className="cert-card">
      <div className="cert-card-accent" style={{ background: color }} />
      <div className="cert-card-body">
        <div className="cert-card-header">
          <div className="cert-card-patient">{cert.patientName}</div>
          <span className="cert-type-badge" style={{ background: color + "18", color, borderColor: color + "44" }}>
            {label}
          </span>
        </div>
        <div className="cert-card-meta">
          <span className="cert-card-date">{fmtDateLocale(cert.date, locale)}</span>
          {cert.type === "arret_travail" && cert.duration && (
            <span className="cert-card-detail" style={{ color }}>
              {cert.dateFrom && cert.dateTo
                ? `${fmtDateLocale(cert.dateFrom, locale)} → ${fmtDateLocale(cert.dateTo, locale)}`
                : `${cert.duration} j`}
            </span>
          )}
          {cert.type === "orientation" && cert.specialist && (
            <span className="cert-card-detail">→ {cert.specialist}</span>
          )}
          {cert.type === "orientation" && cert.reason && (
            <span className="cert-card-detail" style={{ color: "var(--muted)" }}>
              {cert.reason}
            </span>
          )}
        </div>
        {cert.content && (
          <div className="cert-card-preview">
            {cert.content.slice(0, 100)}{cert.content.length > 100 ? "…" : ""}
          </div>
        )}
        {cert.source === "appointment" && (
          <div className="cert-source-badge">{t("certificats.linkedAppt")}</div>
        )}
      </div>
      <div className="cert-card-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => printCertificate(cert, doctor)}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="5" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("certificats.printBtn")}
        </button>
        {cert.source === "standalone" && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>{t("certificats.editBtn")}</button>
            <button className="btn btn-ghost btn-sm danger" onClick={onDelete}>{t("certificats.deleteBtn")}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CertificatsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const today = todayIso();

  const {
    certificates, addCertificate, updateCertificate, deleteCertificate,
    appointments, patients, doctorProfile,
  } = useCabinet();

  const [filterType, setFilterType] = useState<CertificateType | "all">("all");
  const [search, setSearch]         = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Certificate | undefined>();

  const apptCerts: Certificate[] = useMemo(() => {
    const list: Certificate[] = [];
    for (const a of appointments) {
      if (!a.savedCertificates?.length) continue;
      for (const sc of a.savedCertificates) {
        list.push({
          ...sc,
          patientName:   a.patientName,
          patientId:     a.patientId,
          date:          a.date,
          source:        "appointment",
          appointmentId: a.id,
          createdAt:     sc.issuedAt,
        });
      }
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments]);

  const allCerts = useMemo(() => {
    const standalone = [...certificates].sort((a, b) => b.date.localeCompare(a.date));
    return [...standalone, ...apptCerts];
  }, [certificates, apptCerts]);

  const filtered = useMemo(() => {
    let list = filterType === "all" ? allCerts : allCerts.filter(c => c.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.patientName.toLowerCase().includes(q) ||
        (c.specialist ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [allCerts, filterType, search]);

  const thisMonth = today.slice(0, 7);
  const kpis = useMemo(() => ({
    total:       allCerts.length,
    thisMonth:   allCerts.filter(c => c.date.startsWith(thisMonth)).length,
    medical:     allCerts.filter(c => c.type === "medical").length,
    arret:       allCerts.filter(c => c.type === "arret_travail").length,
    orientation: allCerts.filter(c => c.type === "orientation").length,
  }), [allCerts, thisMonth]);

  const patientsList = useMemo<PickerPatient[]>(() =>
    patients.map(p => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName,
      dateOfBirth: p.dateOfBirth, phone: p.phone, city: p.city, cin: p.cin,
    })),
    [patients]);

  const handleSave = useCallback((c: Omit<Certificate, "id" | "createdAt">) => {
    if (editing) {
      updateCertificate({ ...c, id: editing.id, createdAt: editing.createdAt });
    } else {
      addCertificate(c);
    }
    setShowModal(false);
    setEditing(undefined);
  }, [editing, addCertificate, updateCertificate]);

  const tabs: [CertificateType | "all", string, number][] = [
    ["all",           t("certificats.filterAll"),        kpis.total],
    ["medical",       t("certificats.filterMedical"),    kpis.medical],
    ["arret_travail", t("certificats.filterArret"),      kpis.arret],
    ["orientation",   t("certificats.filterOrientation"),kpis.orientation],
  ];

  const body = (
    <>
      <div className="stock-kpi-strip">
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpis.total}</div>
          <div className="stock-kpi-lbl">{t("certificats.kpiTotal")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--blue)" }}>{kpis.thisMonth}</div>
          <div className="stock-kpi-lbl">{t("certificats.kpiThisMonth")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: CERT_TYPE_COLORS.medical }}>{kpis.medical}</div>
          <div className="stock-kpi-lbl">{t("certificats.kpiMedical")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: CERT_TYPE_COLORS.arret_travail }}>{kpis.arret}</div>
          <div className="stock-kpi-lbl">{t("certificats.kpiArret")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: CERT_TYPE_COLORS.orientation }}>{kpis.orientation}</div>
          <div className="stock-kpi-lbl">{t("certificats.kpiOrientation")}</div>
        </div>
      </div>

      <div className="four-tabs" role="tablist" style={{ marginBottom: 16 }}>
        {tabs.map(([val, lbl, count]) => (
          <button
            key={val}
            className={`four-tab${filterType === val ? " active" : ""}`} {...tabProps(filterType === val)}
            onClick={() => setFilterType(val)}
            style={filterType === val && val !== "all"
              ? { borderColor: CERT_TYPE_COLORS[val as CertificateType], color: CERT_TYPE_COLORS[val as CertificateType] }
              : {}}
          >
            {lbl}
            <span className="badge" style={{ marginLeft: 4 }}>{count}</span>
          </button>
        ))}
      </div>

      <div className="four-toolbar">
        <input
          className="search-input"
          placeholder={t("certificats.search")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
        <button className="btn btn-primary" onClick={() => { setEditing(undefined); setShowModal(true); }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {t("certificats.newDoc")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="40" height="40" viewBox="0 0 14 14" fill="none">
              <path d="M3 2h6l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              <path d="M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="empty-title">{search ? t("certificats.emptySearch") : t("certificats.emptyTitle")}</div>
          <div className="empty-sub">{search ? t("certificats.emptySearchHint") : t("certificats.emptyHint")}</div>
          {!search && (
            <button className="btn btn-primary" onClick={() => { setEditing(undefined); setShowModal(true); }}>
              {t("certificats.newDoc")}
            </button>
          )}
        </div>
      ) : (
        <div className="cert-list">
          {filtered.map(cert => (
            <CertCard
              key={cert.id}
              cert={cert}
              locale={locale}
              doctor={doctorProfile}
              onEdit={() => { setEditing(cert); setShowModal(true); }}
              onDelete={async () => { if (await confirmDialog(t("certificats.deleteConfirm"))) deleteCertificate(cert.id); }}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CertModal
          editing={editing}
          patients={patientsList}
          today={today}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
        />
      )}
    </>
  );
  if (noLayout) return body;
  return (
    <Layout title={t("certificats.title")} subtitle={t("certificats.subtitle")}>
      {body}
    </Layout>
  );
}
