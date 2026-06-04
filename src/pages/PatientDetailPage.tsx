import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Patient, PatientGender, VitalSigns, OrdonnanceLine } from "../lib/cabinetTypes";
import { APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS } from "../lib/cabinetTypes";
import { formatMAD, formatDateShort, todayIso } from "../lib/format";
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
function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
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
          const v = Math.round(yMin + (yMax - yMin) * f);
          return (
            <g key={f}>
              <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y}
                stroke="var(--border)" strokeWidth="0.5" />
              <text x={PAD.l - 4} y={y + 3.5} textAnchor="end"
                fontSize="8" fill="var(--tertiary)">{v}</text>
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
          {points[points.length - 1].val} {unit}
        </text>
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate      = useNavigate();
  const { patients, appointments, updatePatient, deletePatient, doctorProfile } = useCabinet();
  const { transactions } = useApp();

  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"dossier" | "rdv" | "vitals" | "ordonnances">("dossier");

  // ── Dossier inline fields ─────────────────────────────────────────────────
  const [bloodType,   setBloodType]   = useState("");
  const [allergies,   setAllergies]   = useState("");
  const [antecedents, setAntecedents] = useState("");
  const [medications, setMedications] = useState("");
  const [notes,       setNotes]       = useState("");
  const [cnops,       setCnops]       = useState("");

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
  const ordAppts       = patientAppts.filter((a) => !!a.savedOrdonnance && a.savedOrdonnance.lines.length > 0);

  const fullName = patient ? `${patient.firstName} ${patient.lastName}` : "";

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

  if (!patient) {
    return (
      <Layout title="Patient" subtitle="introuvable">
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Patient introuvable</div>
          <button className="btn btn-primary" onClick={() => navigate("/patients")}>
            Retour aux patients
          </button>
        </div>
      </Layout>
    );
  }

  const color = avatarColor(fullName);
  const age   = calcAge(patient.dateOfBirth);

  const handleDelete = () => {
    if (!window.confirm(`Supprimer le dossier de ${fullName} ?`)) return;
    deletePatient(patient.id);
    navigate("/patients");
  };

  return (
    <Layout
      title={fullName}
      subtitle={[age ? `${age} ans` : null, patient.gender === "M" ? "Homme" : patient.gender === "F" ? "Femme" : null].filter(Boolean).join(" · ") || "Patient"}
    >
      {/* Back */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/patients" className="appt-back-link">← Retour aux patients</Link>
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
              {age && <span>{age} ans</span>}
              {patient.gender && <span>{patient.gender === "M" ? "Homme" : "Femme"}</span>}
              {patient.dateOfBirth && <span>{fmtDate(patient.dateOfBirth)}</span>}
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
            <div className="patient-stat-label">RDV</div>
          </div>
          <div className="patient-stat">
            <div className="patient-stat-value">{completedAppts.length}</div>
            <div className="patient-stat-label">Terminés</div>
          </div>
          {patientRevenue > 0 && (
            <div className="patient-stat">
              <div className="patient-stat-value" style={{ color: "var(--green)" }}>{formatMAD(patientRevenue)}</div>
              <div className="patient-stat-label">Recettes</div>
            </div>
          )}
          <div className="patient-header-actions">
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={openEdit}>
              ✏️ Modifier
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => printPatientReport({ patient, appointments: patientAppts, doctorProfile })}
              title="Imprimer le dossier complet A4"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
              </svg>
              Dossier
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, background: "var(--navy)" }}
              onClick={() => navigate(`/agenda?newAppt=${patient.id}`)}
            >
              + Nouveau RDV
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="appt-tabs">
        {([
          { key: "dossier",     label: "Dossier médical",                        dot: false },
          { key: "rdv",         label: `Rendez-vous (${patientAppts.length})`,   dot: patientAppts.length > 0 },
          { key: "vitals",      label: "Suivi vitaux",                           dot: hasVitals },
          { key: "ordonnances", label: `Ordonnances (${ordAppts.length})`,       dot: ordAppts.length > 0 },
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

      {/* ── DOSSIER MÉDICAL ── */}
      {tab === "dossier" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">Dossier médical</div>
            <span style={{ fontSize: 11, color: "var(--tertiary)" }}>Auto-sauvegardé à la sortie du champ</span>
          </div>

          <div className="patient-dossier-grid">
            {/* Blood type */}
            <div className="form-group">
              <label className="form-label">Groupe sanguin</label>
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
              <label className="form-label">N° AMO / CNOPS / RAMED</label>
              <input
                className="form-input"
                placeholder="Numéro immatriculation…"
                value={cnops}
                onChange={(e) => setCnops(e.target.value)}
                onBlur={saveDossier}
              />
            </div>
          </div>

          <div className="patient-dossier-fields">
            <div className="form-group">
              <label className="form-label">Allergies</label>
              <textarea
                className="form-input appt-textarea" rows={2}
                placeholder="Pénicilline, aspirine, latex…"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                onBlur={saveDossier}
                style={{ borderColor: allergies ? "var(--coral)" : undefined }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Antécédents médicaux</label>
              <textarea
                className="form-input appt-textarea" rows={3}
                placeholder="HTA, diabète, cardiopathie…"
                value={antecedents}
                onChange={(e) => setAntecedents(e.target.value)}
                onBlur={saveDossier}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Médicaments en cours</label>
              <textarea
                className="form-input appt-textarea" rows={2}
                placeholder="Metformine 1g 2×/j, Amlodipine 5mg…"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                onBlur={saveDossier}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes cliniques libres</label>
              <textarea
                className="form-input appt-textarea" rows={2}
                placeholder="Observations, contexte social…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveDossier}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-ghost"
              style={{ color: "var(--coral)", borderColor: "var(--coral)", fontSize: 12 }}
              onClick={handleDelete}
            >
              Supprimer le dossier
            </button>
          </div>
        </div>
      )}

      {/* ── RENDEZ-VOUS ── */}
      {tab === "rdv" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">Historique des rendez-vous</div>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={() => navigate("/agenda")}
            >
              + Nouveau RDV
            </button>
          </div>

          {patientAppts.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucun rendez-vous</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Ce patient n'a pas encore de rendez-vous.
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
                      <div className="patient-rdv-date">{fmtDate(a.date)} · {a.startTime}</div>
                      <div className="patient-rdv-badges">
                        <span className="appt-badge" style={{ background: color + "20", color }}>
                          {APPT_TYPE_LABELS[a.type]}
                        </span>
                        <span className="appt-badge" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
                          {APPT_STATUS_LABELS[a.status]}
                        </span>
                        {a.billedAt && (
                          <span className="appt-badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                            ✓ Facturé
                          </span>
                        )}
                        {hasNote && (
                          <span className="appt-badge" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
                            📋 Notes
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
          <div className="appt-section-header">
            <div className="appt-section-title">Évolution des signes vitaux</div>
            <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
              {vitalsAppts.length} mesure{vitalsAppts.length !== 1 ? "s" : ""} enregistrée{vitalsAppts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {!hasVitals ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucune mesure disponible</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Enregistrez les signes vitaux lors des consultations pour voir l'évolution ici.
              </div>
            </div>
          ) : (
            <div className="vitals-charts-grid">
              {bpPoints.length > 0 && (
                <TrendChart
                  points={bpPoints} unit="mmHg" label="Tension systolique"
                  yMin={80} yMax={180} dangerHigh={140} dangerLow={90} warnHigh={130}
                />
              )}
              {hrPoints.length > 0 && (
                <TrendChart
                  points={hrPoints} unit="bpm" label="Fréquence cardiaque"
                  yMin={40} yMax={120} dangerHigh={100} dangerLow={50}
                />
              )}
              {tempPoints.length > 0 && (
                <TrendChart
                  points={tempPoints} unit="°C" label="Température"
                  yMin={35} yMax={41} dangerHigh={38.5} warnHigh={37.5}
                />
              )}
              {weightPoints.length > 0 && (
                <TrendChart
                  points={weightPoints} unit="kg" label="Poids"
                  yMin={Math.max(0, Math.min(...weightPoints.map(p => p.val)) - 10)}
                  yMax={Math.max(...weightPoints.map(p => p.val)) + 10}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ORDONNANCES ── */}
      {tab === "ordonnances" && (
        <div className="appt-tab-panel">
          <div className="appt-section-header">
            <div className="appt-section-title">Historique des ordonnances</div>
            <span style={{ fontSize: 11, color: "var(--tertiary)" }}>
              {ordAppts.length} ordonnance{ordAppts.length !== 1 ? "s" : ""} enregistrée{ordAppts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {ordAppts.length === 0 ? (
            <div className="tx-empty" style={{ padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>℞</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucune ordonnance</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Les prescriptions créées lors des consultations apparaissent ici.
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
                        Éditée le {new Date(appt.savedOrdonnance!.printedAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        to={`/agenda/${appt.id}`}
                        className="payroll-print-btn"
                        style={{ textDecoration: "none" }}
                      >
                        Voir le RDV →
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
                        Réimprimer
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
      {showEdit && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEdit(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le patient</h2>
              <button className="modal-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prénom</label>
                  <input className="form-input" value={editFirst} onChange={(e) => setEFirst(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom</label>
                  <input className="form-input" value={editLast} onChange={(e) => setELast(e.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="form-input" type="tel" value={editPhone} onChange={(e) => setEPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date de naissance</label>
                  <input className="form-input" type="date" value={editDob} onChange={(e) => setEDob(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Genre</label>
                <select className="form-select" value={editGender} onChange={(e) => setEGender(e.target.value as PatientGender | "")}>
                  <option value="">— Non précisé —</option>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveEdit}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
