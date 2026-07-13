import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { apptTypeLabel } from "../lib/cabinetTypes";
import type { Appointment } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function diffDays(followUp: string, today: string): number {
  return Math.round(
    (new Date(followUp + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime())
    / 86400000,
  );
}

type Urgency = "overdue" | "today" | "week" | "upcoming";

function urgencyOf(days: number): Urgency {
  if (days < 0)   return "overdue";
  if (days === 0) return "today";
  if (days <= 7)  return "week";
  return "upcoming";
}

const URGENCY_STYLE: Record<Urgency, { accent: string; bg: string; icon: string }> = {
  overdue:  { accent: "var(--coral)", bg: "var(--coral-soft)", icon: "⚠" },
  today:    { accent: "var(--gold)",  bg: "var(--gold-soft)",  icon: "📅" },
  week:     { accent: "var(--blue)",  bg: "var(--blue-soft)",  icon: "🔔" },
  upcoming: { accent: "var(--muted)", bg: "var(--surface-alt)", icon: "📆" },
};

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  appt:    Appointment;
  days:    number;
  urgency: Urgency;
  onDone:  () => void;
  locale:  string;
}

function FollowRow({ appt, days, urgency, onDone, locale }: RowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cfg = URGENCY_STYLE[urgency];
  const initials = appt.patientName.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  function fmtDate(iso: string): string {
    return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  }

  const dayLabel =
    urgency === "overdue"  ? t("rappels.dayOverdue", { n: Math.abs(days), s: Math.abs(days) > 1 ? "s" : "" })
    : urgency === "today"  ? t("rappels.dayToday")
    : t("rappels.dayInN", { n: days, s: days > 1 ? "s" : "" });

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
          <span className="rpl-type-chip">{apptTypeLabel(appt.type)}</span>
          <span className="rpl-orig-date">{t("rappels.consulOn", { date: fmtDate(appt.date) })}</span>
        </div>
      </div>

      {/* Follow-up date & urgency */}
      <div className="rpl-date-col">
        <div className="rpl-followup-date">{fmtDate(appt.followUpDate!)}</div>
        <div className="rpl-days-badge" style={{ background: cfg.bg, color: cfg.accent }}>
          {cfg.icon} {dayLabel}
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
          title={t("rappels.scheduleTitle")}
        >
          {t("rappels.scheduleAppt")}
        </button>
        <button
          className="rpl-btn rpl-done"
          onClick={onDone}
          title={t("rappels.resolvedTitle")}
        >
          {t("rappels.resolved")}
        </button>
        <Link
          to={`/agenda/${appt.id}`}
          className="rpl-rdv-link"
          title={t("rappels.viewApptTitle")}
        >
          {t("rappels.viewAppt")}
        </Link>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ urgency, items, today, onDone, locale }: {
  urgency: Urgency;
  items:   Appointment[];
  today:   string;
  onDone:  (id: string) => void;
  locale:  string;
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  const cfg = URGENCY_STYLE[urgency];
  const labelKey = `urgency${urgency.charAt(0).toUpperCase() + urgency.slice(1)}` as
    "urgencyOverdue" | "urgencyToday" | "urgencyWeek" | "urgencyUpcoming";
  return (
    <div className="rpl-section">
      <div className="rpl-section-hdr" style={{ borderLeftColor: cfg.accent }}>
        <span className="rpl-section-title" style={{ color: cfg.accent }}>{t(`rappels.${labelKey}`)}</span>
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
          locale={locale}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RappelsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { appointments, updateAppointment } = useCabinet();
  const today = todayIso();

  const [search,  setSearch]  = useState("");
  const [showAll, setShowAll] = useState(true);

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
    total:   withFollowUp.length,
    overdue: withFollowUp.filter(a => diffDays(a.followUpDate!, today) < 0).length,
    today:   withFollowUp.filter(a => diffDays(a.followUpDate!, today) === 0).length,
    week:    withFollowUp.filter(a => { const d = diffDays(a.followUpDate!, today); return d > 0 && d <= 7; }).length,
  }), [withFollowUp, today]);

  const handleDone = (apptId: string) => {
    const a = appointments.find(x => x.id === apptId);
    if (!a) return;
    if (!window.confirm(t("rappels.doneConfirm", { name: a.patientName }))) return;
    updateAppointment({ ...a, followUpDate: undefined });
  };

  const totalVisible =
    groups.overdue.length + groups.today.length + groups.week.length +
    (showAll ? groups.upcoming.length : 0);

  const content = (
    <>
      {/* KPI strip */}
      <div className="rpl-kpi-strip">
        {[
          { labelKey: "kpiOverdue", count: kpis.overdue, accent: "var(--coral)" },
          { labelKey: "kpiToday",   count: kpis.today,   accent: "var(--gold)"  },
          { labelKey: "kpiWeek",    count: kpis.week,    accent: "var(--blue)"  },
          { labelKey: "kpiTotal",   count: kpis.total,   accent: "var(--navy)"  },
        ].map(({ labelKey, count, accent }) => (
          <div key={labelKey} className="rpl-kpi" style={{ borderTopColor: accent }}>
            <div className="rpl-kpi-val" style={{ color: accent }}><AnimatedNumber value={count} /></div>
            <div className="rpl-kpi-lbl">{t(`rappels.${labelKey}`)}</div>
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
            placeholder={t("rappels.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`rpl-filter-btn${showAll ? " active" : ""}`}
          onClick={() => setShowAll(v => !v)}
        >
          {showAll ? t("rappels.showAll") : t("rappels.urgentOnly")}
        </button>
      </div>

      {totalVisible === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 17 }}>
            {search ? t("rappels.emptySearch") : t("rappels.emptyTitle")}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {t("rappels.emptyHint")}
          </div>
        </div>
      ) : (
        <div className="rpl-list">
          <Section urgency="overdue"  items={groups.overdue}  today={today} onDone={handleDone} locale={locale} />
          <Section urgency="today"    items={groups.today}    today={today} onDone={handleDone} locale={locale} />
          <Section urgency="week"     items={groups.week}     today={today} onDone={handleDone} locale={locale} />
          {showAll && (
            <Section urgency="upcoming" items={groups.upcoming} today={today} onDone={handleDone} locale={locale} />
          )}
        </div>
      )}
    </>
  );

  return noLayout ? content : (
    <Layout
      title={t("rappels.title")}
      subtitle={t("rappels.subtitle", { n: kpis.total, s: kpis.total !== 1 ? "s" : "" })}
    >
      {content}
    </Layout>
  );
}
