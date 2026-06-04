import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import { APPT_TYPE_LABELS } from "../lib/cabinetTypes";
import type { Appointment } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function diffDays(followUp: string, today: string): number {
  return Math.round(
    (new Date(followUp + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime())
    / 86400000,
  );
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

type Urgency = "overdue" | "today" | "week" | "upcoming";

function urgencyOf(days: number): Urgency {
  if (days < 0)  return "overdue";
  if (days === 0) return "today";
  if (days <= 7)  return "week";
  return "upcoming";
}

const URGENCY_CONFIG: Record<Urgency, {
  label:    string;
  accent:   string;
  bg:       string;
  icon:     string;
  dayLabel: (d: number) => string;
}> = {
  overdue:  {
    label:    "En retard",
    accent:   "var(--coral)",
    bg:       "var(--coral-soft)",
    icon:     "⚠",
    dayLabel: (d) => `${Math.abs(d)} jour${Math.abs(d) > 1 ? "s" : ""} de retard`,
  },
  today:    {
    label:    "Aujourd'hui",
    accent:   "var(--gold)",
    bg:       "var(--gold-soft)",
    icon:     "📅",
    dayLabel: () => "Prévu aujourd'hui",
  },
  week:     {
    label:    "Cette semaine",
    accent:   "var(--blue)",
    bg:       "var(--blue-soft)",
    icon:     "🔔",
    dayLabel: (d) => `Dans ${d} jour${d > 1 ? "s" : ""}`,
  },
  upcoming: {
    label:    "Prochainement",
    accent:   "var(--muted)",
    bg:       "var(--surface-alt)",
    icon:     "📆",
    dayLabel: (d) => `Dans ${d} jour${d > 1 ? "s" : ""}`,
  },
};

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  appt:    Appointment;
  days:    number;
  urgency: Urgency;
  onDone:  () => void;
}

function FollowRow({ appt, days, urgency, onDone }: RowProps) {
  const navigate = useNavigate();
  const cfg = URGENCY_CONFIG[urgency];
  const initials = appt.patientName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={`rpl-row rpl-${urgency}`}>
      {/* Avatar */}
      <div className="rpl-avatar" style={{ background: cfg.accent + "22", color: cfg.accent }}>
        {initials}
      </div>

      {/* Patient & consultation info */}
      <div className="rpl-info">
        <div className="rpl-patient-name">
          {appt.patientId
            ? <Link to={`/patients/${appt.patientId}`} className="rpl-patient-link">{appt.patientName}</Link>
            : <span>{appt.patientName}</span>
          }
        </div>
        <div className="rpl-meta">
          <span className="rpl-type-chip">{APPT_TYPE_LABELS[appt.type]}</span>
          <span className="rpl-orig-date">Consul. le {fmtDate(appt.date)}</span>
        </div>
      </div>

      {/* Follow-up date & urgency */}
      <div className="rpl-date-col">
        <div className="rpl-followup-date">{fmtDate(appt.followUpDate!)}</div>
        <div className="rpl-days-badge" style={{ background: cfg.bg, color: cfg.accent }}>
          {cfg.icon} {cfg.dayLabel(days)}
        </div>
      </div>

      {/* Actions */}
      <div className="rpl-actions">
        <button
          className="rpl-btn rpl-schedule"
          onClick={() => {
            if (appt.patientId) {
              navigate(`/agenda?newAppt=${appt.patientId}`);
            } else {
              navigate("/agenda");
            }
          }}
          title="Programmer un nouveau rendez-vous"
        >
          📅 Programmer RDV
        </button>
        <button
          className="rpl-btn rpl-done"
          onClick={onDone}
          title="Marquer le suivi comme résolu"
        >
          ✓ Résolu
        </button>
        <Link
          to={`/agenda/${appt.id}`}
          className="rpl-rdv-link"
          title="Voir le rendez-vous d'origine"
        >
          Voir RDV →
        </Link>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ urgency, items, today, onDone }: {
  urgency: Urgency;
  items:   Appointment[];
  today:   string;
  onDone:  (id: string) => void;
}) {
  if (items.length === 0) return null;
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <div className="rpl-section">
      <div className="rpl-section-hdr" style={{ borderLeftColor: cfg.accent }}>
        <span className="rpl-section-title" style={{ color: cfg.accent }}>{cfg.label}</span>
        <span className="rpl-section-count" style={{ background: cfg.accent + "22", color: cfg.accent }}>
          {items.length}
        </span>
      </div>
      {items.map(a => (
        <FollowRow
          key={a.id}
          appt={a}
          days={diffDays(a.followUpDate!, today)}
          urgency={urgency}
          onDone={() => onDone(a.id)}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RappelsPage() {
  const { appointments, updateAppointment } = useCabinet();
  const today = todayIso();

  const [search,  setSearch]  = useState("");
  const [showAll, setShowAll] = useState(true);  // true = all; false = urgent only

  // All appointments with a followUpDate, sorted by urgency then date
  const withFollowUp = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...appointments]
      .filter(a => {
        if (!a.followUpDate) return false;
        if (q && !a.patientName.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  }, [appointments, search]);

  // Group by urgency
  const groups = useMemo(() => {
    const g: Record<Urgency, Appointment[]> = {
      overdue: [], today: [], week: [], upcoming: [],
    };
    for (const a of withFollowUp) {
      const d = diffDays(a.followUpDate!, today);
      if (!showAll && d > 7) continue;
      g[urgencyOf(d)].push(a);
    }
    return g;
  }, [withFollowUp, today, showAll]);

  const kpis = useMemo(() => ({
    total:    withFollowUp.length,
    overdue:  withFollowUp.filter(a => diffDays(a.followUpDate!, today) < 0).length,
    today:    withFollowUp.filter(a => diffDays(a.followUpDate!, today) === 0).length,
    week:     withFollowUp.filter(a => { const d = diffDays(a.followUpDate!, today); return d > 0 && d <= 7; }).length,
  }), [withFollowUp, today]);

  const handleDone = (apptId: string) => {
    const a = appointments.find(x => x.id === apptId);
    if (!a) return;
    if (!window.confirm(`Marquer le suivi de ${a.patientName} comme résolu ?\nLa date de suivi sera supprimée.`)) return;
    updateAppointment({ ...a, followUpDate: undefined });
  };

  const totalVisible =
    groups.overdue.length + groups.today.length + groups.week.length +
    (showAll ? groups.upcoming.length : 0);

  return (
    <Layout
      title="Rappels & Suivis"
      subtitle={`${kpis.total} patient${kpis.total !== 1 ? "s" : ""} avec date de suivi`}
    >
      {/* KPI strip */}
      <div className="rpl-kpi-strip">
        {[
          { label: "En retard",     count: kpis.overdue, accent: "var(--coral)" },
          { label: "Aujourd'hui",   count: kpis.today,   accent: "var(--gold)" },
          { label: "Cette semaine", count: kpis.week,    accent: "var(--blue)" },
          { label: "Total suivis",  count: kpis.total,   accent: "var(--navy)" },
        ].map(({ label, count, accent }) => (
          <div key={label} className="rpl-kpi" style={{ borderTopColor: accent }}>
            <div className="rpl-kpi-val" style={{ color: accent }}>{count}</div>
            <div className="rpl-kpi-lbl">{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="rpl-toolbar">
        <div className="rmb-search-wrap">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="rmb-search"
            placeholder="Rechercher un patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`rpl-filter-btn${showAll ? " active" : ""}`}
          onClick={() => setShowAll(v => !v)}
        >
          {showAll ? "Tous affichés" : "Urgents uniquement"}
        </button>
      </div>

      {totalVisible === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 17 }}>
            {search ? "Aucun résultat pour cette recherche" : "Aucun suivi en attente"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Les dates de suivi se configurent depuis la fiche d'un rendez-vous, onglet Suivi & AMO.
          </div>
        </div>
      ) : (
        <div className="rpl-list">
          <Section urgency="overdue"  items={groups.overdue}  today={today} onDone={handleDone} />
          <Section urgency="today"    items={groups.today}    today={today} onDone={handleDone} />
          <Section urgency="week"     items={groups.week}     today={today} onDone={handleDone} />
          {showAll && (
            <Section urgency="upcoming" items={groups.upcoming} today={today} onDone={handleDone} />
          )}
        </div>
      )}
    </Layout>
  );
}
