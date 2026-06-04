import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type {
  Appointment, AppointmentStatus, AppointmentType,
  ConsultationNote, VitalSigns,
} from "../lib/cabinetTypes";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS,
} from "../lib/cabinetTypes";
import { NOTE_TEMPLATES, TEMPLATE_CATEGORIES } from "../lib/noteTemplates";
import { todayIso, formatMAD } from "../lib/format";
import { printReceipt } from "../lib/receiptPrinter";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTS: AppointmentStatus[] = [
  "scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show",
];
const TYPE_OPTS: AppointmentType[] = [
  "consultation", "suivi", "procedure", "urgence", "autre",
];

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// Vital sign colour (normal / warning / danger)
function vsColor(key: keyof VitalSigns, val: number): string {
  switch (key) {
    case "bpSys":  return val < 90 || val > 140 ? "var(--coral)" : val > 130 ? "var(--gold)" : "var(--green)";
    case "bpDia":  return val < 60 || val > 90  ? "var(--coral)" : val > 85  ? "var(--gold)" : "var(--green)";
    case "hr":     return val < 50 || val > 100  ? "var(--coral)" : "var(--green)";
    case "temp":   return val < 36 || val > 38.5 ? "var(--coral)" : val > 37.5 ? "var(--gold)" : "var(--green)";
    case "spo2":   return val < 90  ? "var(--coral)" : val < 95 ? "var(--gold)" : "var(--green)";
    default:       return "var(--text)";
  }
}

// ── Ordonnance print ──────────────────────────────────────────────────────────

function printOrdonnance(
  doctorName: string, specialty: string, inpe: string, address: string, phone: string,
  patientName: string, date: string, content: string,
) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Ordonnance – ${patientName}</title>
<style>
  @page { size: A5; margin: 14mm 16mm; }
  body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #111; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0A4E7E; padding-bottom: 10px; margin-bottom: 14px; }
  .doctor-block { }
  .doctor-name { font-size: 14pt; font-weight: bold; color: #0A4E7E; }
  .doctor-meta { font-size: 9pt; color: #444; margin-top: 3px; }
  .date-block { text-align: right; font-size: 9pt; color: #444; padding-top: 4px; }
  .patient-line { margin-bottom: 14px; font-size: 10pt; }
  .patient-line strong { color: #0A4E7E; }
  .rx-title { font-size: 26pt; color: #0A4E7E; font-style: italic; margin-bottom: 16px; }
  .rx-content { font-size: 11pt; line-height: 1.9; white-space: pre-wrap; min-height: 120mm; }
  .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 8pt; color: #666; text-align: center; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div class="doctor-block">
    <div class="doctor-name">${doctorName || "Médecin"}</div>
    <div class="doctor-meta">${specialty || ""}<br>${inpe ? "INPE : " + inpe : ""}</div>
  </div>
  <div class="date-block">${address ? address + "<br>" : ""}${phone ? "Tél : " + phone + "<br>" : ""}Le ${new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
</div>
<div class="patient-line">Patient(e) : <strong>${patientName}</strong></div>
<div class="rx-title">℞</div>
<div class="rx-content">${content || "(vide)"}</div>
<div class="footer">Ordonnance médicale — à conserver</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── VitalSign input ───────────────────────────────────────────────────────────

function VsInput({
  label, unit, value, onChange, onBlur, vsKey, hint,
}: {
  label: string; unit: string; value: string;
  onChange: (v: string) => void; onBlur: () => void;
  vsKey?: keyof VitalSigns; hint?: string;
}) {
  const num  = parseFloat(value.replace(",", "."));
  const color = vsKey && !isNaN(num) ? vsColor(vsKey, num) : "var(--text)";
  return (
    <div className="vs-field">
      <div className="vs-label">{label}</div>
      <div className="vs-input-wrap">
        <input
          className="vs-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={{ color: !isNaN(num) && vsKey ? color : undefined }}
        />
        <span className="vs-unit">{unit}</span>
      </div>
      {hint && <div className="vs-hint">{hint}</div>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AppointmentDetailPage() {
  const { apptId } = useParams<{ apptId: string }>();
  const navigate    = useNavigate();
  const { appointments, patients, updateAppointment, deleteAppointment } = useCabinet();
  const { addTransaction } = useApp();
  const { doctorProfile } = useCabinet();

  const appt = useMemo(
    () => appointments.find((a) => a.id === apptId),
    [appointments, apptId],
  );

  const patient = useMemo(
    () => appt?.patientId ? patients.find((p) => p.id === appt.patientId) : null,
    [patients, appt?.patientId],
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"notes" | "vitals" | "suivi">("notes");

  // ── Clinical notes (local → auto-save on blur) ────────────────────────────
  const [motif,     setMotif]     = useState("");
  const [exam,      setExam]      = useState("");
  const [diag,      setDiag]      = useState("");
  const [treatment, setTreatment] = useState("");

  // ── Vital signs ───────────────────────────────────────────────────────────
  const [bpSys,  setBpSys]  = useState("");
  const [bpDia,  setBpDia]  = useState("");
  const [hr,     setHr]     = useState("");
  const [temp,   setTemp]   = useState("");
  const [spo2,   setSpo2]   = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // ── Reimbursement ─────────────────────────────────────────────────────────
  const [rmbAmount, setRmbAmount] = useState("");

  // ── Ordonnance modal ──────────────────────────────────────────────────────
  const [showOrd, setShowOrd] = useState(false);
  const [ordText, setOrdText] = useState("");

  // ── Billing modal ─────────────────────────────────────────────────────────
  const [showBill,  setShowBill]  = useState(false);
  const [billAmt,   setBillAmt]   = useState("200");

  // ── Template selector ─────────────────────────────────────────────────────
  const [templateCat, setTemplateCat] = useState<string>("Général");
  const [showTemplates, setShowTemplates] = useState(false);

  // Sync state from appointment
  useEffect(() => {
    if (!appt) return;
    const n = appt.consultationNote ?? {};
    setMotif(n.motif ?? "");
    setExam(n.examination ?? "");
    setDiag(n.diagnosis ?? "");
    setTreatment(n.treatment ?? "");
    const vs = appt.vitalSigns ?? {};
    setBpSys(vs.bpSys != null ? String(vs.bpSys) : "");
    setBpDia(vs.bpDia != null ? String(vs.bpDia) : "");
    setHr(vs.hr != null ? String(vs.hr) : "");
    setTemp(vs.temp != null ? String(vs.temp) : "");
    setSpo2(vs.spo2 != null ? String(vs.spo2) : "");
    setWeight(vs.weight != null ? String(vs.weight) : "");
    setHeight(vs.height != null ? String(vs.height) : "");
    setRmbAmount(appt.reimbursementAmount != null ? String(appt.reimbursementAmount) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id]);

  if (!appt) {
    return (
      <Layout title="Rendez-vous" subtitle="introuvable">
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Rendez-vous introuvable</div>
          <button className="btn btn-primary" onClick={() => navigate("/agenda")}>
            Retour à l'agenda
          </button>
        </div>
      </Layout>
    );
  }

  // ── Save helpers ──────────────────────────────────────────────────────────

  const saveNotes = () => {
    const note: ConsultationNote = {
      motif:       motif.trim() || undefined,
      examination:  exam.trim()  || undefined,
      diagnosis:    diag.trim()  || undefined,
      treatment:    treatment.trim() || undefined,
    };
    updateAppointment({ ...appt, consultationNote: note });
  };

  const saveVitals = () => {
    const p = (s: string) => { const n = parseFloat(s.replace(",", ".")); return isNaN(n) ? undefined : n; };
    const vs: VitalSigns = {
      bpSys: p(bpSys), bpDia: p(bpDia), hr: p(hr),
      temp: p(temp), spo2: p(spo2), weight: p(weight), height: p(height),
    };
    const hasAny = Object.values(vs).some((v) => v !== undefined);
    updateAppointment({ ...appt, vitalSigns: hasAny ? vs : undefined });
  };

  const applyTemplate = (tpl: typeof NOTE_TEMPLATES[0]) => {
    if (tpl.motif       !== undefined) setMotif(tpl.motif);
    if (tpl.examination !== undefined) setExam(tpl.examination);
    if (tpl.diagnosis   !== undefined) setDiag(tpl.diagnosis);
    if (tpl.treatment   !== undefined) setTreatment(tpl.treatment);
    updateAppointment({
      ...appt,
      consultationNote: {
        motif:       tpl.motif       ?? motif,
        examination:  tpl.examination ?? exam,
        diagnosis:    tpl.diagnosis   ?? diag,
        treatment:    tpl.treatment   ?? treatment,
      },
    });
    setShowTemplates(false);
  };

  const handleStatusChange = (s: AppointmentStatus) => {
    updateAppointment({ ...appt, status: s });
  };

  const handleBill = () => {
    const n = parseFloat(billAmt);
    if (isNaN(n) || n <= 0) return;
    addTransaction({
      type: "RECETTE", amount: n, date: appt.date,
      category: appt.type === "procedure" ? "acte_chirurgical" : "consultation",
      deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1,
      description: `${APPT_TYPE_LABELS[appt.type]} – ${appt.patientName}`,
    });
    updateAppointment({ ...appt, billedAt: new Date().toISOString(), billedAmount: n });
    setShowBill(false);
  };

  const handleRmbSave = () => {
    const n = parseFloat(rmbAmount.replace(",", "."));
    updateAppointment({
      ...appt,
      reimbursementAmount: isNaN(n) ? undefined : n,
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Supprimer le rendez-vous de ${appt.patientName} ?`)) return;
    deleteAppointment(appt.id);
    navigate("/agenda");
  };

  // ── BMI ───────────────────────────────────────────────────────────────────
  const bmi = (() => {
    const w = parseFloat(weight), h = parseFloat(height);
    if (!w || !h || h <= 0) return null;
    return w / ((h / 100) ** 2);
  })();
  const bmiLabel = bmi === null ? null
    : bmi < 18.5 ? "Insuffisance pondérale"
    : bmi < 25   ? "Corpulence normale"
    : bmi < 30   ? "Surpoids"
    : "Obésité";

  const typeColor   = APPT_TYPE_COLORS[appt.type];
  const hasNotes    = motif || exam || diag || treatment;
  const templatesByCat = NOTE_TEMPLATES.filter((t) => t.category === templateCat);

  return (
    <Layout
      title={appt.patientName}
      subtitle={`${fmtDate(appt.date)} · ${appt.startTime} → ${appt.endTime}`}
    >
      {/* ── Back link ── */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/agenda" className="appt-back-link">
          ← Retour à l'Agenda
        </Link>
      </div>

      {/* ── Header card ── */}
      <div className="appt-detail-header">
        <div className="appt-detail-meta">
          <span
            className="appt-detail-type-badge"
            style={{ background: typeColor + "20", color: typeColor }}
          >
            {APPT_TYPE_LABELS[appt.type]}
          </span>
          {appt.billedAt && (
            <span className="appt-detail-billed-badge">✓ Facturé</span>
          )}
          {patient && (
            <Link to={`/patients/${patient.id}`} className="appt-detail-patient-link">
              Voir le dossier patient →
            </Link>
          )}
        </div>

        <div className="appt-detail-status-row">
          <span className="appt-detail-status-label">Statut</span>
          <select
            className="appt-detail-status-select"
            value={appt.status}
            onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus)}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>{APPT_STATUS_LABELS[s]}</option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {!appt.billedAt && (
              <button className="btn btn-primary" style={{ background: "var(--green)" }}
                onClick={() => setShowBill(true)}>
                💰 Facturer
              </button>
            )}
            <button className="btn btn-ghost" style={{ color: "var(--coral)", borderColor: "var(--coral)" }}
              onClick={handleDelete}>
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="appt-tabs">
        {([
          { key: "notes",  label: "Notes cliniques", dot: hasNotes },
          { key: "vitals", label: "Signes vitaux",   dot: !!appt.vitalSigns },
          { key: "suivi",  label: "Suivi & AMO",     dot: !!appt.reimbursementStatus || !!appt.followUpDate },
        ] as const).map(({ key, label, dot }) => (
          <button
            key={key}
            className={`appt-tab${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
            {dot && <span className="appt-tab-dot" />}
          </button>
        ))}
      </div>

      {/* ─────────────── TAB: NOTES CLINIQUES ─────────────── */}
      {tab === "notes" && (
        <div className="appt-tab-panel">
          {/* Template selector */}
          <div className="appt-section-header">
            <div className="appt-section-title">Notes cliniques</div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => setShowTemplates((v) => !v)}
            >
              📋 Modèles {showTemplates ? "▲" : "▼"}
            </button>
          </div>

          {showTemplates && (
            <div className="appt-templates-panel">
              <div className="appt-template-cats">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`tx-cat-chip${templateCat === cat ? " active" : ""}`}
                    onClick={() => setTemplateCat(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="appt-template-list">
                {templatesByCat.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="appt-template-item"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <div className="appt-template-label">{tpl.label}</div>
                    {tpl.motif && (
                      <div className="appt-template-preview">{tpl.motif.slice(0, 60)}…</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="appt-notes-grid">
            <div className="form-group">
              <label className="form-label">Motif de consultation</label>
              <textarea
                className="form-input appt-textarea"
                rows={2}
                placeholder="Raison de la visite…"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                onBlur={saveNotes}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Examen clinique</label>
              <textarea
                className="form-input appt-textarea"
                rows={4}
                placeholder="Résultats de l'examen clinique…"
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                onBlur={saveNotes}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Diagnostic</label>
              <textarea
                className="form-input appt-textarea"
                rows={2}
                placeholder="Diagnostic retenu…"
                value={diag}
                onChange={(e) => setDiag(e.target.value)}
                onBlur={saveNotes}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Traitement / Conduite à tenir</label>
              <textarea
                className="form-input appt-textarea"
                rows={4}
                placeholder="Prescriptions, conseils, suivi…"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                onBlur={saveNotes}
              />
            </div>
          </div>

          {/* Ordonnance shortcut */}
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => {
                setOrdText(treatment);
                setShowOrd(true);
              }}
            >
              🖨️ Générer une ordonnance
            </button>
            <span style={{ fontSize: 11, color: "var(--tertiary)", alignSelf: "center" }}>
              auto-sauvegardé à la sortie du champ
            </span>
          </div>
        </div>
      )}

      {/* ─────────────── TAB: SIGNES VITAUX ─────────────── */}
      {tab === "vitals" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">Signes vitaux</div>
          </div>

          <div className="vs-grid">
            {/* Blood pressure */}
            <div className="vs-bp-group">
              <div className="vs-group-label">Tension artérielle</div>
              <div className="vs-bp-row">
                <VsInput label="Sys." unit="mmHg" value={bpSys} onChange={setBpSys} onBlur={saveVitals} vsKey="bpSys" />
                <span className="vs-bp-slash">/</span>
                <VsInput label="Dia." unit="mmHg" value={bpDia} onChange={setBpDia} onBlur={saveVitals} vsKey="bpDia" />
              </div>
            </div>

            <VsInput label="Fréquence cardiaque" unit="bpm"  value={hr}     onChange={setHr}     onBlur={saveVitals} vsKey="hr" />
            <VsInput label="Température"         unit="°C"   value={temp}   onChange={setTemp}   onBlur={saveVitals} vsKey="temp" />
            <VsInput label="SpO₂"                unit="%"    value={spo2}   onChange={setSpo2}   onBlur={saveVitals} vsKey="spo2" />
            <VsInput label="Poids"               unit="kg"   value={weight} onChange={setWeight} onBlur={saveVitals} />
            <VsInput label="Taille"              unit="cm"   value={height} onChange={setHeight} onBlur={saveVitals} />
          </div>

          {bmi !== null && (
            <div className="vs-bmi-card">
              <div className="vs-bmi-value">IMC : {bmi.toFixed(1)}</div>
              <div className="vs-bmi-label" style={{
                color: bmi < 18.5 || bmi >= 30 ? "var(--coral)" : bmi >= 25 ? "var(--gold)" : "var(--green)",
              }}>
                {bmiLabel}
              </div>
            </div>
          )}

          <div className="vs-legend">
            <span className="vs-legend-item" style={{ color: "var(--green)" }}>● Normal</span>
            <span className="vs-legend-item" style={{ color: "var(--gold)" }}>● Limite</span>
            <span className="vs-legend-item" style={{ color: "var(--coral)" }}>● Anormal</span>
            <span className="vs-legend-hint">Les couleurs changent selon les valeurs saisies. Auto-sauvegardé.</span>
          </div>
        </div>
      )}

      {/* ─────────────── TAB: SUIVI & AMO ─────────────── */}
      {tab === "suivi" && (
        <div className="appt-tab-panel">

          {/* AMO / CNOPS */}
          <div className="appt-section-header">
            <div className="appt-section-title">AMO / CNOPS</div>
          </div>
          <div className="appt-suivi-grid">
            <div className="form-group">
              <label className="form-label">Statut remboursement</label>
              <select
                className="form-select"
                value={appt.reimbursementStatus ?? ""}
                onChange={(e) => updateAppointment({
                  ...appt,
                  reimbursementStatus: (e.target.value || undefined) as Appointment["reimbursementStatus"],
                })}
              >
                <option value="">— Non concerné —</option>
                <option value="pending">En attente</option>
                <option value="received">Encaissé</option>
                <option value="rejected">Refusé</option>
              </select>
            </div>

            {appt.reimbursementStatus && (
              <>
                <div className="form-group">
                  <label className="form-label">Montant AMO (MAD)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="form-input"
                      type="number" min="0" step="0.01"
                      placeholder="0.00"
                      value={rmbAmount}
                      onChange={(e) => setRmbAmount(e.target.value)}
                      onBlur={handleRmbSave}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Date encaissement</label>
                  <input
                    className="form-input"
                    type="date"
                    value={appt.reimbursementDate ?? ""}
                    onChange={(e) => updateAppointment({
                      ...appt, reimbursementDate: e.target.value || undefined,
                    })}
                  />
                </div>
              </>
            )}
          </div>

          {/* Reimbursement status badge */}
          {appt.reimbursementStatus && (
            <div className="appt-rmb-badge-row">
              <span className="appt-rmb-badge" style={{
                background: appt.reimbursementStatus === "received" ? "var(--green-soft)"
                          : appt.reimbursementStatus === "rejected"  ? "var(--coral-soft)"
                          : "var(--gold-soft)",
                color:      appt.reimbursementStatus === "received" ? "var(--green)"
                          : appt.reimbursementStatus === "rejected"  ? "var(--coral)"
                          : "var(--gold)",
              }}>
                {appt.reimbursementStatus === "received" ? "✓ Encaissé"
                : appt.reimbursementStatus === "rejected" ? "✗ Refusé"
                : "⏳ En attente"}
                {appt.reimbursementAmount ? ` · ${formatMAD(appt.reimbursementAmount)}` : ""}
              </span>
            </div>
          )}

          {/* Follow-up */}
          <div className="appt-section-header" style={{ marginTop: 20 }}>
            <div className="appt-section-title">Rendez-vous de suivi</div>
          </div>
          <div className="appt-suivi-grid">
            <div className="form-group">
              <label className="form-label">Date de suivi prévue</label>
              <input
                className="form-input"
                type="date"
                value={appt.followUpDate ?? ""}
                onChange={(e) => updateAppointment({
                  ...appt, followUpDate: e.target.value || undefined,
                })}
              />
            </div>
          </div>

          {/* Billing */}
          <div className="appt-section-header" style={{ marginTop: 20 }}>
            <div className="appt-section-title">Facturation</div>
          </div>
          {appt.billedAt ? (
            <div className="appt-billed-info">
              <span style={{ color: "var(--green)", fontWeight: 700 }}>✓ Consultation facturée</span>
              <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                le {new Date(appt.billedAt).toLocaleDateString("fr-FR")}
                {appt.billedAmount ? ` · ${formatMAD(appt.billedAmount)}` : ""}
              </span>
              <button
                className="btn btn-ghost receipt-print-btn"
                onClick={() => printReceipt({
                  patientName:      appt.patientName,
                  consultationType: APPT_TYPE_LABELS[appt.type],
                  appointmentDate:  appt.date,
                  appointmentTime:  appt.startTime,
                  amount:           appt.billedAmount ?? 0,
                  doctorProfile,
                })}
                title="Imprimer le reçu de paiement"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                  <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 9h6M4 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Reçu
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={() => setShowBill(true)}
              >
                💰 Facturer cette consultation
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Crée une recette dans Transactions
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Bill modal ── */}
      {showBill && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowBill(false); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 className="modal-title">Facturer la consultation</h2>
              <button className="modal-close" onClick={() => setShowBill(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Montant (MAD)</label>
                <input
                  className="form-input"
                  type="number" min="0" step="0.01" autoFocus
                  value={billAmt}
                  onChange={(e) => setBillAmt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBill()}
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Patient : {appt.patientName} · {APPT_TYPE_LABELS[appt.type]}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowBill(false)}>Annuler</button>
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={handleBill}
              >
                Ajouter la recette
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ordonnance modal ── */}
      {showOrd && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowOrd(false); }}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h2 className="modal-title">Ordonnance — {appt.patientName}</h2>
              <button className="modal-close" onClick={() => setShowOrd(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Contenu de l'ordonnance</label>
                <textarea
                  className="form-input appt-textarea"
                  rows={10}
                  placeholder="Médicaments, posologie, durée…"
                  value={ordText}
                  onChange={(e) => setOrdText(e.target.value)}
                />
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                En-tête : {doctorProfile?.fullName || "— nom non renseigné —"} ·{" "}
                {doctorProfile?.specialtyLabel || ""} ·{" "}
                <Link to="/profil" style={{ color: "var(--blue)" }}>Compléter le profil</Link>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowOrd(false)}>Annuler</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  printOrdonnance(
                    doctorProfile?.fullName ?? "",
                    doctorProfile?.specialtyLabel ?? "",
                    doctorProfile?.inpe ?? "",
                    doctorProfile?.address ?? "",
                    doctorProfile?.phone ?? "",
                    appt.patientName,
                    appt.date,
                    ordText,
                  );
                  setShowOrd(false);
                }}
              >
                🖨️ Imprimer / Enregistrer PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
