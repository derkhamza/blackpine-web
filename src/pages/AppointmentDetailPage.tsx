import { confirmDialog } from "../lib/confirm";
import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
import { Layout } from "../components/Layout";
import { DictationButton } from "../components/DictationButton";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { useToast } from "../components/Toast";
import { ActionIcon } from "../components/ActionIcon";
import { AttachmentLink } from "../components/AttachmentLink";
import { findOrphanAppts } from "../lib/orphanAppts";
import { fullName as fmtFullName } from "../lib/nameFormat";
import type {
  Appointment, AppointmentStatus, Patient, CustomMeasure,
  ConsultationNote, VitalSigns, OrdonnanceLine, SavedCertificate, BillingLine, PaymentMethod,
} from "../lib/cabinetTypes";
import { paymentSummary, billSubtotal as calcSubtotal, billLineDiscounts, billNet, lineDiscount, lineNet } from "../lib/billing";
import {
  APPT_STATUS_LABELS, DEFAULT_SECRETARY_PERMISSIONS,
  apptTypeLabel, apptTypeColor, resolveApptTypes, apptLabelById,
} from "../lib/cabinetTypes";
import { NOTE_TEMPLATES, TEMPLATE_CATEGORIES } from "../lib/noteTemplates";
import { todayIso, formatMAD, formatDateShort, bmiClassify, calcAge } from "../lib/format";
import { ckdEpiFromMgL, type Sex } from "../lib/ckdEpi";
import { printReceipt } from "../lib/receiptPrinter";
import { printOrdonnance } from "../lib/ordonnancePrinter";
import { nextInvoiceNumber, printFacture } from "../lib/facturePrinter";
import { OrdonnanceModal }  from "../components/OrdonnanceModal";
import { CertificateModal } from "../components/CertificateModal";
import { ExamRequestModal } from "../components/ExamRequestModal";
import { MedicalReportModal } from "../components/MedicalReportModal";
import { findLastPrescription } from "../lib/prescriptions";
import { Icd10Picker }      from "../components/Icd10Picker";
import type { Icd10Entry }  from "../lib/icd10";
import { getSpecialtyGroups, getSpecialtyBilans, DEFAULT_BILANS, BILAN_CATALOG, fieldMeta } from "../lib/specialtyFields";
import type { SpecialtyField } from "../lib/specialtyFields";
import type { CustomNoteTemplate } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTS: AppointmentStatus[] = [
  "scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show",
];
// Core types always offered for reclassification; the full resolved list (incl.
// the doctor's custom types) is merged in at render time. Legacy types remain
// displayable on existing records and are preserved per-appointment via seenTypes.
const STANDARD_TYPES: string[] = ["consultation", "controle", "autre"];

function fmtDate(iso: string, locale = "fr-FR") {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
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

// ── VitalSign input ───────────────────────────────────────────────────────────

function VsInput({
  label, unit, value, onChange, onBlur, vsKey, hint, readOnly, colorScale = 1,
}: {
  label: string; unit: string; value: string;
  onChange: (v: string) => void; onBlur: () => void;
  vsKey?: keyof VitalSigns; hint?: string; readOnly?: boolean;
  colorScale?: number; // multiply entered value before applying clinical thresholds (cmHg→mmHg = 10)
}) {
  const num  = parseFloat(value.replace(",", "."));
  const color = vsKey && !isNaN(num) ? vsColor(vsKey, num * colorScale) : "var(--text)";
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
          readOnly={readOnly}
          style={{ color: !isNaN(num) && vsKey ? color : undefined }}
        />
        <span className="vs-unit">{unit}</span>
      </div>
      {hint && <div className="vs-hint">{hint}</div>}
    </div>
  );
}

// ── Specialty field input ─────────────────────────────────────────────────────

function SpecialtyFieldInput({
  field, value, onChange, onBlur, readOnly,
}: {
  field: SpecialtyField;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  readOnly?: boolean;
}) {
  const labelEl = (
    <label className="sf-label">
      {field.label}
      {field.unit && <span className="sf-unit">{field.unit}</span>}
    </label>
  );

  if (field.type === "select") {
    return (
      <div className="sf-field">
        {labelEl}
        <select
          className="form-select sf-input"
          value={value}
          disabled={readOnly}
          onChange={(e) => { onChange(e.target.value); onBlur(e.target.value); }}
        >
          <option value="">—</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="sf-field sf-field-full">
        {labelEl}
        <textarea
          className="form-input sf-input"
          rows={field.rows ?? 2}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          readOnly={readOnly}
        />
      </div>
    );
  }

  return (
    <div className="sf-field">
      {labelEl}
      <input
        className="form-input sf-input"
        type="text"
        inputMode={field.type === "number" ? "decimal" : "text"}
        /* Number fields: no example placeholder (it reads like a real value);
           text fields keep their descriptive hint. */
        placeholder={field.type === "number" ? undefined : field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  );
}

// ── Link-to-patient picker ──────────────────────────────────────────────────────

function LinkPatientModal({
  patients, apptName, onPick, onClose,
}: {
  patients: { id: string; firstName: string; lastName: string; phone?: string; dateOfBirth?: string }[];
  apptName: string;
  onPick: (p: { id: string; firstName: string; lastName: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Seed the search with the appointment's name so the likely match is on top.
  const [q, setQ] = useState(apptName.trim());
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = useMemo(() => {
    const needle = norm(q.trim());
    const list = needle
      ? patients.filter(p => norm(`${p.lastName} ${p.firstName} ${p.firstName} ${p.lastName} ${p.phone ?? ""}`).includes(needle))
      : patients;
    return list.slice(0, 50);
  }, [patients, q]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{t("apptDetail.linkTitle")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <input
            className="form-input"
            autoFocus
            placeholder={t("apptDetail.linkSearchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {patients.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>{t("apptDetail.linkNoPatients")}</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>{t("apptDetail.linkNoMatch")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="rv-press"
                  onClick={() => onPick(p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9,
                    background: "var(--surface)", cursor: "pointer", textAlign: "start",
                  }}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "var(--blue-soft)", color: "var(--blue)", fontWeight: 700,
                    display: "grid", placeItems: "center", fontSize: 13,
                  }}>
                    {(p.lastName[0] ?? p.firstName[0] ?? "?").toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, display: "block" }}>{fmtFullName(p)}</span>
                    {p.phone && <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.phone}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="invite-code-hint" style={{ marginTop: 10 }}>{t("apptDetail.linkHint")}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AppointmentDetailPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { apptId } = useParams<{ apptId: string }>();
  const navigate    = useNavigate();
  const location    = useLocation();
  const {
    appointments, patients, updateAppointment, deleteAppointment, addInvoice,
    addPatient, updatePatient, addAppointment, doctorProfile, setDoctorProfile, viewAsSecretary,
    examRequests, addExamRequest, updateExamRequest,
    apptDocuments, addApptDocument, deleteApptDocument,
    examResults, addExamResult, prescriptions,
    medicalReports, addMedicalReport, updateMedicalReport,
  } = useCabinet();
  const { addTransaction, deleteTransaction, transactions } = useApp();
  const toast = useToast();
  const readOnly = viewAsSecretary; // secretary (incl. doctor preview): view clinical notes, no clinical edits
  // A Moroccan secretary commonly takes the measurements, so vitals stay
  // editable for them when the doctor grants recordVitals (default on).
  const secretaryPerms = doctorProfile.secretaryPermissions ?? DEFAULT_SECRETARY_PERMISSIONS;
  const vitalsReadOnly = readOnly && !secretaryPerms.recordVitals;
  // Bilan clinique spécialisé / specialty fields hold MEASUREMENTS the
  // secretary commonly takes — editable with the same permission as vitals.
  // (The server only accepts extraFields from a secretary; the rest of the
  // clinical note stays doctor-only.)
  const bilanReadOnly = readOnly && !secretaryPerms.recordVitals;
  // Motif de consultation (reason for visit) is a front-desk field: the
  // secretary who checks the patient in usually records it. So it's editable
  // by the secretary too — the rest of the note (examen, diagnostic,
  // traitement) stays doctor-only. The server mirrors this: it accepts
  // consultationNote.motif from a secretary, nothing else beyond extraFields.
  const motifReadOnly = false;

  // Most recent prescription this patient already received — across other
  // appointments AND standalone ordonnances — so the doctor can one-click renew
  // for a returning / chronic patient.
  const lastRx = useMemo(() => {
    const cur = appointments.find((a) => a.id === apptId);
    if (!cur) return undefined;
    return findLastPrescription(
      { patientId: cur.patientId, patientName: cur.patientName, excludeApptId: apptId },
      prescriptions, appointments,
    );
  }, [appointments, prescriptions, apptId]);

  const appt = useMemo(
    () => appointments.find((a) => a.id === apptId),
    [appointments, apptId],
  );

  const patient = useMemo(
    () => appt?.patientId ? patients.find((p) => p.id === appt.patientId) : null,
    [patients, appt?.patientId],
  );

  // eGFR (CKD-EPI) is auto-computed from serum creatinine + the patient's age &
  // sex, so it only needs the doctor to enter the creatinine. Requires a known
  // sex (the formula is sex-specific) and a birth date.
  const patientAge = patient?.dateOfBirth ? calcAge(patient.dateOfBirth) : null;
  const patientSex: Sex | null =
    patient?.gender === "M" ? "male" : patient?.gender === "F" ? "female" : null;
  const canAutoDfg = patientAge != null && patientAge > 0 && patientSex != null;

  // ── Auto-computed (derived) fields ──────────────────────────────────────────
  // Fields that are computed from OTHER entered fields rather than measured, so
  // whenever their inputs are present they are (re)computed automatically and the
  // field is shown locked ("· auto"). eGFR is only included when the patient's
  // age + sex are known (the CKD-EPI formula needs them); VEMS/CVF ratio always.
  const numOf = (s?: string) => { const n = parseFloat(String(s ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
  const DERIVED_FIELDS: Record<string, { inputs: string[]; compute: (f: Record<string, string>) => number | null }> = {
    ...(canAutoDfg ? {
      bl_ren_dfg: { inputs: ["bl_ren_creat"], compute: (f) => ckdEpiFromMgL(f.bl_ren_creat ?? "", patientAge as number, patientSex as Sex) },
      dfg:        { inputs: ["creatinine"],   compute: (f) => ckdEpiFromMgL(f.creatinine ?? "", patientAge as number, patientSex as Sex) },
    } : {}),
    // Tiffeneau ratio = VEMS / CVF × 100 (%).
    ratio: { inputs: ["vems", "cvf"], compute: (f) => { const v = numOf(f.vems), c = numOf(f.cvf); return v != null && c != null && c > 0 ? Math.round((v / c) * 100) : null; } },
  };
  const isDerivedField = (key: string) => key in DERIVED_FIELDS;
  const derivedValue = (key: string, f: Record<string, string>): number | null =>
    isDerivedField(key) ? DERIVED_FIELDS[key].compute(f) : null;
  // Recompute every derived field for persistence. A derived key is set when it
  // can be computed, cleared when its inputs are present but no longer yield a
  // value, and left untouched when it has no inputs at all (never clobbers a
  // manually-entered value on a field the doctor is using directly).
  const deriveExtraFields = (f: Record<string, string>): Record<string, string> => {
    const out = { ...f };
    for (const key of Object.keys(DERIVED_FIELDS)) {
      const d = DERIVED_FIELDS[key];
      const v = d.compute(out);
      if (v != null) out[key] = String(v);
      else if (d.inputs.some((k) => (out[k] ?? "").trim() !== "")) delete out[key];
    }
    return out;
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"notes" | "vitals" | "history" | "suivi">("notes");

  // Keep every type this RDV has had during the session selectable, so
  // reclassifying (e.g. Suivi → Consultation) never drops the previous type's
  // pill — the doctor can always switch back. Without this, a non-standard type
  // (suivi/procédure/urgence on older records), once left, cannot be reselected.
  const [seenTypes, setSeenTypes] = useState<string[]>([]);

  // ── Clinical notes (local → auto-save on blur) ────────────────────────────
  const [motif,       setMotif]       = useState("");
  const [exam,        setExam]        = useState("");
  const [diag,        setDiag]        = useState("");
  const [treatment,   setTreatment]   = useState("");
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});

  // ── Vital signs ───────────────────────────────────────────────────────────
  const [bpSys,  setBpSys]  = useState("");
  const [bpDia,  setBpDia]  = useState("");
  const [hr,     setHr]     = useState("");
  const [temp,   setTemp]   = useState("");
  const [spo2,   setSpo2]   = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // ── Ordonnance modal ──────────────────────────────────────────────────────
  const [showOrd,  setShowOrd]  = useState(false);

  // ── Certificate modal ─────────────────────────────────────────────────────
  const [showCert, setShowCert] = useState(false);

  // ── Exam-request modal ────────────────────────────────────────────────────
  const [showExam, setShowExam] = useState(false);
  const apptExamRequests = useMemo(
    () => examRequests.filter(e => e.appointmentId === apptId),
    [examRequests, apptId],
  );

  // ── Medical report modal (compte rendu d'imagerie / rapport médical) ───────
  const [reportModal, setReportModal] = useState<null | { editId?: string }>(null);
  const apptReports = useMemo(
    () => medicalReports.filter(r => r.appointmentId === apptId),
    [medicalReports, apptId],
  );

  // ── Billing modal ─────────────────────────────────────────────────────────
  const [showBill,  setShowBill]  = useState(false);
  const [billItems,     setBillItems]     = useState<BillingLine[]>([]);
  const [billReduction, setBillReduction] = useState("");
  const [billCollected, setBillCollected] = useState("");   // cash taken at billing time
  // Recording a later instalment on an already-billed appointment
  const [showPay,    setShowPay]    = useState(false);
  const [payAmount,  setPayAmount]  = useState("");
  const [payMethod,  setPayMethod]  = useState<PaymentMethod>("cash");

  // ── Link-to-patient modal ─────────────────────────────────────────────────
  const [showLink, setShowLink] = useState(false);
  // Linking is a patient-data action: doctors always, secretaries only if granted.
  const canLink = !readOnly || secretaryPerms.editPatients;

  // New patients are often booked before their record exists. This creates the
  // record from the appointment's name (and online-booking phone, if any), then
  // attaches every still-unlinked appointment booked under that same name.
  const handleCreatePatientFromAppt = () => {
    if (!appt) return;
    // Names are written Moroccan-style (last name first), so the first token is
    // the family name and the remainder is the given name.
    const parts = appt.patientName.trim().split(/\s+/);
    const created = addPatient({
      lastName:  parts[0] ?? appt.patientName.trim(),
      firstName: parts.slice(1).join(" "),
      phone:     appt.bookingPhone || undefined,
    });
    const fullName = fmtFullName(created);
    const orphans = findOrphanAppts(appointments, appt.patientName);
    orphans.forEach(a => updateAppointment({ ...a, patientId: created.id, patientName: fullName || a.patientName }));
    toast(t("apptDetail.patientCreated", { count: orphans.length }), "success");
  };

  // ── Template selector ─────────────────────────────────────────────────────
  const [templateCat, setTemplateCat] = useState<string>("Général");
  const [showTemplates, setShowTemplates] = useState(false);

  // ── ICD-10 picker ─────────────────────────────────────────────────────────
  const [showIcd10, setShowIcd10] = useState(false);

  // ── Document attachments ──────────────────────────────────────────────────
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docSizeWarn, setDocSizeWarn] = useState(false);

  const apptDocs = useMemo(
    () => apptDocuments.filter(d => d.appointmentId === apptId),
    [apptDocuments, apptId],
  );
  // Radiology films/reports are attached under the "bilan radiologique" section
  // (see the notes flow); everything else stays in the generic attachments list.
  const radioDocs   = useMemo(() => apptDocs.filter(d => d.category === "radiologie"), [apptDocs]);
  const generalDocs = useMemo(() => apptDocs.filter(d => d.category !== "radiologie"), [apptDocs]);
  const radioFileRef = useRef<HTMLInputElement>(null);

  // Patient history edited in-flow (antécédents, médicaments en cours) — saved
  // back to the patient record so the doctor never leaves the appointment screen.
  const [antecedents, setAntecedents] = useState("");
  const [currentMeds, setCurrentMeds] = useState("");
  const [socialHistory, setSocialHistory] = useState("");

  // "Fixer le prochain rendez-vous" — schedule the follow-up RDV in-flow.
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("09:00");
  const [nextType, setNextType] = useState<string>("controle");

  const handleDocUpload = (category?: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    files.forEach(file => {
      const MB5 = 5 * 1024 * 1024;
      if (file.size > MB5) { setDocSizeWarn(true); return; }

      const storeDoc = (data: string, sizeBytes: number, mimeType: string) => {
        addApptDocument({
          appointmentId: apptId!,
          filename:      file.name,
          mimeType,
          sizeBytes,
          data,
          category,
          uploadedAt:    new Date().toISOString(),
        });
      };

      const reader = new FileReader();
      reader.onerror = () => setDocSizeWarn(true);
      reader.onload = ev => {
        const original = ev.target?.result as string;
        if (!original) { setDocSizeWarn(true); return; }

        if (file.type.startsWith("image/")) {
          // Try to compress images via canvas; fall back to the original bytes if
          // anything in the decode/encode pipeline fails (HEIC, tainted canvas,
          // oversized dimensions) so the attachment always lands on the first try.
          const storeOriginal = () => {
            const MB3 = 3 * 1024 * 1024;
            if (file.size > MB3) { setDocSizeWarn(true); return; }
            storeDoc(original, file.size, file.type || "image/jpeg");
          };
          const img = new Image();
          img.onload = () => {
            try {
              const MAX = 1200;
              let w = img.width, h = img.height;
              if (!w || !h) { storeOriginal(); return; }
              if (w > MAX || h > MAX) {
                const ratio = MAX / Math.max(w, h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
              }
              const canvas = document.createElement("canvas");
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (!ctx) { storeOriginal(); return; }
              ctx.drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL("image/jpeg", 0.78);
              if (!compressed || compressed.length < 100) { storeOriginal(); return; }
              storeDoc(compressed, Math.round(compressed.length * 0.75), "image/jpeg");
            } catch {
              storeOriginal();
            }
          };
          img.onerror = storeOriginal;
          img.src = original;
        } else {
          const MB2 = 2 * 1024 * 1024;
          if (file.size > MB2) { setDocSizeWarn(true); return; }
          storeDoc(original, file.size, file.type || "application/octet-stream");
        }
      };
      reader.readAsDataURL(file);
    });
  };

  function fmtBytes(n: number): string {
    if (n < 1024)       return n + " o";
    if (n < 1024*1024)  return (n / 1024).toFixed(0) + " Ko";
    return (n / (1024*1024)).toFixed(1) + " Mo";
  }

  function docIcon(mime: string): string {
    if (mime.startsWith("image/"))            return "🖼️";
    if (mime === "application/pdf")           return "📄";
    if (mime.includes("word") || mime.includes("document")) return "📝";
    return "📎";
  }

  const renderDocRow = (doc: (typeof apptDocuments)[number]) => (
    <div key={doc.id} className="appt-doc-row">
      <span className="appt-doc-icon">{docIcon(doc.mimeType)}</span>
      <div className="appt-doc-info">
        <div className="appt-doc-name">
          <AttachmentLink doc={doc} download={!doc.mimeType.startsWith("image/")} className="appt-doc-link">{doc.filename}</AttachmentLink>
        </div>
        <div className="appt-doc-meta">
          {fmtBytes(doc.sizeBytes)} · {new Date(doc.uploadedAt).toLocaleDateString(locale)}
          {doc.label && <span className="appt-doc-label"> · {doc.label}</span>}
        </div>
      </div>
      <button
        className="appt-doc-delete"
        title={t("common.delete")}
        onClick={async () => { if (await confirmDialog(t("apptDetail.deleteFileConfirm", { name: doc.filename }))) deleteApptDocument(doc.id); }}
      >
        ×
      </button>
    </div>
  );

  // ── Consultation timer ────────────────────────────────────────────────────
  const [timerRunning, setTimerRunning]   = useState(false);
  const [timerSeconds, setTimerSeconds]   = useState(0);
  // Custom (free-form) measures — edited locally, persisted on blur/add/remove.
  const [customLocal, setCustomLocal] = useState<CustomMeasure[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);
  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };
  const stopAndSaveTimer = () => {
    setTimerRunning(false);
    if (timerSeconds > 0 && appt) {
      updateAppointment({ ...appt, consultationDuration: timerSeconds });
    }
  };

  // Sync state from appointment
  useEffect(() => {
    if (!appt) return;
    const n = appt.consultationNote ?? {};
    setMotif(n.motif ?? "");
    setExam(n.examination ?? "");
    setDiag(n.diagnosis ?? "");
    setTreatment(n.treatment ?? "");
    setExtraFields(n.extraFields ?? {});
    const vs = appt.vitalSigns ?? {};
    setBpSys(vs.bpSys != null ? String(vs.bpSys) : "");
    setBpDia(vs.bpDia != null ? String(vs.bpDia) : "");
    setHr(vs.hr != null ? String(vs.hr) : "");
    setTemp(vs.temp != null ? String(vs.temp) : "");
    setSpo2(vs.spo2 != null ? String(vs.spo2) : "");
    setWeight(vs.weight != null ? String(vs.weight) : "");
    setHeight(vs.height != null ? String(vs.height) : "");
    setCustomLocal(appt.customMeasures ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id]);

  // Remember every type this appointment takes on while open (see seenTypes).
  useEffect(() => {
    if (!appt) return;
    setSeenTypes((prev) => (prev.includes(appt.type) ? prev : [...prev, appt.type]));
  }, [appt?.type]);

  // Load the patient's history fields into the in-flow editors.
  useEffect(() => {
    setAntecedents(patient?.antecedents ?? "");
    setCurrentMeds(patient?.currentMedications ?? "");
    setSocialHistory(patient?.socialHistory ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  // Auto-open the bill editor when arriving from Facturation → "Corriger la facture"
  // (the list passes { openBill: true } in the navigation state). Held in a ref so
  // this hook can sit above the early return without depending on openBillModal.
  const openBillRef = useRef<() => void>(() => {});
  const billAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (!appt || billAutoOpenedRef.current) return;
    const st = location.state as { openBill?: boolean } | null;
    if (st?.openBill && appt.billedAt && !readOnly) {
      billAutoOpenedRef.current = true;
      openBillRef.current();
      navigate(location.pathname, { replace: true });   // clear state so it won't reopen
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id, location.state, readOnly]);

  if (!appt) {
    return (
      <Layout title={t("apptDetail.notFound")} subtitle="">
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("apptDetail.notFound")}</div>
          <button className="btn btn-primary" onClick={() => navigate("/agenda")}>
            {t("apptDetail.backLink")}
          </button>
        </div>
      </Layout>
    );
  }

  // ── Save helpers ──────────────────────────────────────────────────────────

  const saveNotes = (overrideExtra?: Record<string, string>) => {
    const ef = overrideExtra ?? extraFields;
    const nonEmptyExtra = Object.fromEntries(
      Object.entries(ef).filter(([, v]) => v.trim() !== ""),
    );
    const note: ConsultationNote = {
      motif:        motif.trim()     || undefined,
      examination:  exam.trim()      || undefined,
      diagnosis:    diag.trim()      || undefined,
      treatment:    treatment.trim() || undefined,
      extraFields:  Object.keys(nonEmptyExtra).length ? nonEmptyExtra : undefined,
    };
    updateAppointment({ ...appt, consultationNote: note });
  };

  // Persist a patient-history field (antécédents / médicaments en cours) back to
  // the patient record, so it carries across every visit.
  const savePatientField = (patch: Partial<Patient>) => {
    if (patient) updatePatient({ ...patient, ...patch });
  };

  // Schedule the next appointment straight from the consultation, without
  // leaving the screen. Defaults to a 30-minute slot of the chosen type.
  const scheduleNextAppt = () => {
    if (!nextDate) return;
    const [hh, mm] = nextTime.split(":").map((n) => parseInt(n, 10) || 0);
    const endTotal = hh * 60 + mm + 30;
    const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
    addAppointment({
      patientId:   appt.patientId,
      patientName: appt.patientName,
      date:        nextDate,
      startTime:   nextTime,
      endTime,
      type:        nextType,
      status:      "scheduled",
    });
    updateAppointment({ ...appt, followUpDate: nextDate });
    setNextDate("");
    toast(t("apptDetail.nextApptCreated"));
  };

  // Append a dictated phrase to a clinical-note field and persist immediately
  // (the mic button never fires the textarea's onBlur autosave).
  const dictateInto = (
    key: "motif" | "examination" | "diagnosis" | "treatment",
    setter: (s: string) => void,
    current: string,
  ) => (text: string) => {
    const merged = (current.trim() ? current.replace(/\s+$/, "") + " " : "") + text;
    setter(merged);
    const nonEmptyExtra = Object.fromEntries(
      Object.entries(extraFields).filter(([, v]) => v.trim() !== ""),
    );
    const note: ConsultationNote = {
      motif:       motif.trim()     || undefined,
      examination: exam.trim()      || undefined,
      diagnosis:   diag.trim()      || undefined,
      treatment:   treatment.trim() || undefined,
      extraFields: Object.keys(nonEmptyExtra).length ? nonEmptyExtra : undefined,
    };
    note[key] = merged.trim() || undefined;
    updateAppointment({ ...appt, consultationNote: note });
  };

  const setExtraField = (key: string, value: string) => {
    setExtraFields((prev) => ({ ...prev, [key]: value }));
  };

  const saveExtraField = (key: string, value: string) => {
    // Recompute all derived fields (eGFR, VEMS/CVF ratio…) from the new inputs.
    const updated = deriveExtraFields({ ...extraFields, [key]: value });
    setExtraFields(updated);
    saveNotes(updated);
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

  const applyTemplate = (tpl: { motif?: string; examination?: string; diagnosis?: string; treatment?: string }) => {
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

  // ── Doctor's own note templates (stored on the synced doctorProfile) ──────
  const myTemplates = doctorProfile.noteTemplates ?? [];

  const saveCurrentAsTemplate = () => {
    if (!motif.trim() && !exam.trim() && !diag.trim() && !treatment.trim()) {
      toast(t("apptDetail.tplEmptyNote"), "warning");
      return;
    }
    const label = window.prompt(t("apptDetail.tplNamePrompt"));
    if (!label || !label.trim()) return;
    const tpl: CustomNoteTemplate = {
      id: `ntpl_${Date.now()}`,
      label: label.trim(),
      motif: motif.trim() || undefined,
      examination: exam.trim() || undefined,
      diagnosis: diag.trim() || undefined,
      treatment: treatment.trim() || undefined,
    };
    setDoctorProfile({ ...doctorProfile, noteTemplates: [...myTemplates, tpl] });
    toast(t("apptDetail.tplSaved", { name: tpl.label }), "success");
  };

  const deleteMyTemplate = async (id: string) => {
    if (!await confirmDialog(t("apptDetail.tplDeleteConfirm"))) return;
    setDoctorProfile({ ...doctorProfile, noteTemplates: myTemplates.filter(x => x.id !== id) });
  };

  // ── Extra bilan groups (any specialty) ────────────────────────────────────
  // Two sources are merged: the doctor's profile-level default set (shows on
  // every appointment, editable only by the doctor since it needs the profile
  // sync) and per-appointment additions (ride the appointment sync, so a
  // secretary can add a bilan and fill in the measurements at the desk).
  // Until the doctor saves a preferred set, default to the bilans relevant to
  // their specialty (keeps the screen focused instead of showing all 18).
  // Every measure group — the specialty EXAM groups AND the lab/imaging bilans —
  // is one addable, keyed group. Specialty groups carry a "spec:" key. Nothing
  // specialty-specific shows by default; the doctor/secretary adds what they need
  // into either section, and the doctor can save the arrangement as their default.
  const specGroupDefs = getSpecialtyGroups(doctorProfile.specialtyLabel)
    .map(g => ({ key: `spec:${g.title}`, title: g.title, fields: g.fields }));
  const bilanGroupDefs = BILAN_CATALOG.map(b => ({ key: b.key, title: b.title, fields: b.fields }));
  const allGroupDefs = [...bilanGroupDefs, ...specGroupDefs];

  const specialtyRelevant = getSpecialtyBilans(doctorProfile.specialtyLabel);
  const profileGroupKeys = doctorProfile.extraBilans ?? DEFAULT_BILANS;
  const apptGroupKeys    = appt.extraBilans ?? [];
  const enabledKeys      = new Set([...profileGroupKeys, ...apptGroupKeys]);
  const enabledGroups    = allGroupDefs.filter(g => enabledKeys.has(g.key));
  // Groups not yet shown — offered in the "+ ajouter" menu, specialty-relevant first.
  const availableGroups  = allGroupDefs
    .filter(g => !enabledKeys.has(g.key))
    .sort((a, b) => {
      const ai = specialtyRelevant.indexOf(a.key), bi = specialtyRelevant.indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  // ── Patient history, surfaced in-screen so the doctor never opens the patient
  // file mid-consultation. Plain consts (not hooks) — computed after the appt
  // guard above, so they must stay out of the hook list. ──────────────────────
  const pid = appt.patientId;
  // History = the patient's OTHER consultations, split into past (most-recent
  // first) and upcoming (soonest first). Today's other visits count as past.
  const historyTodayIso = todayIso();
  const historyApptsAll = pid ? appointments.filter(a => a.patientId === pid && a.id !== appt.id) : [];
  const historyAppts = historyApptsAll
    .filter(a => a.date <= historyTodayIso)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startTime || "").localeCompare(a.startTime || ""));
  const futureAppts = historyApptsAll
    .filter(a => a.date > historyTodayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""));
  const historyExams = pid
    ? examResults.filter(e => e.patientId === pid).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const historyRx = pid
    ? prescriptions.filter(p => p.patientId === pid).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const historyCount = historyAppts.length + futureAppts.length + historyExams.length + historyRx.length;

  // ── Two-section split (bilanSource) + custom measures ───────────────────────
  // Which section a group sits in: this appointment's choice, else the doctor's
  // saved preference, else a sensible default (specialty exam → "Mesures du jour",
  // lab/imaging bilan → "Résultats"). Either can be moved with the ⇄ toggle.
  const bilanSourceFor = (key: string): "office" | "external" =>
    appt.bilanSource?.[key] ?? doctorProfile.bilanSourcePrefs?.[key]
      ?? (key.startsWith("spec:") ? "office" : "external");
  const setBilanSource = (key: string, src: "office" | "external") =>
    updateAppointment({ ...appt, bilanSource: { ...(appt.bilanSource ?? {}), [key]: src } });

  const persistCustom = (list: CustomMeasure[]) =>
    updateAppointment({ ...appt, customMeasures: list.filter(m => m.label.trim() || m.value.trim()) });
  const addCustomMeasure = (source: "office" | "external", groupKey?: string) =>
    setCustomLocal(prev => [...prev, { id: Math.random().toString(36).slice(2, 9), label: "", value: "", unit: "", source, groupKey }]);
  const editCustomMeasure = (id: string, patch: Partial<CustomMeasure>) =>
    setCustomLocal(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  const removeCustomMeasure = (id: string) =>
    setCustomLocal(prev => { const next = prev.filter(m => m.id !== id); persistCustom(next); return next; });

  // Collapse bilan/specialty groups to keep the screen short — every group starts
  // CLOSED (only vital signs are shown expanded); the doctor opens what they need.
  // A green dot on a closed group flags that it already holds values.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groupHasValue = (fields: SpecialtyField[], groupKey: string) =>
    fields.some(f => (extraFields[f.key] ?? "").trim() !== "") ||
    customLocal.some(m => m.groupKey === groupKey && (m.label.trim() !== "" || m.value.trim() !== ""));
  const isGroupOpen = (groupKey: string) => openGroups[groupKey] ?? false;
  const toggleGroup = (groupKey: string) =>
    setOpenGroups(prev => ({ ...prev, [groupKey]: !(prev[groupKey] ?? false) }));

  // Custom measures attached to a specific group ("add a measure in each bilan").
  const renderCustomMeasures = (groupKey: string, source: "office" | "external") => {
    const rows = customLocal.filter(m => m.groupKey === groupKey);
    return (
      <>
        {rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {rows.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input className="form-input" style={{ flex: 2 }} placeholder={t("apptDetail.measureLabel")}
                  value={m.label} readOnly={bilanReadOnly}
                  onChange={(e) => editCustomMeasure(m.id, { label: e.target.value })} onBlur={() => persistCustom(customLocal)} />
                <input className="form-input" style={{ flex: 1, minWidth: 60 }} placeholder={t("apptDetail.measureValue")}
                  value={m.value} readOnly={bilanReadOnly}
                  onChange={(e) => editCustomMeasure(m.id, { value: e.target.value })} onBlur={() => persistCustom(customLocal)} />
                <input className="form-input" style={{ width: 70 }} placeholder={t("apptDetail.measureUnit")}
                  value={m.unit ?? ""} readOnly={bilanReadOnly}
                  onChange={(e) => editCustomMeasure(m.id, { unit: e.target.value })} onBlur={() => persistCustom(customLocal)} />
                {!bilanReadOnly && (
                  <button type="button" className="appt-doc-delete" title={t("common.delete")} onClick={() => removeCustomMeasure(m.id)}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
        {!bilanReadOnly && (
          <button type="button" className="ord-add-btn" style={{ marginTop: 6, fontSize: 12 }} onClick={() => addCustomMeasure(source, groupKey)}>
            + {t("apptDetail.addMeasure")}
          </button>
        )}
      </>
    );
  };

  // Add a group (bilan or specialty exam) to a chosen section. Both roles add at
  // the appointment level; a secretary can't write the doctor profile, and the
  // doctor promotes the arrangement to their default via "save preferred".
  const addGroup = (key: string, source: "office" | "external") => {
    if (!key || enabledKeys.has(key)) return;
    updateAppointment({
      ...appt,
      extraBilans: [...apptGroupKeys, key],
      bilanSource: { ...(appt.bilanSource ?? {}), [key]: source },
    });
  };
  const removeGroup = (key: string) => {
    if (apptGroupKeys.includes(key)) {
      updateAppointment({ ...appt, extraBilans: apptGroupKeys.filter(k => k !== key) });
    }
    if (!readOnly && profileGroupKeys.includes(key)) {
      setDoctorProfile({ ...doctorProfile, extraBilans: profileGroupKeys.filter(k => k !== key) });
    }
  };
  const canRemoveGroup = (key: string) =>
    apptGroupKeys.includes(key) || (!readOnly && profileGroupKeys.includes(key));
  // Save the current groups + their sections as the doctor's default for every
  // future visit (doctor only — it writes the profile).
  const savePreferred = () => {
    if (readOnly) return;
    const prefs: Record<string, "office" | "external"> = {};
    enabledGroups.forEach(g => { prefs[g.key] = bilanSourceFor(g.key); });
    setDoctorProfile({ ...doctorProfile, extraBilans: [...enabledKeys], bilanSourcePrefs: prefs });
    toast(t("apptDetail.preferredSaved"), "success");
  };

  const handleStatusChange = (s: AppointmentStatus) => {
    updateAppointment({ ...appt, status: s });
  };

  // ── Itemized billing ──────────────────────────────────────────────────────
  const billSubtotal   = calcSubtotal(billItems);              // gross (before discounts)
  const billLineDisc   = billLineDiscounts(billItems);         // sum of per-act discounts
  const billReductionN = Math.max(0, parseFloat(billReduction.replace(",", ".")) || 0);
  const billTotal      = billNet(billItems, billReductionN);   // net: lines − discounts − global
  const billCollectedN = Math.min(billTotal, Math.max(0, parseFloat(billCollected.replace(",", ".")) || 0));
  const billRemaining  = Math.max(0, billTotal - billCollectedN);
  const pay = paymentSummary(appt);

  const openBillModal = () => {
    let total: number;
    if (appt.billedItems && appt.billedItems.length) {
      setBillItems(appt.billedItems.map(l => ({ ...l })));
      setBillReduction(appt.billedReduction ? String(appt.billedReduction) : "");
      total = billNet(appt.billedItems, appt.billedReduction ?? 0);
    } else if (appt.preparedItems && appt.preparedItems.length) {
      // The doctor already composed the bill — the secretary only collects.
      setBillItems(appt.preparedItems.map(l => ({ ...l })));
      setBillReduction(appt.preparedReduction ? String(appt.preparedReduction) : "");
      total = billNet(appt.preparedItems, appt.preparedReduction ?? 0);
    } else {
      const base = doctorProfile.appointmentPrices?.[appt.type] ?? appt.billedAmount ?? 200;
      setBillItems([{ label: apptTypeLabel(appt.type), qty: 1, unitPrice: Number(base) || 0 }]);
      setBillReduction("");
      total = Number(base) || 0;
    }
    // Default to collecting the full amount; the secretary lowers it if the
    // patient pays part now and defers the rest. When correcting an already-billed
    // facture, pre-fill with what was actually collected.
    setBillCollected(String(Math.max(0, appt.billedAt ? (appt.paidAmount ?? total) : total)));
    setShowBill(true);
  };
  openBillRef.current = openBillModal;   // keep the ref current for the auto-open effect

  // Doctor saves the composed bill WITHOUT collecting — the secretary handles
  // encaissement (payment / partial / deferred) at the front desk.
  // Normalize a bill line for persistence, preserving the optional per-act remise.
  const cleanLine = (l: BillingLine): BillingLine => {
    const out: BillingLine = {
      label: l.label.trim(),
      qty: Math.max(1, Math.round(l.qty) || 1),
      unitPrice: Number(l.unitPrice) || 0,
    };
    if (l.remise && l.remise > 0) { out.remise = l.remise; out.remiseType = l.remiseType ?? "mad"; }
    return out;
  };

  const handlePrepareBill = () => {
    const items = billItems.map(cleanLine).filter(l => l.label.length > 0);
    if (items.length === 0) return;
    updateAppointment({
      ...appt,
      preparedItems: items,
      preparedReduction: billReductionN > 0 ? billReductionN : undefined,
    });
    toast(t("apptDetail.billPreparedToast"), "success");
    setShowBill(false);
  };

  const addBillLine = (line: BillingLine) => setBillItems(prev => [...prev, line]);
  const updateBillLine = (i: number, patch: Partial<BillingLine>) =>
    setBillItems(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeBillLine = (i: number) => setBillItems(prev => prev.filter((_, idx) => idx !== i));

  // Reconcile ledger income for a bill correction so it never duplicates. Removes
  // the ledger rows this appointment auto-created (the linked bill txn + any of ITS
  // instalment rows, matched by exact auto-description so manual entries are never
  // touched) and reposts a single row for the corrected cash. Returns the new txn id
  // to store. Secretaries never write the doctor's ledger (handled by the derived view).
  const reconcileBillTxn = (collected: number): string | undefined => {
    const cat = appt.type === "procedure" ? "acte_chirurgical" : "consultation";
    const desc = `${apptTypeLabel(appt.type)} – ${appt.patientName}`;
    const payDesc = `${t("apptDetail.payLedgerNote")} – ${appt.patientName}`;
    const toRemove = new Set<string>();
    if (appt.billTxnId) toRemove.add(appt.billTxnId);
    for (const x of transactions) {
      if (x.type === "RECETTE" && x.date === appt.date && (x.description === desc || x.description === payDesc)) {
        toRemove.add(x.id);
      }
    }
    toRemove.forEach((id) => deleteTransaction(id));
    if (!viewAsSecretary && collected > 0) {
      return addTransaction({ type: "RECETTE", amount: collected, date: appt.date, category: cat,
        deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1, description: desc });
    }
    return undefined;
  };

  const handleBill = () => {
    const correcting = !!appt.billedAt;   // opened via "Corriger" on a billed facture
    const items = billItems.map(cleanLine).filter(l => l.label.length > 0);
    if (items.length === 0) return;
    // 0 MAD is a valid bill (free consultation): stamped billed, no ledger entry.
    const total = billNet(items, billReductionN);
    // The patient may pay all, part, or none of it now — the rest is deferred.
    const collected = Math.min(total, Math.max(0, parseFloat(billCollected.replace(",", ".")) || 0));
    const now = new Date().toISOString();
    // Ledger income: reconcile it on a correction (no duplicate); otherwise credit
    // the cash actually received. Secretaries never write the doctor's ledger.
    let billTxnId: string | undefined;
    if (correcting) {
      billTxnId = reconcileBillTxn(collected);
    } else if (!viewAsSecretary && collected > 0) {
      billTxnId = addTransaction({
        type: "RECETTE", amount: collected, date: appt.date,
        category: appt.type === "procedure" ? "acte_chirurgical" : "consultation",
        deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1,
        description: `${apptTypeLabel(appt.type)} – ${appt.patientName}`,
      });
    }
    updateAppointment({
      ...appt,
      billedAt: appt.billedAt ?? now,   // keep the original billing date on a correction
      billedAmount: total,
      billedItems: items,
      billedReduction: billReductionN > 0 ? billReductionN : undefined,
      paidAmount: collected,
      payments: collected > 0 ? [{ amount: collected, date: now, method: "cash" }] : [],
      billTxnId,
      // The prepared bill is consumed once invoiced (null survives JSON so the
      // secretary's merge-push actually clears it on the server).
      preparedItems: null,
      preparedReduction: null,
    });
    setShowBill(false);
    if (correcting) toast(t("apptDetail.factureCorrected"));
  };

  // Record a later instalment on an already-billed appointment.
  const openPayModal = () => {
    const { balance } = paymentSummary(appt);
    setPayAmount(String(balance));
    setPayMethod("cash");
    setShowPay(true);
  };

  const handlePay = () => {
    const { paid, balance } = paymentSummary(appt);
    const amount = Math.min(balance, Math.max(0, parseFloat(payAmount.replace(",", ".")) || 0));
    if (amount <= 0) return;
    const now = new Date().toISOString();
    if (!viewAsSecretary) {
      addTransaction({
        type: "RECETTE", amount, date: appt.date.slice(0, 10),
        category: appt.type === "procedure" ? "acte_chirurgical" : "consultation",
        deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1,
        description: `${t("apptDetail.payLedgerNote")} – ${appt.patientName}`,
      });
    }
    updateAppointment({
      ...appt,
      paidAmount: paid + amount,
      payments: [...(appt.payments ?? []), { amount, date: now, method: payMethod }],
    });
    setShowPay(false);
  };

  const handleDelete = async () => {
    if (!await confirmDialog(t("apptDetail.deleteConfirm", { name: appt.patientName }))) return;
    const backDate = appt.date;
    deleteAppointment(appt.id);
    navigate(`/agenda?d=${backDate}`);
  };

  // ── BMI ───────────────────────────────────────────────────────────────────
  const bmi = (() => {
    const w = parseFloat(weight), h = parseFloat(height);
    if (!w || !h || h <= 0) return null;
    return w / ((h / 100) ** 2);
  })();
  const bmiClass = bmi === null ? null : bmiClassify(bmi);
  const bmiLabel = bmiClass?.label ?? null;

  const typeColor   = apptTypeColor(appt.type);
  const hasNotes    = motif || exam || diag || treatment || Object.keys(extraFields).some((k) => extraFields[k]?.trim());
  const templatesByCat = NOTE_TEMPLATES.filter((t) => t.category === templateCat);

  const handleTypeChange = (newType: string) => {
    updateAppointment({ ...appt, type: newType });
  };

  // The reclassify pills always offer the three core types (so any RDV can be
  // set to Consultation/Contrôle/Autre), plus any legacy/other type this RDV has
  // carried this session. `hiddenConsultationTypes` only trims the *new-RDV*
  // form — it must not remove a target you may need to reclassify to.
  const visibleTypes = Array.from(new Set<string>([
    ...STANDARD_TYPES,
    ...resolveApptTypes().map((rt) => rt.id),
    ...seenTypes,
    appt.type,
  ]));

  // Flatten every enabled group's fields, then keep only the ones that hold a
  // value — this is the compact "results" list the doctor reads at a glance.
  const bilanFieldList = enabledGroups.flatMap(g =>
    g.fields.map(f => ({ field: f, groupTitle: g.title })),
  );
  const filledBilan = bilanFieldList.filter(x => (extraFields[x.field.key] ?? "").trim() !== "");

  // Group the filled measures by their actual bilan/exam type, so the Notes
  // summary labels each block (e.g. "Bilan rénal", "Bilan thyroïdien") instead
  // of lumping everything under one "biologique & radiologique" heading.
  const groupedBilan = (() => {
    const map = new Map<string, typeof filledBilan>();
    for (const item of filledBilan) {
      const arr = map.get(item.groupTitle) ?? [];
      arr.push(item);
      map.set(item.groupTitle, arr);
    }
    return Array.from(map, ([title, items]) => ({ title, items }));
  })();

  // Read-only summaries shown in the Notes flow (entry lives in Mesures & bilan).
  const vitalsChips: { label: string; value: string }[] = (() => {
    const vs = appt.vitalSigns; const out: { label: string; value: string }[] = [];
    if (!vs) return out;
    if (vs.bpSys != null && vs.bpDia != null) out.push({ label: t("apptDetail.bpGroup"),     value: `${vs.bpSys}/${vs.bpDia} mmHg` });
    if (vs.hr     != null) out.push({ label: t("apptDetail.hrLabel"),     value: `${vs.hr} bpm` });
    if (vs.temp   != null) out.push({ label: t("apptDetail.tempLabel"),   value: `${vs.temp} °C` });
    if (vs.spo2   != null) out.push({ label: t("apptDetail.spo2Label"),   value: `${vs.spo2} %` });
    if (vs.weight != null) out.push({ label: t("apptDetail.weightLabel"), value: `${vs.weight} kg` });
    if (vs.height != null) out.push({ label: t("apptDetail.heightLabel"), value: `${vs.height} cm` });
    if (bmi != null)       out.push({ label: "IMC", value: bmi.toFixed(1) + (bmiLabel ? ` · ${bmiLabel}` : "") });
    return out;
  })();
  const customFilled = customLocal.filter(m => m.label.trim() || m.value.trim());

  // Link the two "results" surfaces: push the measures/bilan entered here into a
  // structured Examens & Bio record, so the doctor enters lab values ONCE. Pulls
  // every filled bilan field + custom measure (value + unit) into an ExamResult.
  const saveBilanAsExamResult = () => {
    const values = [
      ...filledBilan.map(({ field }) => ({ label: field.label, value: String(extraFields[field.key] ?? ""), unit: field.unit })),
      ...customFilled.map(m => ({ label: m.label, value: m.value, unit: m.unit || undefined })),
    ].filter(v => v.label.trim() && v.value.trim());
    if (!values.length) return;
    addExamResult({
      patientId:   appt.patientId,
      patientName: appt.patientName,
      type:        "biologie",
      date:        appt.date,
      title:       t("apptDetail.bilanExamTitle", { date: formatDateShort(appt.date) }),
      values,
    });
    toast(t("apptDetail.bilanSavedAsExam", { n: values.length }), "success");
  };

  return (
    <Layout
      title={appt.patientName}
      subtitle={`${fmtDate(appt.date, locale)} · ${appt.startTime} → ${appt.endTime}`}
    >
      {/* ── Back link — returns to the week containing this appointment so the
           doctor lands where they were, not on today. ── */}
      <div style={{ marginBottom: 16 }}>
        <Link to={`/agenda?d=${appt.date}`} className="appt-back-link">
          {t("apptDetail.backLink")}
        </Link>
      </div>

      {/* ── Header card ── */}
      <div className="appt-detail-header">
        <div className="appt-detail-meta">
          {/* Inline consultation type selector */}
          <div className="appt-type-pills" title={t("apptDetail.typeLabel")}>
            {visibleTypes.map((type) => {
              const c = apptTypeColor(type);
              const active = appt.type === type;
              return (
                <button
                  key={type}
                  className={`appt-type-pill${active ? " active" : ""}`}
                  style={active ? { background: c + "20", color: c, borderColor: c } : undefined}
                  onClick={() => handleTypeChange(type)}
                  type="button"
                >
                  {apptTypeLabel(type)}
                </button>
              );
            })}
          </div>
          {appt.billedAt && (
            <span className="appt-detail-billed-badge">{t("apptDetail.billedBadge")}</span>
          )}
          {!appt.billedAt && (appt.preparedItems?.length ?? 0) > 0 && (
            <span className="appt-detail-billed-badge" style={{ background: "var(--gold-soft, #FBF3E0)", color: "var(--gold, #D4962A)" }}>
              {t("apptDetail.billPreparedBadge")}
            </span>
          )}
          {appt.bookingSource === "online" && (
            <span className="appt-online-badge" title={appt.bookingPhone || ""}>🌐 {t("apptDetail.onlineBadge")}</span>
          )}
          {patient ? (
            <>
              <Link to={`/patients/${patient.id}`} className="appt-detail-patient-link">
                {t("apptDetail.patientFile")}
              </Link>
              {canLink && (
                <button
                  type="button"
                  className="appt-detail-unlink-btn"
                  onClick={() => updateAppointment({ ...appt, patientId: undefined })}
                  title={t("apptDetail.unlinkTitle")}
                >
                  {t("apptDetail.unlink")}
                </button>
              )}
            </>
          ) : (
            canLink && (
              <div className="appt-detail-patient-actions">
                <button
                  type="button"
                  className="appt-detail-create-btn"
                  onClick={handleCreatePatientFromAppt}
                  title={t("apptDetail.createPatientTitle")}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M7 3.5v7M3.5 7h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  {t("apptDetail.createPatient")}
                </button>
                <button
                  type="button"
                  className="appt-detail-link-btn"
                  onClick={() => setShowLink(true)}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M5.5 8.5l3-3M6 4l.7-.7a2.3 2.3 0 0 1 3.3 3.3l-.7.7M8 10l-.7.7a2.3 2.3 0 0 1-3.3-3.3l.7-.7"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t("apptDetail.linkPatient")}
                </button>
              </div>
            )
          )}
        </div>

        <div className="appt-detail-status-row">
          <span className="appt-detail-status-label">{t("apptDetail.statusLabel")}</span>
          <select
            className="appt-detail-status-select"
            value={appt.status}
            onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus)}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>{APPT_STATUS_LABELS[s]}</option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {!readOnly && <>
            {/* Consultation timer */}
            <div className="consult-timer" title={appt.consultationDuration ? t("apptDetail.lastDuration", { d: fmtTimer(appt.consultationDuration) }) : t("apptDetail.timerTitle")}>
              <span className="consult-timer-display" style={{ color: timerRunning ? "var(--green)" : undefined }}>
                ⏱ {timerSeconds > 0 ? fmtTimer(timerSeconds) : appt.consultationDuration ? fmtTimer(appt.consultationDuration) : "00:00"}
              </span>
              {!timerRunning ? (
                <button className="btn btn-ghost consult-timer-btn" onClick={() => setTimerRunning(true)} style={{ fontSize: 11 }}>
                  ▶
                </button>
              ) : (
                <button className="btn btn-ghost consult-timer-btn" onClick={stopAndSaveTimer} style={{ fontSize: 11, color: "var(--coral)" }}>
                  ■
                </button>
              )}
            </div>
            <button
              className="btn btn-ghost ord-open-btn"
              onClick={() => setShowOrd(true)}
              title={appt.savedOrdonnance ? t("apptDetail.reprOrd") : t("apptDetail.newOrd")}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 5 }}>
                <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 5h4M5 7.5h4M5 10h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {t("apptDetail.prescription")}
              {appt.savedOrdonnance && (
                <span className="ord-saved-dot" />
              )}
            </button>
            <button
              className="btn btn-ghost ord-open-btn"
              onClick={() => setShowCert(true)}
              title={t("apptDetail.certTitle")}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 5 }}>
                <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M10 2v3h3M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {t("apptDetail.certificate")}
              {(appt.savedCertificates?.length ?? 0) > 0 && (
                <span className="ord-saved-dot" />
              )}
            </button>
            <button
              className="btn btn-ghost ord-open-btn"
              onClick={() => setShowExam(true)}
              title={t("examReq.titleShort")}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 5 }}>
                <path d="M6 1.5v4.2L2.6 12a1.4 1.4 0 0 0 1.2 2.1h8.4A1.4 1.4 0 0 0 13.4 12L10 5.7V1.5"
                  stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M6 1.5h4M5.2 9h5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {t("examReq.btn")}
              {apptExamRequests.length > 0 && (
                <span className="ord-saved-dot" />
              )}
            </button>
            <button
              className="btn btn-ghost ord-open-btn"
              onClick={() => setReportModal({})}
              title={t("medReport.btnTitle")}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 5 }}>
                <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M10 2v3h3M5.6 12.4a2.9 2.9 0 0 1 4.8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {t("medReport.btn")}
              {apptReports.length > 0 && (
                <span className="ord-saved-dot" />
              )}
            </button>
            {!appt.billedAt && (
              <button className="btn btn-primary" style={{ background: "var(--green)" }}
                onClick={openBillModal}>
                {t("apptDetail.bill")}
              </button>
            )}
            <button className="btn btn-ghost" style={{ color: "var(--coral)", borderColor: "var(--coral)" }}
              onClick={handleDelete}>
              {t("apptDetail.deleteBtn")}
            </button>
            </>}
            {/* Secretary (read-only clinically) may still bill at the front desk. */}
            {readOnly && secretaryPerms.handleBilling && !appt.billedAt && (
              <button className="btn btn-primary" style={{ background: "var(--green)" }}
                onClick={openBillModal}>
                {t("apptDetail.bill")}
              </button>
            )}
            {/* Secretaries manage the schedule: deleting an appointment is allowed. */}
            {readOnly && (
              <button className="btn btn-ghost" style={{ color: "var(--coral)", borderColor: "var(--coral)" }}
                onClick={handleDelete}>
                {t("apptDetail.deleteBtn")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Persistent patient medical context ──
          Shown above every tab so the doctor always has the safety-critical
          clinical facts in view while working — allergies first (EHR "patient
          banner" pattern), then durable antécédents and traitement de fond. All
          the standing medical information, on the medical screen, at all times. */}
      {patient && (
        <div className="appt-med-banner">
          <div className="appt-med-demo">
            {patientAge != null && <span className="appt-med-demo-item">{t("apptDetail.ageYears", { n: patientAge })}</span>}
            {patient.gender && <span className="appt-med-demo-item">{patient.gender === "M" ? t("apptDetail.sexM") : t("apptDetail.sexF")}</span>}
            {patient.bloodType && <span className="appt-med-demo-item appt-med-blood">{patient.bloodType}</span>}
          </div>
          <div className="appt-med-facts">
            {patient.allergies ? (
              <span className="appt-med-chip appt-med-allergy" title={patient.allergies}>
                <b>⚠ {t("apptDetail.allergiesLabel")}</b> {patient.allergies}
              </span>
            ) : (
              <span className="appt-med-chip appt-med-ok">{t("apptDetail.noKnownAllergy")}</span>
            )}
            {patient.antecedents && (
              <span className="appt-med-chip" title={patient.antecedents}>
                <b>{t("apptDetail.antecedents")}</b> {patient.antecedents}
              </span>
            )}
            {patient.currentMedications && (
              <span className="appt-med-chip" title={patient.currentMedications}>
                <b>{t("apptDetail.currentMeds")}</b> {patient.currentMedications}
              </span>
            )}
          </div>
          {patient.id && (
            <Link to={`/patients/${patient.id}`} className="appt-med-dossier">
              {t("apptDetail.openDossier")}
            </Link>
          )}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="appt-tabs" role="tablist">
        {([
          { key: "notes",  label: t("apptDetail.clinicalNotes"), dot: hasNotes },
          { key: "vitals", label: t("apptDetail.measuresTab"),   dot: !!appt.vitalSigns || filledBilan.length > 0 },
          { key: "history", label: t("apptDetail.historyTab"),   dot: historyCount > 0 },
          // Suivi & AMO: the secretary handles the mutuelle/AMO paperwork and the
          // encaissement, so this tab is shown to secretaries too.
          { key: "suivi" as const, label: t("apptDetail.followup"), dot: !!appt.mutuellePapersFilled || !!appt.followUpDate },
        ] as const).map(({ key, label, dot }) => (
          <button
            key={key}
            className={`appt-tab${tab === key ? " active" : ""}`}
            {...tabProps(tab === key)}
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
            <div className="appt-section-title">{t("apptDetail.clinicalNotes")}</div>
            {!readOnly && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => setShowTemplates((v) => !v)}
              >
                {t("apptDetail.templates")} {showTemplates ? "▲" : "▼"}
              </button>
            )}
          </div>

          {showTemplates && (
            <div className="appt-templates-panel">
              <div className="appt-template-cats">
                <button
                  className={`tx-cat-chip${templateCat === "__mine" ? " active" : ""}`}
                  onClick={() => setTemplateCat("__mine")}
                >
                  ★ {t("apptDetail.tplMine")}
                </button>
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
              {templateCat === "__mine" ? (
                <>
                  <div className="appt-template-list">
                    {myTemplates.map((tpl) => (
                      <div key={tpl.id} className="appt-template-item" style={{ position: "relative" }}>
                        <button
                          style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                          onClick={() => applyTemplate(tpl)}
                        >
                          <div className="appt-template-label">{tpl.label}</div>
                          {(tpl.motif || tpl.diagnosis) && (
                            <div className="appt-template-preview">{(tpl.motif || tpl.diagnosis || "").slice(0, 60)}…</div>
                          )}
                        </button>
                        <button
                          className="modal-close"
                          style={{ position: "absolute", top: 4, right: 4, fontSize: 13, width: 20, height: 20, lineHeight: "18px" }}
                          title={t("apptDetail.tplDelete")}
                          onClick={() => deleteMyTemplate(tpl.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {myTemplates.length === 0 && (
                    <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "4px 2px 8px" }}>
                      {t("apptDetail.tplMineEmpty")}
                    </div>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={saveCurrentAsTemplate}>
                    + {t("apptDetail.tplSaveCurrent")}
                  </button>
                </>
              ) : (
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
              )}
            </div>
          )}

          {/* Structured consultation flow — everything in one screen, in order:
              1 motif · 2 antécédents · 3 médicaments · 4 examen (+ mesures)
              · 5 bilans bio/radio · 6 diagnostic · 7 traitement · prochain RDV */}

          {/* 1 · Motif — hidden for a read-only viewer when empty (no point showing
              an empty labelled box with placeholder filler). */}
          <div className="form-group appt-note-block" style={readOnly && !motif.trim() ? { display: "none" } : undefined}>
            <div className="appt-note-label-row">
              <label className="form-label" style={{ margin: 0 }}>{t("apptDetail.motif")}</label>
              {!motifReadOnly && <DictationButton lang={locale} onText={dictateInto("motif", setMotif, motif)} />}
            </div>
            <textarea
              className="form-input appt-textarea"
              rows={2}
              placeholder={t("apptDetail.motifPlaceholder")}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              onBlur={() => saveNotes()}
              readOnly={motifReadOnly}
            />
          </div>

          {/* 2 · Antécédents (from the patient record, saved back to it) */}
          <div className="form-group appt-note-block">
            <label className="form-label" style={{ marginBottom: 4, display: "block" }}>{t("apptDetail.antecedents")}</label>
            {patient ? (
              <textarea
                className="form-input appt-textarea"
                rows={2}
                placeholder={t("apptDetail.antecedentsPlaceholder")}
                value={antecedents}
                onChange={(e) => setAntecedents(e.target.value)}
                onBlur={() => savePatientField({ antecedents: antecedents.trim() || undefined })}
                readOnly={readOnly}
              />
            ) : (
              <div className="appt-note-nolink">{t("apptDetail.historyNeedsPatient")}</div>
            )}
          </div>

          {/* 3 · Médicaments en cours (patient record). Editable by the secretary
              too — she often records the patient's current treatment at check-in
              (the server whitelists currentMedications for secretary writes). */}
          <div className="form-group appt-note-block">
            <label className="form-label" style={{ marginBottom: 4, display: "block" }}>{t("apptDetail.currentMeds")}</label>
            {patient ? (
              <textarea
                className="form-input appt-textarea"
                rows={2}
                placeholder={t("apptDetail.currentMedsPlaceholder")}
                value={currentMeds}
                onChange={(e) => setCurrentMeds(e.target.value)}
                onBlur={() => savePatientField({ currentMedications: currentMeds.trim() || undefined })}
              />
            ) : (
              <div className="appt-note-nolink">{t("apptDetail.historyNeedsPatient")}</div>
            )}
          </div>

          {/* Contexte social & mode de vie (patient record) — persistent background.
              Hidden for a read-only viewer when empty. */}
          <div className="form-group appt-note-block" style={readOnly && !socialHistory.trim() ? { display: "none" } : undefined}>
            <label className="form-label" style={{ marginBottom: 4, display: "block" }}>{t("apptDetail.socialHistory")}</label>
            {patient ? (
              <textarea
                className="form-input appt-textarea"
                rows={2}
                placeholder={readOnly ? undefined : t("apptDetail.socialHistoryPlaceholder")}
                value={socialHistory}
                onChange={(e) => setSocialHistory(e.target.value)}
                onBlur={() => savePatientField({ socialHistory: socialHistory.trim() || undefined })}
                readOnly={readOnly}
              />
            ) : (
              <div className="appt-note-nolink">{t("apptDetail.historyNeedsPatient")}</div>
            )}
          </div>

          {/* 4 · Examen clinique + mesures (displayed — entered in Mesures & bilan) */}
          <div className="form-group appt-note-block">
            <div className="appt-note-label-row">
              <label className="form-label" style={{ margin: 0 }}>{t("apptDetail.examination")}</label>
              {!readOnly && <DictationButton lang={locale} onText={dictateInto("examination", setExam, exam)} />}
            </div>
            <textarea
              className="form-input appt-textarea"
              rows={4}
              placeholder={readOnly ? undefined : t("apptDetail.examPlaceholder")}
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              onBlur={() => saveNotes()}
              readOnly={readOnly}
            />
            <div className="appt-measures-inline" style={{ marginTop: 12 }}>
              <div className="specialty-group-title" style={{ display: "flex", alignItems: "center" }}>
                {t("apptDetail.vitalSigns")}
                {!readOnly && (
                  <button type="button" className="bilan-edit-toggle" style={{ marginLeft: "auto" }} onClick={() => setTab("vitals")}>
                    {t("apptDetail.openMeasuresTab")}
                  </button>
                )}
              </div>
              {vitalsChips.length > 0 ? (
                <div className="bilan-summary">
                  {vitalsChips.map((c, i) => (
                    <div key={i} className="bilan-summary-item">
                      <span className="bilan-summary-label">{c.label}</span>
                      <span className="bilan-summary-value">{c.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bilan-empty-hint">{t("apptDetail.noMeasuresYet")}</div>
              )}
            </div>
          </div>

          {/* 5 · Mesures & bilans (displayed — entered in Mesures & bilan), grouped by type */}
          <div className="appt-note-block">
            <div className="appt-note-label-row">
              <label className="form-label" style={{ margin: 0 }}>{t("apptDetail.notesMeasuresTitle")}</label>
              {!readOnly && (
                <button type="button" className="bilan-edit-toggle" style={{ marginLeft: "auto" }} onClick={() => setTab("vitals")}>
                  {t("apptDetail.openMeasuresTab")}
                </button>
              )}
            </div>
            {(filledBilan.length > 0 || customFilled.length > 0) ? (
              <div className="bilan-summary-groups">
                {groupedBilan.map(({ title, items }) => (
                  <div key={title} className="bilan-summary-group">
                    <div className="specialty-group-title" style={{ margin: "0 0 4px" }}>{title}</div>
                    <div className="bilan-summary">
                      {items.map(({ field }) => (
                        <div key={field.key} className="bilan-summary-item">
                          <span className="bilan-summary-label">{field.label}</span>
                          <span className="bilan-summary-value">{extraFields[field.key]}{field.unit ? ` ${field.unit}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {customFilled.length > 0 && (
                  <div className="bilan-summary-group">
                    <div className="specialty-group-title" style={{ margin: "0 0 4px" }}>{t("apptDetail.customMeasuresTitle")}</div>
                    <div className="bilan-summary">
                      {customFilled.map((m) => (
                        <div key={m.id} className="bilan-summary-item">
                          <span className="bilan-summary-label">{m.label}</span>
                          <span className="bilan-summary-value">{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bilan-empty-hint">{t("apptDetail.noMeasuresYet")}</div>
            )}
            {radioDocs.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="specialty-group-title" style={{ margin: "0 0 4px" }}>{t("apptDetail.radioFiles")}</div>
                <div className="appt-docs-list">{radioDocs.map(renderDocRow)}</div>
              </div>
            )}
          </div>

          {/* 6 · Diagnostic */}
          <div className="form-group appt-note-block" style={readOnly && !diag.trim() ? { display: "none" } : undefined}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <label className="form-label" style={{ margin: 0 }}>{t("apptDetail.diagnosis")}</label>
              {!readOnly && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <DictationButton lang={locale} onText={dictateInto("diagnosis", setDiag, diag)} />
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "2px 8px", gap: 4 }}
                    onClick={() => setShowIcd10(true)}
                    title={t("apptDetail.icd10Title")}
                    type="button"
                  >
                    🔬 {t("apptDetail.icd10")}
                  </button>
                </div>
              )}
            </div>
            <textarea
              className="form-input appt-textarea"
              rows={2}
              placeholder={t("apptDetail.diagPlaceholder")}
              value={diag}
              onChange={(e) => setDiag(e.target.value)}
              onBlur={() => saveNotes()}
              readOnly={readOnly}
            />
          </div>

          {/* 7 · Traitement */}
          <div className="form-group appt-note-block" style={readOnly && !treatment.trim() ? { display: "none" } : undefined}>
            <div className="appt-note-label-row">
              <label className="form-label" style={{ margin: 0 }}>{t("apptDetail.treatment")}</label>
              {!readOnly && <DictationButton lang={locale} onText={dictateInto("treatment", setTreatment, treatment)} />}
            </div>
            <textarea
              className="form-input appt-textarea"
              rows={4}
              placeholder={t("apptDetail.treatPlaceholder")}
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              onBlur={() => saveNotes()}
              readOnly={readOnly}
            />
          </div>

          {/* Ordonnance shortcut */}
          {!readOnly && (
            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="btn btn-ghost ord-open-btn"
                onClick={() => setShowOrd(true)}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
                  <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 5h4M5 7.5h4M5 10h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                {appt.savedOrdonnance ? t("apptDetail.viewReprOrd") : t("apptDetail.newOrd")}
              </button>
              {appt.savedOrdonnance && (
                <span className="ord-saved-badge">
                  {t("apptDetail.ordSaved", { date: new Date(appt.savedOrdonnance.printedAt).toLocaleDateString(locale) })}
                </span>
              )}
              {!appt.savedOrdonnance && (
                <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                  {t("apptDetail.autoSaved")}
                </span>
              )}
            </div>
          )}

          {/* Prochain rendez-vous — schedule the follow-up without leaving */}
          {!readOnly && (
            <div className="appt-note-block" style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <label className="form-label" style={{ marginBottom: 6, display: "block" }}>{t("apptDetail.nextApptTitle")}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input className="form-input" type="date" style={{ maxWidth: 170 }} min={todayIso()} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                <input className="form-input" type="time" style={{ maxWidth: 120 }} value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
                <select className="form-select" style={{ maxWidth: 160 }} value={nextType} onChange={(e) => setNextType(e.target.value)}>
                  {resolveApptTypes()
                    .filter((rt) => !(doctorProfile.hiddenConsultationTypes ?? []).includes(rt.id) || rt.id === nextType)
                    .map((rt) => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
                </select>
                <button className="btn btn-primary" type="button" disabled={!nextDate || !appt.patientId} onClick={scheduleNextAppt}>
                  {t("apptDetail.nextApptCreate")}
                </button>
              </div>
              {nextDate && (() => {
                // How full is the day the doctor is about to book into? Count the
                // live appointments already planned that date (skip this one +
                // cancelled/no-show) so they can steer to a quieter day.
                const n = appointments.filter(a =>
                  a.date === nextDate && a.id !== appt.id &&
                  a.status !== "cancelled" && a.status !== "no_show").length;
                const busy = n >= 8; // a heavy day — flag in amber
                return (
                  <div style={{ marginTop: 6, fontSize: 12, color: busy ? "var(--amber, #B45309)" : "var(--muted)" }}>
                    {n === 0
                      ? t("apptDetail.sameDayNone")
                      : t("apptDetail.sameDayCount", { count: n })}
                  </div>
                );
              })()}
              {!appt.patientId && (
                <div className="appt-note-nolink" style={{ marginTop: 6 }}>{t("apptDetail.historyNeedsPatient")}</div>
              )}
              {appt.followUpDate && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--green)" }}>
                  ✓ {t("apptDetail.nextApptSet", { date: formatDateShort(appt.followUpDate) })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────── TAB: SIGNES VITAUX ─────────────── */}
      {tab === "vitals" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("apptDetail.measuresTab")}</div>
          </div>

          {/* ── Mesures & bilan — ENTERED here; displayed read-only in Notes.
              Two sections: vital signs live inside the first. ── */}
          {(enabledGroups.length > 0 || !bilanReadOnly) && (
            <div className="specialty-fields-section" style={{ marginTop: 18 }}>
              <div className="specialty-fields-title">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {t("apptDetail.specialtyFields")}
                {doctorProfile.specialtyLabel && (
                  <span className="specialty-fields-badge">{doctorProfile.specialtyLabel}</span>
                )}
                {/* Link to Examens & Bio: save the measures entered here as a
                    structured lab result (single source, no double entry). */}
                {!readOnly && (filledBilan.length > 0 || customFilled.length > 0) && (
                  <button type="button" className="btn btn-ghost"
                    style={{ marginLeft: "auto", fontSize: 12, padding: "3px 10px" }}
                    onClick={saveBilanAsExamResult} title={t("apptDetail.bilanToExamTitle")}>
                    <ActionIcon name="flask" /> {t("apptDetail.bilanToExam")}
                  </button>
                )}
                {/* Doctor promotes this appointment's arrangement to their default. */}
                {!readOnly && (
                  <button type="button" className="btn btn-ghost"
                    style={{ marginLeft: (filledBilan.length > 0 || customFilled.length > 0) ? undefined : "auto", fontSize: 12, padding: "3px 10px" }}
                    onClick={savePreferred} title={t("apptDetail.savePreferredTitle")}>
                    ★ {t("apptDetail.savePreferred")}
                  </button>
                )}
              </div>
              {/* Read-only viewers (secretary without recordVitals) get a compact
                  summary; anyone who can record sees the two entry sections. */}
              {bilanReadOnly && (vitalsChips.length > 0 || filledBilan.length > 0 || customFilled.length > 0) && (
                <div className="bilan-summary">
                  {vitalsChips.map((c, i) => (
                    <div key={`v${i}`} className="bilan-summary-item">
                      <span className="bilan-summary-label">{c.label}</span>
                      <span className="bilan-summary-value">{c.value}</span>
                    </div>
                  ))}
                  {filledBilan.map(({ field }) => (
                    <div key={field.key} className="bilan-summary-item">
                      <span className="bilan-summary-label">{field.label}</span>
                      <span className="bilan-summary-value">{extraFields[field.key]}{field.unit ? ` ${field.unit}` : ""}</span>
                    </div>
                  ))}
                  {customFilled.map((m) => (
                    <div key={m.id} className="bilan-summary-item">
                      <span className="bilan-summary-label">{m.label}</span>
                      <span className="bilan-summary-value">{m.value}{m.unit ? ` ${m.unit}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}

              {bilanReadOnly && vitalsChips.length === 0 && filledBilan.length === 0 && customFilled.length === 0 && (
                <div className="bilan-empty-hint">{t("apptDetail.bilanNoMeasures")}</div>
              )}

              {!bilanReadOnly && (["office", "external"] as const).map((src) => {
                const groups     = enabledGroups.filter(g => bilanSourceFor(g.key) === src);
                const customForSrc = customLocal.filter(m => m.source === src);
                return (
                  <div key={src} className="bilan-src-card">
                    <div className="bilan-src-title">
                      {src === "office" ? t("apptDetail.bilanOffice") : t("apptDetail.bilanExternal")}
                    </div>

                    {src === "office" && (
                      <div className="specialty-group">
                        <div className="specialty-group-title">{t("apptDetail.vitalSigns")}</div>
                        <div className="vs-grid">
                          <div className="vs-bp-group">
                            <div className="vs-group-label">{t("apptDetail.bpGroup")}</div>
                            <div className="vs-bp-row">
                              <VsInput label={t("apptDetail.bpSysLabel")} unit="mmHg" value={bpSys} onChange={setBpSys} onBlur={saveVitals} vsKey="bpSys" readOnly={vitalsReadOnly} />
                              <span className="vs-bp-slash">/</span>
                              <VsInput label={t("apptDetail.bpDiaLabel")} unit="mmHg" value={bpDia} onChange={setBpDia} onBlur={saveVitals} vsKey="bpDia" readOnly={vitalsReadOnly} />
                            </div>
                          </div>
                          <VsInput label={t("apptDetail.hrLabel")}     unit="bpm"  value={hr}     onChange={setHr}     onBlur={saveVitals} vsKey="hr"   readOnly={vitalsReadOnly} />
                          <VsInput label={t("apptDetail.tempLabel")}   unit="°C"   value={temp}   onChange={setTemp}   onBlur={saveVitals} vsKey="temp" readOnly={vitalsReadOnly} />
                          <VsInput label={t("apptDetail.spo2Label")}   unit="%"    value={spo2}   onChange={setSpo2}   onBlur={saveVitals} vsKey="spo2" readOnly={vitalsReadOnly} />
                        </div>
                        {renderCustomMeasures("__vitals", "office")}
                      </div>
                    )}

                    {/* Anthropométrie — weight/height are measurements, NOT vital
                        signs; kept in their own group (they still drive the IMC). */}
                    {src === "office" && (
                      <div className="specialty-group">
                        <div className="specialty-group-title">{t("apptDetail.anthropometry")}</div>
                        <div className="vs-grid">
                          <VsInput label={t("apptDetail.weightLabel")} unit="kg"   value={weight} onChange={setWeight} onBlur={saveVitals} readOnly={vitalsReadOnly} />
                          <VsInput label={t("apptDetail.heightLabel")} unit="cm"   value={height} onChange={setHeight} onBlur={saveVitals} readOnly={vitalsReadOnly} />
                        </div>
                        {bmi !== null && (
                          <div className="vs-bmi-card">
                            <div className="vs-bmi-value">{t("apptDetail.bmiLabel", { val: bmi.toFixed(1) })}</div>
                            <div className="vs-bmi-label" style={{ color: bmiClass?.color ?? "var(--text)" }}>{bmiLabel}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {groups.map((group) => {
                      const gk = group.key;
                      const hasVal = groupHasValue(group.fields, gk);
                      const open = isGroupOpen(gk);
                      return (
                        <div key={group.key} className="specialty-group">
                          <div className="specialty-group-title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span onClick={() => toggleGroup(gk)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 12, display: "inline-block", fontSize: 10 }}>{open ? "▾" : "▸"}</span>
                              {group.title}
                              {!open && hasVal && <span className="bilan-filled-dot" title={t("apptDetail.bilanHasValues")} />}
                            </span>
                            {!bilanReadOnly && (
                              <button type="button" className="bilan-edit-toggle" style={{ marginLeft: "auto" }}
                                onClick={() => setBilanSource(group.key, src === "office" ? "external" : "office")}
                                title={t("apptDetail.bilanMove")}>
                                ⇄ {src === "office" ? t("apptDetail.bilanExternal") : t("apptDetail.bilanOffice")}
                              </button>
                            )}
                            {!bilanReadOnly && canRemoveGroup(group.key) && (
                              <button type="button" className="appt-detail-unlink-btn"
                                onClick={() => removeGroup(group.key)} title={t("apptDetail.removeBilan")}>
                                {t("apptDetail.removeBilan")}
                              </button>
                            )}
                          </div>
                          {open && (
                            <>
                              <div className="specialty-fields-grid">
                                {group.fields.map((field: SpecialtyField) => {
                                  // Derived fields (eGFR, VEMS/CVF ratio…) auto-compute from their
                                  // inputs and are shown locked + labelled "auto".
                                  const dVal = derivedValue(field.key, extraFields);
                                  const auto = dVal != null;
                                  return (
                                    <SpecialtyFieldInput key={field.key}
                                      field={auto ? { ...field, label: `${field.label} · auto` } : field}
                                      value={auto ? String(dVal) : (extraFields[field.key] ?? "")}
                                      onChange={(v) => setExtraField(field.key, v)}
                                      onBlur={(v) => saveExtraField(field.key, v)}
                                      readOnly={bilanReadOnly || auto} />
                                  );
                                })}
                              </div>
                              {renderCustomMeasures(gk, src)}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Custom measures added before per-bilan grouping (no groupKey). */}
                    {customForSrc.filter(m => !m.groupKey).length > 0 && (
                      <div className="specialty-group">
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {customForSrc.filter(m => !m.groupKey).map((m) => (
                            <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input className="form-input" style={{ flex: 2 }} placeholder={t("apptDetail.measureLabel")}
                                value={m.label} readOnly={bilanReadOnly}
                                onChange={(e) => editCustomMeasure(m.id, { label: e.target.value })}
                                onBlur={() => persistCustom(customLocal)} />
                              <input className="form-input" style={{ flex: 1, minWidth: 60 }} placeholder={t("apptDetail.measureValue")}
                                value={m.value} readOnly={bilanReadOnly}
                                onChange={(e) => editCustomMeasure(m.id, { value: e.target.value })}
                                onBlur={() => persistCustom(customLocal)} />
                              <input className="form-input" style={{ width: 70 }} placeholder={t("apptDetail.measureUnit")}
                                value={m.unit ?? ""} readOnly={bilanReadOnly}
                                onChange={(e) => editCustomMeasure(m.id, { unit: e.target.value })}
                                onBlur={() => persistCustom(customLocal)} />
                              {!bilanReadOnly && (
                                <button type="button" className="appt-doc-delete" title={t("common.delete")}
                                  onClick={() => removeCustomMeasure(m.id)}>×</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add a bilan / measure group directly into THIS section. */}
                    {availableGroups.length > 0 && (
                      <select
                        className="form-select"
                        style={{ marginTop: 8, fontSize: 12, padding: "4px 8px", maxWidth: 240 }}
                        value=""
                        onChange={(e) => { if (e.target.value) addGroup(e.target.value, src); e.target.value = ""; }}
                        title={t("apptDetail.addBilanTitle")}
                      >
                        <option value="">+ {src === "office" ? t("apptDetail.addToOffice") : t("apptDetail.addToExternal")}</option>
                        {availableGroups.map(g => (
                          <option key={g.key} value={g.key}>{g.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}

              {/* Radiology films / reports — entered here, viewed in Notes */}
              {(!bilanReadOnly || radioDocs.length > 0) && (
                <div className="appt-radio-attach" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div className="appt-note-label-row">
                    <span className="specialty-group-title" style={{ margin: 0 }}>
                      {t("apptDetail.radioFiles")}
                      {radioDocs.length > 0 && <span className="appt-docs-count">{radioDocs.length}</span>}
                    </span>
                    {!bilanReadOnly && (
                      <button className="btn btn-ghost btn-sm" type="button"
                        onClick={() => { setDocSizeWarn(false); radioFileRef.current?.click(); }}>
                        {t("apptDetail.addRadioFile")}
                      </button>
                    )}
                    <input ref={radioFileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }} onChange={handleDocUpload("radiologie")} />
                  </div>
                  {radioDocs.length > 0 && <div className="appt-docs-list">{radioDocs.map(renderDocRow)}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────── TAB: HISTORIQUE PATIENT ─────────────── */}
      {tab === "history" && (
        <div className="appt-tab-panel">
          {!patient ? (
            <div className="appt-note-nolink">{t("apptDetail.historyNeedsPatient")}</div>
          ) : (
            <>
              {/* Patient-level medical info — the static dossier, NOT tied to any
                  single visit (antécédents, allergies, traitement de fond…). Shown
                  first so the doctor has the whole picture without leaving. */}
              <div className="hist-static">
                <div className="hist-static-head">
                  <span className="hist-static-title">{t("apptDetail.patientMedicalInfo")}</span>
                  <span className="hist-static-note">{t("apptDetail.staticInfoNote")}</span>
                </div>
                {patient.allergies && (
                  <div className="hist-static-row hist-static-alert">
                    <b>⚠ {t("apptDetail.allergiesLabel")}</b><span>{patient.allergies}</span>
                  </div>
                )}
                {patient.bloodType && (
                  <div className="hist-static-row"><b>{t("apptDetail.bloodTypeLabel")}</b><span>{patient.bloodType}</span></div>
                )}
                {patient.antecedents && (
                  <div className="hist-static-row"><b>{t("apptDetail.antecedents")}</b><span>{patient.antecedents}</span></div>
                )}
                {patient.currentMedications && (
                  <div className="hist-static-row"><b>{t("apptDetail.currentMeds")}</b><span>{patient.currentMedications}</span></div>
                )}
                {!patient.allergies && !patient.bloodType && !patient.antecedents && !patient.currentMedications && (
                  <div className="hist-static-empty">{t("apptDetail.noStaticInfo")}</div>
                )}
              </div>

              {/* Upcoming consultations — kept separate from the past history below. */}
              {futureAppts.length > 0 && (
                <>
                  <div className="appt-section-header">
                    <div className="appt-section-title">
                      {t("apptDetail.upcomingVisits")}
                      <span className="appt-docs-count">{futureAppts.length}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                    {futureAppts.slice(0, 20).map(a => (
                      <Link key={a.id} to={`/agenda/${a.id}`} className="hist-upcoming">
                        <span className="hist-upcoming-date">{formatDateShort(a.date)}{a.startTime ? ` · ${a.startTime}` : ""}</span>
                        <span className="hist-visit-type" style={{ color: apptTypeColor(a.type), background: apptTypeColor(a.type) + "18" }}>{apptTypeLabel(a.type)}</span>
                        {apptLabelById(a.labelId) && (
                          <span className="hist-visit-tag" style={{ background: apptLabelById(a.labelId)!.color + "22", color: apptLabelById(a.labelId)!.color }}>{apptLabelById(a.labelId)!.label}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              <div className="appt-section-header">
                <div className="appt-section-title">
                  {t("apptDetail.pastVisits")}
                  {historyAppts.length > 0 && <span className="appt-docs-count">{historyAppts.length}</span>}
                </div>
              </div>
              {historyAppts.length === 0 ? (
                <div className="appt-docs-empty">{t("apptDetail.noHistory")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {historyAppts.slice(0, 40).map(a => {
                    const n = a.consultationNote; const vs = a.vitalSigns;
                    // Every captured vital, incl. computed BMI — nothing hidden.
                    const vChips: string[] = [];
                    if (vs) {
                      if (vs.bpSys != null && vs.bpDia != null) vChips.push(`TA ${vs.bpSys}/${vs.bpDia} mmHg`);
                      if (vs.hr != null)     vChips.push(`FC ${vs.hr} bpm`);
                      if (vs.temp != null)   vChips.push(`T° ${vs.temp} °C`);
                      if (vs.spo2 != null)   vChips.push(`SpO₂ ${vs.spo2} %`);
                      if (vs.weight != null) vChips.push(`${vs.weight} kg`);
                      if (vs.height != null) vChips.push(`${vs.height} cm`);
                      if (vs.weight != null && vs.height) {
                        const bmi = vs.weight / Math.pow(vs.height / 100, 2);
                        if (isFinite(bmi)) vChips.push(`IMC ${bmi.toFixed(1)}`);
                      }
                    }
                    // Every specialty / bilan measure stored on the note.
                    const extra = n?.extraFields ? Object.entries(n.extraFields).filter(([, v]) => v != null && String(v).trim()) : [];
                    // Ad-hoc measures typed at the desk.
                    const custom = a.customMeasures ?? [];
                    const docs = apptDocuments.filter(d => d.appointmentId === a.id);
                    const hasFoot = (a.savedOrdonnance && (a.savedOrdonnance.lines?.length ?? 0) > 0)
                      || (a.savedCertificates?.length ?? 0) > 0 || docs.length > 0;
                    return (
                      <div key={a.id} className="hist-visit">
                        <div className="hist-visit-head">
                          <Link to={`/agenda/${a.id}`} className="hist-visit-date">{formatDateShort(a.date)}</Link>
                          <span className="hist-visit-type" style={{ color: apptTypeColor(a.type), background: apptTypeColor(a.type) + "18" }}>{apptTypeLabel(a.type)}</span>
                          {apptLabelById(a.labelId) && (
                            <span className="hist-visit-tag" style={{ background: apptLabelById(a.labelId)!.color + "22", color: apptLabelById(a.labelId)!.color }}>{apptLabelById(a.labelId)!.label}</span>
                          )}
                        </div>
                        {/* Field order mirrors the note-clinique entry order:
                            motif → examen (+ signes vitaux) → mesures/bilans → diagnostic → traitement. */}
                        {n?.motif && <div className="hist-note"><span className="hist-note-label">{t("apptDetail.motif")}</span><span className="hist-note-text">{n.motif}</span></div>}
                        {n?.examination && <div className="hist-note"><span className="hist-note-label">{t("apptDetail.examination")}</span><span className="hist-note-text">{n.examination}</span></div>}
                        {vChips.length > 0 && (
                          <div className="hist-measures">
                            {vChips.map((c, i) => <span key={i} className="hist-measure-chip">{c}</span>)}
                          </div>
                        )}
                        {(extra.length > 0 || custom.length > 0) && (
                          <div className="hist-measures">
                            {extra.map(([k, v]) => {
                              const m = fieldMeta(k);
                              return <span key={k} className="hist-measure-chip"><b>{m.label}:</b> {v}{m.unit ? ` ${m.unit}` : ""}</span>;
                            })}
                            {custom.map((cm) => (
                              <span key={cm.id} className="hist-measure-chip"><b>{cm.label}:</b> {cm.value}{cm.unit ? ` ${cm.unit}` : ""}</span>
                            ))}
                          </div>
                        )}
                        {n?.diagnosis && <div className="hist-note"><span className="hist-note-label">{t("apptDetail.diagnosis")}</span><span className="hist-note-text">{n.diagnosis}</span></div>}
                        {n?.treatment && <div className="hist-note"><span className="hist-note-label">{t("apptDetail.treatment")}</span><span className="hist-note-text">{n.treatment}</span></div>}
                        {hasFoot && (
                          <div className="hist-visit-foot">
                            {a.savedOrdonnance && (a.savedOrdonnance.lines?.length ?? 0) > 0 && (
                              <button type="button" className="hist-foot-item hist-foot-rx"
                                title={t("apptDetail.reprOrd")}
                                onClick={() => printOrdonnance({
                                  lines: a.savedOrdonnance!.lines ?? [],
                                  patientName: a.patientName,
                                  date: a.date,
                                  doctorProfile,
                                  patient: patient ? { gender: patient.gender, dateOfBirth: patient.dateOfBirth } : undefined,
                                })}>
                                ℞ {(a.savedOrdonnance.lines ?? []).map(l => l.drug).join(", ")} <span className="hist-foot-rx-cta">↗</span>
                              </button>
                            )}
                            {(a.savedCertificates?.length ?? 0) > 0 && (
                              <span className="hist-foot-item">📜 {t("apptDetail.certificate")} ({a.savedCertificates!.length})</span>
                            )}
                            {docs.length > 0 && (
                              <div className="hist-docs">
                                <span className="hist-docs-label">📎 {t("apptDetail.attachments")} ({docs.length})</span>
                                <div className="hist-docs-list">
                                  {docs.map(doc => (
                                    <AttachmentLink key={doc.id} doc={doc} download={!doc.mimeType.startsWith("image/")} className="hist-doc-chip">{docIcon(doc.mimeType)} {doc.filename}</AttachmentLink>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {historyExams.length > 0 && (
                <>
                  <div className="appt-section-header" style={{ marginTop: 16 }}>
                    <div className="appt-section-title">{t("apptDetail.examResultsHistory")}<span className="appt-docs-count">{historyExams.length}</span></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyExams.slice(0, 20).map(e => (
                      <div key={e.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{formatDateShort(e.date)}</span>
                          <span style={{ fontSize: 12 }}>{e.title}</span>
                          {e.labName && <span style={{ fontSize: 11, color: "var(--muted)" }}>· {e.labName}</span>}
                        </div>
                        {e.values.length > 0 && (
                          <div style={{ fontSize: 12.5 }}>
                            {e.values.slice(0, 6).map(v => `${v.label}: ${v.value}${v.unit ? ` ${v.unit}` : ""}`).join(" · ")}
                          </div>
                        )}
                        {e.notes && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.notes}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {historyRx.length > 0 && (
                <>
                  <div className="appt-section-header" style={{ marginTop: 16 }}>
                    <div className="appt-section-title">{t("apptDetail.rxHistory")}<span className="appt-docs-count">{historyRx.length}</span></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyRx.slice(0, 20).map(p => (
                      <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{formatDateShort(p.date)}</div>
                        <div style={{ fontSize: 12.5 }}>℞ {(p.lines ?? []).map(l => l.drug).join(", ")}</div>
                        {p.notes && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.notes}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────── TAB: SUIVI & AMO ─────────────── */}
      {tab === "suivi" && (
        <div className="appt-tab-panel">

          {/* Mutuelle paperwork — doctors don't see the actual reimbursement, so we
              only track whether the mutuelle forms were filled, and when. */}
          <div className="appt-section-header">
            <div className="appt-section-title">{t("apptDetail.mutuelleTitle")}</div>
          </div>
          <div className="appt-suivi-grid">
            <div className="form-group">
              <label className="form-label">{t("apptDetail.mutuellePapersLabel")}</label>
              <label className="appt-mutuelle-check">
                <input
                  type="checkbox"
                  checked={!!appt.mutuellePapersFilled}
                  onChange={(e) => updateAppointment({
                    ...appt,
                    mutuellePapersFilled: e.target.checked || undefined,
                    mutuellePapersDate: e.target.checked
                      ? (appt.mutuellePapersDate ?? todayIso())
                      : undefined,
                  })}
                />
                <span>{t("apptDetail.mutuellePapersDone")}</span>
              </label>
            </div>

            {appt.mutuellePapersFilled && (
              <div className="form-group">
                <label className="form-label">{t("apptDetail.mutuellePapersDate")}</label>
                <input
                  className="form-input"
                  type="date"
                  value={appt.mutuellePapersDate ?? ""}
                  onChange={(e) => updateAppointment({
                    ...appt, mutuellePapersDate: e.target.value || undefined,
                  })}
                />
              </div>
            )}
          </div>

          {appt.mutuellePapersFilled && (
            <div className="appt-rmb-badge-row">
              <span className="appt-rmb-badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                {t("apptDetail.mutuelleBadgeDone")}
                {appt.mutuellePapersDate ? ` · ${formatDateShort(appt.mutuellePapersDate)}` : ""}
              </span>
            </div>
          )}

          {/* Follow-up */}
          <div className="appt-section-header" style={{ marginTop: 20 }}>
            <div className="appt-section-title">{t("apptDetail.followUpSection")}</div>
          </div>
          <div className="appt-suivi-grid">
            <div className="form-group">
              <label className="form-label">{t("apptDetail.followUpDate")}</label>
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
            <div className="appt-section-title">{t("apptDetail.billingTitle")}</div>
          </div>
          {appt.billedAt ? (
            <div className="appt-billed-info" style={{ flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: "var(--green)", fontWeight: 700 }}>{t("apptDetail.billed")}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {t("apptDetail.billedOn", { date: new Date(appt.billedAt).toLocaleDateString(locale) })}
                {appt.billedAmount ? ` · ${formatMAD(appt.billedAmount)}` : ""}
              </span>
              {/* Payment status */}
              <span className={`pay-badge pay-badge-${pay.status}`}>
                {pay.status === "paid"     && t("apptDetail.payStatusPaid")}
                {pay.status === "partial"  && t("apptDetail.payStatusPartial", { amount: formatMAD(pay.balance) })}
                {pay.status === "deferred" && t("apptDetail.payStatusDeferred", { amount: formatMAD(pay.balance) })}
              </span>
              {pay.balance > 0 && (
                <button
                  className="btn btn-primary receipt-print-btn"
                  style={{ background: "var(--blue)" }}
                  onClick={openPayModal}
                  title={t("apptDetail.payTitle")}
                >
                  {t("apptDetail.payCollect")}
                </button>
              )}
              {/* Reçu */}
              <button
                className="btn btn-ghost receipt-print-btn"
                onClick={() => printReceipt({
                  patientName:      appt.patientName,
                  consultationType: apptTypeLabel(appt.type),
                  appointmentDate:  appt.date,
                  appointmentTime:  appt.startTime,
                  amount:           pay.paid,
                  total:            pay.due,
                  balance:          pay.balance,
                  items:            appt.billedItems,
                  reduction:        appt.billedReduction,
                  doctorProfile,
                })}
                title={t("apptDetail.printReceiptTitle")}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                  <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 9h6M4 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {t("apptDetail.receipt")}
              </button>
              {/* Corriger la facture (doctor only) — re-opens the bill editor to fix an error */}
              {!readOnly && (
                <button
                  className="btn btn-ghost receipt-print-btn"
                  onClick={openBillModal}
                  title={t("apptDetail.correctFactureTitle")}
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ marginRight: 5 }}>
                    <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                  {t("apptDetail.correctFacture")}
                </button>
              )}
              {/* Facture */}
              {appt.invoiceNumber ? (
                <button
                  className="btn btn-ghost receipt-print-btn"
                  onClick={() => {
                    const pt = patient;
                    printFacture({
                      invoiceNumber:  appt.invoiceNumber!,
                      invoiceDate:    appt.invoiceIssuedAt
                        ? appt.invoiceIssuedAt.slice(0, 10)
                        : appt.date,
                      patientName:    appt.patientName,
                      patientCnops:   pt?.cnopsNumber,
                      serviceLabel:   apptTypeLabel(appt.type) + " médicale",
                      serviceDate:    appt.date,
                      amount:         appt.billedAmount ?? 0,
                      items:          appt.billedItems,
                      reduction:      appt.billedReduction,
                      doctorProfile,
                    });
                  }}
                  title={t("apptDetail.reprInvoiceTitle", { num: appt.invoiceNumber })}
                >
                  {t("apptDetail.invoicePrefix")} {appt.invoiceNumber}
                </button>
              ) : (
                <button
                  className="btn btn-ghost receipt-print-btn"
                  style={{ color: "var(--blue)", borderColor: "var(--blue)" }}
                  onClick={() => {
                    const pt = patient;
                    const invNum   = nextInvoiceNumber();
                    const issuedAt = new Date().toISOString();
                    updateAppointment({ ...appt, invoiceNumber: invNum, invoiceIssuedAt: issuedAt });
                    addInvoice({
                      appointmentId: appt.id,
                      patientId:     appt.patientId,
                      patientName:   appt.patientName,
                      amount:        appt.billedAmount ?? 0,
                      actLabel:      apptTypeLabel(appt.type) + " médicale",
                      invoiceNumber: invNum,
                      issuedAt,
                      cnopsNumber:   pt?.cnopsNumber,
                    });
                    printFacture({
                      invoiceNumber:  invNum,
                      invoiceDate:    issuedAt.slice(0, 10),
                      patientName:    appt.patientName,
                      patientCnops:   pt?.cnopsNumber,
                      serviceLabel:   apptTypeLabel(appt.type) + " médicale",
                      serviceDate:    appt.date,
                      amount:         appt.billedAmount ?? 0,
                      items:          appt.billedItems,
                      reduction:      appt.billedReduction,
                      doctorProfile,
                    });
                  }}
                  title={t("apptDetail.emitInvoiceTitle")}
                >
                  {t("apptDetail.emitInvoice")}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={openBillModal}
              >
                {t("apptDetail.billThisConsult")}
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {t("apptDetail.billHint")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Pièces jointes ── */}
      <div className="appt-docs-section">
        <div className="appt-section-header">
          <div className="appt-section-title">
            {t("apptDetail.attachments")}
            {generalDocs.length > 0 && (
              <span className="appt-docs-count">{generalDocs.length}</span>
            )}
          </div>
          {/* Secretaries attach documents at the desk too (analyses, mutuelle
              forms, scans) — the sync pushes their additions to the server. */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setDocSizeWarn(false); docFileRef.current?.click(); }}
          >
            {t("apptDetail.addFile")}
          </button>
          <input
            ref={docFileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            style={{ display: "none" }}
            onChange={handleDocUpload()}
          />
        </div>

        {docSizeWarn && (
          <div className="appt-docs-warn">
            {t("apptDetail.fileTooLarge")}
            <button className="appt-docs-warn-close" onClick={() => setDocSizeWarn(false)}>×</button>
          </div>
        )}

        {generalDocs.length === 0 ? (
          <div className="appt-docs-empty">
            {t("apptDetail.noFiles")}
          </div>
        ) : (
          <div className="appt-docs-list">
            {generalDocs.map(renderDocRow)}
          </div>
        )}
      </div>

      {/* ── Bill modal ── */}
      {showBill && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowBill(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">{appt.billedAt ? t("apptDetail.correctFacture") : t("apptDetail.billConsult")}</h2>
              <button className="modal-close" onClick={() => setShowBill(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                {t("apptDetail.billPatient", { name: appt.patientName, type: apptTypeLabel(appt.type) })}
              </div>

              {/* Itemized lines: consultation base + each act performed.
                  Prices & rebate are the DOCTOR's decision — the secretary
                  sees them read-only and only handles the encaissement. */}
              {readOnly && (
                <div className="bill-ro-hint">{t("apptDetail.billRoHint")}</div>
              )}
              <div className="bill-lines">
                {billItems.map((l, i) => readOnly ? (
                  <div className="bill-line bill-line-ro" key={i}>
                    <span className="bill-line-ro-label">{l.label || "—"}</span>
                    <span className="bill-line-ro-qty">{l.qty} ×</span>
                    <span className="bill-line-ro-price">{formatMAD(l.unitPrice)}</span>
                    {lineDiscount(l) > 0 && (
                      <span className="bill-line-ro-remise" title={t("apptDetail.billActRemise")}>
                        − {l.remiseType === "pct" ? `${l.remise}%` : formatMAD(l.remise || 0)} → {formatMAD(lineNet(l))}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="bill-line bill-line-editable" key={i}>
                    {/* Everything on one line: act, qty, price, then (only after
                        the doctor clicks the % button) the per-act remise. */}
                    <div className="bill-line-main">
                      <input
                        className="form-input bill-line-label"
                        placeholder={t("apptDetail.billItemLabel")}
                        value={l.label}
                        onChange={(e) => updateBillLine(i, { label: e.target.value })}
                      />
                      <input
                        className="form-input bill-line-qty"
                        type="number" min="1" step="1"
                        value={l.qty || ""}
                        onChange={(e) => updateBillLine(i, { qty: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        title={t("apptDetail.billQty")}
                      />
                      <input
                        className="form-input bill-line-price"
                        type="number" min="0" step="0.01"
                        value={l.unitPrice || ""}
                        onChange={(e) => updateBillLine(i, { unitPrice: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                        title={t("apptDetail.billUnitPrice")}
                      />
                      {l.remise == null ? (
                        <button
                          type="button"
                          className="bill-line-remise-btn"
                          onClick={() => updateBillLine(i, { remise: 0, remiseType: l.remiseType ?? "mad" })}
                          title={t("apptDetail.billApplyRemise")}
                        >
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ marginInlineEnd: 4, flexShrink: 0 }} aria-hidden>
                            <path d="M2 7.4V3a1 1 0 0 1 1-1h4.4a1 1 0 0 1 .7.3l4.6 4.6a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0L2.3 8.1A1 1 0 0 1 2 7.4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                            <circle cx="5" cy="5" r="1" fill="currentColor"/>
                          </svg>
                          {t("apptDetail.billRemiseShort")}
                        </button>
                      ) : (
                        <>
                          <input
                            className="form-input bill-line-remise-input"
                            type="number" min="0" step="0.01"
                            placeholder="0" autoFocus
                            value={l.remise || ""}
                            onChange={(e) => updateBillLine(i, { remise: parseFloat(e.target.value.replace(",", ".")) || 0, remiseType: l.remiseType ?? "mad" })}
                            title={t("apptDetail.billActRemise")}
                          />
                          <button
                            type="button"
                            className="bill-line-remise-toggle"
                            onClick={() => updateBillLine(i, { remiseType: l.remiseType === "pct" ? "mad" : "pct" })}
                            title={t("apptDetail.billActRemiseToggle")}
                          >{l.remiseType === "pct" ? "%" : "MAD"}</button>
                          <button
                            type="button"
                            className="bill-line-remise-clear"
                            onClick={() => updateBillLine(i, { remise: undefined, remiseType: undefined })}
                            title={t("apptDetail.billRemoveRemise")}
                            aria-label={t("apptDetail.billRemoveRemise")}
                          >×</button>
                        </>
                      )}
                      <button
                        type="button"
                        className="bill-line-remove"
                        onClick={() => removeBillLine(i)}
                        disabled={billItems.length <= 1}
                        title={t("common.delete")}
                      >×</button>
                    </div>
                    {l.remise != null && lineDiscount(l) > 0 && (
                      <div className="bill-line-remise-hint">− {formatMAD(lineDiscount(l))} → {formatMAD(lineNet(l))}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add an act — from the doctor's act list, or a blank custom line */}
              {!readOnly && (
              <div className="bill-add-row">
                {(doctorProfile.acteCodes?.length ?? 0) > 0 && (
                  <select
                    className="form-select bill-act-select"
                    value=""
                    onChange={(e) => {
                      const a = doctorProfile.acteCodes?.find(c => c.id === e.target.value);
                      if (a) addBillLine({ label: a.label || a.code, qty: 1, unitPrice: a.price ?? 0 });
                      e.target.value = "";
                    }}
                  >
                    <option value="">{t("apptDetail.billAddAct")}</option>
                    {doctorProfile.acteCodes!.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.label}{a.price != null ? ` · ${a.price} MAD` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="btn btn-ghost bill-add-custom"
                  onClick={() => addBillLine({ label: "", qty: 1, unitPrice: 0 })}
                >
                  + {t("apptDetail.billAddLine")}
                </button>
              </div>
              )}

              {/* Reduction — the DOCTOR's decision. The secretary sees it applied
                  in the totals below (sum due) but does not edit it. */}
              {!readOnly && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">{t("apptDetail.billReduction")}</label>
                <input
                  className="form-input"
                  type="number" min="0" step="0.01"
                  placeholder="0"
                  value={billReduction}
                  onChange={(e) => setBillReduction(e.target.value)}
                />
              </div>
              )}

              {/* Totals */}
              <div className="bill-totals">
                <div className="bill-total-row">
                  <span>{t("apptDetail.billSubtotal")}</span>
                  <span>{formatMAD(billSubtotal)}</span>
                </div>
                {billLineDisc > 0 && (
                  <div className="bill-total-row bill-total-reduction">
                    <span>{t("apptDetail.billActRemises")}</span>
                    <span>− {formatMAD(billLineDisc)}</span>
                  </div>
                )}
                {billReductionN > 0 && (
                  <div className="bill-total-row bill-total-reduction">
                    <span>{t("apptDetail.billReduction")}</span>
                    <span>− {formatMAD(billReductionN)}</span>
                  </div>
                )}
                <div className="bill-total-row bill-total-net">
                  <span>{t("apptDetail.billTotal")}</span>
                  <span>{formatMAD(billTotal)}</span>
                </div>
              </div>

              {/* Payment now — patient may pay all, part, or nothing (deferred) */}
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">{t("apptDetail.billCollected")}</label>
                <div className="bill-collect-row">
                  <input
                    className="form-input"
                    type="number" min="0" step="0.01"
                    value={billCollected}
                    onChange={(e) => setBillCollected(e.target.value)}
                  />
                  <button type="button" className="bill-collect-chip" onClick={() => setBillCollected(String(billTotal))}>
                    {t("apptDetail.billPayFull")}
                  </button>
                  <button type="button" className="bill-collect-chip" onClick={() => setBillCollected("0")}>
                    {t("apptDetail.billDefer")}
                  </button>
                </div>
              </div>
              {billRemaining > 0 && (
                <div className="bill-remaining">
                  {t("apptDetail.billRemaining")} <strong>{formatMAD(billRemaining)}</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowBill(false)}>{t("common.cancel")}</button>
              {!readOnly && !appt.billedAt && (
                <button
                  className="btn btn-ghost"
                  onClick={handlePrepareBill}
                  disabled={billItems.every(l => !l.label.trim())}
                  title={t("apptDetail.billPrepareTitle")}
                >
                  {t("apptDetail.billPrepare")}
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={handleBill}
                disabled={billItems.every(l => !l.label.trim())}
              >
                {appt.billedAt ? t("apptDetail.correctSave") : t("apptDetail.addRevenue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record a later payment (deferred / partial) ── */}
      {showPay && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPay(false); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 className="modal-title">{t("apptDetail.payTitle")}</h2>
              <button className="modal-close" onClick={() => setShowPay(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bill-totals" style={{ marginTop: 0, borderTop: "none" }}>
                <div className="bill-total-row"><span>{t("apptDetail.billTotal")}</span><span>{formatMAD(pay.due)}</span></div>
                <div className="bill-total-row"><span>{t("apptDetail.payAlready")}</span><span>{formatMAD(pay.paid)}</span></div>
                <div className="bill-total-row bill-total-net" style={{ color: "var(--coral)" }}>
                  <span>{t("apptDetail.billRemaining")}</span><span>{formatMAD(pay.balance)}</span>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">{t("apptDetail.payAmount")}</label>
                <input
                  className="form-input"
                  type="number" min="0" step="0.01" max={pay.balance} autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePay()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("apptDetail.payMethod")}</label>
                <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">{t("apptDetail.payCash")}</option>
                  <option value="card">{t("apptDetail.payCard")}</option>
                  <option value="cheque">{t("apptDetail.payCheque")}</option>
                  <option value="transfer">{t("apptDetail.payTransfer")}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPay(false)}>{t("common.cancel")}</button>
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={handlePay}
                disabled={pay.balance <= 0}
              >
                {t("apptDetail.payRecord")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ordonnance modal ── */}
      {showOrd && (
        <OrdonnanceModal
          patientName={appt.patientName}
          date={appt.date}
          doctorProfile={doctorProfile}
          patient={patient ? { gender: patient.gender, dateOfBirth: patient.dateOfBirth } : undefined}
          allergies={patient?.allergies}
          lastOrdonnance={lastRx?.lines}
          lastOrdonnanceDate={lastRx?.date}
          initialLines={appt.savedOrdonnance?.lines}
          onSave={(lines: OrdonnanceLine[]) => {
            updateAppointment({
              ...appt,
              savedOrdonnance: { lines, printedAt: new Date().toISOString() },
            });
          }}
          onClose={() => setShowOrd(false)}
        />
      )}

      {/* ── Certificate modal ── */}
      {showCert && (
        <CertificateModal
          appt={appt}
          patientName={appt.patientName}
          doctorProfile={doctorProfile}
          onSave={(cert: SavedCertificate) => {
            updateAppointment({
              ...appt,
              savedCertificates: [...(appt.savedCertificates ?? []), cert],
            });
          }}
          onClose={() => setShowCert(false)}
        />
      )}

      {/* ── Exam-request modal ── */}
      {showExam && (
        <ExamRequestModal
          patientName={appt.patientName}
          date={appt.date}
          doctorProfile={doctorProfile}
          initialLines={apptExamRequests[0]?.lines}
          initialIndication={apptExamRequests[0]?.indication}
          savedTemplates={doctorProfile.examRequestTemplates}
          onSaveTemplate={(name, lines, indication) => {
            const tpl = { id: Math.random().toString(36).slice(2, 9), name, lines, indication };
            setDoctorProfile({ ...doctorProfile, examRequestTemplates: [...(doctorProfile.examRequestTemplates ?? []), tpl] });
            toast(t("examReq.modelSaved", { name }), "success");
          }}
          onDeleteTemplate={(id) => setDoctorProfile({ ...doctorProfile, examRequestTemplates: (doctorProfile.examRequestTemplates ?? []).filter(x => x.id !== id) })}
          onSave={({ lines, indication }) => {
            const existing = apptExamRequests[0];
            if (existing) {
              updateExamRequest({ ...existing, lines, indication, date: appt.date });
            } else {
              addExamRequest({
                patientId:     appt.patientId,
                patientName:   appt.patientName,
                date:          appt.date,
                lines, indication,
                source:        "appointment",
                appointmentId: appt.id,
              });
            }
          }}
          onClose={() => setShowExam(false)}
        />
      )}

      {/* ── Medical report modal (compte rendu d'imagerie / rapport médical) ── */}
      {reportModal && (
        <MedicalReportModal
          patientName={appt.patientName}
          patientId={appt.patientId}
          date={appt.date}
          doctorProfile={doctorProfile}
          source="appointment"
          appointmentId={appt.id}
          initial={reportModal.editId ? medicalReports.find(r => r.id === reportModal.editId) : undefined}
          onSave={(data) => {
            if (reportModal.editId) {
              const existing = medicalReports.find(r => r.id === reportModal.editId);
              if (existing) updateMedicalReport({ ...existing, ...data });
            } else {
              const created = addMedicalReport(data);
              // Switch to edit mode so a subsequent print/save updates the same record.
              setReportModal({ editId: created.id });
            }
          }}
          onClose={() => setReportModal(null)}
        />
      )}

      {/* ── Link-to-patient modal ── */}
      {showLink && (
        <LinkPatientModal
          patients={patients}
          apptName={appt.patientName}
          onPick={(p) => {
            updateAppointment({ ...appt, patientId: p.id, patientName: fmtFullName(p) });
            setShowLink(false);
          }}
          onClose={() => setShowLink(false)}
        />
      )}

      {/* ── ICD-10 picker ── */}
      {showIcd10 && (
        <Icd10Picker
          onSelect={(entry: Icd10Entry) => {
            const prefix = diag.trim() ? diag.trim() + " | " : "";
            const next = prefix + entry.code + " — " + entry.desc;
            setDiag(next);
            updateAppointment({
              ...appt,
              consultationNote: {
                ...(appt.consultationNote ?? {}),
                diagnosis: next,
              },
            });
          }}
          onClose={() => setShowIcd10(false)}
        />
      )}
    </Layout>
  );
}
