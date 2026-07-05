import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { DictationButton } from "../components/DictationButton";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import { useToast } from "../components/Toast";
import { findOrphanAppts } from "../lib/orphanAppts";
import { fullName as fmtFullName } from "../lib/nameFormat";
import type {
  Appointment, AppointmentStatus, AppointmentType, Patient,
  ConsultationNote, VitalSigns, OrdonnanceLine, SavedCertificate, BillingLine, PaymentMethod,
} from "../lib/cabinetTypes";
import { paymentSummary } from "../lib/billing";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS, DEFAULT_SECRETARY_PERMISSIONS,
} from "../lib/cabinetTypes";
import { NOTE_TEMPLATES, TEMPLATE_CATEGORIES } from "../lib/noteTemplates";
import { todayIso, formatMAD, formatDateShort, bmiClassify } from "../lib/format";
import { printReceipt } from "../lib/receiptPrinter";
import { nextInvoiceNumber, printFacture } from "../lib/facturePrinter";
import { OrdonnanceModal }  from "../components/OrdonnanceModal";
import { CertificateModal } from "../components/CertificateModal";
import { ExamRequestModal } from "../components/ExamRequestModal";
import { Icd10Picker }      from "../components/Icd10Picker";
import type { Icd10Entry }  from "../lib/icd10";
import { getSpecialtyGroups, BILAN_CATALOG } from "../lib/specialtyFields";
import type { SpecialtyField } from "../lib/specialtyFields";
import type { CustomNoteTemplate } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTS: AppointmentStatus[] = [
  "scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show",
];
// Only these three types are offered for new appointments; legacy types
// (suivi, procédure, urgence) remain displayable on existing records and are
// preserved per-appointment via seenTypes.
const STANDARD_TYPES: AppointmentType[] = ["consultation", "controle", "autre"];

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
                    background: "var(--surface)", cursor: "pointer", textAlign: "left",
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
  const {
    appointments, patients, updateAppointment, deleteAppointment, addInvoice,
    addPatient, updatePatient, addAppointment, doctorProfile, setDoctorProfile, role,
    examRequests, addExamRequest, updateExamRequest,
    apptDocuments, addApptDocument, deleteApptDocument,
    examResults, prescriptions,
  } = useCabinet();
  const { addTransaction } = useApp();
  const toast = useToast();
  const readOnly = role === "secretary"; // secretary: view clinical notes, no clinical edits
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

  // Most recent prescription this patient received at any *other* appointment —
  // lets the doctor one-click "repeat last" for chronic patients.
  const lastOrdonnanceLines = useMemo(() => {
    const pid = appointments.find((a) => a.id === apptId)?.patientId;
    if (!pid) return undefined;
    const prior = appointments
      .filter((a) => a.id !== apptId && a.patientId === pid
        && a.savedOrdonnance && a.savedOrdonnance.lines.length > 0)
      .sort((a, b) => b.savedOrdonnance!.printedAt.localeCompare(a.savedOrdonnance!.printedAt));
    return prior[0]?.savedOrdonnance?.lines;
  }, [appointments, apptId]);

  const appt = useMemo(
    () => appointments.find((a) => a.id === apptId),
    [appointments, apptId],
  );

  const patient = useMemo(
    () => appt?.patientId ? patients.find((p) => p.id === appt.patientId) : null,
    [patients, appt?.patientId],
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"notes" | "vitals" | "history" | "suivi">("notes");

  // Keep every type this RDV has had during the session selectable, so
  // reclassifying (e.g. Suivi → Consultation) never drops the previous type's
  // pill — the doctor can always switch back. Without this, a non-standard type
  // (suivi/procédure/urgence on older records), once left, cannot be reselected.
  const [seenTypes, setSeenTypes] = useState<AppointmentType[]>([]);

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

  // "Fixer le prochain rendez-vous" — schedule the follow-up RDV in-flow.
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("09:00");
  const [nextType, setNextType] = useState<AppointmentType>("controle");

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
          {doc.mimeType.startsWith("image/") ? (
            <a href={doc.data} target="_blank" rel="noopener noreferrer" className="appt-doc-link">{doc.filename}</a>
          ) : (
            <a href={doc.data} download={doc.filename} className="appt-doc-link">{doc.filename}</a>
          )}
        </div>
        <div className="appt-doc-meta">
          {fmtBytes(doc.sizeBytes)} · {new Date(doc.uploadedAt).toLocaleDateString(locale)}
          {doc.label && <span className="appt-doc-label"> · {doc.label}</span>}
        </div>
      </div>
      <button
        className="appt-doc-delete"
        title={t("common.delete")}
        onClick={() => { if (confirm(t("apptDetail.deleteFileConfirm", { name: doc.filename }))) deleteApptDocument(doc.id); }}
      >
        ×
      </button>
    </div>
  );

  // ── Consultation timer ────────────────────────────────────────────────────
  const [timerRunning, setTimerRunning]   = useState(false);
  const [timerSeconds, setTimerSeconds]   = useState(0);
  // Bilan measurements are usually keyed in by the secretary; the doctor mostly
  // reads them. So the doctor sees a compact results summary and only reveals
  // the input grid on demand. (The secretary/data-enterer always sees inputs.)
  const [showBilanEdit, setShowBilanEdit] = useState(false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

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
    const updated = { ...extraFields, [key]: value };
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

  const deleteMyTemplate = (id: string) => {
    if (!window.confirm(t("apptDetail.tplDeleteConfirm"))) return;
    setDoctorProfile({ ...doctorProfile, noteTemplates: myTemplates.filter(x => x.id !== id) });
  };

  // ── Extra bilan groups (any specialty) ────────────────────────────────────
  // Two sources are merged: the doctor's profile-level default set (shows on
  // every appointment, editable only by the doctor since it needs the profile
  // sync) and per-appointment additions (ride the appointment sync, so a
  // secretary can add a bilan and fill in the measurements at the desk).
  const profileBilanKeys = doctorProfile.extraBilans ?? [];
  const apptBilanKeys     = appt.extraBilans ?? [];
  const enabledBilanKeys  = [...new Set([...profileBilanKeys, ...apptBilanKeys])];
  const enabledBilans   = BILAN_CATALOG.filter(b => enabledBilanKeys.includes(b.key));
  const availableBilans = BILAN_CATALOG.filter(b => !enabledBilanKeys.includes(b.key));
  // Section 5 of the consultation always offers biology + radiology bilans.
  const bioBilan   = BILAN_CATALOG.find(b => b.key === "biologique");
  const radioBilan = BILAN_CATALOG.find(b => b.key === "radiologique");

  // ── Patient history, surfaced in-screen so the doctor never opens the patient
  // file mid-consultation. Plain consts (not hooks) — computed after the appt
  // guard above, so they must stay out of the hook list. ──────────────────────
  const pid = appt.patientId;
  const historyAppts = pid
    ? appointments
        .filter(a => a.patientId === pid && a.id !== appt.id)
        .sort((a, b) => b.date.localeCompare(a.date) || (b.startTime || "").localeCompare(a.startTime || ""))
    : [];
  const historyExams = pid
    ? examResults.filter(e => e.patientId === pid).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const historyRx = pid
    ? prescriptions.filter(p => p.patientId === pid).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const historyCount = historyAppts.length + historyExams.length + historyRx.length;

  const addBilan = (key: string) => {
    if (!key || enabledBilanKeys.includes(key)) return;
    if (readOnly) {
      // Secretary: store on the appointment (cannot write the doctor profile).
      updateAppointment({ ...appt, extraBilans: [...apptBilanKeys, key] });
    } else {
      // Doctor: add to the profile default so it appears on future visits too.
      setDoctorProfile({ ...doctorProfile, extraBilans: [...profileBilanKeys, key] });
    }
  };
  const removeBilan = (key: string) => {
    // Remove from whichever source(s) hold it. A secretary can only clear the
    // appointment-level copy; the doctor's profile default stays put for them.
    if (apptBilanKeys.includes(key)) {
      updateAppointment({ ...appt, extraBilans: apptBilanKeys.filter(k => k !== key) });
    }
    if (!readOnly && profileBilanKeys.includes(key)) {
      setDoctorProfile({ ...doctorProfile, extraBilans: profileBilanKeys.filter(k => k !== key) });
    }
  };
  // A bilan can be removed by this session when it lives on the appointment
  // (either role) or on the profile (doctor only).
  const canRemoveBilan = (key: string) =>
    apptBilanKeys.includes(key) || (!readOnly && profileBilanKeys.includes(key));

  const handleStatusChange = (s: AppointmentStatus) => {
    updateAppointment({ ...appt, status: s });
  };

  // ── Itemized billing ──────────────────────────────────────────────────────
  const billSubtotal  = billItems.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0);
  const billReductionN = Math.max(0, parseFloat(billReduction.replace(",", ".")) || 0);
  const billTotal     = Math.max(0, billSubtotal - billReductionN);
  const billCollectedN = Math.min(billTotal, Math.max(0, parseFloat(billCollected.replace(",", ".")) || 0));
  const billRemaining  = Math.max(0, billTotal - billCollectedN);
  const pay = paymentSummary(appt);

  const openBillModal = () => {
    let total: number;
    if (appt.billedItems && appt.billedItems.length) {
      setBillItems(appt.billedItems.map(l => ({ ...l })));
      setBillReduction(appt.billedReduction ? String(appt.billedReduction) : "");
      total = appt.billedItems.reduce((s, l) => s + l.qty * l.unitPrice, 0) - (appt.billedReduction ?? 0);
    } else if (appt.preparedItems && appt.preparedItems.length) {
      // The doctor already composed the bill — the secretary only collects.
      setBillItems(appt.preparedItems.map(l => ({ ...l })));
      setBillReduction(appt.preparedReduction ? String(appt.preparedReduction) : "");
      total = appt.preparedItems.reduce((s, l) => s + l.qty * l.unitPrice, 0) - (appt.preparedReduction ?? 0);
    } else {
      const base = doctorProfile.appointmentPrices?.[appt.type] ?? appt.billedAmount ?? 200;
      setBillItems([{ label: APPT_TYPE_LABELS[appt.type], qty: 1, unitPrice: Number(base) || 0 }]);
      setBillReduction("");
      total = Number(base) || 0;
    }
    // Default to collecting the full amount; the secretary lowers it if the
    // patient pays part now and defers the rest.
    setBillCollected(String(Math.max(0, total)));
    setShowBill(true);
  };

  // Doctor saves the composed bill WITHOUT collecting — the secretary handles
  // encaissement (payment / partial / deferred) at the front desk.
  const handlePrepareBill = () => {
    const items = billItems
      .map(l => ({ label: l.label.trim(), qty: Math.max(1, Math.round(l.qty) || 1), unitPrice: Number(l.unitPrice) || 0 }))
      .filter(l => l.label.length > 0);
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

  const handleBill = () => {
    const items = billItems
      .map(l => ({ label: l.label.trim(), qty: Math.max(1, Math.round(l.qty) || 1), unitPrice: Number(l.unitPrice) || 0 }))
      .filter(l => l.label.length > 0);
    if (items.length === 0) return;
    const subtotal = items.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    // 0 MAD is a valid bill (free consultation): stamped billed, no ledger entry.
    const total    = Math.max(0, subtotal - billReductionN);
    // The patient may pay all, part, or none of it now — the rest is deferred.
    const collected = Math.min(total, Math.max(0, parseFloat(billCollected.replace(",", ".")) || 0));
    const now = new Date().toISOString();
    // The ledger is credited with cash actually received (deferred amounts are
    // recognised later when paid). Secretaries never touch the doctor's ledger.
    if (role !== "secretary" && collected > 0) {
      addTransaction({
        type: "RECETTE", amount: collected, date: appt.date,
        category: appt.type === "procedure" ? "acte_chirurgical" : "consultation",
        deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1,
        description: `${APPT_TYPE_LABELS[appt.type]} – ${appt.patientName}`,
      });
    }
    updateAppointment({
      ...appt,
      billedAt: now,
      billedAmount: total,
      billedItems: items,
      billedReduction: billReductionN > 0 ? billReductionN : undefined,
      paidAmount: collected,
      payments: collected > 0 ? [{ amount: collected, date: now, method: "cash" }] : [],
      // The prepared bill is consumed once invoiced (null survives JSON so the
      // secretary's merge-push actually clears it on the server).
      preparedItems: null,
      preparedReduction: null,
    });
    setShowBill(false);
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
    if (role !== "secretary") {
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

  const handleDelete = () => {
    if (!window.confirm(t("apptDetail.deleteConfirm", { name: appt.patientName }))) return;
    deleteAppointment(appt.id);
    navigate("/agenda");
  };

  // ── BMI ───────────────────────────────────────────────────────────────────
  const bmi = (() => {
    const w = parseFloat(weight), h = parseFloat(height);
    if (!w || !h || h <= 0) return null;
    return w / ((h / 100) ** 2);
  })();
  const bmiClass = bmi === null ? null : bmiClassify(bmi);
  const bmiLabel = bmiClass?.label ?? null;

  const typeColor   = APPT_TYPE_COLORS[appt.type];
  const hasNotes    = motif || exam || diag || treatment || Object.keys(extraFields).some((k) => extraFields[k]?.trim());
  const templatesByCat = NOTE_TEMPLATES.filter((t) => t.category === templateCat);

  const handleTypeChange = (newType: AppointmentType) => {
    updateAppointment({ ...appt, type: newType });
  };

  const hiddenTypes = doctorProfile.hiddenConsultationTypes ?? [];
  const visibleTypes = Array.from(new Set<AppointmentType>([
    ...STANDARD_TYPES,
    ...seenTypes,          // every type this RDV has had this session stays selectable
    appt.type,
  ])).filter(t => !hiddenTypes.includes(t) || t === appt.type || seenTypes.includes(t));

  const specialtyGroups = getSpecialtyGroups(doctorProfile.specialtyLabel);

  // Flatten every bilan/specialty field, then keep only the ones that hold a
  // value — this is the compact "results" list the doctor reads at a glance.
  const bilanFieldList = [...specialtyGroups, ...enabledBilans].flatMap(g =>
    g.fields.map(f => ({ field: f, groupTitle: g.title })),
  );
  const filledBilan = bilanFieldList.filter(x => (extraFields[x.field.key] ?? "").trim() !== "");
  // Who keys the measurements in: a secretary (the data-enterer) always gets the
  // input grid; the doctor gets the compact results and an explicit "edit" toggle
  // — unless nothing has been entered yet, in which case show the inputs so the
  // measurements can be captured directly.
  const showBilanInputs = !bilanReadOnly && (readOnly || showBilanEdit || filledBilan.length === 0);

  return (
    <Layout
      title={appt.patientName}
      subtitle={`${fmtDate(appt.date, locale)} · ${appt.startTime} → ${appt.endTime}`}
    >
      {/* ── Back link ── */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/agenda" className="appt-back-link">
          {t("apptDetail.backLink")}
        </Link>
      </div>

      {/* ── Header card ── */}
      <div className="appt-detail-header">
        <div className="appt-detail-meta">
          {/* Inline consultation type selector */}
          <div className="appt-type-pills" title={t("apptDetail.typeLabel")}>
            {visibleTypes.map((type) => {
              const c = APPT_TYPE_COLORS[type];
              const active = appt.type === type;
              return (
                <button
                  key={type}
                  className={`appt-type-pill${active ? " active" : ""}`}
                  style={active ? { background: c + "20", color: c, borderColor: c } : undefined}
                  onClick={() => handleTypeChange(type)}
                  type="button"
                >
                  {t(`apptType.${type}`)}
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

      {/* ── Tab bar ── */}
      <div className="appt-tabs">
        {([
          { key: "notes",  label: t("apptDetail.clinicalNotes"), dot: hasNotes },
          { key: "vitals", label: t("apptDetail.measuresTab"),   dot: !!appt.vitalSigns || filledBilan.length > 0 },
          { key: "history", label: t("apptDetail.historyTab"),   dot: historyCount > 0 },
          // The follow-up / AMO tab is financial — hidden from secretaries.
          ...(readOnly ? [] : [{ key: "suivi" as const, label: t("apptDetail.followup"), dot: !!appt.mutuellePapersFilled || !!appt.followUpDate }]),
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

          {/* 1 · Motif */}
          <div className="form-group appt-note-block">
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

          {/* 3 · Médicaments en cours (patient record) */}
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
                readOnly={readOnly}
              />
            ) : (
              <div className="appt-note-nolink">{t("apptDetail.historyNeedsPatient")}</div>
            )}
          </div>

          {/* 4 · Examen clinique + mesures (recorded in-flow) */}
          <div className="form-group appt-note-block">
            <div className="appt-note-label-row">
              <label className="form-label" style={{ margin: 0 }}>{t("apptDetail.examination")}</label>
              {!readOnly && <DictationButton lang={locale} onText={dictateInto("examination", setExam, exam)} />}
            </div>
            <textarea
              className="form-input appt-textarea"
              rows={4}
              placeholder={t("apptDetail.examPlaceholder")}
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              onBlur={() => saveNotes()}
              readOnly={readOnly}
            />
            <div className="appt-measures-inline" style={{ marginTop: 12 }}>
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
          </div>

          {/* 5 · Bilans biologique & radiologique (+ radiology attachments) */}
          <div className="appt-note-block">
            <label className="form-label" style={{ marginBottom: 6, display: "block" }}>{t("apptDetail.bilansBioRadio")}</label>
            {bioBilan && (
              <div className="specialty-group">
                <div className="specialty-group-title">{bioBilan.title}</div>
                <div className="specialty-fields-grid">
                  {bioBilan.fields.map((field: SpecialtyField) => (
                    <SpecialtyFieldInput
                      key={field.key}
                      field={field}
                      value={extraFields[field.key] ?? ""}
                      onChange={(v) => setExtraField(field.key, v)}
                      onBlur={(v) => saveExtraField(field.key, v)}
                      readOnly={bilanReadOnly}
                    />
                  ))}
                </div>
              </div>
            )}
            {radioBilan && (
              <div className="specialty-group">
                <div className="specialty-group-title">{radioBilan.title}</div>
                <div className="specialty-fields-grid">
                  {radioBilan.fields.map((field: SpecialtyField) => (
                    <SpecialtyFieldInput
                      key={field.key}
                      field={field}
                      value={extraFields[field.key] ?? ""}
                      onChange={(v) => setExtraField(field.key, v)}
                      onBlur={(v) => saveExtraField(field.key, v)}
                      readOnly={bilanReadOnly}
                    />
                  ))}
                </div>
                {/* Radiology films / reports */}
                <div className="appt-radio-attach" style={{ marginTop: 8 }}>
                  <div className="appt-note-label-row">
                    <span className="specialty-group-title" style={{ margin: 0 }}>
                      {t("apptDetail.radioFiles")}
                      {radioDocs.length > 0 && <span className="appt-docs-count">{radioDocs.length}</span>}
                    </span>
                    {!bilanReadOnly && (
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => { setDocSizeWarn(false); radioFileRef.current?.click(); }}
                      >
                        {t("apptDetail.addRadioFile")}
                      </button>
                    )}
                    <input
                      ref={radioFileRef}
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleDocUpload("radiologie")}
                    />
                  </div>
                  {radioDocs.length > 0 && (
                    <div className="appt-docs-list">{radioDocs.map(renderDocRow)}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6 · Diagnostic */}
          <div className="form-group appt-note-block">
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
          <div className="form-group appt-note-block">
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
                <select className="form-select" style={{ maxWidth: 160 }} value={nextType} onChange={(e) => setNextType(e.target.value as AppointmentType)}>
                  {STANDARD_TYPES.map((tp) => <option key={tp} value={tp}>{t(`apptType.${tp}`)}</option>)}
                </select>
                <button className="btn btn-primary" type="button" disabled={!nextDate || !appt.patientId} onClick={scheduleNextAppt}>
                  {t("apptDetail.nextApptCreate")}
                </button>
              </div>
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
            <div className="appt-section-title">{t("apptDetail.vitalSigns")}</div>
          </div>

          <div className="vs-grid">
            {/* Blood pressure */}
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
            <VsInput label={t("apptDetail.weightLabel")} unit="kg"   value={weight} onChange={setWeight} onBlur={saveVitals} readOnly={vitalsReadOnly} />
            <VsInput label={t("apptDetail.heightLabel")} unit="cm"   value={height} onChange={setHeight} onBlur={saveVitals} readOnly={vitalsReadOnly} />
          </div>

          {bmi !== null && (
            <div className="vs-bmi-card">
              <div className="vs-bmi-value">{t("apptDetail.bmiLabel", { val: bmi.toFixed(1) })}</div>
              <div className="vs-bmi-label" style={{ color: bmiClass?.color ?? "var(--text)" }}>
                {bmiLabel}
              </div>
            </div>
          )}

          <div className="vs-legend">
            <span className="vs-legend-item" style={{ color: "var(--green)" }}>● {t("apptDetail.vsNormal")}</span>
            <span className="vs-legend-item" style={{ color: "var(--gold)" }}>● {t("apptDetail.vsLimit")}</span>
            <span className="vs-legend-item" style={{ color: "var(--coral)" }}>● {t("apptDetail.vsAbnormal")}</span>
            <span className="vs-legend-hint">{t("apptDetail.vsHint")}</span>
          </div>

          {/* ── Bilan clinique / specialty measurements — entered here (usually by
              the secretary), shown compactly in Notes cliniques for the doctor. ── */}
          {(specialtyGroups.length > 0 || enabledBilans.length > 0 || !bilanReadOnly) && (
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
                {!bilanReadOnly && availableBilans.length > 0 && (
                  <select
                    className="form-select"
                    style={{ marginLeft: "auto", fontSize: 12, padding: "3px 8px", maxWidth: 210 }}
                    value=""
                    onChange={(e) => addBilan(e.target.value)}
                    title={t("apptDetail.addBilanTitle")}
                  >
                    <option value="">+ {t("apptDetail.addBilan")}</option>
                    {availableBilans.map(b => (
                      <option key={b.key} value={b.key}>{b.title}</option>
                    ))}
                  </select>
                )}
              </div>
              {/* Compact results — read at a glance */}
              {filledBilan.length > 0 && (
                <div className="bilan-summary">
                  {filledBilan.map(({ field }) => (
                    <div key={field.key} className="bilan-summary-item">
                      <span className="bilan-summary-label">{field.label}</span>
                      <span className="bilan-summary-value">
                        {extraFields[field.key]}{field.unit ? ` ${field.unit}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Doctor toggles the input grid on demand; the secretary always sees it */}
              {!bilanReadOnly && !readOnly && filledBilan.length > 0 && (
                <button
                  type="button"
                  className="bilan-edit-toggle"
                  onClick={() => setShowBilanEdit(v => !v)}
                >
                  {showBilanInputs ? t("apptDetail.bilanHideInputs") : t("apptDetail.bilanEditInputs")}
                </button>
              )}

              {bilanReadOnly && filledBilan.length === 0 && (
                <div className="bilan-empty-hint">{t("apptDetail.bilanNoMeasures")}</div>
              )}

              {showBilanInputs && <>
              {specialtyGroups.map((group) => (
                <div key={group.title} className="specialty-group">
                  <div className="specialty-group-title">{group.title}</div>
                  <div className="specialty-fields-grid">
                    {group.fields.map((field: SpecialtyField) => (
                      <SpecialtyFieldInput
                        key={field.key}
                        field={field}
                        value={extraFields[field.key] ?? ""}
                        onChange={(v) => setExtraField(field.key, v)}
                        onBlur={(v) => saveExtraField(field.key, v)}
                        readOnly={bilanReadOnly}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {enabledBilans.map((group) => (
                <div key={group.key} className="specialty-group">
                  <div className="specialty-group-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {group.title}
                    {!bilanReadOnly && canRemoveBilan(group.key) && (
                      <button
                        type="button"
                        className="appt-detail-unlink-btn"
                        style={{ marginLeft: "auto" }}
                        onClick={() => removeBilan(group.key)}
                        title={t("apptDetail.removeBilan")}
                      >
                        {t("apptDetail.removeBilan")}
                      </button>
                    )}
                  </div>
                  <div className="specialty-fields-grid">
                    {group.fields.map((field: SpecialtyField) => (
                      <SpecialtyFieldInput
                        key={field.key}
                        field={field}
                        value={extraFields[field.key] ?? ""}
                        onChange={(v) => setExtraField(field.key, v)}
                        onBlur={(v) => saveExtraField(field.key, v)}
                        readOnly={bilanReadOnly}
                      />
                    ))}
                  </div>
                </div>
              ))}
              </>}
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
              {patient.allergies && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--coral-soft, #FDECEC)", color: "var(--coral, #C0392B)", border: "1px solid var(--coral, #C0392B)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13 }}>
                  <span>⚠</span><span><b>{t("apptDetail.allergiesLabel")} :</b> {patient.allergies}</span>
                </div>
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
                    const vitalsStr = vs ? [
                      vs.bpSys != null && vs.bpDia != null ? `TA ${vs.bpSys}/${vs.bpDia}` : "",
                      vs.hr != null ? `FC ${vs.hr}` : "",
                      vs.temp != null ? `T° ${vs.temp}` : "",
                      vs.weight != null ? `${vs.weight} kg` : "",
                    ].filter(Boolean).join(" · ") : "";
                    return (
                      <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <Link to={`/agenda/${a.id}`} className="appt-doc-link" style={{ fontWeight: 700 }}>{formatDateShort(a.date)}</Link>
                          <span style={{ fontSize: 11, fontWeight: 700, color: APPT_TYPE_COLORS[a.type] }}>{t(`apptType.${a.type}`)}</span>
                        </div>
                        {n?.motif && <div style={{ fontSize: 12.5 }}><b>{t("apptDetail.motif")} :</b> {n.motif}</div>}
                        {n?.diagnosis && <div style={{ fontSize: 12.5 }}><b>{t("apptDetail.diagnosis")} :</b> {n.diagnosis}</div>}
                        {n?.treatment && <div style={{ fontSize: 12.5 }}><b>{t("apptDetail.treatment")} :</b> {n.treatment}</div>}
                        {vitalsStr && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{vitalsStr}</div>}
                        {a.savedOrdonnance && a.savedOrdonnance.lines.length > 0 && (
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>℞ {a.savedOrdonnance.lines.map(l => l.drug).join(", ")}</div>
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
                        <div style={{ fontSize: 12.5 }}>℞ {p.lines.map(l => l.drug).join(", ")}</div>
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
                  consultationType: APPT_TYPE_LABELS[appt.type],
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
                      serviceLabel:   APPT_TYPE_LABELS[appt.type] + " médicale",
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
                      actLabel:      APPT_TYPE_LABELS[appt.type] + " médicale",
                      invoiceNumber: invNum,
                      issuedAt,
                      cnopsNumber:   pt?.cnopsNumber,
                    });
                    printFacture({
                      invoiceNumber:  invNum,
                      invoiceDate:    issuedAt.slice(0, 10),
                      patientName:    appt.patientName,
                      patientCnops:   pt?.cnopsNumber,
                      serviceLabel:   APPT_TYPE_LABELS[appt.type] + " médicale",
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
              <h2 className="modal-title">{t("apptDetail.billConsult")}</h2>
              <button className="modal-close" onClick={() => setShowBill(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                {t("apptDetail.billPatient", { name: appt.patientName, type: APPT_TYPE_LABELS[appt.type] })}
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
                  </div>
                ) : (
                  <div className="bill-line" key={i}>
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
                    <button
                      type="button"
                      className="bill-line-remove"
                      onClick={() => removeBillLine(i)}
                      disabled={billItems.length <= 1}
                      title={t("common.delete")}
                    >×</button>
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

              {/* Reduction — doctor's decision */}
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
              {!readOnly && (
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
                {t("apptDetail.addRevenue")}
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
          allergies={patient?.allergies}
          lastOrdonnance={lastOrdonnanceLines}
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
