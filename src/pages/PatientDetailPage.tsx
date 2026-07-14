import { confirmDialog } from "../lib/confirm";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { tabProps } from "../lib/a11y";
import { Layout } from "../components/Layout";
import { ActionIcon } from "../components/ActionIcon";
import { fetchAttachment } from "../api/client";
import { GrowthCurve } from "../components/GrowthCurve";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Patient, PatientGender, VitalSigns, OrdonnanceLine } from "../lib/cabinetTypes";
import {
  apptTypeLabel, apptTypeColor, APPT_STATUS_LABELS,
  EXAM_TYPE_LABELS, EXAM_TYPE_COLORS,
  CERT_TYPE_LABELS, CERT_TYPE_COLORS,
  TELE_STATUS_LABELS,
  MUTUELLES, MOROCCAN_CITIES,
} from "../lib/cabinetTypes";
import { getSpecialtyGroups, BILAN_CATALOG } from "../lib/specialtyFields";
import { fileToDocPayload } from "../lib/fileToDoc";
import { formatMAD, formatDateShort, todayIso, calcAge } from "../lib/format";
import { fullName as fmtFullName, initials as fmtInitials, avatarColor } from "../lib/nameFormat";
import { outstandingTotal } from "../lib/billing";
import { printPatientReport } from "../lib/patientReportPrinter";
import { printOrdonnance } from "../lib/ordonnancePrinter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale = "fr-FR") {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;

function fmtBytesLocal(n: number): string {
  if (n < 1024)          return n + " o";
  if (n < 1024 * 1024)   return (n / 1024).toFixed(0) + " Ko";
  return (n / (1024 * 1024)).toFixed(1) + " Mo";
}

// ── Vitals trend chart ────────────────────────────────────────────────────────

interface TrendPoint { date: string; val: number; bad: boolean; }

// A single measured value inside a merged result row (a vital, a bilan measure, or a lab value).
interface ResultItem { label: string; value: string; unit?: string; bad?: boolean; }
// One dated entry in the unified "Résultats & mesures" list — either the measures taken
// during a consultation (vitals + bilan) or an external exam/lab result.
interface ResultRow {
  id: string; date: string; source: "consultation" | "exam";
  accent: string; title: string; sub?: string;
  items: ResultItem[]; notes?: string; abnormal: number;
}

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
    apptDocuments, addApptDocument, deleteApptDocument,
    updatePatient, deletePatient, doctorProfile, viewAsSecretary, syncState,
  } = useCabinet();
  const { transactions } = useApp();
  const readOnly = viewAsSecretary; // secretary (incl. doctor preview): contact edits ok, clinical read-only

  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"timeline" | "dossier" | "consultations" | "vitals" | "ordonnances" | "documents">("timeline");

  // ── Documents / bulk import (files from before the app) ────────────────────
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importLinkAppt, setImportLinkAppt] = useState<string>("");   // "" = dossier-level
  const [importing, setImporting] = useState(false);
  const [importWarn, setImportWarn] = useState<string | null>(null);

  // Timeline: which appointment entry is expanded inline (compact view of the
  // consultation without leaving the patient page).
  const [expandedTl, setExpandedTl] = useState<string | null>(null);

  // ── Dossier inline fields ─────────────────────────────────────────────────
  const [bloodType,   setBloodType]   = useState("");
  const [allergies,   setAllergies]   = useState("");
  const [antecedents, setAntecedents] = useState("");
  const [medications, setMedications] = useState("");
  const [notes,       setNotes]       = useState("");

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
  const [editArabic, setEArabic] = useState("");
  const [editPhone, setEPhone]  = useState("");
  const [editDob,   setEDob]    = useState("");
  const [editGender, setEGender] = useState<PatientGender | "">("");
  // AMO / mutuelle / ville are identity information, edited with the rest of
  // the patient info (not part of the dossier médical).
  const [editCnops,    setECnops]    = useState("");
  const [editMutuelle, setEMutuelle] = useState("");
  const [editCity,     setECity]     = useState("");

  useEffect(() => {
    if (!patient) return;
    setBloodType(patient.bloodType ?? "");
    setAllergies(patient.allergies ?? "");
    setAntecedents(patient.antecedents ?? "");
    setMedications(patient.currentMedications ?? "");
    setNotes(patient.notes ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  const openEdit = () => {
    if (!patient) return;
    setEFirst(patient.firstName);
    setELast(patient.lastName);
    setEArabic(patient.arabicName ?? "");
    setEPhone(patient.phone ?? "");
    setEDob(patient.dateOfBirth ?? "");
    setEGender(patient.gender ?? "");
    setECnops(patient.cnopsNumber ?? "");
    setEMutuelle(patient.mutuelle ?? "");
    setECity(patient.city ?? "");
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
    });
  };

  const saveEdit = () => {
    if (!patient || !editFirst.trim() || !editLast.trim()) return;
    updatePatient({
      ...patient,
      firstName: editFirst.trim(), lastName: editLast.trim(),
      arabicName: editArabic.trim() || undefined,
      phone: editPhone || undefined,
      dateOfBirth: editDob || undefined,
      gender: (editGender || undefined) as PatientGender | undefined,
      cnopsNumber: editCnops.trim() || undefined,
      mutuelle: editMutuelle.trim() || undefined,
      city: editCity.trim() || undefined,
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

  // "Patient depuis" — the earliest date we actually know about. createdAt alone
  // is wrong for patients imported/created after their first real visit, so take
  // the min of createdAt and the earliest appointment date (guarding bad dates).
  const patientSince = useMemo(() => {
    const cand: string[] = [];
    const cd = patient?.createdAt?.slice(0, 10);
    if (cd && /^\d{4}-\d{2}-\d{2}$/.test(cd)) cand.push(cd);
    for (const a of patientAppts) if (/^\d{4}-\d{2}-\d{2}/.test(a.date)) cand.push(a.date.slice(0, 10));
    if (!cand.length) return null;
    return cand.sort()[0];
  }, [patient?.createdAt, patientAppts]);
  const patientOutstanding = useMemo(() => outstandingTotal(patientAppts), [patientAppts]);
  const ordAppts       = patientAppts.filter((a) => !!a.savedOrdonnance && (a.savedOrdonnance.lines?.length ?? 0) > 0);

  // Every document that belongs to this patient: those imported at the dossier
  // level (patientId set) plus those uploaded to one of the patient's
  // appointments. Newest first.
  const patientDocs = useMemo(() => {
    const apptIds = new Set(patientAppts.map((a) => a.id));
    return apptDocuments
      .filter((d) => d.patientId === patientId || (d.appointmentId && apptIds.has(d.appointmentId)))
      .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
  }, [apptDocuments, patientAppts, patientId]);

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !patientId) return;
    setImporting(true);
    setImportWarn(null);
    let skipped = 0;
    for (const file of files) {
      const payload = await fileToDocPayload(file);
      if (!payload) { skipped++; continue; }
      addApptDocument({
        appointmentId: importLinkAppt || "",
        patientId,
        filename:   file.name,
        mimeType:   payload.mimeType,
        sizeBytes:  payload.sizeBytes,
        data:       payload.data,
        category:   "anterieur",
        uploadedAt: new Date().toISOString(),
      });
    }
    setImporting(false);
    if (skipped > 0) setImportWarn(t("patientDetail.docImportSkipped", { n: skipped }));
  };

  const openDoc = async (d: { data: string; filename: string }) => {
    // Resolve an object-storage marker to a real data URL first (inline data
    // passes through untouched), then data-URL → Blob so the browser opens it.
    let data = d.data;
    if (data.startsWith("blob:")) {
      const resolved = await fetchAttachment(data.slice(5));
      if (!resolved) return;
      data = resolved;
    }
    try {
      const [meta, b64] = data.split(",");
      const mime = /data:(.*?);/.exec(meta)?.[1] || "application/octet-stream";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      window.open(data, "_blank", "noopener");
    }
  };

  const fullName = patient ? fmtFullName(patient) : "";

  // A document belongs to this patient when it carries this patient's id. As a
  // fallback for legacy documents that were saved with no id, we match by name —
  // but ONLY when the document has no id at all, so a document explicitly linked
  // to a *different* same-name patient never leaks onto this record.
  const belongsHere = (it: { patientId?: string; patientName?: string }) =>
    it.patientId === patientId || (!it.patientId && it.patientName === fullName);

  // Unified ordonnance history: prescriptions saved on an appointment
  // (appt.savedOrdonnance) AND standalone ones created from Documents. Before,
  // the patient screen only showed the former, so standalone ordonnances never
  // appeared here.
  const ordHistory = useMemo(() => {
    const fromAppts = ordAppts.map((a) => ({
      key: `appt-${a.id}`, date: a.date, stamp: a.savedOrdonnance!.printedAt,
      lines: (a.savedOrdonnance!.lines ?? []) as OrdonnanceLine[],
      apptId: a.id as string | null, typeLabel: apptTypeLabel(a.type), patientName: a.patientName,
    }));
    const fromStandalone = prescriptions
      .filter((p) => p.source === "standalone" && belongsHere(p) && (p.lines?.length ?? 0) > 0)
      .map((p) => ({
        key: `rx-${p.id}`, date: p.date, stamp: p.createdAt,
        lines: (p.lines ?? []) as OrdonnanceLine[],
        apptId: null as string | null, typeLabel: t("patientDetail.ordStandalone"), patientName: p.patientName,
      }));
    return [...fromAppts, ...fromStandalone]
      .sort((a, b) => b.date.localeCompare(a.date) || b.stamp.localeCompare(a.stamp));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordAppts, prescriptions, patientId, fullName, i18n.language]);

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
      .map((a) => ({ date: a.date, val: a.vitalSigns!.bpSys!, bad: a.vitalSigns!.bpSys! > 140 || a.vitalSigns!.bpSys! < 90 })),
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

  // ── Bilan clinique measurements: evolution of the numeric point-of-care
  // measurements (glycémie capillaire, HbA1c, FE, etc.) entered per visit. ──────
  const bilanFieldMeta = useMemo(() => {
    const map = new Map<string, { label: string; unit?: string; type?: string }>();
    const groups = [...getSpecialtyGroups(doctorProfile.specialtyLabel), ...BILAN_CATALOG];
    for (const g of groups) for (const f of g.fields) map.set(f.key, { label: f.label, unit: f.unit, type: f.type });
    return map;
  }, [doctorProfile.specialtyLabel]);

  const bilanSeries = useMemo(() => {
    const byKey: Record<string, { label: string; unit: string; pts: TrendPoint[] }> = {};
    const appts = [...patientAppts]
      .filter((a) => a.consultationNote?.extraFields)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const a of appts) {
      const ef = a.consultationNote!.extraFields!;
      for (const [key, raw] of Object.entries(ef)) {
        if (String(raw ?? "").trim() === "") continue;
        const meta = bilanFieldMeta.get(key);
        // Only chart numeric fields (skip text / select measurements).
        if (meta && meta.type && meta.type !== "number") continue;
        const num = parseFloat(String(raw).replace(",", ".").replace(/[^\d.\-]/g, ""));
        if (!isFinite(num)) continue;
        const s = byKey[key] ??= { label: meta?.label ?? key, unit: meta?.unit ?? "", pts: [] };
        s.pts.push({ date: a.date, val: num, bad: false });
      }
    }
    return Object.values(byKey)
      .filter((s) => s.pts.length >= 2)
      .map((s) => {
        const vals = s.pts.map((p) => p.val);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = ((hi - lo) || Math.abs(hi) || 1) * 0.15;
        return { ...s, yMin: lo - pad, yMax: hi + pad };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [patientAppts, bilanFieldMeta]);

  // ── Unified "Résultats & mesures" list ───────────────────────────────────────
  // One dated entry per consultation (its vitals + bilan measures) and per external
  // exam result, merged and sorted newest-first. This is the single place a doctor
  // reads every measured value regardless of where it was captured — resolving the
  // felt redundancy between point-of-care measures and the Examens/bio module.
  const resultTimeline = useMemo<ResultRow[]>(() => {
    const rows: ResultRow[] = [];
    // Consultation-captured measures: vital signs + bilan clinique fields.
    for (const a of patientAppts) {
      const items: ResultItem[] = [];
      const vs = a.vitalSigns;
      if (vs) {
        if (vs.bpSys != null && vs.bpDia != null)
          items.push({ label: t("patientDetail.mTA"), value: `${vs.bpSys}/${vs.bpDia}`, unit: "mmHg", bad: vs.bpSys > 140 || vs.bpSys < 90 || vs.bpDia > 90 });
        if (vs.hr != null)     items.push({ label: t("patientDetail.mHR"), value: String(vs.hr), unit: "bpm", bad: vs.hr > 100 || vs.hr < 50 });
        if (vs.temp != null)   items.push({ label: t("patientDetail.mTemp"), value: String(vs.temp), unit: "°C", bad: vs.temp > 38.5 || vs.temp < 35 });
        if (vs.spo2 != null)   items.push({ label: "SpO₂", value: String(vs.spo2), unit: "%", bad: vs.spo2 < 92 });
        if (vs.weight != null) items.push({ label: t("patientDetail.mWeight"), value: String(vs.weight), unit: "kg" });
        if (vs.height != null) items.push({ label: t("patientDetail.mHeight"), value: String(vs.height), unit: "cm" });
      }
      const ef = a.consultationNote?.extraFields;
      if (ef) for (const [key, raw] of Object.entries(ef)) {
        if (String(raw ?? "").trim() === "") continue;
        const meta = bilanFieldMeta.get(key);
        items.push({ label: meta?.label ?? key, value: String(raw).trim(), unit: meta?.unit });
      }
      if (items.length === 0) continue;
      rows.push({
        id: "c-" + a.id, date: a.date, source: "consultation",
        accent: "#0A4E7E", title: t("patientDetail.srcConsult"),
        items, abnormal: items.filter((i) => i.bad).length,
      });
    }
    // External exam / lab results.
    for (const e of examResults.filter((e) => e.patientId === patientId)) {
      const items: ResultItem[] = (e.values ?? []).map((v) => {
        const num = parseFloat(String(v.value ?? "").replace(",", ".").replace(/[^\d.\-]/g, ""));
        const bad = v.isAbnormal === true
          || (isFinite(num) && v.refMin != null && num < v.refMin)
          || (isFinite(num) && v.refMax != null && num > v.refMax);
        return { label: v.label, value: v.value, unit: v.unit, bad };
      });
      if (items.length === 0 && !e.notes?.trim()) continue;
      rows.push({
        id: "e-" + e.id, date: e.date, source: "exam",
        accent: EXAM_TYPE_COLORS[e.type], title: e.title || EXAM_TYPE_LABELS[e.type],
        sub: EXAM_TYPE_LABELS[e.type] + (e.labName ? ` · ${e.labName}` : ""),
        items, notes: e.notes?.trim() || undefined, abnormal: items.filter((i) => i.bad).length,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [patientAppts, examResults, patientId, bilanFieldMeta, t]);

  const hasResults = resultTimeline.length > 0;

  const hasTrends = hasVitals || labSeries.length > 0 || bilanSeries.length > 0;

  // Pediatric growth curve: shown for children (≤ 18 y). Age from date of birth.
  const isChild = useMemo(() => {
    if (!patient?.dateOfBirth) return false;
    const dob = new Date(patient.dateOfBirth + "T00:00:00");
    if (Number.isNaN(dob.getTime())) return false;
    const age = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
    return age >= 0 && age <= 18;
  }, [patient?.dateOfBirth]);

  // ── Unified timeline ──────────────────────────────────────────────────────
  const EXAM_ICONS: Record<string, string> = { biologie: "flask", imagerie: "xray", ecg: "heart", autre: "clipboard" };

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
      const color = a.status === "completed" ? apptTypeColor(a.type) : "var(--tertiary)";
      let subtitle = a.consultationNote?.motif || a.consultationNote?.diagnosis || undefined;
      if (subtitle && subtitle.length > 90) subtitle = subtitle.slice(0, 90) + "…";
      const chips: string[] = [];
      if (a.vitalSigns && Object.values(a.vitalSigns).some((v) => v != null)) chips.push(t("patientDetail.tlVitals"));
      if (a.savedOrdonnance?.lines?.length) chips.push(t("patientDetail.tlMeds", { n: a.savedOrdonnance.lines.length }));
      if (a.savedCertificates?.length) chips.push(t("patientDetail.tlCerts", { n: a.savedCertificates.length }));
      if (a.billedAt) chips.push(t("patientDetail.tlBilled"));
      entries.push({
        id: `rdv-${a.id}`, kind: "rdv",
        date: a.date, sortKey: a.date + "T" + a.startTime,
        icon: a.status === "completed" ? "stethoscope" : "calendar",
        color,
        title: apptTypeLabel(a.type) + (a.status !== "completed" ? ` · ${APPT_STATUS_LABELS[a.status]}` : ""),
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
        icon: EXAM_ICONS[e.type] ?? "clipboard",
        color: EXAM_TYPE_COLORS[e.type],
        title: e.title,
        subtitle: EXAM_TYPE_LABELS[e.type] + (e.labName ? ` · ${e.labName}` : ""),
        detail: abnormal > 0 ? t("patientDetail.tlExamAbnormal", { n: abnormal, s: abnormal > 1 ? "s" : "" }) : undefined,
        link: `/examens?focus=${e.id}`,
      });
    }

    // Standalone prescriptions
    for (const p of prescriptions.filter((p) => p.source === "standalone" && belongsHere(p))) {
      const first = p.lines?.[0];
      const rxCount = p.lines?.length ?? 0;
      entries.push({
        id: `rx-${p.id}`, kind: "prescription",
        date: p.date, sortKey: p.date + "T00:01",
        icon: "pills", color: "#15A876",
        title: t("patientDetail.tlPrescription"),
        subtitle: first
          ? `${first.drug}${rxCount > 1 ? ` ${t("patientDetail.tlPrescMore", { n: rxCount - 1 })}` : ""}`
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
        icon: "file", color: CERT_TYPE_COLORS[c.type],
        title: CERT_TYPE_LABELS[c.type],
        subtitle,
        link: `/certificats?focus=${c.id}`,
      });
    }

    // Exam requests (demandes d'examens)
    for (const r of examRequests.filter((r) => belongsHere(r))) {
      const names = (r.lines ?? []).map((l) => l.label).filter(Boolean);
      let subtitle = names.slice(0, 3).join(" · ");
      if (names.length > 3) subtitle += ` · +${names.length - 3}`;
      entries.push({
        id: `examreq-${r.id}`, kind: "examRequest",
        date: r.date, sortKey: r.date + "T00:02",
        icon: "flask", color: "#1890C5",
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
        icon: "monitor", color: "#1890C5",
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
        icon: "pin", color: "#D4962A",
        title: ev.title,
        subtitle: ev.notes || undefined,
      });
    }

    return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientAppts, examResults, prescriptions, certificates, examRequests, teleSessions, patient?.timelineEvents, patientId, fullName, i18n.language]);

  if (!patient) {
    // While a sync is in flight the patients array may be momentarily
    // incomplete — show a neutral loading state instead of flashing
    // "patient introuvable" at the user.
    if (syncState === "syncing") {
      return (
        <Layout title="…" subtitle="">
          <div className="tx-empty" style={{ padding: "48px 0" }}>
            <div className="auth-spinner" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("common.loading")}</div>
          </div>
        </Layout>
      );
    }
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

  const handleDelete = async () => {
    if (!await confirmDialog(t("patientDetail.deleteConfirm", { name: fullName }))) return;
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
            {fmtInitials(patient)}
          </div>
          <div className="patient-header-info">
            <div className="patient-header-name">{fullName}</div>
            <div className="patient-header-meta">
              {age && <span>{t("patientDetail.ageYears", { n: age })}</span>}
              {patient.gender && <span>{patient.gender === "M" ? t("patients.male") : t("patients.female")}</span>}
              {patient.dateOfBirth && <span>{fmtDate(patient.dateOfBirth, locale)}</span>}
            </div>
            <div className="patient-header-tags">
              {patient.phone && (() => {
                const digits = patient.phone.replace(/\D/g, "");
                const wa = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? "212" + digits.slice(1) : digits;
                return (
                  <span className="patient-tag patient-contact-tag" style={{ background: "var(--blue-soft)", color: "var(--navy)", padding: "0 4px 0 0", display: "inline-flex", alignItems: "center", gap: 2 }}>
                    <a href={`tel:${patient.phone}`} className="patient-contact-link" title={t("common.call", { defaultValue: "Appeler" })}>📞 {patient.phone}</a>
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="patient-contact-link" title="WhatsApp" aria-label="WhatsApp" style={{ color: "#25D366" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>
                    </a>
                  </span>
                );
              })()}
              {(patient.bloodType || bloodType) && (
                <span className="patient-tag" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
                  🩸 {patient.bloodType || bloodType}
                </span>
              )}
              {patient.cnopsNumber && (
                <span className="patient-tag" style={{ background: "#6b46c118", color: "#6b46c1" }}>
                  AMO {patient.cnopsNumber}
                </span>
              )}
              {patient.mutuelle && (
                <span className="patient-tag" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                  🏥 {patient.mutuelle}
                </span>
              )}
              {patient.city && (
                <span className="patient-tag" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
                  📍 {patient.city}
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
            {/* Secretaries manage the patient desk — deletion allowed for both roles. */}
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, color: "var(--coral)" }}
              onClick={handleDelete}
              title={t("patientDetail.deleteRecord")}
            >
              {t("patientDetail.deleteRecord")}
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
      <div className="appt-tabs" role="tablist">
        {([
          { key: "timeline",    label: t("patientDetail.tabTimeline", { n: tlEntries.length }),       dot: tlEntries.length > 0 },
          { key: "dossier",     label: t("patientDetail.tabDossier"),                                 dot: false },
          { key: "consultations", label: t("patientDetail.tabConsultations", { n: patientAppts.length }), dot: patientAppts.length > 0 },
          { key: "vitals",      label: t("patientDetail.tabVitals"),                                  dot: hasResults || isChild },
          { key: "ordonnances", label: t("patientDetail.tabOrdonnances", { n: ordHistory.length }),     dot: ordHistory.length > 0 },
          { key: "documents",   label: t("patientDetail.tabDocuments", { n: patientDocs.length }),      dot: patientDocs.length > 0 },
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

      {/* ── TIMELINE ── */}
      {tab === "timeline" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.tlTitle")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                {t("patientDetail.tlEvents", { n: tlEntries.length, s: tlEntries.length !== 1 ? "s" : "" })}
              </span>
              {!viewAsSecretary && (
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
                  (entry.date ?? "").slice(0, 7) !== (tlEntries[idx - 1].date ?? "").slice(0, 7);
                const isLast = idx === tlEntries.length - 1;
                // Appointments expand INLINE (compact consultation view) — the
                // doctor shouldn't need to leave the patient page for a recap.
                const isRdv = entry.kind === "rdv";
                const rdvAppt = isRdv ? patientAppts.find(a => `rdv-${a.id}` === entry.id) : undefined;
                const expanded = expandedTl === entry.id;
                const onEntryClick = isRdv
                  ? () => setExpandedTl(expanded ? null : entry.id)
                  : entry.link ? () => navigate(entry.link!) : undefined;
                return (
                  <div key={entry.id}>
                    {showMonth && entry.date && (
                      <div className="tl-month">
                        {new Date(entry.date + "T12:00:00").toLocaleDateString(locale, {
                          month: "long", year: "numeric",
                        })}
                      </div>
                    )}
                    <div
                      className={`tl-entry${onEntryClick ? " tl-entry-clickable" : ""}`}
                      onClick={onEntryClick}
                      role={onEntryClick ? "button" : undefined}
                      tabIndex={onEntryClick ? 0 : undefined}
                      onKeyDown={onEntryClick ? (e) => { if (e.key === "Enter") onEntryClick(); } : undefined}
                      style={onEntryClick ? { cursor: "pointer" } : undefined}
                    >
                      <div className="tl-icon-col">
                        <div className="tl-icon" style={{ background: entry.color + "18", color: entry.color }}>
                          <ActionIcon name={entry.icon} />
                        </div>
                        {!isLast && <div className="tl-connector" />}
                      </div>
                      <div className="tl-body">
                        <div className="tl-row-top">
                          <span className="tl-title">{entry.title}</span>
                          <span className="tl-date">
                            {fmtDate(entry.date, locale)}
                            {isRdv && (
                              <span className="tl-chevron">{expanded ? " ▲" : " ▼"}</span>
                            )}
                          </span>
                        </div>
                        {entry.subtitle && <div className="tl-subtitle">{entry.subtitle}</div>}
                        {entry.detail && <div className="tl-detail">{entry.detail}</div>}

                        {/* ── Compact inline consultation view ── */}
                        {expanded && rdvAppt && (
                          <div className="tl-expand" onClick={(e) => e.stopPropagation()}>
                            {rdvAppt.vitalSigns && Object.values(rdvAppt.vitalSigns).some(v => v != null) && (
                              <div className="tl-expand-vitals">
                                {rdvAppt.vitalSigns.bpSys != null && rdvAppt.vitalSigns.bpDia != null && (
                                  <span className="tl-vital-chip">TA {rdvAppt.vitalSigns.bpSys}/{rdvAppt.vitalSigns.bpDia} mmHg</span>
                                )}
                                {rdvAppt.vitalSigns.hr != null && <span className="tl-vital-chip">FC {rdvAppt.vitalSigns.hr} bpm</span>}
                                {rdvAppt.vitalSigns.temp != null && <span className="tl-vital-chip">{rdvAppt.vitalSigns.temp} °C</span>}
                                {rdvAppt.vitalSigns.spo2 != null && <span className="tl-vital-chip">SpO₂ {rdvAppt.vitalSigns.spo2}%</span>}
                                {rdvAppt.vitalSigns.weight != null && <span className="tl-vital-chip">{rdvAppt.vitalSigns.weight} kg</span>}
                              </div>
                            )}
                            {([
                              ["motif",       rdvAppt.consultationNote?.motif],
                              ["examination", rdvAppt.consultationNote?.examination],
                              ["diagnosis",   rdvAppt.consultationNote?.diagnosis],
                              ["treatment",   rdvAppt.consultationNote?.treatment],
                            ] as const).map(([key, val]) => val ? (
                              <div className="tl-expand-field" key={key}>
                                <span className="tl-expand-label">{t(`apptDetail.${key}`)}</span>
                                <span className="tl-expand-value">{val}</span>
                              </div>
                            ) : null)}
                            {(rdvAppt.savedOrdonnance?.lines?.length ?? 0) > 0 && (
                              <div className="tl-expand-field">
                                <span className="tl-expand-label">{t("patientDetail.tabOrdonnances", { n: "" }).trim()}</span>
                                <span className="tl-expand-value">
                                  {(rdvAppt.savedOrdonnance!.lines ?? []).map(l => l.drug).join(" · ")}
                                </span>
                              </div>
                            )}
                            {rdvAppt.billedAt && (
                              <div className="tl-expand-field">
                                <span className="tl-expand-label">{t("patientDetail.rdvBilled")}</span>
                                <span className="tl-expand-value">{formatMAD(rdvAppt.billedAmount ?? 0)}</span>
                              </div>
                            )}
                            {!rdvAppt.consultationNote && !rdvAppt.vitalSigns && !rdvAppt.billedAt && (
                              <div className="tl-expand-empty">{t("patientDetail.tlExpandEmpty")}</div>
                            )}
                            <button
                              className="tl-link"
                              style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
                              onClick={() => navigate(`/agenda/${rdvAppt.id}`)}
                            >
                              {t("patientDetail.tlViewDetail")} →
                            </button>
                          </div>
                        )}

                        {entry.link && !isRdv && (
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
          {/* Identification — the full identity record, read-only here (edited via
              the patient form). Gives the dossier every identifying detail at a
              glance alongside the medical information below. */}
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.idSectionTitle")}</div>
          </div>
          <div className="patient-id-card">
            {[
              [t("patientDetail.birthDate"), patient.dateOfBirth ? `${formatDateShort(patient.dateOfBirth)}${age != null ? ` · ${age} ${t("patientDetail.ageYears")}` : ""}` : null],
              [t("patients.gender"), patient.gender === "M" ? t("patients.male") : patient.gender === "F" ? t("patients.female") : null],
              [t("patients.phone"), patient.phone || null],
              [t("patients.cin"), patient.cin || null],
              [t("patients.cnops"), patient.cnopsNumber || null],
              [t("patientDetail.mutuelleLabel"), patient.mutuelle || null],
              [t("patients.city"), patient.city || null],
              [t("patientDetail.patientSince"), patientSince ? formatDateShort(patientSince) : null],
            ].filter(([, v]) => v).map(([label, v]) => (
              <div key={label as string} className="patient-id-row">
                <span className="patient-id-label">{label}</span>
                <span className="patient-id-val">{v}</span>
              </div>
            ))}
          </div>

          <div className="appt-section-header" style={{ marginTop: 18 }}>
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

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-ghost"
              style={{ color: "var(--coral)", borderColor: "var(--coral)", fontSize: 12 }}
              onClick={handleDelete}
            >
              {t("patientDetail.deleteRecord")}
            </button>
          </div>
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
                const color = apptTypeColor(a.type);
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
                          {apptTypeLabel(a.type)}
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
          {isChild && patient && (
            <div style={{ marginBottom: (hasResults || hasTrends) ? 22 : 0 }}>
              <div className="appt-section-header">
                <div className="appt-section-title">{t("growth.title")}</div>
                <span style={{ fontSize: 11, color: "var(--tertiary)" }}>{t("growth.subtitle")}</span>
              </div>
              <GrowthCurve patient={patient} appointments={appointments} />
            </div>
          )}
          {(!hasResults && !hasTrends) ? (
            !isChild && (
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
            )
          ) : (
            <>
              {hasResults && (
                <div style={{ marginBottom: hasTrends ? 24 : 0 }}>
                  <div className="appt-section-header">
                    <div className="appt-section-title">{t("patientDetail.resultsTitle")}</div>
                    <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                      {t("patientDetail.vitalsMeasures", { n: resultTimeline.length, s: resultTimeline.length !== 1 ? "s" : "" })}
                    </span>
                  </div>
                  <div className="res-hint">{t("patientDetail.resultsHint")}</div>
                  <div className="res-list">
                    {resultTimeline.map((r) => (
                      <div key={r.id} className="res-card" style={{ borderLeftColor: r.accent }}>
                        <div className="res-card-head">
                          <span className="res-src" style={{ background: r.accent }}>
                            {r.source === "consultation" ? t("patientDetail.srcConsult") : t("patientDetail.srcExam")}
                          </span>
                          <span className="res-ttl">{r.title}</span>
                          {r.sub && <span className="res-sub">{r.sub}</span>}
                          <span className="res-date">{fmtDate(r.date, locale)}</span>
                          {r.abnormal > 0 && (
                            <span className="res-flag">{t("patientDetail.resAbnormal", { n: r.abnormal })}</span>
                          )}
                        </div>
                        {r.items.length > 0 && (
                          <div className="res-items">
                            {r.items.map((it, i) => (
                              <span key={i} className={"res-chip" + (it.bad ? " bad" : "")}>
                                <span className="res-chip-l">{it.label}</span>
                                <span className="res-chip-v">{it.value}{it.unit ? " " + it.unit : ""}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {r.notes && <div className="res-notes">{r.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                        points={bpPoints} unit="mmHg" label={t("patientDetail.vitalsBp")}
                        yMin={80} yMax={180} dangerHigh={140} dangerLow={90} warnHigh={130}
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

              {bilanSeries.length > 0 && (
                <>
                  <div className="appt-section-header" style={{ marginTop: (hasVitals || labSeries.length > 0) ? 22 : 0 }}>
                    <div className="appt-section-title">{t("patientDetail.bilanTrendsTitle")}</div>
                    <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
                      {t("patientDetail.labsMeasures", { n: bilanSeries.length, s: bilanSeries.length !== 1 ? "s" : "" })}
                    </span>
                  </div>
                  <div className="vitals-charts-grid">
                    {bilanSeries.map((s) => (
                      <TrendChart
                        key={s.label}
                        points={s.pts} unit={s.unit} label={s.label}
                        yMin={s.yMin} yMax={s.yMax}
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
              {t("patientDetail.ordCount", { n: ordHistory.length, s: ordHistory.length !== 1 ? "s" : "" })}
            </span>
          </div>

          {ordHistory.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>℞</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("patientDetail.ordEmpty")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {t("patientDetail.ordEmptySub")}
              </div>
            </div>
          ) : (
            <div className="ord-history-list">
              {ordHistory.map(item => (
                <div key={item.key} className="ord-history-card">
                  <div className="ord-history-header">
                    <div>
                      <div className="ord-history-date">
                        {fmtDate(item.date)} · {item.typeLabel}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {t("patientDetail.ordEdited", { date: new Date(item.stamp).toLocaleDateString(locale) })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {item.apptId && (
                        <Link
                          to={`/agenda/${item.apptId}`}
                          className="payroll-print-btn"
                          style={{ textDecoration: "none" }}
                        >
                          {t("patientDetail.ordViewAppt")}
                        </Link>
                      )}
                      <button
                        className="payroll-print-btn"
                        onClick={() => printOrdonnance({
                          lines:        item.lines,
                          patientName:  item.patientName,
                          date:         item.date,
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
                    {(item.lines ?? []).map((l, i) => (
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

      {/* ── DOCUMENTS (imported / pre-app files) ── */}
      {tab === "documents" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">{t("patientDetail.docTitle")}</div>
            <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
              {t("patientDetail.docCount", { n: patientDocs.length })}
            </span>
          </div>

          {/* Import controls */}
          <div className="doc-import-bar">
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              {t("patientDetail.docImportHint")}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="form-select"
                style={{ maxWidth: 260 }}
                value={importLinkAppt}
                onChange={(e) => setImportLinkAppt(e.target.value)}
                title={t("patientDetail.docLinkTo")}
              >
                <option value="">{t("patientDetail.docLinkDossier")}</option>
                {patientAppts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fmtDate(a.date)} · {apptTypeLabel(a.type)}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                disabled={importing}
                onClick={() => importFileRef.current?.click()}
              >
                {importing ? t("patientDetail.docImporting") : t("patientDetail.docImportBtn")}
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                multiple
                style={{ display: "none" }}
                onChange={handleImportFiles}
              />
            </div>
            {importWarn && (
              <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{importWarn}</div>
            )}
          </div>

          {patientDocs.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("patientDetail.docEmpty")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("patientDetail.docEmptySub")}</div>
            </div>
          ) : (
            <div className="doc-list">
              {patientDocs.map((d) => {
                const linkedAppt = d.appointmentId
                  ? patientAppts.find((a) => a.id === d.appointmentId)
                  : null;
                return (
                  <div key={d.id} className="doc-row">
                    <div className="doc-row-icon">{d.mimeType.startsWith("image/") ? "🖼️" : "📄"}</div>
                    <div className="doc-row-main">
                      <div className="doc-row-name">{d.filename}</div>
                      <div className="doc-row-meta">
                        {fmtBytesLocal(d.sizeBytes)}
                        {" · "}
                        {new Date(d.uploadedAt).toLocaleDateString(locale)}
                        {linkedAppt
                          ? ` · ${t("patientDetail.docLinkedAppt", { date: fmtDate(linkedAppt.date) })}`
                          : ` · ${t("patientDetail.docDossierBadge")}`}
                      </div>
                    </div>
                    <div className="doc-row-actions">
                      <button className="payroll-print-btn" onClick={() => openDoc(d)}>
                        {t("patientDetail.docOpen")}
                      </button>
                      <button
                        className="doc-row-del"
                        title={t("common.delete")}
                        onClick={async () => { if (await confirmDialog(t("patientDetail.docDeleteConfirm", { name: d.filename }))) deleteApptDocument(d.id); }}
                      >×</button>
                    </div>
                  </div>
                );
              })}
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
                  <label className="form-label">{t("patients.lastName")}</label>
                  <input className="form-input" value={editLast} onChange={(e) => setELast(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("patients.firstName")}</label>
                  <input className="form-input" value={editFirst} onChange={(e) => setEFirst(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t("patients.arabicName")}</label>
                <input
                  className="form-input"
                  dir="rtl"
                  lang="ar"
                  placeholder={t("patients.arabicNamePlaceholder")}
                  value={editArabic}
                  onChange={(e) => setEArabic(e.target.value)}
                />
                <div className="settings-row-hint" style={{ marginTop: 4 }}>{t("patients.arabicNameHint")}</div>
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
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("patientDetail.cnopsLabel")}</label>
                  <input className="form-input" value={editCnops} onChange={(e) => setECnops(e.target.value)}
                    placeholder={t("patientDetail.cnopsPlaceholder")} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("patientDetail.mutuelleLabel")}</label>
                  <input className="form-input" list="mutuelle-list" value={editMutuelle}
                    onChange={(e) => setEMutuelle(e.target.value)} placeholder={t("patientDetail.mutuellePlaceholder")} />
                  <datalist id="mutuelle-list">
                    {MUTUELLES.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t("patientDetail.cityLabel")}</label>
                <input className="form-input" list="city-list" value={editCity}
                  onChange={(e) => setECity(e.target.value)} placeholder={t("patientDetail.cityPlaceholder")} />
                <datalist id="city-list">
                  {MOROCCAN_CITIES.map(c => <option key={c} value={c} />)}
                </datalist>
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
