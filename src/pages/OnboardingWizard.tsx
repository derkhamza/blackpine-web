import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label={t("onboarding.ariaLabel")}>
      <div className="ob-card">

        {/* Skip link — only on steps 0-2 */}
        {step < 3 && (
          <button className="ob-skip" onClick={dismiss}>{t("onboarding.skip")}</button>
        )}

        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="ob-body ob-center">
            <div className="ob-icon-hero">🏥</div>
            <h1 className="ob-title">{t("onboarding.step0Title")}</h1>
            <p className="ob-sub">{t("onboarding.step0Sub")}</p>
            <StepDots step={0} />
            <button className="btn btn-primary ob-btn-main" onClick={next}>
              {t("onboarding.step0Btn")}
            </button>
          </div>
        )}

        {/* ── Step 1: Doctor profile ── */}
        {step === 1 && (
          <div className="ob-body">
            <StepDots step={1} />
            <h2 className="ob-title">{t("onboarding.step1Title")}</h2>
            <p className="ob-sub">{t("onboarding.step1Sub")}</p>

            <div className="ob-form">
              <label className="ob-label">
                {t("onboarding.fullNameLabel")} <span className="ob-required">*</span>
                <input
                  className={"ob-input" + (nameErr ? " ob-input-err" : "")}
                  placeholder={t("onboarding.fullNamePlaceholder")}
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); setNameErr(false); }}
                  autoFocus
                />
                {nameErr && <span className="ob-err">{t("onboarding.fullNameRequired")}</span>}
              </label>

              <label className="ob-label">
                {t("onboarding.specialtyLabel")}
                <select
                  className="ob-input ob-select"
                  value={specialtyLabel}
                  onChange={e => setSpecialtyLabel(e.target.value)}
                >
                  <option value="">{t("onboarding.specialtyDefault")}</option>
                  {SPECIALTIES.map(s => (
                    <option key={s.id} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className="ob-label">
                {t("onboarding.inpeLabel")}
                <input
                  className="ob-input"
                  placeholder={t("onboarding.inpePlaceholder")}
                  value={inpe}
                  onChange={e => setInpe(e.target.value)}
                />
              </label>
            </div>

            <div className="ob-footer">
              <button className="btn btn-ghost ob-btn-back" onClick={back}>{t("onboarding.back")}</button>
              <button className="btn btn-primary ob-btn-main" onClick={next}>{t("onboarding.next")}</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Cabinet info ── */}
        {step === 2 && (
          <div className="ob-body">
            <StepDots step={2} />
            <h2 className="ob-title">{t("onboarding.step2Title")}</h2>
            <p className="ob-sub">{t("onboarding.step2Sub")}</p>

            <div className="ob-form">
              <label className="ob-label">
                {t("onboarding.addressLabel")}
                <input
                  className="ob-input"
                  placeholder={t("onboarding.addressPlaceholder")}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  autoFocus
                />
              </label>

              <label className="ob-label">
                {t("onboarding.phoneLabel")}
                <input
                  className="ob-input"
                  placeholder={t("onboarding.phonePlaceholder")}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </label>
            </div>

            <div className="ob-footer">
              <button className="btn btn-ghost ob-btn-back" onClick={back}>{t("onboarding.back")}</button>
              <button className="btn btn-primary ob-btn-main" onClick={next}>{t("onboarding.next")}</button>
            </div>
          </div>
        )}

        {/* ── Step 3: All done ── */}
        {step === 3 && (
          <div className="ob-body ob-center">
            <Avatar name={fullName} />
            <h2 className="ob-title ob-title-green">{t("onboarding.step3Title")}</h2>
            <p className="ob-sub">
              <strong>{fullName}</strong>
              {specialtyLabel ? ` · ${specialtyLabel}` : ""}
              {address ? <><br /><span className="ob-muted">{address}</span></> : null}
            </p>
            <div className="ob-check-list">
              <div className="ob-check-item">{t("onboarding.check1")}</div>
              <div className="ob-check-item">{t("onboarding.check2")}</div>
              <div className="ob-check-item">{t("onboarding.check3")}</div>
            </div>
            <button className="btn btn-primary ob-btn-main ob-btn-big" onClick={finish}>
              {t("onboarding.finish")}
            </button>
            <button className="ob-skip-inline" onClick={back}>{t("onboarding.modify")}</button>
          </div>
        )}

      </div>
    </div>
  );
}
