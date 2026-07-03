import { FormEvent, useState } from "react";
import type { DoctorProfile } from "../engine";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import type { CabinetDoctorProfile } from "../lib/cabinetTypes";
import { SPECIALTIES } from "../lib/cabinetTypes";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`;
  if (d.length <= 8) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

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

export function ProfilePage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t } = useTranslation();
  const { profile, setProfile, user, logout } = useApp();
  const { doctorProfile, setDoctorProfile }   = useCabinet();
  const navigate = useNavigate();

  const [doc,   setDoc]   = useState<CabinetDoctorProfile>({ ...doctorProfile });
  const [fiscal, setFiscal] = useState<DoctorProfile>({ ...profile });

  const updateDoc   = <K extends keyof CabinetDoctorProfile>(k: K, v: CabinetDoctorProfile[K]) =>
    setDoc(p => ({ ...p, [k]: v }));
  const updateFiscal = <K extends keyof DoctorProfile>(k: K, v: DoctorProfile[K]) =>
    setFiscal(p => ({ ...p, [k]: v }));

  const showToast = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setDoctorProfile(doc);
    setProfile(fiscal);
    showToast(t("profile.saved"));
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const avatarText = doc.fullName ? initials(doc.fullName) : "?";
  const hasName    = (doc.fullName ?? "").trim().length > 0;

  const body = (
    <>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Section 1 : Identité du médecin ── */}
        <Section
          title={t("profile.doctorIdentity")}
          subtitle={t("profile.doctorIdentitySub")}
        >
          <div className="profile-identity-layout">
            {/* Avatar preview */}
            <div className="profile-avatar-col">
              <div className="profile-avatar-large" style={{ opacity: hasName ? 1 : 0.35 }}>
                {avatarText}
              </div>
              <div className="profile-avatar-name">
                {hasName ? doc.fullName : t("profile.yourName")}
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
                  <label className="form-label">{t("profile.fullName")} *</label>
                  <input
                    className="form-input"
                    placeholder={t("profile.fullNamePlaceholder")}
                    value={doc.fullName}
                    onChange={e => updateDoc("fullName", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">{t("profile.specialty")}</label>
                  <select
                    className="form-select"
                    value={doc.specialtyLabel ?? ""}
                    onChange={e => updateDoc("specialtyLabel", e.target.value || undefined)}
                  >
                    <option value="">{t("profile.chooseSpecialty")}</option>
                    {SPECIALTIES.map(s => (
                      <option key={s.id} value={s.label}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("profile.inpe")}</label>
                  <input
                    className="form-input"
                    placeholder="1234567890"
                    value={doc.inpe ?? ""}
                    onChange={e => updateDoc("inpe", e.target.value.replace(/\D/g, "").slice(0, 10) || undefined)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("profile.phone")}</label>
                  <input
                    className="form-input phone-input"
                    type="tel"
                    inputMode="tel"
                    placeholder="0522 48 00 00"
                    value={doc.phone ?? ""}
                    onChange={e => updateDoc("phone", fmtPhone(e.target.value) || undefined)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("profile.ordre")}</label>
                  <input
                    className="form-input"
                    placeholder="12345"
                    value={doc.ordre ?? ""}
                    onChange={e => updateDoc("ordre", e.target.value.trim() || undefined)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {t("profile.ice")}
                    <span className="form-label-hint"> {t("profile.iceHint")}</span>
                  </label>
                  <input
                    className="form-input"
                    placeholder="001234567000089"
                    value={doc.ice ?? ""}
                    onChange={e => updateDoc("ice", e.target.value.replace(/\D/g, "").slice(0, 15) || undefined)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {t("profile.rib")}
                  <span className="form-label-hint"> {t("profile.ribHint")}</span>
                </label>
                <input
                  className="form-input"
                  placeholder="011 780 0000123456789012 34"
                  value={doc.rib ?? ""}
                  onChange={e => updateDoc("rib", e.target.value || undefined)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t("profile.whatsApp")}</label>
                  <div className="phone-input-wrap">
                    <span className="phone-input-icon">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.512 5.84L.057 23.804l6.085-1.595A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.002-1.368l-.359-.213-3.722.976.993-3.625-.233-.373A9.77 9.77 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
                      </svg>
                    </span>
                    <input
                      className="form-input phone-input"
                      type="tel"
                      inputMode="tel"
                      placeholder="06 12 34 56 78"
                      value={doc.whatsApp ?? ""}
                      onChange={e => updateDoc("whatsApp", fmtPhone(e.target.value) || undefined)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {t("profile.accountant")}
                    <span className="form-label-hint"> {t("profile.accountantHint")}</span>
                  </label>
                  <div className="phone-input-wrap">
                    <span className="phone-input-icon">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.512 5.84L.057 23.804l6.085-1.595A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.002-1.368l-.359-.213-3.722.976.993-3.625-.233-.373A9.77 9.77 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
                      </svg>
                    </span>
                    <input
                      className="form-input phone-input"
                      type="tel"
                      inputMode="tel"
                      placeholder="06 00 00 00 00"
                      value={doc.accountantPhone ?? ""}
                      onChange={e => updateDoc("accountantPhone", fmtPhone(e.target.value) || undefined)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t("profile.address")}</label>
                <input
                  className="form-input"
                  placeholder="123 Bd. Mohammed V, Casablanca"
                  value={doc.address ?? ""}
                  onChange={e => updateDoc("address", e.target.value || undefined)}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section 2 : Paramètres fiscaux ── */}
        <Section
          title={t("profile.fiscalParams")}
          subtitle={t("profile.fiscalParamsSub")}
        >
          <div className="profile-grid">
            <div className="form-group">
              <label className="form-label">{t("profile.legalForm")}</label>
              <select
                className="form-select"
                value={fiscal.legalForm}
                onChange={e => updateFiscal("legalForm", e.target.value as LegalForm)}
              >
                <option value="PERSONNE_PHYSIQUE">{t("profile.legalPersonPhysique")}</option>
                <option value="SARL">{t("profile.legalSARL")}</option>
                <option value="SA">{t("profile.legalSA")}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t("profile.practiceType")}</label>
              <select
                className="form-select"
                value={fiscal.practiceType}
                onChange={e => updateFiscal("practiceType", e.target.value as Practice)}
              >
                <option value="CABINET_ONLY">{t("profile.practiceCabinetOnly")}</option>
                <option value="CLINIQUE_ONLY">{t("profile.practiceCliniqueOnly")}</option>
                <option value="MIXED">{t("profile.practiceMixed")}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t("profile.activityStart")}</label>
              <input
                type="date" className="form-input"
                value={fiscal.activityStartDate}
                onChange={e => updateFiscal("activityStartDate", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("profile.commune")}</label>
              <input
                type="text" className="form-input"
                placeholder="Casablanca"
                value={fiscal.commune}
                onChange={e => updateFiscal("commune", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("profile.communeType")}</label>
              <select
                className="form-select"
                value={fiscal.communeType}
                onChange={e => updateFiscal("communeType", e.target.value as Commune)}
              >
                <option value="URBAN">{t("profile.communeUrban")}</option>
                <option value="RURAL">{t("profile.communeRural")}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t("profile.maritalStatus")}</label>
              <select
                className="form-select"
                value={fiscal.maritalStatus}
                onChange={e => updateFiscal("maritalStatus", e.target.value as Marital)}
              >
                <option value="SINGLE">{t("profile.maritalSingle")}</option>
                <option value="MARRIED">{t("profile.maritalMarried")}</option>
                <option value="DIVORCED">{t("profile.maritalDivorced")}</option>
                <option value="WIDOWED">{t("profile.maritalWidowed")}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t("profile.dependents")}</label>
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
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("profile.tpRegistered")}</span>
              </label>
            </div>
          </div>
        </Section>

        {/* Save bar */}
        <div className="profile-save-bar">
          <button type="submit" className="btn btn-primary" style={{ minWidth: 160 }}>
            {t("profile.saveBtn")}
          </button>
        </div>
      </form>

      {/* ── Section 3 : Compte ── */}
      <div className="profile-section" style={{ marginTop: 20 }}>
        <div className="profile-section-header">
          <div className="profile-section-title">{t("profile.account")}</div>
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
              {t("profile.accountSubtitle")}
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
            {t("profile.logout")}
          </button>
        </div>
      </div>

    </>
  );
  if (noLayout) return body;
  return (
    <Layout title={t("profile.title")} subtitle={t("profile.subtitle")}>
      {body}
    </Layout>
  );
}
