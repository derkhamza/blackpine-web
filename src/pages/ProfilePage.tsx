import { FormEvent, useState } from "react";
import type { DoctorProfile } from "blackpine-engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import type { CabinetDoctorProfile } from "../lib/cabinetTypes";
import { SPECIALTIES } from "../lib/cabinetTypes";
import { useNavigate } from "react-router-dom";

type Marital  = DoctorProfile["maritalStatus"];
type Commune  = DoctorProfile["communeType"];
type Practice = DoctorProfile["practiceType"];
type LegalForm = DoctorProfile["legalForm"];

// ── Avatar helper ─────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="profile-section">
      <div className="profile-section-header">
        <div className="profile-section-title">{title}</div>
        {subtitle && <div className="profile-section-sub">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { profile, setProfile, user, logout } = useApp();
  const { doctorProfile, setDoctorProfile }   = useCabinet();
  const navigate = useNavigate();

  const [doc,   setDoc]   = useState<CabinetDoctorProfile>({ ...doctorProfile });
  const [fiscal, setFiscal] = useState<DoctorProfile>({ ...profile });
  const [toast,  setToast]  = useState<string | null>(null);

  const updateDoc   = <K extends keyof CabinetDoctorProfile>(k: K, v: CabinetDoctorProfile[K]) =>
    setDoc(p => ({ ...p, [k]: v }));
  const updateFiscal = <K extends keyof DoctorProfile>(k: K, v: DoctorProfile[K]) =>
    setFiscal(p => ({ ...p, [k]: v }));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setDoctorProfile(doc);
    setProfile(fiscal);
    showToast("Profil enregistré");
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const avatarText = doc.fullName ? initials(doc.fullName) : "?";
  const hasName    = doc.fullName.trim().length > 0;

  return (
    <Layout title="Mon profil" subtitle="Identité et paramètres fiscaux">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Section 1 : Identité du médecin ── */}
        <Section
          title="Identité du médecin"
          subtitle="Utilisée pour les ordonnances, certificats et factures"
        >
          <div className="profile-identity-layout">
            {/* Avatar preview */}
            <div className="profile-avatar-col">
              <div className="profile-avatar-large" style={{ opacity: hasName ? 1 : 0.35 }}>
                {avatarText}
              </div>
              <div className="profile-avatar-name">
                {hasName ? doc.fullName : "Votre nom"}
              </div>
              {doc.specialtyLabel && (
                <div className="profile-avatar-spec">{doc.specialtyLabel}</div>
              )}
              {doc.inpe && (
                <div className="profile-avatar-inpe">INPE · {doc.inpe}</div>
              )}
            </div>

            {/* Fields */}
            <div className="profile-fields-col">
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Nom complet *</label>
                  <input
                    className="form-input"
                    placeholder="Dr. Hamza Derkaoui"
                    value={doc.fullName}
                    onChange={e => updateDoc("fullName", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Spécialité</label>
                  <select
                    className="form-select"
                    value={doc.specialtyLabel ?? ""}
                    onChange={e => updateDoc("specialtyLabel", e.target.value || undefined)}
                  >
                    <option value="">— Choisir —</option>
                    {SPECIALTIES.map(s => (
                      <option key={s.id} value={s.label}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">N° INPE</label>
                  <input
                    className="form-input"
                    placeholder="1234567890"
                    value={doc.inpe ?? ""}
                    onChange={e => updateDoc("inpe", e.target.value || undefined)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone cabinet</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="0522 000 000"
                    value={doc.phone ?? ""}
                    onChange={e => updateDoc("phone", e.target.value || undefined)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Adresse du cabinet</label>
                <input
                  className="form-input"
                  placeholder="123 Bd. Mohammed V, Casablanca"
                  value={doc.address ?? ""}
                  onChange={e => updateDoc("address", e.target.value || undefined)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Tél. expert-comptable
                  <span className="form-label-hint"> (WhatsApp)</span>
                </label>
                <input
                  className="form-input"
                  type="tel"
                  placeholder="0600 000 000"
                  value={doc.accountantPhone ?? ""}
                  onChange={e => updateDoc("accountantPhone", e.target.value || undefined)}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 2 : Paramètres fiscaux ── */}
        <Section
          title="Paramètres fiscaux"
          subtitle="Utilisés pour le calcul IR et cotisation minimale"
        >
          <div className="profile-grid">
            <div className="form-group">
              <label className="form-label">Forme juridique</label>
              <select
                className="form-select"
                value={fiscal.legalForm}
                onChange={e => updateFiscal("legalForm", e.target.value as LegalForm)}
              >
                <option value="PERSONNE_PHYSIQUE">Personne physique</option>
                <option value="SARL">SARL</option>
                <option value="SA">SA</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Type de pratique</label>
              <select
                className="form-select"
                value={fiscal.practiceType}
                onChange={e => updateFiscal("practiceType", e.target.value as Practice)}
              >
                <option value="CABINET_ONLY">Cabinet uniquement</option>
                <option value="CLINIQUE_ONLY">Clinique uniquement</option>
                <option value="MIXED">Mixte (cabinet + clinique)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Début d'activité</label>
              <input
                type="date" className="form-input"
                value={fiscal.activityStartDate}
                onChange={e => updateFiscal("activityStartDate", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Commune</label>
              <input
                type="text" className="form-input"
                placeholder="Casablanca"
                value={fiscal.commune}
                onChange={e => updateFiscal("commune", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Type de commune</label>
              <select
                className="form-select"
                value={fiscal.communeType}
                onChange={e => updateFiscal("communeType", e.target.value as Commune)}
              >
                <option value="URBAN">Urbaine</option>
                <option value="RURAL">Rurale</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Situation matrimoniale</label>
              <select
                className="form-select"
                value={fiscal.maritalStatus}
                onChange={e => updateFiscal("maritalStatus", e.target.value as Marital)}
              >
                <option value="SINGLE">Célibataire</option>
                <option value="MARRIED">Marié(e)</option>
                <option value="DIVORCED">Divorcé(e)</option>
                <option value="WIDOWED">Veuf/Veuve</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Personnes à charge</label>
              <input
                type="number" className="form-input" min="0" max="6"
                value={fiscal.dependentsCount}
                onChange={e => updateFiscal("dependentsCount", parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="form-group" style={{ alignSelf: "flex-end", paddingBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={fiscal.tpRegistered}
                  onChange={e => updateFiscal("tpRegistered", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--navy)" }}
                />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Identifiant TP enregistré</span>
              </label>
            </div>
          </div>
        </Section>

        {/* Save bar */}
        <div className="profile-save-bar">
          <button type="submit" className="btn btn-primary" style={{ minWidth: 160 }}>
            Sauvegarder le profil
          </button>
        </div>
      </form>

      {/* ── Section 3 : Compte ── */}
      <div className="profile-section" style={{ marginTop: 20 }}>
        <div className="profile-section-header">
          <div className="profile-section-title">Compte</div>
        </div>
        <div className="profile-account-row">
          <div className="profile-account-avatar">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>
              {user?.email ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Compte Blackpine Cabinet
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLogout}
            style={{ color: "var(--coral)", borderColor: "var(--coral)" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
              <path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6M11 5l3 3-3 3M7 8h7"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Déconnexion
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
