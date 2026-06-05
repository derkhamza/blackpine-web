import { useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { useDarkMode } from "../lib/useDarkMode";
import { exportPatientsCsv, exportAppointmentsCsv } from "../lib/csvExport";
import { exportAgendaIcal } from "../lib/icalExport";

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-title">{title}</div>
        {subtitle && <div className="settings-section-sub">{subtitle}</div>}
      </div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

function SettingsRow({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <div>{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

// ── Dark mode toggle ───────────────────────────────────────────────────────────

function DarkToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button
      className={`dark-toggle${dark ? " dark" : ""}`}
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      <span className="dark-toggle-thumb">
        {dark
          ? <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v1M7 12v1M1 7h1M12 7h1M3.2 3.2l.7.7M10.1 10.1l.7.7M3.2 10.8l.7-.7M10.1 3.9l.7-.7"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          : <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M12 8.5A6 6 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5Z"
                stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
        }
      </span>
    </button>
  );
}

// ── Import preview ─────────────────────────────────────────────────────────────

interface ImportPreview {
  raw:          string;
  appointments: number;
  patients:     number;
  employees:    number;
  exportedAt?:  string;
}

function parsePreview(json: string): ImportPreview {
  const d = JSON.parse(json);
  return {
    raw:          json,
    appointments: Array.isArray(d.appointments) ? d.appointments.length : 0,
    patients:     Array.isArray(d.patients)     ? d.patients.length     : 0,
    employees:    Array.isArray(d.employees)    ? d.employees.length    : 0,
    exportedAt:   d.exportedAt,
  };
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ParametresPage() {
  const {
    appointments, patients, employees,
    doctorProfile,
    exportCabinetJSON, importCabinetJSON,
    clearAppointments, clearPatients,
  } = useCabinet();

  const { dark, toggle } = useDarkMode();

  const fileRef = useRef<HTMLInputElement>(null);

  const [preview,   setPreview]   = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast,     setToast]     = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<"appointments" | "patients" | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const json = exportCabinetJSON();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(json, `blackpine-cabinet-${date}.json`);
    showToast("Sauvegarde téléchargée");
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const preview = parsePreview(ev.target?.result as string);
        setPreview(preview);
      } catch {
        showToast("❌ Fichier JSON invalide ou corrompu");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = () => {
    if (!preview) return;
    setImporting(true);
    try {
      importCabinetJSON(preview.raw);
      setPreview(null);
      showToast(`✓ Importé : ${preview.appointments} RDV, ${preview.patients} patients, ${preview.employees} employés`);
    } catch (err: unknown) {
      showToast(`❌ ${err instanceof Error ? err.message : "Erreur d'importation"}`);
    } finally {
      setImporting(false);
    }
  };

  // ── Clear ───────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (confirmClear === "appointments") {
      clearAppointments();
      showToast("Tous les rendez-vous ont été supprimés");
    } else if (confirmClear === "patients") {
      clearPatients();
      showToast("Tous les patients ont été supprimés");
    }
    setConfirmClear(null);
  };

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Layout title="Paramètres" subtitle="Apparence, données et préférences">
      <div className="settings-page">

        {/* ── Apparence ── */}
        <Section title="Apparence" subtitle="Personnalisez l'affichage de l'application">
          <SettingsRow
            label="Thème sombre"
            hint="Réduit la fatigue visuelle en consultation nocturne"
          >
            <div className="settings-theme-row">
              <span className="settings-theme-label">{dark ? "Mode sombre" : "Mode clair"}</span>
              <DarkToggle dark={dark} toggle={toggle} />
            </div>
          </SettingsRow>
        </Section>

        {/* ── Données du cabinet ── */}
        <Section
          title="Données du cabinet"
          subtitle="Sauvegarde et restauration des rendez-vous, patients et employés"
        >
          {/* Summary */}
          <div className="settings-data-summary">
            <div className="settings-data-stat">
              <div className="settings-data-val">{appointments.length}</div>
              <div className="settings-data-lbl">Rendez-vous</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{patients.length}</div>
              <div className="settings-data-lbl">Patients</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val">{employees.length}</div>
              <div className="settings-data-lbl">Employés</div>
            </div>
            <div className="settings-data-stat">
              <div className="settings-data-val" style={{ fontSize: 12 }}>{today}</div>
              <div className="settings-data-lbl">Aujourd'hui</div>
            </div>
          </div>

          <SettingsRow
            label="Exporter les données"
            hint="Télécharge un fichier JSON contenant tous vos rendez-vous, patients et employés"
          >
            <button className="btn btn-primary settings-action-btn" onClick={handleExport}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Exporter (.json)
            </button>
          </SettingsRow>

          <SettingsRow
            label="Exporter les patients (.csv)"
            hint="Télécharge la liste complète des patients au format CSV (compatible Excel)"
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={() => { exportPatientsCsv(patients); showToast("Patients exportés"); }}
              disabled={patients.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Patients.csv
            </button>
          </SettingsRow>

          <SettingsRow
            label="Exporter les rendez-vous (.csv)"
            hint="Télécharge tous les rendez-vous avec facturation et notes cliniques"
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={() => { exportAppointmentsCsv(appointments); showToast("Rendez-vous exportés"); }}
              disabled={appointments.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <path d="M7 2v8M4 7l3 3 3-3M2 12h10"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Rendez-vous.csv
            </button>
          </SettingsRow>

          <SettingsRow
            label="Exporter l'agenda (.ics)"
            hint="Importe tous vos rendez-vous dans Google Calendar, Outlook ou Apple Calendar"
          >
            <button
              className="btn btn-ghost settings-action-btn"
              onClick={() => {
                const calName = doctorProfile?.fullName
                  ? `Cabinet Dr. ${doctorProfile.fullName}`
                  : "Blackpine Cabinet";
                exportAgendaIcal(appointments, calName);
                showToast("Agenda exporté en iCal");
              }}
              disabled={appointments.length === 0}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 2V1M10 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M7 9V7M5.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Agenda.ics
            </button>
          </SettingsRow>

          <SettingsRow
            label="Importer une sauvegarde"
            hint="Restaure les données depuis un fichier exporté précédemment. Les données existantes sont remplacées."
          >
            <>
              <button
                className="btn btn-ghost settings-action-btn"
                onClick={() => fileRef.current?.click()}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                  <path d="M7 10V2M4 5l3-3 3 3M2 12h10"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Choisir un fichier
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </>
          </SettingsRow>

          {/* Import preview */}
          {preview && (
            <div className="settings-import-preview">
              <div className="settings-import-title">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Aperçu de l'importation
              </div>
              <div className="settings-import-stats">
                <span><strong>{preview.appointments}</strong> rendez-vous</span>
                <span><strong>{preview.patients}</strong> patients</span>
                <span><strong>{preview.employees}</strong> employés</span>
                {preview.exportedAt && (
                  <span style={{ color: "var(--muted)" }}>
                    Sauvegardé le {new Date(preview.exportedAt).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
              <div className="settings-import-warning">
                ⚠️ Cette action remplacera les données actuelles du cabinet.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPreview(null)}
                >
                  Annuler
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImportConfirm}
                  disabled={importing}
                >
                  {importing ? "Importation…" : "Confirmer l'importation"}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Zone de danger ── */}
        <Section
          title="Zone de danger"
          subtitle="Actions irréversibles — procédez avec précaution"
        >
          <SettingsRow
            label="Supprimer tous les rendez-vous"
            hint={`${appointments.length} rendez-vous seront définitivement supprimés`}
          >
            <button
              className="btn settings-danger-btn"
              onClick={() => setConfirmClear("appointments")}
              disabled={appointments.length === 0}
            >
              Effacer les RDV
            </button>
          </SettingsRow>

          <SettingsRow
            label="Supprimer tous les patients"
            hint={`${patients.length} fiches patients seront définitivement supprimées`}
          >
            <button
              className="btn settings-danger-btn"
              onClick={() => setConfirmClear("patients")}
              disabled={patients.length === 0}
            >
              Effacer les patients
            </button>
          </SettingsRow>
        </Section>

        {/* ── À propos ── */}
        <Section title="À propos">
          <div className="settings-about">
            <div className="settings-about-logo">
              <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
                <path d="M4 4h5.5a3.5 3.5 0 0 1 0 7H4V4Z" fill="var(--navy)" fillOpacity="0.8"/>
                <path d="M4 11h6a4 4 0 0 1 0 8H4v-8Z" fill="var(--navy)" fillOpacity="0.5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Blackpine Cabinet Web</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                Application de gestion de cabinet médical
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Confirm clear modal ── */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: "var(--coral)" }}>
                Confirmation de suppression
              </h2>
              <button className="modal-close" onClick={() => setConfirmClear(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                Êtes-vous sûr de vouloir supprimer définitivement{" "}
                {confirmClear === "appointments"
                  ? `tous les ${appointments.length} rendez-vous`
                  : `tous les ${patients.length} patients`}{" "}
                ? Cette action est <strong>irréversible</strong>.
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                Pensez à exporter vos données avant de procéder.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmClear(null)}>Annuler</button>
              <button
                className="btn"
                style={{ background: "var(--coral)", color: "#fff" }}
                onClick={handleClear}
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
