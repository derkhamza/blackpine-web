import { useState } from "react";
import { useCabinet } from "../context/CabinetContext";
import { SPECIALTIES } from "../lib/cabinetTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3;

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  return (
    <div className="ob-dots">
      {([0, 1, 2] as const).map(i => (
        <div
          key={i}
          className={"ob-dot" + (i === step ? " ob-dot-active" : i < step ? " ob-dot-done" : "")}
        />
      ))}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
  return (
    <div className="ob-avatar">
      <span>{initials || "Dr"}</span>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const { setDoctorProfile } = useCabinet();

  const [step, setStep] = useState<Step>(0);

  // Step 1 fields
  const [fullName,       setFullName]       = useState("");
  const [specialtyLabel, setSpecialtyLabel] = useState("");
  const [inpe,           setInpe]           = useState("");

  // Step 2 fields
  const [address, setAddress] = useState("");
  const [phone,   setPhone]   = useState("");

  // Errors
  const [nameErr, setNameErr] = useState(false);

  function dismiss() {
    localStorage.setItem("bp.onboarded", "1");
    onDone();
  }

  function next() {
    if (step === 1) {
      if (!fullName.trim()) { setNameErr(true); return; }
    }
    setStep((s) => (s + 1) as Step);
  }

  function back() {
    setStep((s) => (s - 1) as Step);
  }

  function finish() {
    setDoctorProfile({
      fullName:       fullName.trim(),
      specialtyLabel: specialtyLabel || undefined,
      inpe:           inpe.trim()    || undefined,
      address:        address.trim() || undefined,
      phone:          phone.trim()   || undefined,
    });
    localStorage.setItem("bp.onboarded", "1");
    onDone();
  }

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="Configuration du cabinet">
      <div className="ob-card">

        {/* Skip link — only on steps 0-2 */}
        {step < 3 && (
          <button className="ob-skip" onClick={dismiss}>Passer</button>
        )}

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="ob-body ob-center">
            <div className="ob-icon-hero">🏥</div>
            <h1 className="ob-title">Bienvenue sur Blackpine</h1>
            <p className="ob-sub">
              Configurons votre cabinet médical en&nbsp;2&nbsp;minutes pour personnaliser
              vos ordonnances, certificats et dossiers patients.
            </p>
            <StepDots step={0} />
            <button className="btn btn-primary ob-btn-main" onClick={next}>
              Configurer mon cabinet →
            </button>
          </div>
        )}

        {/* ── Step 1: Doctor profile ── */}
        {step === 1 && (
          <div className="ob-body">
            <StepDots step={1} />
            <h2 className="ob-title">Votre profil médecin</h2>
            <p className="ob-sub">Ces informations apparaîtront sur vos documents.</p>

            <div className="ob-form">
              <label className="ob-label">
                Nom complet <span className="ob-required">*</span>
                <input
                  className={"ob-input" + (nameErr ? " ob-input-err" : "")}
                  placeholder="Dr. Nom Prénom"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setNameErr(false); }}
                  autoFocus
                />
                {nameErr && <span className="ob-err">Ce champ est requis</span>}
              </label>

              <label className="ob-label">
                Spécialité
                <select
                  className="ob-input ob-select"
                  value={specialtyLabel}
                  onChange={e => setSpecialtyLabel(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {SPECIALTIES.map(s => (
                    <option key={s.id} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className="ob-label">
                N° INPE
                <input
                  className="ob-input"
                  placeholder="Facultatif"
                  value={inpe}
                  onChange={e => setInpe(e.target.value)}
                />
              </label>
            </div>

            <div className="ob-footer">
              <button className="btn btn-ghost ob-btn-back" onClick={back}>← Retour</button>
              <button className="btn btn-primary ob-btn-main" onClick={next}>Continuer →</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Cabinet info ── */}
        {step === 2 && (
          <div className="ob-body">
            <StepDots step={2} />
            <h2 className="ob-title">Votre cabinet</h2>
            <p className="ob-sub">Coordonnées affichées sur vos documents imprimés.</p>

            <div className="ob-form">
              <label className="ob-label">
                Adresse du cabinet
                <input
                  className="ob-input"
                  placeholder="123 Rue des Hôpitaux, Casablanca"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="ob-label">
                Téléphone
                <input
                  className="ob-input"
                  placeholder="+212 6XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </label>
            </div>

            <div className="ob-footer">
              <button className="btn btn-ghost ob-btn-back" onClick={back}>← Retour</button>
              <button className="btn btn-primary ob-btn-main" onClick={next}>Continuer →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: All done ── */}
        {step === 3 && (
          <div className="ob-body ob-center">
            <Avatar name={fullName} />
            <h2 className="ob-title ob-title-green">Tout est prêt !</h2>
            <p className="ob-sub">
              <strong>{fullName}</strong>
              {specialtyLabel ? ` · ${specialtyLabel}` : ""}
              {address ? <><br /><span className="ob-muted">{address}</span></> : null}
            </p>
            <div className="ob-check-list">
              <div className="ob-check-item">✅ Profil médecin configuré</div>
              <div className="ob-check-item">✅ Ordonnances &amp; certificats personnalisés</div>
              <div className="ob-check-item">✅ Dossiers patients prêts</div>
            </div>
            <button className="btn btn-primary ob-btn-main ob-btn-big" onClick={finish}>
              Commencer →
            </button>
            <button className="ob-skip-inline" onClick={back}>← Modifier</button>
          </div>
        )}

      </div>
    </div>
  );
}
