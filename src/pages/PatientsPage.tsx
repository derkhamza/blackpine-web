import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { CsvImportModal } from "../components/CsvImportModal";
import { exportPatientsCsv } from "../lib/csvExport";
import { findOrphanAppts } from "../lib/orphanAppts";
import type { Patient, PatientGender } from "../lib/cabinetTypes";
import { MOROCCAN_CITIES, MUTUELLES } from "../lib/cabinetTypes";
import { useTranslation } from "react-i18next";
import { track } from "../lib/analytics";

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function initials(p: Patient): string {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

const AVATAR_COLORS = [
  "#1890C5","#15A876","#D4962A","#9B72D0","#E85B5B","#0A4E7E","#2ECC71","#E67E22",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Patient modal ─────────────────────────────────────────────────────────────

interface PatientModalProps {
  initial?: Patient | null;
  existingPatients?: Patient[];
  onSave: (p: Omit<Patient, "id" | "createdAt">) => void;
  onClose: () => void;
}

function normalizeName(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function PatientModal({ initial, existingPatients = [], onSave, onClose }: PatientModalProps) {
  const { t } = useTranslation();
  const [firstName,   setFirst]   = useState(initial?.firstName ?? "");
  const [lastName,    setLast]    = useState(initial?.lastName ?? "");
  const [arabicName,  setArabic]  = useState(initial?.arabicName ?? "");
  const [phone,       setPhone]   = useState(initial?.phone ?? "");
  const [dateOfBirth, setDob]     = useState(initial?.dateOfBirth ?? "");
  const [gender,      setGender]  = useState<PatientGender | "">(initial?.gender ?? "");
  const [bloodType,   setBlood]   = useState(initial?.bloodType ?? "");
  const [cin,         setCin]     = useState(initial?.cin ?? "");
  const [allergies,   setAllerg]  = useState(initial?.allergies ?? "");
  const [antecedents, setAntec]   = useState(initial?.antecedents ?? "");
  const [notes,       setNotes]   = useState(initial?.notes ?? "");
  const [city,        setCity]    = useState(initial?.city ?? "");
  const [cnops,       setCnops]   = useState(initial?.cnopsNumber ?? "");
  const [mutuelle,    setMutuelle] = useState(initial?.mutuelle ?? "");
  const [dupWarning,  setDupWarn] = useState<string | null>(null);

  const doSave = () => {
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      arabicName: arabicName.trim() || undefined,
      phone: phone || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender as PatientGender || undefined,
      bloodType: bloodType || undefined,
      cin: cin || undefined,
      allergies: allergies || undefined,
      antecedents: antecedents || undefined,
      notes: notes || undefined,
      city: city.trim() || undefined,
      cnopsNumber: cnops.trim() || undefined,
      mutuelle: mutuelle.trim() || undefined,
    });
    onClose();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    // Duplicate-name detection (only on creation). Two patients may legitimately
    // share a name, so this is a soft warning — "Créer quand même" forces it.
    if (!initial && !dupWarning) {
      const norm = normalizeName(`${firstName.trim()} ${lastName.trim()}`);
      const dup = existingPatients.find(p =>
        normalizeName(`${p.firstName} ${p.lastName}`) === norm
      );
      if (dup) {
        const dob = dup.dateOfBirth ? ` · ${dup.dateOfBirth}` : "";
        setDupWarn(`${dup.firstName} ${dup.lastName}${dob}`);
        return;
      }
    }

    doSave();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial ? t("patients.editPatient") : t("patients.newPatient")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("patients.firstName")}</label>
                <input className="form-input" value={firstName} onChange={e => setFirst(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{t("patients.lastName")}</label>
                <input className="form-input" value={lastName} onChange={e => setLast(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("patients.arabicName")}</label>
              <input
                className="form-input"
                dir="rtl"
                lang="ar"
                placeholder={t("patients.arabicNamePlaceholder")}
                value={arabicName}
                onChange={e => setArabic(e.target.value)}
              />
              <div className="settings-row-hint" style={{ marginTop: 4 }}>{t("patients.arabicNameHint")}</div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("patients.phone")}</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="06XXXXXXXX" />
              </div>
              <div className="form-group">
                <label className="form-label">{t("patients.dob")}</label>
                <input className="form-input" type="date" value={dateOfBirth} onChange={e => setDob(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("patients.gender")}</label>
                <select className="form-select" value={gender} onChange={e => setGender(e.target.value as PatientGender | "")}>
                  <option value="">—</option>
                  <option value="M">{t("patients.maleFull")}</option>
                  <option value="F">{t("patients.femaleFull")}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t("patients.bloodType")}</label>
                <select className="form-select" value={bloodType} onChange={e => setBlood(e.target.value)}>
                  <option value="">—</option>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g =>
                    <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t("patients.cin")}</label>
                <input className="form-input" value={cin} onChange={e => setCin(e.target.value)} placeholder="AB123456" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("patients.allergies")}</label>
              <input className="form-input" value={allergies} onChange={e => setAllerg(e.target.value)} placeholder={t("patients.allergiesPlaceholder")} />
            </div>
            <div className="form-group">
              <label className="form-label">{t("patients.antecedentsLabel")}</label>
              <input className="form-input" value={antecedents} onChange={e => setAntec(e.target.value)} placeholder={t("patients.antecedentsPlaceholder")} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("patients.city")}</label>
                <input
                  className="form-input"
                  list="new-patient-cities"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder={t("patients.cityPlaceholder")}
                />
                <datalist id="new-patient-cities">
                  {MOROCCAN_CITIES.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">{t("common.notes")}</label>
                <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("patients.notesPlaceholder")} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("patientDetail.cnopsLabel")}</label>
                <input className="form-input" value={cnops} onChange={e => setCnops(e.target.value)}
                  placeholder={t("patientDetail.cnopsPlaceholder")} />
              </div>
              <div className="form-group">
                <label className="form-label">{t("patientDetail.mutuelleLabel")}</label>
                <input className="form-input" list="new-patient-mutuelles" value={mutuelle}
                  onChange={e => setMutuelle(e.target.value)} placeholder={t("patientDetail.mutuellePlaceholder")} />
                <datalist id="new-patient-mutuelles">
                  {MUTUELLES.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
            </div>

            {dupWarning && (
              <div className="patient-dup-warning">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2L13 12H1L7 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M7 6v2.5M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>{t("patients.dupWarning", { name: dupWarning })}</span>
                <button type="button" className="patient-dup-ignore" onClick={doSave}>
                  {t("patients.dupIgnore")}
                </button>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("common.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Patient card ──────────────────────────────────────────────────────────────

function PatientCard({
  patient, apptCount, onDetail, onEdit, onDelete,
}: {
  patient: Patient; apptCount: number;
  onDetail: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  const age   = calcAge(patient.dateOfBirth);
  const color = avatarColor(patient.firstName + patient.lastName);

  return (
    <div className="patient-card rv-press rv-lift" onClick={onDetail}>
      <div className="patient-avatar" style={{ background: color + "22", color }}>
        {initials(patient)}
      </div>
      <div className="patient-info">
        <div className="patient-name">{patient.firstName} {patient.lastName}</div>
        <div className="patient-meta">
          {patient.gender && (
            <span style={{ color: "var(--muted)" }}>{patient.gender === "M" ? "♂" : "♀"}</span>
          )}
          {age !== null && <span style={{ color: "var(--muted)" }}>{age} {t("patients.age")}</span>}
          {patient.phone && <span style={{ color: "var(--muted)" }}>· {patient.phone}</span>}
        </div>
        <div className="patient-tags">
          {patient.bloodType && (
            <span className="patient-tag" style={{ background: "var(--coral-soft)", color: "var(--coral)", fontWeight: 800 }}>
              {patient.bloodType}
            </span>
          )}
          {patient.allergies && (
            <span className="patient-tag" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
              {t("patients.allergies")}
            </span>
          )}
          {apptCount > 0 && (
            <span className="patient-tag" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              {t("patients.apptCount", { n: apptCount })}
            </span>
          )}
        </div>
      </div>
      <div className="patient-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="appt-edit-btn" title={t("common.edit")} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="tx-delete" title={t("common.delete")} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3h10M5 3V2h4v1M4 3v9h6V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PatientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patients, appointments, addPatient, updatePatient, deletePatient, updateAppointment } = useCabinet();
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState<{ patient?: Patient } | null>(null);
  const [csvOpen,   setCsvOpen]   = useState(false);

  const showToast = useToast();

  const apptCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments) {
      if (a.patientId) map[a.patientId] = (map[a.patientId] ?? 0) + 1;
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(p =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    );
  }, [patients, search]);

  // Group alphabetically
  const sections = useMemo(() => {
    const sorted = [...filtered].sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
    );
    const groups: Record<string, Patient[]> = {};
    for (const p of sorted) {
      const letter = (p.lastName[0] ?? "#").toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(p);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <Layout
      title={t("patients.title")}
      subtitle={t("patients.subtitleCount", { n: patients.length, s: patients.length !== 1 ? "s" : "" })}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => { exportPatientsCsv(patients); showToast(t("patients.exportedCsv")); }}
            disabled={patients.length === 0}
            title={t("patients.exportCsvTitle")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t("patients.exportCsv")}
          </button>
          <button className="btn btn-ghost" onClick={() => setCsvOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 10V2M4 5l3-3 3 3M2 12h10"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t("patients.importCsv")}
          </button>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t("patients.newPatient")}
          </button>
        </div>
      }
    >
      {/* Search */}
      <div className="patients-search">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ color: "var(--muted)", flexShrink: 0 }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          className="patients-search-input"
          placeholder={t("patients.searchPlaceholder")}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}
            onClick={() => setSearch("")}
          >×</button>
        )}
      </div>

      {/* List */}
      {patients.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("patients.noPatients")}</div>
          <div style={{ marginBottom: 16 }}>{t("patients.noPatientsHint")}</div>
          <button className="btn btn-primary" onClick={() => setModal({})}>{t("patients.addPatient")}</button>
        </div>
      ) : sections.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontWeight: 700 }}>{t("patients.noResults", { q: search })}</div>
        </div>
      ) : (
        <div>
          {sections.map(([letter, group]) => (
            <div key={letter} className="patients-section">
              <div className="patients-section-hdr">{letter}</div>
              {group.map(p => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  apptCount={apptCountMap[p.id] ?? 0}
                  onDetail={() => navigate(`/patients/${p.id}`)}
                  onEdit={() => setModal({ patient: p })}
                  onDelete={() => {
                    if (confirm(t("patients.deleteConfirmName", { firstName: p.firstName, lastName: p.lastName }))) {
                      deletePatient(p.id);
                      showToast(t("patients.deleted"));
                    }
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <PatientModal
          initial={modal.patient}
          existingPatients={patients}
          onSave={p => {
            if (modal.patient) {
              updatePatient({ ...p, id: modal.patient.id, createdAt: modal.patient.createdAt });
              showToast(t("patients.modified"));
            } else {
              const created = addPatient(p);
              track("action:create_patient");
              // Attach appointments booked under this name before the record existed.
              const fullName = `${created.firstName} ${created.lastName}`.trim();
              const orphans = findOrphanAppts(appointments, fullName);
              orphans.forEach(a => updateAppointment({ ...a, patientId: created.id }));
              showToast(orphans.length
                ? t("patients.addedLinked", { count: orphans.length })
                : t("patients.added"));
            }
          }}
          onClose={() => setModal(null)}
        />
      )}

      {/* CSV import modal */}
      {csvOpen && (
        <CsvImportModal
          existingPatients={patients}
          onImport={list => {
            list.forEach(p => addPatient(p));
            showToast(t("patients.importedN", { n: list.length, s: list.length !== 1 ? "s" : "" }));
          }}
          onClose={() => setCsvOpen(false)}
        />
      )}

    </Layout>
  );
}
