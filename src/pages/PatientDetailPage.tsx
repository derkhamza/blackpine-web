import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Patient, PatientGender, VitalSigns, OrdonnanceLine } from "../lib/cabinetTypes";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS,
  EXAM_TYPE_LABELS, EXAM_TYPE_COLORS,
  CERT_TYPE_LABELS, CERT_TYPE_COLORS,
  TELE_STATUS_LABELS,
  MUTUELLES, MOROCCAN_CITIES,
} from "../lib/cabinetTypes";
import { formatMAD, formatDateShort, todayIso } from "../lib/format";
import { outstandingTotal } from "../lib/billing";
import { printPatientReport } from "../lib/patientReportPrinter";
import { printOrdonnance } from "../lib/ordonnancePrinter";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#1890C5","#15A876","#D4962A","#9B72D0","#E85B5B","#0A4E7E","#2ECC71","#E67E22",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function calcAge(dob?: string): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}
function fmtDate(iso: string, locale = "fr-FR") {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;

// ── Vitals trend chart ────────────────────────────────────────────────────────

interface TrendPoint { date: string; val: number; bad: boolean; }

function TrendChart({
  points, unit, label, yMin, yMax, dangerHigh, dangerLow, warnHigh,
}: {
  points: TrendPoint[];
  unit: string; label: string;
  yMin: number; yMax: number;
  dangerHigh?: number; dangerLow?: number; warnHigh?: number;
}) {
  if (points.length === 0) return null;
  const W = 320, H = 100, PAD = { t: 10, r: 8, b: 24, l: 36 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  // Adaptive precision so decimal lab values (glucose, HbA1c…) aren't rounded to int.
  const span = yMax - yMin;
  const fmt = (v: number) => span >= 20 ? Math.round(v).toString() : span >= 2 ? v.toFixed(1) : v.toFixed(2);
  const clamp = (v: number) => Math.max(yMin, Math.min(yMax, v));
  const toX = (i: number) =>
    points.length === 1 ? PAD.l + iW / 2 : PAD.l + (i / (points.length - 1)) * iW;
  const toY = (v: number) =>
    PAD.t + iH - ((clamp(v) - yMin) / (yMax - yMin)) * iH;

  const polyline = points.map((p, i) => `${toX(i)},${toY(p.val)}`).join(" ");

  const dotColor = (p: TrendPoint) =>
    p.bad ? "var(--coral)"
    : warnHigh && p.val > warnHigh ? "var(--gold)"
    : "var(--green)";

  return (
    <div className="vitals-chart-wrap">
      <div className="vitals-chart-label">{label} <span className="vitals-chart-unit">({unit})</span></div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {/* Danger zone fill */}
        {dangerHigh && dangerHigh < yMax && (
          <rect
            x={PAD.l} y={PAD.t}
            width={iW} height={toY(dangerHigh) - PAD.t}
            fill="rgba(232,91,91,0.07)"
          />
        )}
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD.t + iH * (1 - f);
          const v = yMin + (yMax - yMin) * f;
          return (
            <g key={f}>
              <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y}
                stroke="var(--border)" strokeWidth="0.5" />
              <text x={PAD.l - 4} y={y + 3.5} textAnchor="end"
                fontSize="8" fill="var(--tertiary)">{fmt(v)}</text>
            </g>
          );
        })}
        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--blue)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.val)} r={4} fill={dotColor(p)} />
            <text x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--muted)">
              {p.date.slice(5).replace("-", "/")}
            </text>
          </g>
        ))}
        {/* Last value */}
        <text
          x={toX(points.length - 1) + 8} y={toY(points[points.length - 1].val)}
          fontSize="9" fontWeight="700" fill={dotColor(points[points.length - 1])}
          dominantBaseline="middle"
        >
          {fmt(points[points.length - 1].val)} {unit}
        </text>
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PatientDetailPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { patientId } = useParams<{ patientId: string }>();
  const navigate      = useNavigate();
  const {
    patients, appointments,
    examResults, prescriptions, teleSessions, certificates, examRequests,
    updatePatient, deletePatient, doctorProfile, role,
  } = useCabinet();
  const { transactions } = useApp();
  const readOnly = role === "secretary"; // secretary: contact edits ok, clinical read-only

  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"timeline" | "dossier" | "consultations" | "vitals" | "ordonnances">("timeline");

  // ── Dossier inline fields ─────────────────────────────────────────────────
  const [bloodType,   setBloodType]   = useState("");
  const [allergies,   setAllergies]   = useState("");
  const [antecedents, setAntecedents] = useState("");
  const [medications, setMedications] = useState("");
  const [notes,       setNotes]       = useState("");
  const [cnops,       setCnops]       = useState("");
  const [mutuelle,    setMutuelle]    = useState("");
  const [city,        setCity]        = useState("");

  // ── Add timeline event ────────────────────────────────────────────────────
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [evtDate,  setEvtDate]  = useState(todayIso());
  const [evtTitle, setEvtTitle] = useState("");
  const [evtNotes, setEvtNotes] = useState("");

  const saveTimelineEvent = () => {
    if (!patient || !evtTitle.trim()) return;
    const ev = {
      id: `tl_${Date.now()}_${Math.round(performance.now())}`,
      date: evtDate, title: evtTitle.trim(), notes: evtNotes.trim() || undefined,
    };
    updatePatient({ ...patient, timelineEvents: [...(patient.timelineEvents ?? []), ev] });
    setShowAddEvent(false);
    setEvtDate(todayIso()); setEvtTitle(""); setEvtNotes("");
  };

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editFirst, setEFirst]  = useState("");
  const [editLast,  setELast]   = useState("");
  const [editPhone, setEPhone]  = useState("");
  const [editDob,   setEDob]    = useState("");
  const [editGender, setEGender] = useState<PatientGender | "">("");

  useEffect(() => {
    if (!patient) return;
    setBloodType(patient.bloodType ?? "");
    setAllergies(patient.allergies ?? "");
    setAntecedents(patient.antecedents ?? "");
    setMedications(patient.currentMedications ?? "");
    setNotes(patient.notes ?? "");
    setCnops(patient.cnopsNumber ?? "");
    setMutuelle(patient.mutuelle ?? "");
    setCity(patient.city ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  const openEdit = () => {
    if (!patient) return;
    setEFirst(patient.firstName);
    setELast(patient.lastName);
    setEPhone(patient.phone ?? "");
    setEDob(patient.dateOfBirth ?? "");
    setEGender(patient.gender ?? "");
    setShowEdit(true);
  };

  const saveDossier = () => {
    if (!patient) return;
    updatePatient({
      ...patient,
      bloodType:          bloodType    || undefined,
      allergies:          allergies.trim()   || undefined,
      antecedents:        antecedents.trim() || undefined,
      currentMedications: medications.trim() || undefined,
      notes:              notes.trim()       || undefined,
      cnopsNumber:        cnops.trim()       || undefined,
      mutuelle:           mutuelle.trim()    || undefined,
      city:               city.trim()        || undefined,
    });
  };

  const saveEdit = () => {
    if (!patient || !editFirst.trim() || !editLast.trim()) return;
    updatePatient({
      ...patient,
      firstName: editFirst.trim(), lastName: editLast.trim(),
      phone: editPhone || undefined,
      dateOfBirth: editDob || undefined,
      gender: (editGender || undefined) as PatientGender | undefined,
    });
    setShowEdit(false);
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const patientAppts = useMemo(
    () => [...appointments.filter((a) => a.patientId === patientId)]
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)),
    [appointments, patientId],
  );

  const completedAppts = patientAppts.filter((a) => a.status === "completed");
  const billedAppts    = patientAppts.filter((a) => !!a.billedAt);
  const patientOutstanding = useMemo(() => outstandingTotal(patientAppts), [patientAppts]);
  const ordAppts       = patientAppts.filter((a) => !!a.savedOrdonnance && a.savedOrdonnance.lines.length > 0);

  const fullName = patient ? `${patient.firstName} ${patient.lastName}` : "";

  // A document belongs to this patient when it carries this patient's id. As a
  // fallback for legacy documents that were saved with no id, we match by name —
  // but ONLY when the document has no id at all, so a document explicitly linked
  // to a *different* same-name patient never leaks onto this record.
  const belongsHere = (it: { patientId?: string; patientName?: string }) =>
    it.patientId === patientId || (!it.patientId && it.patientName === fullName);

  const patientRevenue = useMemo(() => {
    if (!fullName) return 0;
    return transactions
      .filter((tx) =>
        tx.type === "RECETTE" &&
        (tx.description ?? "").includes(fullName),
      )
      .reduce((s, tx) => s + tx.amount, 0);
  }, [transactions, fullName]);

  // Vitals data sets from appointments
  const vitalsAppts = useMemo(
    () => [...patientAppts]
      .filter((a) => a.vitalSigns && Object.values(a.vitalSigns).some((v) => v != null))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [patientAppts],
  );

  const bpPoints  = useMemo(() =>
    vitalsAppts
      .filter((a) => a.vitalSigns?.bpSys != null)
      .map((a) => ({ date: a.date, val: a.vitalSigns!.bpSys! / 10, bad: a.vitalSigns!.bpSys! > 140 || a.vitalSigns!.bpSys! < 90 })),
    [vitalsAppts]);

  const hrPoints  = useMemo(() =>
    vitalsAppts
      .filter((a) => a.vitalSigns?.hr != null)
      .map((a) => ({ date: a.date, val: a.vitalSigns!.hr!, bad: a.vitalSigns!.hr! > 100 || a.vitalSigns!.hr! < 50 })),
    [vitalsAppts]);

  const tempPoints = useMemo(() =>
    vitalsAppts
      .filter((a) => a.vitalSigns?.temp != null)
      .map((a) => ({ date: a.date, val: a.vitalSigns!.temp!, bad: a.vitalSigns!.temp! > 38.5 })),
    [vitalsAppts]);

  const weightPoints = useMemo(() =>
    vitalsAppts
      .filter((a) => a.vitalSigns?.weight != null)
      .map((a) => ({ date: a.date, val: a.vitalSigns!.weight!, bad: false })),
    [vitalsAppts]);

  const hasVitals = bpPoints.length > 0 || hrPoints.length > 0 || tempPoints.length > 0 || weightPoints.length > 0;

  // ── Lab-value trends: group numeric exam values by label across dates ────────
  const labSeries = useMemo(() => {
    const byLabel: Record<string, {
      label: string; unit: string; refMin?: number; refMax?: number; pts: TrendPoint[];
    }> = {};
    const exams = examResults
      .filter((e) => e.patientId === patientId)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const e of exams) {
      for (const v of e.values) {
        const num = parseFloat(String(v.value ?? "").replace(",", ".").replace(/[^\d.\-]/g, ""));
        if (!isFinite(num) || !v.label?.trim()) continue;
        const key = v.label.trim().toLowerCase();
        const bad = v.isAbnormal === true
          || (v.refMin != null && num < v.refMin)
          || (v.refMax != null && num > v.refMax);
        const s = byLabel[key] ??= { label: v.label.trim(), unit: v.unit ?? "", pts: [] };
        if (v.refMin != null) s.refMin = v.refMin;
        if (v.refMax != null) s.refMax = v.refMax;
        if (v.unit) s.unit = v.unit;
        s.pts.push({ date: e.date, val: num, bad });
      }
    }
    // A trend needs ≥2 points; compute a padded y-range per series.
    return Object.values(byLabel)
      .filter((s) => s.pts.length >= 2)
      .map((s) => {
        const vals = s.pts.map((p) => p.val);
        const lo = Math.min(...vals, s.refMin ?? Infinity);
        const hi = Math.max(...vals, s.refMax ?? -Infinity);
        const pad = ((hi - lo) || Math.abs(hi) || 1) * 0.15;
        return { ...s, yMin: lo - pad, yMax: hi + pad };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [examResults, patientId]);

  const hasTrends = hasVitals || labSeries.length > 0;

  // ── Unified timeline ──────────────────────────────────────────────────────
  const EXAM_ICONS: Record<string, string> = { biologie: "🔬", imagerie: "🩻", ecg: "💗", autre: "📋" };

  interface TLEntry {
    id: string; kind: string; date: string; sortKey: string;
    icon: string; color: string; title: string;
    subtitle?: string; detail?: string; link?: string;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tlEntries = useMemo<TLEntry[]>(() => {
    const entries: TLEntry[] = [];

    // Appointments (exclude cancelled / no-show)
    for (const a of patientAppts.filter((a) => a.status !== "cancelled" && a.status !== "no_show")) {
      const color = a.status === "completed" ? APPT_TYPE_COLORS[a.type] : "var(--tertiary)";
      let subtitle = a.consultationNote?.motif || a.consultationNote?.diagnosis || undefined;
      if (subtitle && subtitle.length > 90) subtitle = subtitle.slice(0, 90) + "…";
      const chips: string[] = [];
      if (a.vitalSigns && Object.values(a.vitalSigns).some((v) => v != null)) chips.push(t("patientDetail.tlVitals"));
      if (a.savedOrdonnance?.lines.length) chips.push(t("patientDetail.tlMeds", { n: a.savedOrdonnance.lines.length }));
      if (a.savedCertificates?.length) chips.push(t("patientDetail.tlCerts", { n: a.savedCertificates.length }));
      if (a.billedAt) chips.push(t("patientDetail.tlBilled"));
      entries.push({
        id: `rdv-${a.id}`, kind: "rdv",
        date: a.date, sortKey: a.date + "T" + a.startTime,
        icon: a.status === "completed" ? "🩺" : "📅",
        color,
        title: APPT_TYPE_LABELS[a.type] + (a.status !== "completed" ? ` · ${APPT_STATUS_LABELS[a.status]}` : ""),
        subtitle,
        detail: chips.length > 0 ? chips.join(" · ") : undefined,
        link: `/agenda/${a.id}`,
      });
    }

    // Standalone exams
    for (const e of examResults.filter((e) => e.patientId === patientId)) {
      const abnormal = e.values.filter((v) => v.isAbnormal).length;
      entries.push({
        id: `exam-${e.id}`, kind: "exam",
        date: e.date, sortKey: e.date + "T00:00",
        icon: EXAM_ICONS[e.type] ?? "📋",
        color: EXAM_TYPE_COLORS[e.type],
        title: e.title,
        subtitle: EXAM_TYPE_LABELS[e.type] + (e.labName ? ` · ${e.labName}` : ""),
        detail: abnormal > 0 ? t("patientDetail.tlExamAbnormal", { n: abnormal, s: abnormal > 1 ? "s" : "" }) : undefined,
        link: `/examens?focus=${e.id}`,
      });
    }

    // Standalone prescriptions
    for (const p of prescriptions.filter((p) => p.source === "standalone" && belongsHere(p))) {
      const first = p.lines[0];
      entries.push({
        id: `rx-${p.id}`, kind: "prescription",
        date: p.date, sortKey: p.date + "T00:01",
        icon: "℞", color: "#15A876",
        title: t("patientDetail.tlPrescription"),
        subtitle: first
          ? `${first.drug}${p.lines.length > 1 ? ` ${t("patientDetail.tlPrescMore", { n: p.lines.length - 1 })}` : ""}`
          : undefined,
        link: `/ordonnances?focus=${p.id}`,
      });
    }

    // Standalone certificates
    for (const c of certificates.filter((c) => c.source === "standalone" && belongsHere(c))) {
      let subtitle = c.content ?? c.reason ?? undefined;
      if (subtitle && subtitle.length > 80) subtitle = subtitle.slice(0, 80) + "…";
      entries.push({
        id: `cert-${c.id}`, kind: "certificate",
        date: c.date, sortKey: c.date + "T00:02",
        icon: "📄", color: CERT_TYPE_COLORS[c.type],
        title: CERT_TYPE_LABELS[c.type],
        subtitle,
        link: `/certificats?focus=${c.id}`,
      });
    }

    // Exam requests (demandes d'examens)
    for (const r of examRequests.filter((r) => belongsHere(r))) {
      const names = r.lines.map((l) => l.label).filter(Boolean);
      let subtitle = names.slice(0, 3).join(" · ");
      if (names.length > 3) subtitle += ` · +${names.length - 3}`;
      entries.push({
        id: `examreq-${r.id}`, kind: "examRequest",
        date: r.date, sortKey: r.date + "T00:02",
        icon: "🧪", color: "#1890C5",
        title: t("patientDetail.tlExamRequest"),
        subtitle: subtitle || undefined,
        link: `/documents?tab=examens&focus=${r.id}`,
      });
    }

    // Teleconsultations
    for (const s of teleSessions.filter((s) => belongsHere(s))) {
      entries.push({
        id: `tele-${s.id}`, kind: "teleconsult",
        date: s.scheduledDate, sortKey: s.scheduledDate + "T" + s.scheduledTime,
        icon: "💻", color: "#1890C5",
        title: t("patientDetail.tlTeleconsult"),
        subtitle: TELE_STATUS_LABELS[s.status] + (s.duration ? ` · ${s.duration} min` : ""),
        detail: s.notes ? s.notes.slice(0, 80) : undefined,
        link: `/teleconsult?focus=${s.id}`,
      });
    }

    // Custom events the doctor added directly to the timeline
    for (const ev of patient?.timelineEvents ?? []) {
      entries.push({
        id: `evt-${ev.id}`, kind: "event",
        date: ev.date, sortKey: ev.date + "T00:03",
        icon: "📌", color: "#D4962A",
        title: ev.title,
        subtitle: ev.notes || undefined,
      });
    }

    return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientAppts, examResults, prescriptions, certificates, examRequests, teleSessions, patient?.timelineEvents, patientId, fullName, i18n.language]);

  if (!patient) {
    return (
      <Layout title={t("patientDetail.notFound")} subtitle="">
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("patientDetail.notFound")}</div>
          <button className="btn btn-primary" onClick={() => navigate("/patients")}>
            {t("patientDetail.backLink")}
          </button>
        </div>
      </Layout>
    );
  }

  const color = avatarColor(fullName);
  const age   = calcAge(patient.dateOfBirth);

  const handleDelete = () => {
    if (!window.confirm(t("patientDetail.deleteConfirm", { name: fullName }))) return;
    deletePatient(patient.id);
    navigate("/patients");
  };

  return (
    <Layout
      title={fullName}
      subtitle={[
        age ? t("patientDetail.ageYears", { n: age }) : null,
        patient.gender === "M" ? t("patients.male") : patient.gender === "F" ? t("patients.female") : null,
      ].filter(Boolean).join(" · ") || t("nav.patients")}
    >
      {/* Back */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/patients" className="appt-back-link">{t("patientDetail.backLink")}</Link>
      </div>

      {/* ── Header card ── */}
      <div className="patient-header-card">
        <div className="patient-header-left">
          <div className="patient-header-avatar" style={{ background: color + "20", color }}>
            {`${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase()}
          </div>
          <div className="patient-header-info">
            <div className="patient-header-name">{fullName}</div>
            <div className="patient-header-meta">
              {age && <span>{t("patientDetail.ageYears", { n: age })}</span>}
              {patient.gender && <span>{patient.gender === "M" ? t("patients.male") : t("patients.female")}</span>}
              {patient.dateOfBirth && <span>{fmtDate(patient.dateOfBirth, locale)}</span>}
            </div>
            <div className="patient-header-tags">
              {patient.phone && (
                <span className="patient-tag" style={{ background: "var(--blue-soft)", color: "var(--navy)" }}>
                  📞 {patient.phone}
                </span>
              )}
              {(patient.bloodType || bloodType) && (
                <span className="patient-tag" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
                  🩸 {patient.bloodType || bloodType}
                </span>
              )}
              {(patient.cnopsNumber || cnops) && (
                <span className="patient-tag" style={{ background: "#6b46c118", color: "#6b46c1" }}>
                  AMO {patient.cnopsNumber || cnops}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="patient-header-stats">
          <div className="patient-stat">
            <div className="patient-stat-value">{patientAppts.length}</div>
            <div className="patient-stat-label">{t("patientDetail.statAppts")}</div>
          </div>
          <div className="patient-stat">
            <div className="patient-stat-value">{completedAppts.length}</div>
            <div className="patient-stat-label">{t("patientDetail.statCompleted")}</div>
          </div>
          {!readOnly && patientRevenue > 0 && (
            <div className="patient-stat">
              <div className="patient-stat-value" style={{ color: "var(--green)" }}>{formatMAD(patientRevenue)}</div>
              <div className="patient-stat-label">{t("patientDetail.statRevenue")}</div>
            </div>
          )}
          {patientOutstanding > 0 && (
            <div className="patient-stat">
              <div className="patient-stat-value" style={{ color: "var(--coral)" }}>{formatMAD(patientOutstanding)}</div>
              <div className="patient-stat-label">{t("patientDetail.statOutstanding")}</div>
            </div>
          )}
          <div className="patient-header-actions">
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={openEdit}>
              {t("patientDetail.editBtn")}
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => printPatientReport({
                patient,
                appointments:   patientAppts,
                doctorProfile,
                prescriptions:  prescriptions.filter(p => p.source === "standalone" && belongsHere(p)),
                examResults:    examResults.filter(e => e.patientId === patientId),
                certificates:   certificates.filter(c => belongsHere(c)),
              })}
              title={t("patientDetail.printTitle")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
              </svg>
              {t("patientDetail.printDossier")}
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, background: "var(--navy)" }}
              onClick={() => navigate(`/agenda?newAppt=${patient.id}`)}
            >
              + {t("patientDetail.newApptBtn")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="appt-tabs">
        {([
          { key: "timeline",    label: t("patientDetail.tabTimeline", { n: tlEntries.length }),       dot: tlEntries.length > 0 },
          { key: "dossier",     label: t("patientDetail.tabDossier"),                                 dot: false },
          { key: "consultations", label: t("patientDetail.tabConsultations", { n: patientAppts.length }), dot: patientAppts.length > 0 },
          { key: "vitals",      label: t("patientDetail.tabVitals"),                                  dot: hasTrends },
          { key: "ordonnances", label: t("patientDetail.tabOrdonnances", { n: ordAppts.length }),     dot: ordAppts.length > 0 },
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

      {/* ── TIMELINE ── */}
      {tab === "timeline" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.tlTitle")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                {t("patientDetail.tlEvents", { n: tlEntries.length, s: tlEntries.length !== 1 ? "s" : "" })}
              </span>
              {role !== "secretary" && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddEvent(true)}>
                  + {t("patientDetail.tlAddEvent")}
                </button>
              )}
            </div>
          </div>

          {tlEntries.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗒️</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("patientDetail.tlEmpty")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {t("patientDetail.tlEmptySub")}
              </div>
            </div>
          ) : (
            <div className="tl-list">
              {tlEntries.map((entry, idx) => {
                const showMonth =
                  idx === 0 ||
                  entry.date.slice(0, 7) !== tlEntries[idx - 1].date.slice(0, 7);
                const isLast = idx === tlEntries.length - 1;
                return (
                  <div key={entry.id}>
                    {showMonth && (
                      <div className="tl-month">
                        {new Date(entry.date + "T12:00:00").toLocaleDateString(locale, {
                          month: "long", year: "numeric",
                        })}
                      </div>
                    )}
                    <div
                      className={`tl-entry${entry.link ? " tl-entry-clickable" : ""}`}
                      onClick={entry.link ? () => navigate(entry.link!) : undefined}
                      role={entry.link ? "button" : undefined}
                      tabIndex={entry.link ? 0 : undefined}
                      onKeyDown={entry.link ? (e) => { if (e.key === "Enter") navigate(entry.link!); } : undefined}
                      style={entry.link ? { cursor: "pointer" } : undefined}
                    >
                      <div className="tl-icon-col">
                        <div className="tl-icon" style={{ background: entry.color + "18", color: entry.color }}>
                          {entry.icon}
                        </div>
                        {!isLast && <div className="tl-connector" />}
                      </div>
                      <div className="tl-body">
                        <div className="tl-row-top">
                          <span className="tl-title">{entry.title}</span>
                          <span className="tl-date">{fmtDate(entry.date, locale)}</span>
                        </div>
                        {entry.subtitle && <div className="tl-subtitle">{entry.subtitle}</div>}
                        {entry.detail && <div className="tl-detail">{entry.detail}</div>}
                        {entry.link && (
                          <span className="tl-link">{t("patientDetail.tlViewDetail")} →</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DOSSIER MÉDICAL ── */}
      {tab === "dossier" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.dossierTitle")}</div>
            <span style={{ fontSize: 11, color: "var(--tertiary)" }}>{t("patientDetail.dossierAutoSave")}</span>
          </div>

          <div className="patient-dossier-grid">
            {/* Blood type */}
            <div className="form-group">
              <label className="form-label">{t("patients.bloodType")}</label>
              <div className="blood-type-grid">
                {BLOOD_TYPES.map((bt) => (
                  <button
                    key={bt}
                    className={`blood-type-btn${(patient.bloodType || bloodType) === bt ? " active" : ""}`}
                    onClick={() => {
                      const next = (patient.bloodType || bloodType) === bt ? "" : bt;
                      setBloodType(next);
                      updatePatient({ ...patient, bloodType: next || undefined });
                    }}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* CNOPS */}
            <div className="form-group">
              <label className="form-label">{t("patientDetail.cnopsLabel")}</label>
              <input
                className="form-input"
                placeholder={t("patientDetail.cnopsPlaceholder")}
                value={cnops}
                onChange={(e) => setCnops(e.target.value)}
                onBlur={saveDossier}
              />
            </div>

            {/* Mutuelle */}
            <div className="form-group">
              <label className="form-label">{t("patientDetail.mutuelleLabel")}</label>
              <input
                className="form-input"
                list="mutuelle-list"
                placeholder={t("patientDetail.mutuellePlaceholder")}
                value={mutuelle}
                onChange={(e) => setMutuelle(e.target.value)}
                onBlur={saveDossier}
              />
              <datalist id="mutuelle-list">
                {MUTUELLES.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            {/* Ville */}
            <div className="form-group">
              <label className="form-label">{t("patientDetail.cityLabel")}</label>
              <input
                className="form-input"
                list="city-list"
                placeholder={t("patientDetail.cityPlaceholder")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={saveDossier}
              />
              <datalist id="city-list">
                {MOROCCAN_CITIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="patient-dossier-fields">
            <div className="form-group">
              <label className="form-label">{t("patients.allergies")}</label>
              <textarea
                className="form-input appt-textarea" rows={2}
                placeholder={t("patients.allergiesPlaceholder")}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                onBlur={saveDossier}
                readOnly={readOnly}
                style={{ borderColor: allergies ? "var(--coral)" : undefined }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("patients.antecedentsLabel")}</label>
              <textarea
                className="form-input appt-textarea" rows={3}
                placeholder={t("patients.antecedentsPlaceholder")}
                value={antecedents}
                onChange={(e) => setAntecedents(e.target.value)}
                onBlur={saveDossier}
                readOnly={readOnly}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("patientDetail.medications")}</label>
              <textarea
                className="form-input appt-textarea" rows={2}
                placeholder={t("patientDetail.medicationsPlaceholder")}
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                onBlur={saveDossier}
                readOnly={readOnly}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("patientDetail.clinicalNotes")}</label>
              <textarea
                className="form-input appt-textarea" rows={2}
                placeholder={t("patientDetail.clinicalNotesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveDossier}
                readOnly={readOnly}
              />
            </div>
          </div>

          {!readOnly && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                style={{ color: "var(--coral)", borderColor: "var(--coral)", fontSize: 12 }}
                onClick={handleDelete}
              >
                {t("patientDetail.deleteRecord")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── RENDEZ-VOUS ── */}
      {tab === "consultations" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.consultationsTitle")}</div>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={() => navigate("/agenda")}
            >
              + {t("patientDetail.newApptBtn")}
            </button>
          </div>

          {patientAppts.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("patientDetail.consultationsEmpty")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {t("patientDetail.consultationsEmptySub")}
              </div>
            </div>
          ) : (
            <div className="patient-rdv-list">
              {patientAppts.map((a) => {
                const color = APPT_TYPE_COLORS[a.type];
                const hasNote = !!(a.consultationNote?.motif || a.consultationNote?.diagnosis);
                return (
                  <Link
                    key={a.id}
                    to={`/agenda/${a.id}`}
                    className="patient-rdv-row"
                  >
                    <div className="patient-rdv-accent" style={{ background: a.status === "completed" ? color : "var(--border)" }} />
                    <div className="patient-rdv-body">
                      <div className="patient-rdv-date">{fmtDate(a.date, locale)} · {a.startTime}</div>
                      <div className="patient-rdv-badges">
                        <span className="appt-badge" style={{ background: color + "20", color }}>
                          {APPT_TYPE_LABELS[a.type]}
                        </span>
                        <span className="appt-badge" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
                          {APPT_STATUS_LABELS[a.status]}
                        </span>
                        {a.billedAt && (
                          <span className="appt-badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                            {t("patientDetail.rdvBilled")}
                          </span>
                        )}
                        {hasNote && (
                          <span className="appt-badge" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
                            {t("patientDetail.rdvNotes")}
                          </span>
                        )}
                      </div>
                      {a.consultationNote?.diagnosis && (
                        <div className="patient-rdv-diag">
                          {a.consultationNote.diagnosis.slice(0, 80)}{a.consultationNote.diagnosis.length > 80 ? "…" : ""}
                        </div>
                      )}
                    </div>
                    <div className="patient-rdv-arrow">›</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUIVI VITAUX ── */}
      {tab === "vitals" && (
        <div className="appt-tab-panel">
          {!hasTrends ? (
            <>
              <div className="appt-section-header">
                <div className="appt-section-title">{t("patientDetail.vitalsTitle")}</div>
              </div>
              <div className="tx-empty" style={{ padding: "32px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("patientDetail.vitalsEmpty")}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  {t("patientDetail.vitalsEmptySub")}
                </div>
              </div>
            </>
          ) : (
            <>
              {hasVitals && (
                <>
                  <div className="appt-section-header">
                    <div className="appt-section-title">{t("patientDetail.vitalsTitle")}</div>
                    <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                      {t("patientDetail.vitalsMeasures", { n: vitalsAppts.length, s: vitalsAppts.length !== 1 ? "s" : "" })}
                    </span>
                  </div>
                  <div className="vitals-charts-grid">
                    {bpPoints.length > 0 && (
                      <TrendChart
                        points={bpPoints} unit="cmHg" label={t("patientDetail.vitalsBp")}
                        yMin={8} yMax={18} dangerHigh={14} dangerLow={9} warnHigh={13}
                      />
                    )}
                    {hrPoints.length > 0 && (
                      <TrendChart
                        points={hrPoints} unit="bpm" label={t("patientDetail.vitalsHr")}
                        yMin={40} yMax={120} dangerHigh={100} dangerLow={50}
                      />
                    )}
                    {tempPoints.length > 0 && (
                      <TrendChart
                        points={tempPoints} unit="°C" label={t("patientDetail.vitalsTemp")}
                        yMin={35} yMax={41} dangerHigh={38.5} warnHigh={37.5}
                      />
                    )}
                    {weightPoints.length > 0 && (
                      <TrendChart
                        points={weightPoints} unit="kg" label={t("patientDetail.vitalsWeight")}
                        yMin={Math.max(0, Math.min(...weightPoints.map(p => p.val)) - 10)}
                        yMax={Math.max(...weightPoints.map(p => p.val)) + 10}
                      />
                    )}
                  </div>
                </>
              )}

              {labSeries.length > 0 && (
                <>
                  <div className="appt-section-header" style={{ marginTop: hasVitals ? 22 : 0 }}>
                    <div className="appt-section-title">{t("patientDetail.labsTitle")}</div>
                    <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                      {t("patientDetail.labsMeasures", { n: labSeries.length, s: labSeries.length !== 1 ? "s" : "" })}
                    </span>
                  </div>
                  <div className="vitals-charts-grid">
                    {labSeries.map((s) => (
                      <TrendChart
                        key={s.label}
                        points={s.pts} unit={s.unit} label={s.label}
                        yMin={s.yMin} yMax={s.yMax}
                        dangerHigh={s.refMax} dangerLow={s.refMin}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ORDONNANCES ── */}
      {tab === "ordonnances" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.ordTitle")}</div>
            <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
              {t("patientDetail.ordCount", { n: ordAppts.length, s: ordAppts.length !== 1 ? "s" : "" })}
            </span>
          </div>

          {ordAppts.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>℞</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("patientDetail.ordEmpty")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {t("patientDetail.ordEmptySub")}
              </div>
            </div>
          ) : (
            <div className="ord-history-list">
              {ordAppts.map(appt => (
                <div key={appt.id} className="ord-history-card">
                  <div className="ord-history-header">
                    <div>
                      <div className="ord-history-date">
                        {fmtDate(appt.date)} · {APPT_TYPE_LABELS[appt.type]}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {t("patientDetail.ordEdited", { date: new Date(appt.savedOrdonnance!.printedAt).toLocaleDateString(locale) })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        to={`/agenda/${appt.id}`}
                        className="payroll-print-btn"
                        style={{ textDecoration: "none" }}
                      >
                        {t("patientDetail.ordViewAppt")}
                      </Link>
                      <button
                        className="payroll-print-btn"
                        onClick={() => printOrdonnance({
                          lines:        appt.savedOrdonnance!.lines as OrdonnanceLine[],
                          patientName:  appt.patientName,
                          date:         appt.date,
                          doctorProfile,
                        })}
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}>
                          <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
                        </svg>
                        {t("patientDetail.ordReprint")}
                      </button>
                    </div>
                  </div>
                  <ol className="ord-history-lines">
                    {appt.savedOrdonnance!.lines.map((l, i) => (
                      <li key={i} className="ord-history-line">
                        <span className="ord-history-drug">{l.drug}</span>
                        {l.dosage && <span className="ord-history-meta"> — {l.dosage}</span>}
                        <span className="ord-history-meta"> · {l.frequency} · {l.duration}</span>
                        {l.notes && <span className="ord-history-note"> ({l.notes})</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit modal ── */}
      {showAddEvent && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddEvent(false); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">{t("patientDetail.tlAddEvent")}</h2>
              <button className="modal-close" onClick={() => setShowAddEvent(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: "0 0 160px" }}>
                  <label className="form-label">{t("patientDetail.tlEventDate")}</label>
                  <input className="form-input" type="date" value={evtDate} onChange={(e) => setEvtDate(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t("patientDetail.tlEventTitle")}</label>
                  <input className="form-input" value={evtTitle} onChange={(e) => setEvtTitle(e.target.value)}
                    placeholder={t("patientDetail.tlEventTitlePlaceholder")} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveTimelineEvent(); }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t("patientDetail.tlEventNotes")}</label>
                <textarea className="form-input" rows={3} value={evtNotes} onChange={(e) => setEvtNotes(e.target.value)}
                  placeholder={t("patientDetail.tlEventNotesPlaceholder")} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddEvent(false)}>{t("common.cancel")}</button>
              <button className="btn btn-primary" onClick={saveTimelineEvent} disabled={!evtTitle.trim()}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEdit(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">{t("patients.editPatient")}</h2>
              <button className="modal-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("patients.firstName")}</label>
                  <input className="form-input" value={editFirst} onChange={(e) => setEFirst(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("patients.lastName")}</label>
                  <input className="form-input" value={editLast} onChange={(e) => setELast(e.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("patients.phone")}</label>
                  <input className="form-input" type="tel" value={editPhone} onChange={(e) => setEPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("patients.dob")}</label>
                  <input className="form-input" type="date" value={editDob} onChange={(e) => setEDob(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t("patients.gender")}</label>
                <select className="form-select" value={editGender} onChange={(e) => setEGender(e.target.value as PatientGender | "")}>
                  <option value="">{t("patientDetail.editGenderNone")}</option>
                  <option value="M">{t("patients.male")}</option>
                  <option value="F">{t("patients.female")}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>{t("common.cancel")}</button>
              <button className="btn btn-primary" onClick={saveEdit}>{t("common.save")}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
