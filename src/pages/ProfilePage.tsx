import { FormEvent, useState } from "react";
import type { DoctorProfile } from "blackpine-engine";
import { Layout } from "../components/Layout";
import { useApp } from "../context/AppContext";

type Marital = DoctorProfile["maritalStatus"];
type Commune = DoctorProfile["communeType"];
type Practice = DoctorProfile["practiceType"];
type LegalForm = DoctorProfile["legalForm"];

export function ProfilePage() {
  const { profile, setProfile } = useApp();
  const [form, setForm] = useState<DoctorProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof DoctorProfile>(k: K, v: DoctorProfile[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Layout title="Mon profil" subtitle="Paramètres fiscaux de votre cabinet">
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title">Informations fiscales</div>

          <div className="profile-grid">
            {/* Legal form */}
            <div className="form-group">
              <label className="form-label">Forme juridique</label>
              <select
                className="form-select"
                value={form.legalForm}
                onChange={(e) => update("legalForm", e.target.value as LegalForm)}
              >
                <option value="PERSONNE_PHYSIQUE">Personne physique</option>
                <option value="SARL">SARL</option>
                <option value="SA">SA</option>
              </select>
            </div>

            {/* Practice type */}
            <div className="form-group">
              <label className="form-label">Type de pratique</label>
              <select
                className="form-select"
                value={form.practiceType}
                onChange={(e) => update("practiceType", e.target.value as Practice)}
              >
                <option value="CABINET_ONLY">Cabinet uniquement</option>
                <option value="CLINIQUE_ONLY">Clinique uniquement</option>
                <option value="MIXED">Mixte (cabinet + clinique)</option>
              </select>
            </div>

            {/* Activity start */}
            <div className="form-group">
              <label className="form-label">Début d'activité</label>
              <input
                type="date" className="form-input"
                value={form.activityStartDate}
                onChange={(e) => update("activityStartDate", e.target.value)}
              />
            </div>

            {/* Commune */}
            <div className="form-group">
              <label className="form-label">Commune</label>
              <input
                type="text" className="form-input"
                placeholder="Casablanca"
                value={form.commune}
                onChange={(e) => update("commune", e.target.value)}
              />
            </div>

            {/* Commune type */}
            <div className="form-group">
              <label className="form-label">Type de commune</label>
              <select
                className="form-select"
                value={form.communeType}
                onChange={(e) => update("communeType", e.target.value as Commune)}
              >
                <option value="URBAN">Urbaine</option>
                <option value="RURAL">Rurale</option>
              </select>
            </div>

            {/* Marital status */}
            <div className="form-group">
              <label className="form-label">Situation matrimoniale</label>
              <select
                className="form-select"
                value={form.maritalStatus}
                onChange={(e) => update("maritalStatus", e.target.value as Marital)}
              >
                <option value="SINGLE">Célibataire</option>
                <option value="MARRIED">Marié(e)</option>
                <option value="DIVORCED">Divorcé(e)</option>
                <option value="WIDOWED">Veuf/Veuve</option>
              </select>
            </div>

            {/* Dependents */}
            <div className="form-group">
              <label className="form-label">Personnes à charge</label>
              <input
                type="number" className="form-input" min="0" max="6"
                value={form.dependentsCount}
                onChange={(e) => update("dependentsCount", parseInt(e.target.value) || 0)}
              />
            </div>

            {/* TP */}
            <div className="form-group" style={{ alignSelf: "center" }}>
              <label className="form-label">Identifiant TP</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={form.tpRegistered}
                  onChange={(e) => update("tpRegistered", e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Identifiant TP enregistré</span>
              </label>
            </div>
          </div>

          <div className="profile-save-bar">
            {saved && (
              <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
                ✓ Profil enregistré
              </span>
            )}
            <button type="submit" className="btn btn-primary">
              Sauvegarder
            </button>
          </div>
        </div>
      </form>

      {/* Info card */}
      <div className="card" style={{ marginTop: 16, background: "var(--blue-soft)", borderColor: "var(--blue)", borderWidth: 1 }}>
        <div className="card-title" style={{ color: "var(--navy)" }}>À propos de ces données</div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
          Ces informations sont utilisées pour personnaliser le calcul de votre IR (tranches, déductions familiales)
          et de votre cotisation minimale (CM). Elles sont identiques à celles configurées dans l'application Android
          et sont synchronisées automatiquement.
        </p>
      </div>
    </Layout>
  );
}
