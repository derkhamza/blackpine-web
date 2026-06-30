import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import type { TeleSession, TelePlatform, TeleStatus } from "../lib/cabinetTypes";
import {
  TELE_PLATFORM_LABELS, TELE_PLATFORM_COLORS,
  TELE_STATUS_LABELS, TELE_STATUS_COLORS,
} from "../lib/cabinetTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLATFORMS: TelePlatform[] = ["googlemeet", "zoom", "teams", "jitsi", "autre"];
const STATUSES:  TeleStatus[]   = ["scheduled", "in_progress", "completed", "cancelled"];

function PlatformIcon({ platform }: { platform: TelePlatform }) {
  const color = TELE_PLATFORM_COLORS[platform];
  const icons: Record<TelePlatform, JSX.Element> = {
    googlemeet: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M16 8v8l4 4V4l-4 4Z" fill={color}/>
        <rect x="2" y="6" width="13" height="12" rx="2" fill={color} opacity="0.8"/>
      </svg>
    ),
    zoom: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="1" y="5" width="14" height="14" rx="2.5" fill={color}/>
        <path d="M15 10l6-4v12l-6-4v-4Z" fill={color} opacity="0.8"/>
      </svg>
    ),
    teams: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="16" cy="6" r="3" fill={color} opacity="0.7"/>
        <path d="M14 10h6a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-7a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" fill={color} opacity="0.9"/>
        <circle cx="8" cy="7" r="3.5" fill={color}/>
        <path d="M2 17v-1a6 6 0 0 1 6-6v0a6 6 0 0 1 6 6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" fill={color}/>
      </svg>
    ),
    jitsi: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill={color} opacity="0.15"/>
        <path d="M8 8h8v8H8z" fill={color} opacity="0.3" rx="1"/>
        <path d="M15 10v4l3 2V8l-3 2Z" fill={color}/>
        <rect x="6" y="9" width="9" height="6" rx="1.5" fill={color}/>
      </svg>
    ),
    autre: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5"/>
        <path d="M8 12h8M12 8v8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  };
  return icons[platform];
}

// ── Session modal ──────────────────────────────────────────────────────────────

interface SessionModalProps {
  initial?: Partial<TeleSession>;
  patients: { id: string; firstName: string; lastName: string; phone?: string }[];
  onSave:   (s: Omit<TeleSession, "id" | "createdAt">) => void;
  onClose:  () => void;
}

function SessionModal({ initial, patients, onSave, onClose }: SessionModalProps) {
  const { t } = useTranslation();
  const today = todayIso();
  const [patientName, setPatientName] = useState(initial?.patientName ?? "");
  const [patientId,   setPatientId]   = useState(initial?.patientId   ?? "");
  const [patientPhone,setPhone]       = useState(initial?.patientPhone ?? "");
  const [platform,    setPlatform]    = useState<TelePlatform>(initial?.platform ?? "googlemeet");
  const [link,        setLink]        = useState(initial?.link          ?? "");
  const [date,        setDate]        = useState(initial?.scheduledDate ?? today);
  const [time,        setTime]        = useState(initial?.scheduledTime ?? "09:00");
  const [status,      setStatus]      = useState<TeleStatus>(initial?.status ?? "scheduled");
  const [duration,    setDuration]    = useState(String(initial?.duration ?? 30));
  const [notes,       setNotes]       = useState(initial?.notes         ?? "");

  const handleNameChange = (val: string) => {
    setPatientName(val);
    const p = patients.find(x =>
      `${x.firstName} ${x.lastName}`.toLowerCase() === val.toLowerCase()
    );
    if (p) {
      setPatientId(p.id);
      if (p.phone && !patientPhone) setPhone(p.phone);
    } else {
      setPatientId("");
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    onSave({
      patientName:   patientName.trim(),
      patientId:     patientId   || undefined,
      patientPhone:  patientPhone.trim() || undefined,
      platform,
      link:          link.trim() || undefined,
      scheduledDate: date,
      scheduledTime: time,
      status,
      duration:      parseInt(duration, 10) || 30,
      notes:         notes.trim() || undefined,
    });
  };

  const isEdit = !!initial?.id;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? t("teleconsult.modalEdit") : t("teleconsult.modalNew")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("teleconsult.patientField")}</label>
                <input className="form-input" list="tele-patient-list"
                  value={patientName} onChange={e => handleNameChange(e.target.value)}
                  placeholder={t("teleconsult.patientPlaceholder")} required />
                <datalist id="tele-patient-list">
                  {patients.map(p => <option key={p.id} value={`${p.firstName} ${p.lastName}`} />)}
                </datalist>
              </div>
              <div className="form-group" style={{ flex: "0 0 160px" }}>
                <label className="form-label">{t("teleconsult.phoneField")}</label>
                <input className="form-input" value={patientPhone} onChange={e => setPhone(e.target.value)}
                  placeholder={t("teleconsult.phonePlaceholder")} type="tel" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: "0 0 190px" }}>
                <label className="form-label">{t("teleconsult.platformField")}</label>
                <select className="form-input" value={platform}
                  onChange={e => setPlatform(e.target.value as TelePlatform)}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{TELE_PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("teleconsult.linkField")}</label>
                <input className="form-input" value={link} onChange={e => setLink(e.target.value)}
                  placeholder={t("teleconsult.linkPlaceholder")} type="url" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t("teleconsult.dateField")}</label>
                <input className="form-input" type="date" value={date}
                  onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group" style={{ flex: "0 0 120px" }}>
                <label className="form-label">{t("teleconsult.timeField")}</label>
                <input className="form-input" type="time" value={time}
                  onChange={e => setTime(e.target.value)} required />
              </div>
              <div className="form-group" style={{ flex: "0 0 120px" }}>
                <label className="form-label">{t("teleconsult.durationField")}</label>
                <input className="form-input" type="number" min="5" max="180" step="5"
                  value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: "0 0 150px" }}>
                <label className="form-label">{t("teleconsult.statusField")}</label>
                <select className="form-input" value={status}
                  onChange={e => setStatus(e.target.value as TeleStatus)}>
                  {STATUSES.map(s => <option key={s} value={s}>{TELE_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t("teleconsult.notesField")}</label>
              <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} placeholder={t("teleconsult.notesPlaceholder")} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary"
              style={{ background: TELE_PLATFORM_COLORS[platform] }}>
              {isEdit ? t("common.save") : t("teleconsult.createBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TeleconsultPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const today = todayIso();
  const {
    teleSessions, addTeleSession, updateTeleSession, deleteTeleSession,
    patients, waTemplates, doctorProfile,
  } = useCabinet();

  const [filterStatus, setFilterStatus] = useState<TeleStatus | "all">("all");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState<{ session?: TeleSession } | null>(null);
  const [copied,       setCopied]       = useState<string | null>(null);

  const showToast = useToast();

  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  // WhatsApp messages sent to patients stay in French (patient-facing communication)
  const buildWaUrl = (session: TeleSession, templateBody: string) => {
    const clean = (session.patientPhone ?? "").replace(/\D/g, "");
    const d = new Date(session.scheduledDate + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
    const msg = templateBody
      .replace(/\{patient\}/g, session.patientName)
      .replace(/\{date\}/g,    d)
      .replace(/\{heure\}/g,   session.scheduledTime)
      .replace(/\{docteur\}/g, doctorProfile?.fullName ? `Dr. ${doctorProfile.fullName}` : "le médecin")
      .replace(/\{cabinet\}/g, doctorProfile?.fullName ? `Cabinet Dr. ${doctorProfile.fullName}` : "le cabinet")
      + (session.link ? `\n\nLien : ${session.link}` : "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  const shareTemplate = waTemplates.find(t => t.category === "confirmation") ??
    waTemplates.find(t => t.category === "rappel") ??
    waTemplates[0];

  const kpi = useMemo(() => ({
    total:       teleSessions.length,
    todayCount:  teleSessions.filter(s => s.scheduledDate === today).length,
    scheduled:   teleSessions.filter(s => s.status === "scheduled").length,
    inProgress:  teleSessions.filter(s => s.status === "in_progress").length,
    completed:   teleSessions.filter(s => s.status === "completed").length,
  }), [teleSessions, today]);

  const filtered = useMemo(() =>
    teleSessions
      .filter(s =>
        (filterStatus === "all" || s.status === filterStatus) &&
        (search === "" ||
          s.patientName.toLowerCase().includes(search.toLowerCase()) ||
          (s.notes ?? "").toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) =>
        (b.scheduledDate + b.scheduledTime).localeCompare(a.scheduledDate + a.scheduledTime)
      ),
    [teleSessions, filterStatus, search]);

  const teleActions = (
    <button className="btn btn-primary" onClick={() => setModal({})}>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      {t("teleconsult.newSession")}
    </button>
  );

  const body = (
    <>
      {noLayout && <div className="inline-actions">{teleActions}</div>}

      <div className="tele-kpi-strip">
        <div className="tele-kpi-card">
          <div className="tele-kpi-val"><AnimatedNumber value={kpi.total} /></div>
          <div className="tele-kpi-lbl">{t("teleconsult.kpiTotal")}</div>
        </div>
        <div className="tele-kpi-card">
          <div className="tele-kpi-val" style={{ color: "var(--blue)" }}><AnimatedNumber value={kpi.todayCount} /></div>
          <div className="tele-kpi-lbl">{t("teleconsult.kpiToday")}</div>
        </div>
        <div className="tele-kpi-card">
          <div className="tele-kpi-val" style={{ color: TELE_STATUS_COLORS.scheduled }}><AnimatedNumber value={kpi.scheduled} /></div>
          <div className="tele-kpi-lbl">{t("teleconsult.kpiScheduled")}</div>
        </div>
        <div className="tele-kpi-card">
          <div className="tele-kpi-val" style={{ color: TELE_STATUS_COLORS.in_progress }}><AnimatedNumber value={kpi.inProgress} /></div>
          <div className="tele-kpi-lbl">{t("teleconsult.kpiInProgress")}</div>
        </div>
        <div className="tele-kpi-card">
          <div className="tele-kpi-val" style={{ color: "var(--muted)" }}><AnimatedNumber value={kpi.completed} /></div>
          <div className="tele-kpi-lbl">{t("teleconsult.kpiCompleted")}</div>
        </div>
      </div>

      <div className="tele-toolbar">
        <div className="tele-status-pills">
          <button className={`tele-status-pill${filterStatus === "all" ? " active" : ""}`}
            onClick={() => setFilterStatus("all")}>
            {t("teleconsult.filterAll")} <span className="stock-pill-count">{teleSessions.length}</span>
          </button>
          {STATUSES.map(s => {
            const cnt = teleSessions.filter(x => x.status === s).length;
            if (!cnt && filterStatus !== s) return null;
            return (
              <button key={s}
                className={`tele-status-pill${filterStatus === s ? " active" : ""}`}
                style={filterStatus === s ? { borderColor: TELE_STATUS_COLORS[s], color: TELE_STATUS_COLORS[s] } : {}}
                onClick={() => setFilterStatus(s)}>
                {TELE_STATUS_LABELS[s]} <span className="stock-pill-count">{cnt}</span>
              </button>
            );
          })}
        </div>
        <div className="stock-search-wrap">
          <svg className="stock-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input className="stock-search-input" placeholder={t("teleconsult.search")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="agenda-empty" style={{ marginTop: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎥</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {teleSessions.length === 0 ? t("teleconsult.emptyNone") : t("teleconsult.emptyNoResults")}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            {teleSessions.length === 0 ? t("teleconsult.emptyNoneSub") : t("teleconsult.emptyFilterSub")}
          </div>
          {teleSessions.length === 0 && (
            <button className="btn btn-primary" onClick={() => setModal({})}>
              {t("teleconsult.createFirst")}
            </button>
          )}
        </div>
      ) : (
        <div className="tele-list">
          {filtered.map(s => {
            const isToday = s.scheduledDate === today;
            const d = new Date(s.scheduledDate + "T12:00:00").toLocaleDateString(locale, {
              weekday: "short", day: "numeric", month: "short",
            });
            const statusColor = TELE_STATUS_COLORS[s.status];
            const platColor   = TELE_PLATFORM_COLORS[s.platform];
            return (
              <div key={s.id} className="tele-row">
                <div className="tele-row-accent" style={{ background: platColor }} />
                <div className="tele-row-platform">
                  <PlatformIcon platform={s.platform} />
                </div>
                <div className="tele-row-info">
                  <div className="tele-row-name">{s.patientName}</div>
                  <div className="tele-row-meta">
                    <span className="tele-platform-badge"
                      style={{ background: platColor + "22", color: platColor }}>
                      {TELE_PLATFORM_LABELS[s.platform]}
                    </span>
                    <span style={{ color: isToday ? "var(--blue)" : "var(--muted)" }}>
                      {isToday ? t("teleconsult.todayLabel") : d} · {s.scheduledTime}
                    </span>
                    {s.duration && (
                      <span style={{ color: "var(--muted)" }}>{s.duration} min</span>
                    )}
                  </div>
                  {s.notes && <div className="tele-row-notes">{s.notes}</div>}
                </div>
                <div className="tele-row-right">
                  <span className="tele-status-badge"
                    style={{ background: statusColor + "22", color: statusColor }}>
                    {TELE_STATUS_LABELS[s.status]}
                  </span>
                  <div className="tele-row-actions">
                    {s.link && (
                      <button className="tele-action-btn" onClick={() => copyLink(s.link!, s.id)}>
                        {copied === s.id
                          ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <path d="M2 7l3.5 3.5L12 3.5" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          : <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                              <path d="M2 10V2h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                        }
                      </button>
                    )}
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noopener noreferrer"
                        className="tele-action-btn">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          <path d="M9 1h4v4M13 1L7.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    )}
                    {s.patientPhone && shareTemplate && (
                      <a href={buildWaUrl(s, shareTemplate.body)} target="_blank" rel="noopener noreferrer"
                        className="tele-action-btn wa">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                        </svg>
                      </a>
                    )}
                    {s.status === "scheduled" && (
                      <button className="tele-action-btn primary"
                        onClick={() => { updateTeleSession({ ...s, status: "in_progress" }); showToast(t("teleconsult.toastStarted")); }}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M5 4.5l5 2.5-5 2.5V4.5Z" fill="currentColor"/>
                        </svg>
                      </button>
                    )}
                    {s.status === "in_progress" && (
                      <button className="tele-action-btn primary"
                        onClick={() => { updateTeleSession({ ...s, status: "completed" }); showToast(t("teleconsult.toastCompleted")); }}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}
                    <button className="tele-action-btn" onClick={() => setModal({ session: s })}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button className="tx-delete"
                      onClick={() => {
                        if (confirm(t("teleconsult.deleteConfirm"))) {
                          deleteTeleSession(s.id);
                          showToast(t("teleconsult.toastDeleted"));
                        }
                      }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <SessionModal initial={modal.session} patients={patients}
          onSave={s => {
            if (modal.session) {
              updateTeleSession({ ...s, id: modal.session.id, createdAt: modal.session.createdAt });
              showToast(t("teleconsult.toastUpdated"));
            } else {
              addTeleSession(s);
              showToast(t("teleconsult.toastCreated"));
            }
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

    </>
  );

  if (noLayout) return body;
  return (
    <Layout
      title={t("teleconsult.title")}
      subtitle={t("teleconsult.subtitle", { n: kpi.total, s: kpi.total !== 1 ? "s" : "" })}
      actions={teleActions}
    >
      {body}
    </Layout>
  );
}
