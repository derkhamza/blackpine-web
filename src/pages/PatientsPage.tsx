import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { CsvImportModal } from "../components/CsvImportModal";
import type { Patient, PatientGender } from "../lib/cabinetTypes";

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
  onSave: (p: Omit<Patient, "id" | "createdAt">) => void;
  onClose: () => void;
}

function PatientModal({ initial, onSave, onClose }: PatientModalProps) {
  const [firstName,   setFirst]   = useState(initial?.firstName ?? "");
  const [lastName,    setLast]    = useState(initial?.lastName ?? "");
  const [phone,       setPhone]   = useState(initial?.phone ?? "");
  const [dateOfBirth, setDob]     = useState(initial?.dateOfBirth ?? "");
  const [gender,      setGender]  = useState<PatientGender | "">(initial?.gender ?? "");
  const [bloodType,   setBlood]   = useState(initial?.bloodType ?? "");
  const [cin,         setCin]     = useState(initial?.cin ?? "");
  const [allergies,   setAllerg]  = useState(initial?.allergies ?? "");
  const [antecedents, setAntec]   = useState(initial?.antecedents ?? "");
  const [notes,       setNotes]   = useState(initial?.notes ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender as PatientGender || undefined,
      bloodType: bloodType || undefined,
      cin: cin || undefined,
      allergies: allergies || undefined,
      antecedents: antecedents || undefined,
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial ? "Modifier" : "Nouveau"} patient</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input className="form-input" value={firstName} onChange={e => setFirst(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" value={lastName} onChange={e => setLast(e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="06XXXXXXXX" />
              </div>
              <div className="form-group">
                <label className="form-label">Date de naissance</label>
                <input className="form-input" type="date" value={dateOfBirth} onChange={e => setDob(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Sexe</label>
                <select className="form-select" value={gender} onChange={e => setGender(e.target.value as PatientGender | "")}>
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Groupe sanguin</label>
                <select className="form-select" value={bloodType} onChange={e => setBlood(e.target.value)}>
                  <option value="">—</option>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g =>
                    <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">CIN</label>
                <input className="form-input" value={cin} onChange={e => setCin(e.target.value)} placeholder="AB123456" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Allergies</label>
              <input className="form-input" value={allergies} onChange={e => setAllerg(e.target.value)} placeholder="Pénicilline, …" />
            </div>
            <div className="form-group">
              <label className="form-label">Antécédents médicaux</label>
              <input className="form-input" value={antecedents} onChange={e => setAntec(e.target.value)} placeholder="Diabète, HTA, …" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Remarques, …" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
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
  const age   = calcAge(patient.dateOfBirth);
  const color = avatarColor(patient.firstName + patient.lastName);

  return (
    <div className="patient-card" onClick={onDetail}>
      <div className="patient-avatar" style={{ background: color + "22", color }}>
        {initials(patient)}
      </div>
      <div className="patient-info">
        <div className="patient-name">{patient.firstName} {patient.lastName}</div>
        <div className="patient-meta">
          {patient.gender && (
            <span style={{ color: "var(--muted)" }}>{patient.gender === "M" ? "♂" : "♀"}</span>
          )}
          {age !== null && <span style={{ color: "var(--muted)" }}>{age} ans</span>}
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
              Allergies
            </span>
          )}
          {apptCount > 0 && (
            <span className="patient-tag" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              {apptCount} RDV
            </span>
          )}
        </div>
      </div>
      <div className="patient-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="appt-edit-btn" title="Modifier" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="tx-delete" title="Supprimer" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
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
  const navigate = useNavigate();
  const { patients, appointments, addPatient, updatePatient, deletePatient } = useCabinet();
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState<{ patient?: Patient } | null>(null);
  const [csvOpen,   setCsvOpen]   = useState(false);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

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
      title="Patients"
      subtitle={`${patients.length} patient${patients.length !== 1 ? "s" : ""}`}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setCsvOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 10V2M4 5l3-3 3 3M2 12h10"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Importer CSV
          </button>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Nouveau patient
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
          placeholder="Rechercher par nom ou téléphone…"
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
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun patient</div>
          <div style={{ marginBottom: 16 }}>Ajoutez votre premier patient pour commencer.</div>
          <button className="btn btn-primary" onClick={() => setModal({})}>Ajouter un patient</button>
        </div>
      ) : sections.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontWeight: 700 }}>Aucun résultat pour « {search} »</div>
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
                    if (confirm(`Supprimer ${p.firstName} ${p.lastName} ?`)) {
                      deletePatient(p.id);
                      showToast("Patient supprimé");
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
          onSave={p => {
            if (modal.patient) updatePatient({ ...p, id: modal.patient.id, createdAt: modal.patient.createdAt });
            else addPatient(p);
            showToast(modal.patient ? "Patient modifié" : "Patient ajouté");
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
            showToast(`${list.length} patient${list.length !== 1 ? "s" : ""} importé${list.length !== 1 ? "s" : ""}`);
          }}
          onClose={() => setCsvOpen(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
