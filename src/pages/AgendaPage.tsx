import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { track } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type {
  Appointment, AppointmentType, AppointmentStatus, Patient, WaTemplate,
} from "../lib/cabinetTypes";
import {
  APPT_TYPE_LABELS, APPT_TYPE_COLORS, APPT_STATUS_LABELS,
  WA_TEMPLATE_CATEGORY_LABELS, WA_TEMPLATE_CATEGORY_COLORS,
} from "../lib/cabinetTypes";
import { todayIso, calcAge } from "../lib/format";
import { fullName as fmtFullName } from "../lib/nameFormat";
import {
  WA_MSG_LANGS, WA_MSG_LOCALE, BUILTIN_WA_MESSAGES, type WaMsgLang,
  WA_DOCTOR_PREFIX, WA_CABINET_PREFIX, WA_DOCTOR_FALLBACK, WA_CABINET_FALLBACK,
} from "../lib/waMessages";
import { printReceipt } from "../lib/receiptPrinter";
import { exportAgendaIcal } from "../lib/icalExport";
import { parseAgendaIcal, icalEventsToAppointments } from "../lib/icalImport";
import { useTranslation } from "react-i18next";

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekdayMon(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }
function isoFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getMondayOfWeek(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;  // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

type RecurrFreq = "weekly" | "biweekly" | "monthly";

function generateRecurringDates(start: string, freq: RecurrFreq, count: number): string[] {
  const dates: string[] = [start];
  for (let i = 1; i < count; i++) {
    const prev = dates[i - 1];
    dates.push(
      freq === "weekly"   ? addDays(prev, 7)
      : freq === "biweekly" ? addDays(prev, 14)
      :                       addMonths(prev, 1),
    );
  }
  return dates;
}

type AgendaView = "day" | "week" | "month";

function colour(hex: string, muted = false) { return muted ? "var(--border)" : hex; }

// ── Smart-prefill helpers ──────────────────────────────────────────────────────

interface SmartPrefill {
  type: AppointmentType;
  startTime: string;
  endTime: string;
  suggestedDate: string | null;
}

function getSmartPrefill(patientId: string, appointments: Appointment[]): SmartPrefill | null {
  const today = todayIso();
  const past = appointments
    .filter(a => a.patientId === patientId && a.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (past.length === 0) return null;

  const type = past[0].type;

  // Most frequent start time
  const timeCounts = new Map<string, number>();
  for (const a of past) timeCounts.set(a.startTime, (timeCounts.get(a.startTime) ?? 0) + 1);
  const startTime = [...timeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "09:00";

  // Average duration rounded to 15-min slots
  const durations = past.map(a => {
    const [sh, sm] = a.startTime.split(":").map(Number);
    const [eh, em] = a.endTime.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }).filter(d => d >= 10 && d <= 180);
  const avgDur = durations.length > 0
    ? Math.round(durations.reduce((acc, d) => acc + d, 0) / durations.length / 15) * 15
    : 30;
  const [sh, sm] = startTime.split(":").map(Number);
  const endMins = sh * 60 + sm + avgDur;
  const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  const pendingFollowUp = past[0]?.followUpDate;
  const suggestedDate = pendingFollowUp && pendingFollowUp > today ? pendingFollowUp : null;

  return { type, startTime, endTime, suggestedDate };
}

// ── Time-grid constants ────────────────────────────────────────────────────────
const TG_START  = 7;    // 07:00 — default first hour (grid expands earlier if needed)
const TG_END    = 20;   // 20:00 — default last hour  (grid expands later if needed)
const TG_PX_H   = 88;   // pixels per hour (tall enough that a 15-min slot ≈ 22px)
const TG_MIN_EVENT = 17; // px — floor so a quarter-hour RDV still fits without spilling
const gridHourList = (startH: number, endH: number) =>
  Array.from({ length: Math.max(1, endH - startH) }, (_, i) => startH + i);

// Minutes since midnight from "HH:MM"; null when blank/malformed (legacy/imported data).
function timeToMin(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}
function tTop(hhmm: string, startHour = TG_START): number {
  const min = timeToMin(hhmm);
  if (min == null) return 0;
  return Math.max(0, (min - startHour * 60) / 60 * TG_PX_H);
}
function tDurationMin(start: string, end: string): number {
  const s = timeToMin(start), e = timeToMin(end);
  // Default to a 30-min slot when the end time is missing/invalid so the event
  // never collapses to NaN (which makes the browser size it to its content and
  // spill over the appointments below it).
  if (s == null) return 30;
  if (e == null || e <= s) return 30;
  return e - s;
}
function tHeight(start: string, end: string): number {
  // leave a 1px hairline gap between consecutive events
  const px = tDurationMin(start, end) / 60 * TG_PX_H - 1;
  return Math.max(TG_MIN_EVENT, Number.isFinite(px) ? px : TG_MIN_EVENT);
}
function snapTime(yPx: number, startHour = TG_START, endHour = TG_END): string {
  const totalMins = (endHour - startHour) * 60;
  const total = (endHour - startHour) * TG_PX_H;
  const raw = Math.round((yPx / total) * totalMins / 30) * 30;
  const clipped = Math.max(0, Math.min(totalMins - 30, raw));
  const h = startHour + Math.floor(clipped / 60);
  const m = clipped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
// Snap a dragged event's top (px from grid top) to the nearest `step` minutes,
// keeping the whole event (its `durMin`) inside the visible grid bounds.
function snapDragTime(yPx: number, startHour: number, endHour: number, durMin: number, step = 15): string {
  const totalMins = (endHour - startHour) * 60;
  const total     = (endHour - startHour) * TG_PX_H;
  let mins = Math.round((yPx / total) * totalMins / step) * step;
  mins = Math.max(0, Math.min(totalMins - durMin, mins));
  const h = startHour + Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Side-by-side layout for overlapping appointments: each event gets a column
// index and the total column count of its overlap cluster, so concurrent RDV
// render next to each other instead of stacking on top of one another.
function layoutDayAppts(appts: Appointment[]): Map<string, { col: number; cols: number }> {
  const result = new Map<string, { col: number; cols: number }>();
  const evs = appts
    .map(a => {
      const start = timeToMin(a.startTime) ?? 0;
      const endRaw = timeToMin(a.endTime);
      const end = endRaw != null && endRaw > start ? endRaw : start + 30;
      return { id: a.id, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster: typeof evs = [];
  let colEnds: number[] = [];   // last end time per column in the active cluster
  let clusterMaxEnd = -1;

  const flush = () => {
    const cols = colEnds.length || 1;
    for (const e of cluster) {
      const prev = result.get(e.id)!;
      result.set(e.id, { col: prev.col, cols });
    }
    cluster = [];
    colEnds = [];
    clusterMaxEnd = -1;
  };

  for (const e of evs) {
    if (cluster.length && e.start >= clusterMaxEnd) flush();
    let col = colEnds.findIndex(end => end <= e.start);
    if (col === -1) { col = colEnds.length; colEnds.push(e.end); }
    else colEnds[col] = e.end;
    result.set(e.id, { col, cols: 1 });
    cluster.push(e);
    clusterMaxEnd = Math.max(clusterMaxEnd, e.end);
  }
  flush();
  return result;
}
const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
// Only these three types are offered for new appointments; legacy types
// (suivi, procédure, urgence) remain displayable on existing records.
const TYPE_OPTS: AppointmentType[] = ["consultation", "controle", "autre"];
const STATUS_OPTS: AppointmentStatus[] = ["scheduled", "arrived", "in_consultation", "completed", "cancelled", "no_show"];

// ── WhatsApp helpers ───────────────────────────────────────────────────────────

function renderWaBody(
  body: string,
  appt: Appointment,
  doctorFullName?: string,
  lang: WaMsgLang = "fr",
  opts?: { patientArabicName?: string; doctorArabicName?: string },
): string {
  const d = new Date(appt.date + "T12:00:00").toLocaleDateString(WA_MSG_LOCALE[lang], {
    weekday: "long", day: "numeric", month: "long",
  });
  // In an Arabic message, prefer the Arabic spelling of the names when the
  // doctor has entered one; otherwise fall back to the stored Latin name.
  const patientName = (lang === "ar" && opts?.patientArabicName?.trim())
    ? opts.patientArabicName.trim() : appt.patientName;
  const docName = (lang === "ar" && opts?.doctorArabicName?.trim())
    ? opts.doctorArabicName.trim() : doctorFullName?.trim();
  // Arabic-name variables ({patient_ar}, {docteur_ar}, {cabinet_ar}) always
  // render in Arabic no matter the message language, so a French/English
  // message can still address the patient by their Arabic name. They fall back
  // to the Latin name when no Arabic spelling was entered.
  const patientAr = opts?.patientArabicName?.trim() || appt.patientName;
  const docAr     = opts?.doctorArabicName?.trim()  || doctorFullName?.trim();
  return body
    .replace(/\{patient_ar\}/g, patientAr)
    .replace(/\{docteur_ar\}/g, docAr ? `${WA_DOCTOR_PREFIX.ar} ${docAr}`  : WA_DOCTOR_FALLBACK.ar)
    .replace(/\{cabinet_ar\}/g, docAr ? `${WA_CABINET_PREFIX.ar} ${docAr}` : WA_CABINET_FALLBACK.ar)
    .replace(/\{patient\}/g, patientName)
    .replace(/\{date\}/g,    d)
    .replace(/\{heure\}/g,   appt.startTime)
    .replace(/\{docteur\}/g, docName ? `${WA_DOCTOR_PREFIX[lang]} ${docName}`  : WA_DOCTOR_FALLBACK[lang])
    .replace(/\{cabinet\}/g, docName ? `${WA_CABINET_PREFIX[lang]} ${docName}` : WA_CABINET_FALLBACK[lang]);
}

// ── WhatsApp template picker ──────────────────────────────────────────────────

function WaPickerModal({
  appt, phone, templates, doctorFullName, patientArabicName, doctorArabicName, onClose,
}: {
  appt:              Appointment;
  phone:             string;
  templates:         WaTemplate[];
  doctorFullName?:   string;
  patientArabicName?: string;
  doctorArabicName?: string;
  onClose:           () => void;
}) {
  const { t, i18n } = useTranslation();
  // The MESSAGE language is chosen independently of the app UI language —
  // many patients read Arabic while the doctor uses the app in fr/en.
  const uiLang = (i18n.language?.slice(0, 2) ?? "fr") as WaMsgLang;
  const [msgLang, setMsgLang] = useState<WaMsgLang>(
    WA_MSG_LANGS.some(l => l.key === uiLang) ? uiLang : "fr");
  const locale = WA_MSG_LOCALE[msgLang];
  const d = new Date(appt.date + "T12:00:00").toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long",
  });
  const clean = phone.replace(/\D/g, "");
  const waOpts = { patientArabicName, doctorArabicName };
  const buildUrl = (body: string) =>
    `https://wa.me/${clean}?text=${encodeURIComponent(renderWaBody(body, appt, doctorFullName, msgLang, waOpts))}`;

  // Built-in translated messages for the selected language. When the doctor's
  // own templates exist and the language is French, the built-ins would just
  // duplicate the shipped defaults — hide them in that case.
  const builtins = BUILTIN_WA_MESSAGES[msgLang].filter(() =>
    !(msgLang === "fr" && templates.length > 0));
  const isRtl = msgLang === "ar";

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wa-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366" style={{ marginRight: 8, flexShrink: 0 }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
            {t("agenda.waTitle")}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="wa-picker-appt-info">
            <strong>{appt.patientName}</strong>
            <span className="wa-picker-appt-meta">{t("agenda.waApptMeta", { date: d, time: appt.startTime })}</span>
          </div>

          {/* Message language — independent of the app language */}
          <div className="wa-picker-label">{t("agenda.waMsgLang")}</div>
          <div className="wa-lang-chips">
            {WA_MSG_LANGS.map(l => (
              <button
                key={l.key}
                type="button"
                className={`wa-lang-chip${msgLang === l.key ? " active" : ""}`}
                onClick={() => setMsgLang(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="wa-picker-label">{t("agenda.waChooseTemplate")}</div>
          {templates.length === 0 && builtins.length === 0 ? (
            <div className="wa-picker-empty">
              {t("agenda.waNoTemplates")}{" "}
              <a href="/messages" style={{ color: "var(--blue)" }}>
                {t("agenda.waCreateTemplates")}
              </a>
            </div>
          ) : (
            <div className="wa-picker-list">
              {builtins.map(b => (
                <a
                  key={b.id}
                  href={buildUrl(b.body)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wa-picker-card"
                  onClick={onClose}
                >
                  <div className="wa-picker-card-header">
                    <div
                      className="wa-picker-card-dot"
                      style={{ background: WA_TEMPLATE_CATEGORY_COLORS[b.category] }}
                    />
                    <span className="wa-picker-card-name">{b.name}</span>
                    <span
                      className="wa-picker-card-cat"
                      style={{
                        background: WA_TEMPLATE_CATEGORY_COLORS[b.category] + "22",
                        color: WA_TEMPLATE_CATEGORY_COLORS[b.category],
                      }}
                    >
                      {WA_TEMPLATE_CATEGORY_LABELS[b.category]}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" style={{ marginLeft: "auto", flexShrink: 0 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <div className="wa-picker-card-body" dir={isRtl ? "rtl" : "ltr"}>
                    {renderWaBody(b.body, appt, doctorFullName, msgLang, waOpts)}
                  </div>
                </a>
              ))}
              {templates.map(t => (
                <a
                  key={t.id}
                  href={buildUrl(t.body)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wa-picker-card"
                  onClick={onClose}
                >
                  <div className="wa-picker-card-header">
                    <div
                      className="wa-picker-card-dot"
                      style={{ background: WA_TEMPLATE_CATEGORY_COLORS[t.category] }}
                    />
                    <span className="wa-picker-card-name">{t.name}</span>
                    <span
                      className="wa-picker-card-cat"
                      style={{
                        background: WA_TEMPLATE_CATEGORY_COLORS[t.category] + "22",
                        color: WA_TEMPLATE_CATEGORY_COLORS[t.category],
                      }}
                    >
                      {WA_TEMPLATE_CATEGORY_LABELS[t.category]}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" style={{ marginLeft: "auto", flexShrink: 0 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <div className="wa-picker-card-body" dir={isRtl ? "rtl" : "ltr"}>
                    {renderWaBody(t.body, appt, doctorFullName, msgLang, waOpts)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Appointment modal ─────────────────────────────────────────────────────────

interface ApptModalProps {
  initial?: Partial<Appointment>;
  defaultDate: string;
  isEdit: boolean;
  patients: Patient[];
  appointments: Appointment[];
  onSave:      (a: Omit<Appointment, "id">) => void;
  onSaveBatch?: (appts: Omit<Appointment, "id">[]) => void;
  onClose: () => void;
}

function ApptModal({ initial, defaultDate, isEdit, patients, appointments, onSave, onSaveBatch, onClose }: ApptModalProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { doctorProfile } = useCabinet();
  const locations = doctorProfile?.locations ?? [];
  // Consultation types: hide the ones the doctor disabled in Settings, but always
  // keep the currently-selected type visible (e.g. when editing an old RDV).
  const hiddenApptTypes = doctorProfile?.hiddenConsultationTypes ?? [];

  const [patientName, setName]      = useState(initial?.patientName ?? "");
  const [linkedPid,   setPid]       = useState(initial?.patientId   ?? "");
  // New RDV default to today (or the viewed day if it is already in the future) —
  // never silently land in the past when the doctor has scrolled back in the agenda.
  const [date,        setDate]      = useState(
    initial?.date ?? (defaultDate < todayIso() ? todayIso() : defaultDate),
  );
  const [start,       setStart]     = useState(initial?.startTime ?? "09:00");
  const [end,         setEnd]       = useState(initial?.endTime ?? "09:30");
  const [type,        setType]      = useState<AppointmentType>(initial?.type ?? "consultation");
  const [status,      setStatus]    = useState<AppointmentStatus>(initial?.status ?? "scheduled");
  const [notes,       setNotes]     = useState(initial?.notes ?? "");
  const [locationId,  setLocationId] = useState(initial?.locationId ?? "");
  const [autoFilled,  setAutoFilled] = useState(false);
  const [followUpHint, setFollowUpHint] = useState<string | null>(null);
  // Recurrence (new appointments only)
  const [recurring,     setRecurring]   = useState(false);
  const [recurrFreq,    setRecurrFreq]  = useState<RecurrFreq>("weekly");
  const [recurrCount,   setRecurrCount] = useState(4);
  const [conflictWarn,  setConflictWarn] = useState<string | null>(null);
  // When the typed name belongs to two or more patients, we ask which one
  // rather than silently linking the first match.
  const [nameChoices,   setNameChoices]  = useState<Patient[]>([]);

  const applyLink = (match: Patient) => {
    setPid(match.id);
    setNameChoices([]);
    setName(fmtFullName(match));
    if (!isEdit) {
      const prefill = getSmartPrefill(match.id, appointments);
      if (prefill) {
        setType(prefill.type);
        setStart(prefill.startTime);
        setEnd(prefill.endTime);
        setAutoFilled(true);
        setFollowUpHint(
          prefill.suggestedDate
            ? new Date(prefill.suggestedDate + "T12:00:00").toLocaleDateString(locale, {
                day: "numeric", month: "long", year: "numeric",
              })
            : null,
        );
      } else {
        setAutoFilled(false);
        setFollowUpHint(null);
      }
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const v = val.trim().toLowerCase();
    const exact = patients.filter(
      p => fmtFullName(p).toLowerCase() === v
    );
    if (exact.length === 1) {
      applyLink(exact[0]);
    } else {
      // zero matches (new patient) or several (ambiguous → ask)
      setPid("");
      setNameChoices(exact.length >= 2 ? exact : []);
      setAutoFilled(false);
      setFollowUpHint(null);
    }
  };

  const patientDistinguisher = (p: Patient): string => {
    const parts: string[] = [];
    if (p.dateOfBirth) parts.push(p.dateOfBirth);
    if (p.phone)       parts.push(p.phone);
    else if (p.cin)    parts.push(p.cin);
    else if (p.city)   parts.push(p.city);
    return parts.join("  ·  ");
  };

  const linkedPatient = patients.find(p => p.id === linkedPid);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;

    // Conflict detection
    if (!conflictWarn) {
      const editId = initial && "id" in initial ? (initial as { id?: string }).id : undefined;
      const conflict = appointments.find(a =>
        a.date === date &&
        a.id !== editId &&
        a.status !== "cancelled" &&
        start < a.endTime && end > a.startTime,
      );
      if (conflict) {
        setConflictWarn(`${conflict.patientName} (${conflict.startTime}–${conflict.endTime})`);
        return;
      }
    }

    const base = {
      patientName: patientName.trim(),
      patientId:   linkedPid || undefined,
      startTime: start, endTime: end, type, status,
      notes:       notes || undefined,
      locationId:  locationId || undefined,
    };
    if (!isEdit && recurring && onSaveBatch) {
      const dates = generateRecurringDates(date, recurrFreq, recurrCount);
      const ruleId = Math.random().toString(36).slice(2, 9);
      onSaveBatch(dates.map(d => ({ ...base, date: d, recurringRuleId: ruleId })));
    } else {
      onSave({ ...base, date });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? t("agenda.editApptTitle") : t("agenda.addAppt")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">{t("agenda.patientName")}</label>
              <input
                className="form-input"
                value={patientName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder={t("agenda.patientName")}
                list="appt-patient-list"
                required autoFocus
              />
              <datalist id="appt-patient-list">
                {patients.map(p => (
                  <option key={p.id} value={fmtFullName(p)} />
                ))}
              </datalist>
              {nameChoices.length >= 2 && !linkedPid && (
                <div className="patient-picker-ambig">
                  <div className="patient-picker-ambig-title">{t("patientPicker.ambiguous")}</div>
                  {nameChoices.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      className="patient-picker-choice rv-press"
                      onClick={() => applyLink(p)}
                    >
                      <span className="patient-picker-choice-name">{fmtFullName(p)}</span>
                      <span className="patient-picker-choice-meta">
                        {patientDistinguisher(p) || t("patientPicker.noInfo")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {linkedPatient && (
                <div className="appt-linked-patient">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t("agenda.linkedPatient", { phone: linkedPatient.phone ?? t("agenda.noPhone") })}
                </div>
              )}
              {linkedPatient && (
                <div className="appt-info-chips">
                  {linkedPatient.dateOfBirth && (
                    <span className="appt-info-chip">
                      {t("agenda.linkedPatientAge", { n: calcAge(linkedPatient.dateOfBirth) })}
                    </span>
                  )}
                  {linkedPatient.cnopsNumber && (
                    <span className="appt-info-chip appt-info-chip-blue">
                      {t("agenda.linkedPatientCnops")}
                    </span>
                  )}
                  {linkedPatient.allergies && (
                    <span className="appt-info-chip appt-info-chip-warn">
                      {t("agenda.linkedPatientAllergy", { text: linkedPatient.allergies })}
                    </span>
                  )}
                  {autoFilled && (
                    <span className="appt-info-chip appt-info-chip-smart">
                      ✦ {t("agenda.smartFilled")}
                    </span>
                  )}
                </div>
              )}
              {followUpHint && (
                <div className="appt-followup-hint">
                  {t("agenda.followUpSuggested", { date: followUpHint })}
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("agenda.date")}</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t("agenda.start")}</label>
                <input className="form-input" type="time" value={start} onChange={e => setStart(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t("agenda.end")}</label>
                <input className="form-input" type="time" value={end} onChange={e => setEnd(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("agenda.type")}</label>
              <div className="appt-type-pills">
                {TYPE_OPTS
                  .concat(TYPE_OPTS.includes(type) ? [] : [type])   // legacy type stays selectable on old records
                  .filter(tp => !hiddenApptTypes.includes(tp) || tp === type)
                  .map(tp => {
                    const c = APPT_TYPE_COLORS[tp];
                    const active = type === tp;
                    return (
                      <button
                        key={tp}
                        type="button"
                        className={`appt-type-pill${active ? " active" : ""}`}
                        style={active ? { background: c + "20", color: c, borderColor: c } : undefined}
                        onClick={() => setType(tp)}
                      >
                        {t(`apptType.${tp}`)}
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t("agenda.status")}</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value as AppointmentStatus)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{APPT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t("agenda.notes")} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{t("common.optional")}</span></label>
              <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("agenda.notesPlaceholder")} />
            </div>

            {/* ── Location — only when locations are configured ── */}
            {locations.length > 0 && (
              <div className="form-group">
                <label className="form-label">{t("agenda.location")}</label>
                <select
                  className="form-select"
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                >
                  <option value="">{t("agenda.locationDefault")}</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Recurrence — new appointments only ── */}
            {!isEdit && (
              <div className="recurrence-section">
                <label className="recurrence-toggle">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={e => setRecurring(e.target.checked)}
                  />
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M7 3V7l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M2 7l-2-2M2 7l2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{t("agenda.repeatAppt")}</span>
                </label>

                {recurring && (
                  <div className="recurrence-options">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">{t("agenda.frequency")}</label>
                        <select
                          className="form-select"
                          value={recurrFreq}
                          onChange={e => setRecurrFreq(e.target.value as RecurrFreq)}
                        >
                          <option value="weekly">{t("agenda.weeklyOpt")}</option>
                          <option value="biweekly">{t("agenda.biweeklyOpt")}</option>
                          <option value="monthly">{t("agenda.monthlyOpt")}</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t("agenda.sessions")}</label>
                        <input
                          type="number"
                          className="form-input"
                          min={2} max={52}
                          value={recurrCount}
                          onChange={e =>
                            setRecurrCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                        />
                      </div>
                    </div>

                    {date && (
                      <div className="recurrence-preview">
                        <div className="recurrence-preview-summary">
                          {t("agenda.recurringPreview", { n: recurrCount })}
                          {" · "}
                          <span style={{ color: "var(--muted)" }}>
                            {new Date(date + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}
                            {" → "}
                            {new Date(
                              generateRecurringDates(date, recurrFreq, recurrCount).slice(-1)[0] + "T12:00:00"
                            ).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="recurrence-chips">
                          {generateRecurringDates(date, recurrFreq, recurrCount).slice(0, 5).map((d, i) => (
                            <span key={d} className="recurrence-chip">
                              {i + 1}. {new Date(d + "T12:00:00").toLocaleDateString(locale, {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                            </span>
                          ))}
                          {recurrCount > 5 && (
                            <span className="recurrence-chip recurrence-chip-more">
                              {t("agenda.recurringMore", { n: recurrCount - 5 })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {conflictWarn && (
            <div className="appt-conflict-warn">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <path d="M7 2L13 12H1L7 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M7 6v2.5M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span>{t("agenda.conflictWarn", { name: conflictWarn })}</span>
              <button type="button" className="appt-conflict-ignore" onClick={() => setConflictWarn(null)}>
                {t("agenda.conflictIgnore")}
              </button>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" style={{ background: APPT_TYPE_COLORS[type] }}>
              {!isEdit && recurring ? t("agenda.createNAppts", { n: recurrCount }) : t("agenda.saveBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Follow-up strip ────────────────────────────────────────────────────────────

interface FollowUpStripProps {
  followUps: Appointment[];
  onNavigate: (appt: Appointment) => void;
  onProgram: (appt: Appointment) => void;
}

function FollowUpStrip({ followUps, onNavigate, onProgram }: FollowUpStripProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  if (followUps.length === 0) return null;
  return (
    <div className="followup-strip">
      <div className="followup-strip-header">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <strong>{t("agenda.followUpHeader")}</strong>
        <span className="followup-count">{t("agenda.followUpCount", { n: followUps.length, s: followUps.length > 1 ? "s" : "" })}</span>
      </div>
      <div className="followup-list">
        {followUps.map(appt => {
          const fDate = new Date(appt.followUpDate! + "T12:00:00").toLocaleDateString(locale, {
            weekday: "short", day: "numeric", month: "short",
          });
          const ms       = new Date(appt.followUpDate!).getTime() - new Date(todayIso()).getTime();
          const daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24));
          const urgent   = daysLeft <= 3;
          return (
            <div key={appt.id} className="followup-item">
              <div className="followup-avatar">{appt.patientName[0]?.toUpperCase() ?? "?"}</div>
              <div className="followup-info">
                <div className="followup-name">{appt.patientName}</div>
                <div className="followup-date">
                  {t("agenda.followUpDate", { date: fDate })}
                  <span className="followup-days" style={{ color: urgent ? "var(--danger)" : "var(--gold)" }}>
                    {daysLeft <= 0 ? t("agenda.followUpToday") : t("agenda.followUpDays", { n: daysLeft })}
                  </span>
                </div>
              </div>
              <div className="followup-btns">
                <button
                  className="btn btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => onNavigate(appt)}
                  title={t("agenda.viewOriginalTitle")}
                >
                  {t("agenda.viewOriginal")}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => onProgram(appt)}
                  title={t("agenda.scheduleFollowUpTitle")}
                >
                  {t("agenda.scheduleFollowUp")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Appointment card ───────────────────────────────────────────────────────────

function ApptCard({
  appt, onDetail, onEdit, onToggle, onBill, onPrintReceipt, onDelete, onWaClick,
}: {
  appt: Appointment;
  onDetail:       () => void;
  onEdit:         () => void;
  onToggle:       () => void;
  onBill:         () => void;
  onPrintReceipt: () => void;
  onDelete:       () => void;
  onWaClick?:     () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { doctorProfile } = useCabinet();
  const isDone = appt.status === "completed";
  const color  = APPT_TYPE_COLORS[appt.type];
  const hasNotes = !!(appt.consultationNote?.motif || appt.consultationNote?.diagnosis || appt.vitalSigns);
  const locName = appt.locationId
    ? (doctorProfile?.locations ?? []).find(l => l.id === appt.locationId)?.name
    : undefined;

  return (
    <div className="appt-card rv-press" style={{ opacity: isDone ? 0.75 : 1 }} onClick={onDetail}>
      <div className="appt-accent" style={{ background: isDone ? "var(--border)" : color }} />
      <div className="appt-body">
        <div className="appt-time">{appt.startTime} – {appt.endTime}</div>
        <div className="appt-name">{appt.patientName}</div>
        <div className="appt-badges">
          <span className="appt-badge" style={{ background: color + "22", color }}>
            {APPT_TYPE_LABELS[appt.type]}
          </span>
          <span className="appt-badge" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
            {APPT_STATUS_LABELS[appt.status]}
          </span>
          {appt.billedAt && (
            <span className="appt-badge" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
              {t("agenda.billed")}
            </span>
          )}
          {appt.bookingSource === "online" && (
            <span className="appt-badge" style={{ background: "var(--blue-soft)", color: "var(--blue)" }} title={appt.bookingPhone || ""}>
              🌐 {t("agenda.badgeOnline")}
            </span>
          )}
          {hasNotes && (
            <span className="appt-badge" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}>
              {t("agenda.badgeNotes")}
            </span>
          )}
          {appt.followUpDate && (
            <span className="appt-badge" style={{ background: "#FFF8E1", color: "var(--gold)" }}>
              🔁 {new Date(appt.followUpDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}
            </span>
          )}
          {appt.recurringRuleId && (
            <span className="appt-badge" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
              {t("agenda.badgeRecurring")}
            </span>
          )}
          {locName && (
            <span className="appt-badge" style={{ background: "var(--surface-alt)", color: "var(--muted)" }}>
              📍 {locName}
            </span>
          )}
        </div>
        {appt.notes && <div className="appt-notes">{appt.notes}</div>}
      </div>
      <div className="appt-actions" onClick={e => e.stopPropagation()}>
        {/* WhatsApp — opens template picker */}
        {onWaClick && (
          <button
            className="appt-wa-btn"
            title={t("agenda.whatsapp")}
            onClick={(e) => { e.stopPropagation(); onWaClick(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
          </button>
        )}
        {/* Edit shortcut */}
        <button
          className="appt-edit-btn"
          title={t("agenda.editAppt")}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Toggle done */}
        <button
          className={`appt-done-btn${isDone ? " active" : ""}`}
          title={isDone ? t("agenda.markUndone") : t("agenda.markDone")}
          onClick={onToggle}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Print receipt */}
        {appt.billedAt && (
          <button
            className="appt-receipt-btn"
            title={t("agenda.printReceipt")}
            onClick={onPrintReceipt}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4 9h6M4 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Bill */}
        {isDone && !appt.billedAt && (
          <button className="appt-bill-btn" title={t("agenda.addRevenueTip")} onClick={onBill}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 3v6M4 5h3.5a1.5 1.5 0 0 1 0 3H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {/* Delete */}
        <button className="tx-delete" title={t("agenda.deleteApptTip")} onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Bulk billing modal ─────────────────────────────────────────────────────────

interface BulkBillItem {
  appt: Appointment;
  amount: string;
}

interface BulkBillModalProps {
  items: BulkBillItem[];
  onChange: (id: string, amount: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function BulkBillModal({ items, onChange, onConfirm, onClose }: BulkBillModalProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t("agenda.bulkBillModal")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {t("agenda.bulkBillSub", { n: items.length })}
          </div>
          <div className="bulk-bill-list">
            {items.map(({ appt, amount }) => (
              <div key={appt.id} className="bulk-bill-row">
                <div className="bulk-bill-info">
                  <div className="bulk-bill-name">{appt.patientName}</div>
                  <div className="bulk-bill-sub">
                    <span style={{ background: APPT_TYPE_COLORS[appt.type] + "22", color: APPT_TYPE_COLORS[appt.type], padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>
                      {APPT_TYPE_LABELS[appt.type]}
                    </span>
                    · {appt.startTime}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    className="form-input"
                    type="number" min="1" step="0.01"
                    value={amount}
                    onChange={e => onChange(appt.id, e.target.value)}
                    style={{ width: 90, textAlign: "right", fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>MAD</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bulk-bill-total">
            {t("common.total")} : <strong>{total.toLocaleString(locale)} MAD</strong>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button
            className="btn btn-primary"
            style={{ background: "var(--green)" }}
            onClick={onConfirm}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ marginRight: 6 }}>
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 3v6M4 5h3.5a1.5 1.5 0 0 1 0 3H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {t("agenda.bulkBillAll", { n: items.length })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Time-slot grid body ────────────────────────────────────────────────────────

function TGSlotGrid({
  appts, isToday, nowTop, gridStart, gridEnd, onSlotClick, onApptClick, onApptPointerDown, draggingId,
}: {
  appts:       Appointment[];
  isToday:     boolean;
  nowTop:      number;
  gridStart:   number;
  gridEnd:     number;
  onSlotClick: (startTime: string, endTime: string) => void;
  onApptClick: (appt: Appointment) => void;
  onApptPointerDown?: (e: React.PointerEvent, appt: Appointment) => void;
  draggingId?: string | null;
}) {
  const layout = layoutDayAppts(appts);
  const total  = (gridEnd - gridStart) * TG_PX_H;
  const hours  = gridHourList(gridStart, gridEnd);
  return (
    <div
      className="tgrid-body"
      style={{ height: total }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".tgrid-event")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y    = e.clientY - rect.top;
        const t    = snapTime(y, gridStart, gridEnd);
        onSlotClick(t, addMinutes(t, 30));
      }}
    >
      {/* Grid lines */}
      {hours.map((h, idx) => (
        <span key={h}>
          <div className="tgrid-hour-line" style={{ top: idx * TG_PX_H }} />
          <div className="tgrid-half-line" style={{ top: idx * TG_PX_H + TG_PX_H / 2 }} />
        </span>
      ))}
      <div className="tgrid-hour-line" style={{ top: total }} />

      {/* Now indicator */}
      {isToday && nowTop >= 0 && nowTop <= total && (
        <div className="tgrid-now-line" style={{ top: nowTop }} />
      )}

      {/* Appointments */}
      {appts.map(appt => {
        const color  = APPT_TYPE_COLORS[appt.type];
        const done   = appt.status === "completed";
        const canc   = appt.status === "cancelled" || appt.status === "no_show";
        const top    = tTop(appt.startTime, gridStart);
        const height = tHeight(appt.startTime, appt.endTime);
        const lay    = layout.get(appt.id) ?? { col: 0, cols: 1 };
        const widthPct = 100 / lay.cols;
        // Short slots (≤20 min) can't fit two stacked lines — render one compact row.
        const compact = tDurationMin(appt.startTime, appt.endTime) <= 20 || height < 34;
        return (
          <div
            key={appt.id}
            className={`tgrid-event${done ? " done" : ""}${canc ? " cancelled" : ""}${lay.cols > 1 ? " tgrid-event-multi" : ""}${compact ? " tgrid-event-compact" : ""}${draggingId === appt.id ? " tgrid-event-dragging" : ""}`}
            style={{
              top, height,
              left:  `calc(${lay.col * widthPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              right: "auto",
              background:      canc ? "var(--surface-alt)" : color + "1a",
              borderLeftColor: canc ? "var(--border)"      : color,
              color:           canc ? "var(--muted)"       : color,
              cursor:          onApptPointerDown ? "grab" : undefined,
              touchAction:     onApptPointerDown ? "none" : undefined,
            }}
            onPointerDown={onApptPointerDown ? (e) => onApptPointerDown(e, appt) : undefined}
            onClick={(e) => { e.stopPropagation(); onApptClick(appt); }}
            title={`${appt.patientName} · ${appt.startTime}–${appt.endTime}`}
          >
            <span className="tgrid-event-time">{appt.startTime}</span>
            <span className="tgrid-event-name">{appt.patientName}</span>
            {(appt.billedAt || appt.savedOrdonnance) && (
              <span className="tgrid-badges">
                {appt.billedAt        && <span className="tgrid-badge green">✓</span>}
                {appt.savedOrdonnance && <span className="tgrid-badge blue">℞</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const today    = todayIso();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    appointments, patients, doctorProfile,
    addAppointment, updateAppointment, deleteAppointment, deleteAppointmentSeries,
    waTemplates, role,
  } = useCabinet();
  const { addTransaction } = useApp();

  const [selDate,   setSelDate]   = useState(today);
  const [view,      setView]      = useState<AgendaView>("week");
  const [calYear,   setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth());
  const [modal,          setModal]          = useState<{ appt?: Appointment; prefill?: Partial<Appointment> } | null>(null);
  const [billModal,      setBillModal]      = useState<{ appt: Appointment } | null>(null);
  const [waPickerTarget, setWaPickerTarget] = useState<{ appt: Appointment; phone: string } | null>(null);
  const [showBulkWa, setShowBulkWa] = useState(false);
  const [billAmt,   setBillAmt]   = useState("200");
  const [bulkItems, setBulkItems] = useState<BulkBillItem[]>([]);
  const [showBulk,  setShowBulk]  = useState(false);
  const [seriesDeleteTarget, setSeriesDeleteTarget] = useState<Appointment | null>(null);
  const [dragAppt, setDragAppt] = useState<Appointment | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  // Week-view time-grid drag: move an RDV vertically to change its time (and
  // sideways across day columns). Preview holds the live floating-ghost coords.
  const [tgDrag, setTgDrag] = useState<{
    appt: Appointment; durMin: number;
    preview: { iso: string; startTime: string; left: number; top: number; width: number; height: number } | null;
  } | null>(null);
  const tgDragMovedRef = useRef(false);
  const icalInputRef = useRef<HTMLInputElement>(null);
  const tgridScrollRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Drag a RDV onto another day column → reschedule to that day (time unchanged).
  const moveApptToDate = (iso: string) => {
    const a = dragAppt;
    setDragAppt(null);
    setDragOverDay(null);
    if (!a || a.date === iso) return;
    updateAppointment({ ...a, date: iso });
    showToast(t("agenda.movedTo", { date: new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" }) }));
  };

  const handleIcalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const events = parseAgendaIcal(String(reader.result ?? ""));
        if (events.length === 0) { showToast(t("agenda.icalImportEmpty")); return; }
        const drafts = icalEventsToAppointments(events);
        drafts.forEach(d => addAppointment(d));
        showToast(t("agenda.icalImportedN", { n: drafts.length }));
      } catch {
        showToast(t("agenda.icalImportError"), "error");
      }
    };
    reader.onerror = () => showToast(t("agenda.icalImportError"), "error");
    reader.readAsText(file);
  };

  const showToast = useToast();

  // Current-time indicator (updates every minute)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-open new-appointment modal when navigated from a patient page
  useEffect(() => {
    const pid = searchParams.get("newAppt");
    if (!pid) return;
    const p = patients.find(x => x.id === pid);
    if (p) {
      const smart = getSmartPrefill(p.id, appointments);
      setModal({
        prefill: {
          patientName: fmtFullName(p),
          patientId:   p.id,
          date:        today,
          startTime:   smart?.startTime ?? "09:00",
          endTime:     smart?.endTime   ?? "09:30",
          type:        smart?.type      ?? "consultation",
          status:      "scheduled",
        },
      });
    }
    setSearchParams({}, { replace: true });   // remove param from URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Patient phone lookup map
  const patientPhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      if (p.phone) map.set(p.id, p.phone);
    }
    return map;
  }, [patients]);

  // Follow-ups in next 14 days
  const followUps = useMemo(() => {
    const future = new Date(today);
    future.setDate(future.getDate() + 14);
    const t14Iso = future.toISOString().slice(0, 10);
    return appointments
      .filter(a => a.followUpDate && a.followUpDate >= today && a.followUpDate <= t14Iso)
      .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  }, [appointments, today]);

  // Calendar grid
  const nDays   = daysInMonth(calYear, calMonth);
  const leading = firstWeekdayMon(calYear, calMonth);
  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: nDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
  const apptsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    appointments
      .filter(a => a.date.startsWith(monthPrefix))
      .forEach(a => {
        const day = parseInt(a.date.split("-")[2], 10);
        const list = map.get(day) ?? [];
        list.push(a);
        map.set(day, list);
      });
    return map;
  }, [appointments, monthPrefix]);

  const dayAppts = useMemo(() =>
    appointments
      .filter(a => a.date === selDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, selDate]);

  const todayAppts = useMemo(() =>
    appointments.filter(a => a.date === today),
    [appointments, today]);

  const stats = useMemo(() => ({
    total:   todayAppts.length,
    done:    todayAppts.filter(a => a.status === "completed").length,
    waiting: todayAppts.filter(a => a.status === "scheduled").length,
  }), [todayAppts]);

  // Unbilled completed RDVs for the selected day
  const unbilledCompleted = useMemo(() =>
    dayAppts.filter(a => a.status === "completed" && !a.billedAt),
    [dayAppts]);

  const apptsPendingWa = useMemo(() => {
    return dayAppts.filter(a => {
      if (a.status === "cancelled") return false;
      const pt = a.patientId ? patients.find(p => p.id === a.patientId) : null;
      const phone = pt?.phone ?? "";
      return phone.length >= 8;
    });
  }, [dayAppts, patients]);

  const prevMonth = () => {
    let m = calMonth - 1, y = calYear;
    if (m < 0) { m = 11; y--; }
    setCalYear(y); setCalMonth(m);
  };
  const nextMonth = () => {
    let m = calMonth + 1, y = calYear;
    if (m > 11) { m = 0; y++; }
    setCalYear(y); setCalMonth(m);
  };

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString(locale, {
    month: "long", year: "numeric",
  });

  // ── Week view ─────────────────────────────────────────────────────────────
  const weekStart = getMondayOfWeek(selDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = (() => {
    const s = new Date(weekDays[0] + "T12:00:00");
    const e = new Date(weekDays[6] + "T12:00:00");
    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      d.toLocaleDateString(locale, opts);
    return `${fmt(s, { day: "numeric", month: "short" })} – ${fmt(e, { day: "numeric", month: "short", year: "numeric" })}`;
  })();
  const prevWeek = () => setSelDate(addDays(selDate, -7));
  const nextWeek = () => setSelDate(addDays(selDate, +7));
  const jumpToToday = () => {
    setSelDate(today);
    const d = new Date(today + "T12:00:00");
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const weekApptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const iso of weekDays) {
      map.set(iso, appointments
        .filter(a => a.date === iso)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, weekStart]);

  // Grid hours expand beyond the default 07:00–20:00 window to include any
  // early-morning or late-evening appointments, so nothing is pinned to an edge.
  const { gridStart, gridEnd } = useMemo(() => {
    let lo = TG_START, hi = TG_END;
    for (const list of weekApptsByDay.values()) {
      for (const a of list) {
        const s = timeToMin(a.startTime), e = timeToMin(a.endTime);
        if (s != null) lo = Math.min(lo, Math.floor(s / 60));
        if (e != null) hi = Math.max(hi, Math.ceil(e / 60));
      }
    }
    return { gridStart: Math.max(0, lo), gridEnd: Math.min(24, Math.max(hi, lo + 1)) };
  }, [weekApptsByDay]);
  const gridHours = gridHourList(gridStart, gridEnd);
  const nowTop = ((nowMinutes - gridStart * 60) / 60) * TG_PX_H;

  // Auto-scroll the week grid so the doctor lands on the relevant part of the
  // day — the current time when today is in view, otherwise the earliest booked
  // appointment. Fires only on view/week/geometry change (not every minute
  // tick) so it never fights a manual scroll.
  useEffect(() => {
    if (view !== "week") return;
    const el = tgridScrollRef.current;
    if (!el) return;
    let targetPx: number | null = null;
    if (weekDays.includes(today) && nowMinutes >= gridStart * 60) {
      targetPx = ((nowMinutes - gridStart * 60) / 60) * TG_PX_H;
    } else {
      const starts: number[] = [];
      for (const iso of weekDays)
        for (const a of weekApptsByDay.get(iso) ?? []) {
          const m = timeToMin(a.startTime);
          if (m != null) starts.push(m);
        }
      if (starts.length) targetPx = ((Math.min(...starts) - gridStart * 60) / 60) * TG_PX_H;
    }
    if (targetPx != null) el.scrollTo({ top: Math.max(0, targetPx - 90), behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekDays[0], gridStart, gridEnd]);

  // Pointer-drag an RDV inside the week time-grid: vertical = new time, sideways
  // = new day. A floating ghost tracks the snapped slot; a tap (no movement)
  // falls through to opening the appointment.
  const onApptPointerDown = (e: React.PointerEvent, appt: Appointment) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const grabDy  = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const durMin  = tDurationMin(appt.startTime, appt.endTime);
    const downX = e.clientX, downY = e.clientY;
    tgDragMovedRef.current = false;
    setTgDrag({ appt, durMin, preview: null });

    const move = (ev: PointerEvent) => {
      if (!tgDragMovedRef.current) {
        if (Math.abs(ev.clientY - downY) < 5 && Math.abs(ev.clientX - downX) < 5) return;
        tgDragMovedRef.current = true;
      }
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const col   = under?.closest(".tgrid-col[data-iso]") as HTMLElement | null;
      const body  = col?.querySelector(".tgrid-body") as HTMLElement | null;
      if (!col || !body) return; // pointer over the gutter/header — keep last preview
      const iso       = col.getAttribute("data-iso")!;
      const bodyRect  = body.getBoundingClientRect();
      const yTop      = ev.clientY - bodyRect.top - grabDy;
      const startTime = snapDragTime(yTop, gridStart, gridEnd, durMin);
      const height    = tHeight(startTime, addMinutes(startTime, durMin));
      // Ghost follows the cursor (grab-point preserved) instead of snapping to
      // the slot top, so the card stays under the pointer; the drop still snaps
      // to `startTime`, which the ghost shows as its label.
      setTgDrag({
        appt, durMin,
        preview: { iso, startTime, left: bodyRect.left + 2, top: ev.clientY - grabDy, width: bodyRect.width - 4, height },
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setTgDrag(prev => {
        if (tgDragMovedRef.current && prev?.preview) {
          const { iso, startTime } = prev.preview;
          if (appt.date !== iso || appt.startTime !== startTime) {
            updateAppointment({ ...appt, date: iso, startTime, endTime: addMinutes(startTime, durMin) });
            showToast(appt.date !== iso
              ? t("agenda.movedToDateTime", {
                  date: new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" }),
                  time: startTime,
                })
              : t("agenda.movedToTime", { time: startTime }));
          }
        }
        return null;
      });
      // Let the click that follows pointerup be swallowed, then re-enable taps.
      setTimeout(() => { tgDragMovedRef.current = false; }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Net total of the bill the doctor prepared on the appointment page
  // (acts + prices − remise), or null when nothing was prepared.
  const preparedNet = (appt: Appointment): number | null => {
    if (!appt.preparedItems || appt.preparedItems.length === 0) return null;
    const subtotal = appt.preparedItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    return Math.max(0, subtotal - (appt.preparedReduction ?? 0));
  };

  // Single bill handler — 0 MAD is allowed (free consultation): the visit is
  // marked billed but nothing enters the ledger.
  const handleBill = () => {
    if (!billModal) return;
    const raw = parseFloat(billAmt);
    if (isNaN(raw) || raw < 0) return;
    const appt = billModal.appt;
    const net = preparedNet(appt);
    // With a doctor-prepared bill the entered amount is what was COLLECTED,
    // clamped to the net total (rest stays as balance due).
    const collected = net != null ? Math.min(net, raw) : raw;
    // Cash entering the ledger is only what was actually collected — and never
    // from a secretary session (she doesn't write the doctor's finances).
    if (collected > 0 && role !== "secretary") {
      addTransaction({
        type: "RECETTE", amount: collected,
        date: appt.date,
        category: "consultation",
        description: `${APPT_TYPE_LABELS[appt.type]} – ${appt.patientName}`,
        deductibilityStatus: "FULLY_DEDUCTIBLE",
        professionalUseRatio: 1,
      });
    }
    const now = new Date().toISOString();
    if (net != null) {
      // Keep the doctor's items + remise on the facture.
      updateAppointment({
        ...appt,
        billedAt: now,
        billedAmount: net,
        billedItems: appt.preparedItems!,
        billedReduction: appt.preparedReduction && appt.preparedReduction > 0 ? appt.preparedReduction : undefined,
        paidAmount: collected,
        payments: collected > 0 ? [{ amount: collected, date: now, method: "cash" }] : [],
        preparedItems: null,
        preparedReduction: null,
      });
    } else {
      updateAppointment({ ...appt, billedAt: now, billedAmount: collected });
    }
    setBillModal(null);
    showToast(t("agenda.addRevenueToast", { amt: collected.toLocaleString(locale) }));
  };

  // Bulk bill handlers — prefill each row with the doctor's per-type fee.
  const openBulkBill = () => {
    setBulkItems(unbilledCompleted.map(a => ({
      appt: a,
      amount: String(doctorProfile?.appointmentPrices?.[a.type] ?? 200),
    })));
    setShowBulk(true);
  };

  const handleBulkConfirm = () => {
    let grandTotal = 0;
    for (const { appt, amount } of bulkItems) {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) continue;
      addTransaction({
        type: "RECETTE", amount: amt,
        date: appt.date,
        category: "consultation",
        description: `${APPT_TYPE_LABELS[appt.type]} – ${appt.patientName}`,
        deductibilityStatus: "FULLY_DEDUCTIBLE",
        professionalUseRatio: 1,
      });
      updateAppointment({ ...appt, billedAt: new Date().toISOString(), billedAmount: amt });
      grandTotal += amt;
    }
    setShowBulk(false);
    showToast(t("agenda.bulkTotal", { total: grandTotal.toLocaleString(locale) }));
  };

  // Follow-up "Programmer" handler: jump to that date + open pre-filled new modal
  const handleProgramFollowUp = (appt: Appointment) => {
    if (!appt.followUpDate) return;
    const parts = appt.followUpDate.split("-").map(Number);
    setCalYear(parts[0]);
    setCalMonth(parts[1] - 1);
    setSelDate(appt.followUpDate);
    const smart = appt.patientId ? getSmartPrefill(appt.patientId, appointments) : null;
    setModal({
      prefill: {
        patientName: appt.patientName,
        patientId:   appt.patientId,
        date:        appt.followUpDate,
        startTime:   smart?.startTime ?? "09:00",
        endTime:     smart?.endTime   ?? "09:30",
        type:        "suivi",
        status:      "scheduled",
      },
    });
  };

  return (
    <Layout
      title={t("agenda.title")}
      subtitle={t("agenda.subtitleTotal", { n: appointments.length })}
      actions={
        <>
          <div className="agenda-view-toggle">
            <button
              className={`agenda-view-btn${view === "day" ? " active" : ""}`}
              onClick={() => setView("day")}
              title={t("agenda.dayView")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M4 5h6M4 7.5h6M4 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {t("agenda.day")}
            </button>
            <button
              className={`agenda-view-btn${view === "week" ? " active" : ""}`}
              onClick={() => setView("week")}
              title={t("agenda.weekView")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.5"/>
                <rect x="4" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.7"/>
                <rect x="7" y="3" width="2" height="8" rx="0.5" fill="currentColor"/>
                <rect x="10" y="3" width="2" height="8" rx="0.5" fill="currentColor" opacity="0.7"/>
              </svg>
              {t("agenda.week")}
            </button>
            <button
              className={`agenda-view-btn${view === "month" ? " active" : ""}`}
              onClick={() => setView("month")}
              title={t("agenda.monthView")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 2V1M10 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <rect x="3" y="7" width="2" height="2" rx="0.4" fill="currentColor" opacity="0.7"/>
                <rect x="6" y="7" width="2" height="2" rx="0.4" fill="currentColor"/>
                <rect x="9" y="7" width="2" height="2" rx="0.4" fill="currentColor" opacity="0.5"/>
              </svg>
              {t("agenda.month")}
            </button>
          </div>
          <div className="agenda-more-wrap">
            <button
              className="btn btn-ghost agenda-more-btn"
              onClick={() => setMoreOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title={t("agenda.moreActions")}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/>
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="agenda-more-backdrop" onClick={() => setMoreOpen(false)} />
                <div className="agenda-more-menu" role="menu">
                  <button
                    role="menuitem"
                    className="agenda-more-item"
                    disabled={!appointments.some(a => a.date.startsWith(monthPrefix))}
                    onClick={() => {
                      const monthAppts = appointments.filter(a => a.date.startsWith(monthPrefix));
                      const calName = doctorProfile?.fullName
                        ? `Cabinet Dr. ${doctorProfile.fullName}`
                        : "Blackpine";
                      exportAgendaIcal(monthAppts, calName, `agenda-${monthPrefix}.ics`);
                      showToast(t("agenda.exportedN", { n: monthAppts.length }));
                      setMoreOpen(false);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M1 5h12" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 2V1M10 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M7 9V7M5.5 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {t("agenda.exportMonth", { month: monthLabel })}
                  </button>
                  <button
                    role="menuitem"
                    className="agenda-more-item"
                    onClick={() => { icalInputRef.current?.click(); setMoreOpen(false); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    {t("agenda.icalImport")}
                  </button>
                </div>
              </>
            )}
          </div>
          <input
            ref={icalInputRef}
            type="file"
            accept=".ics,text/calendar"
            style={{ display: "none" }}
            onChange={handleIcalImport}
          />
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t("agenda.newAppt")}
          </button>
        </>
      }
    >
      {/* ── Follow-up strip ── */}
      <FollowUpStrip
        followUps={followUps}
        onNavigate={appt => navigate(`/agenda/${appt.id}`)}
        onProgram={handleProgramFollowUp}
      />

      {/* ── Colour legend ── */}
      <div className="agenda-legend">
        {(() => {
          // The legend is a colour key. A type is hidden only from the *new-RDV
          // selector*; existing RDVs of that type (e.g. online bookings default
          // to "consultation") still need their colour explained. So show a type
          // when it is not hidden OR it appears in the current appointments.
          const hidden  = new Set(doctorProfile?.hiddenConsultationTypes ?? []);
          const present = new Set(appointments.map(a => a.type));
          const types   = [...new Set([...TYPE_OPTS, ...appointments.map(a => a.type)])]
            .filter(tp => !hidden.has(tp) || present.has(tp));
          return types.map(tp => (
            <span key={tp} className="agenda-legend-item">
              <span className="agenda-legend-dot" style={{ background: APPT_TYPE_COLORS[tp] }} />
              {t(`apptType.${tp}`)}
            </span>
          ));
        })()}
      </div>

      {/* ── Month view ── */}
      {view === "month" && (
        <div className="agenda-month-view">
          {/* Nav */}
          <div className="agenda-month-nav">
            <button className="agenda-week-arrow" onClick={prevMonth} title={t("agenda.prevMonth")}>‹</button>
            <span className="agenda-month-label">{monthLabel}</span>
            {(() => {
              const onCurrentMonth = calYear === new Date(today + "T12:00:00").getFullYear() &&
                calMonth === new Date(today + "T12:00:00").getMonth();
              return (
                <button
                  className="agenda-week-today-btn"
                  onClick={jumpToToday}
                  style={onCurrentMonth ? { visibility: "hidden" } : undefined}
                  tabIndex={onCurrentMonth ? -1 : undefined}
                  aria-hidden={onCurrentMonth || undefined}
                >{t("agenda.today")}</button>
              );
            })()}
            <button className="agenda-week-arrow" onClick={nextMonth} title={t("agenda.nextMonth")}>›</button>
          </div>

          {/* Grid */}
          <div className="agenda-month-grid">
            {/* Weekday headers — locale-aware, Mon=0 (Jan 6 2025 is a Monday) */}
            <div className="agenda-month-weekdays">
              {Array.from({ length: 7 }, (_, i) =>
                new Date(2025, 0, 6 + i).toLocaleDateString(locale, { weekday: "short" })
              ).map(d => (
                <div key={d} className="agenda-month-wday">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="agenda-month-days">
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="agenda-month-cell agenda-month-empty" />;
                const iso       = isoFromParts(calYear, calMonth, day);
                const isToday   = iso === today;
                const isSel     = iso === selDate;
                const cellAppts = [...(apptsByDay.get(day) ?? [])]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const shown = cellAppts.slice(0, 3);
                const more  = cellAppts.length - shown.length;
                const isDropTarget = dragOverDay === iso && dragAppt?.date !== iso;
                return (
                  <div
                    key={i}
                    className={`agenda-month-cell${isToday ? " am-today" : ""}${isSel ? " am-sel" : ""}${isDropTarget ? " am-drop" : ""}`}
                    onClick={() => { setSelDate(iso); setView("day"); }}
                    onDragOver={dragAppt ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverDay !== iso) setDragOverDay(iso); } : undefined}
                    onDragLeave={dragAppt ? () => setDragOverDay(d => d === iso ? null : d) : undefined}
                    onDrop={dragAppt ? (e) => { e.preventDefault(); moveApptToDate(iso); } : undefined}
                    title={t("agenda.monthCellTitle", { day, n: cellAppts.length })}
                  >
                    <div className={`agenda-month-day-num${isToday ? " am-today-ring" : ""}`}>
                      {day}
                    </div>
                    <div className="agenda-month-chips">
                      {shown.map(a => {
                        const cancelled = a.status === "cancelled" || a.status === "no_show";
                        return (
                          <div
                            key={a.id}
                            className={`agenda-month-chip${a.status === "completed" ? " am-done" : ""}${cancelled ? " am-cancel" : ""}`}
                            style={{ borderLeftColor: APPT_TYPE_COLORS[a.type], cursor: "grab" }}
                            draggable
                            onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragAppt(a); }}
                            onClick={e => { e.stopPropagation(); navigate(`/agenda/${a.id}`); }}
                            title={`${a.startTime} · ${a.patientName}`}
                          >
                            <span className="am-chip-time">{a.startTime}</span>
                            <span className="am-chip-name">{a.patientName}</span>
                          </div>
                        );
                      })}
                      {more > 0 && (
                        <div className="agenda-month-more">{t("agenda.moreAppts", { n: more, s: more > 1 ? "s" : "" })}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Week view (time-grid) ── */}
      {view === "week" && (
        <div className="agenda-week-view">
          {/* Nav bar */}
          <div className="agenda-week-nav">
            <button className="agenda-week-arrow" onClick={prevWeek} title={t("agenda.prevWeek")}>‹</button>
            <span className="agenda-week-label">{weekLabel}</span>
            {/* Today sits just left of the next arrow; always rendered (space kept,
                hidden on the current week) so the next arrow stays on the edge. */}
            <button
              className="agenda-week-today-btn"
              onClick={jumpToToday}
              style={weekDays.includes(today) ? { visibility: "hidden" } : undefined}
              tabIndex={weekDays.includes(today) ? -1 : undefined}
              aria-hidden={weekDays.includes(today) || undefined}
            >{t("agenda.today")}</button>
            <button className="agenda-week-arrow" onClick={nextWeek} title={t("agenda.nextWeek")}>›</button>
          </div>

          {/* Time-grid */}
          <div className="tgrid-scroll" ref={tgridScrollRef}>
            <div className="tgrid-inner">
              {/* Column headers row */}
              <div className="tgrid-hdr-row">
                <div className="tgrid-time-gutter" />
                {weekDays.map(iso => {
                  const isToday = iso === today;
                  const d       = new Date(iso + "T12:00:00");
                  const dayName = d.toLocaleDateString(locale, { weekday: "short" });
                  const dayNum  = d.getDate();
                  const appts   = weekApptsByDay.get(iso) ?? [];
                  return (
                    <div key={iso} className={`tgrid-col-hdr${isToday ? " tgrid-col-hdr-today" : ""}`}>
                      <button
                        className="tgrid-hdr-btn"
                        onClick={() => { setSelDate(iso); setView("day"); }}
                      >
                        <span className="tgrid-hdr-day">{dayName}</span>
                        <span className={`tgrid-hdr-num${isToday ? " tgrid-today-ring" : ""}`}>{dayNum}</span>
                        {appts.length > 0 && (
                          <span className="tgrid-hdr-badge">{appts.length}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Grid body */}
              <div className="tgrid-body-row">
                {/* Time labels */}
                <div className="tgrid-time-gutter">
                  {gridHours.map(h => (
                    <div key={h} className="tgrid-time-cell">
                      <span className="tgrid-time-lbl">{String(h).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map(iso => {
                  const isToday = iso === today;
                  const appts   = weekApptsByDay.get(iso) ?? [];
                  const isDropTarget = tgDrag?.preview?.iso === iso;
                  return (
                    <div
                      key={iso}
                      data-iso={iso}
                      className={`tgrid-col${isToday ? " tgrid-col-today" : ""}${isDropTarget ? " tgrid-col-drop" : ""}`}
                    >
                      <TGSlotGrid
                        appts={appts}
                        isToday={isToday}
                        nowTop={nowTop}
                        gridStart={gridStart}
                        gridEnd={gridEnd}
                        onSlotClick={(start, end) => {
                          setSelDate(iso);
                          setModal({ prefill: { date: iso, startTime: start, endTime: end } });
                        }}
                        onApptClick={appt => { if (tgDragMovedRef.current) return; navigate(`/agenda/${appt.id}`); }}
                        onApptPointerDown={onApptPointerDown}
                        draggingId={tgDrag?.appt.id ?? null}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Day view ── */}
      {view === "day" && <div className="agenda-layout">
        {/* ── Calendar panel ── */}
        <div className="agenda-cal">
          <div className="cal-month-nav">
            <button className="cal-arrow" onClick={prevMonth}>‹</button>
            <span className="cal-month-label">{monthLabel}</span>
            <button className="cal-arrow" onClick={nextMonth}>›</button>
          </div>

          <div className="cal-day-headers">
            {Array.from({ length: 7 }, (_, i) =>
              new Date(2025, 0, 6 + i).toLocaleDateString(locale, { weekday: "short" })
            ).map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
          </div>

          <div className="cal-grid">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell cal-cell-empty" />;
              const iso       = isoFromParts(calYear, calMonth, day);
              const isToday   = iso === today;
              const isSel     = iso === selDate;
              const dayAppts2 = apptsByDay.get(day) ?? [];
              return (
                <button
                  key={i}
                  className={`cal-cell${isToday ? " cal-today" : ""}${isSel ? " cal-selected" : ""}`}
                  onClick={() => setSelDate(iso)}
                >
                  <span className="cal-num">{day}</span>
                  {dayAppts2.length > 0 && (
                    <div className="cal-dots">
                      {dayAppts2.slice(0, 3).map((a, j) => (
                        <span key={j} className="cal-dot" style={{ background: APPT_TYPE_COLORS[a.type] }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {stats.total > 0 && (
            <div className="agenda-stats">
              <div className="agenda-stat" style={{ color: "var(--blue)" }}>
                <span className="agenda-stat-val">{stats.total}</span>
                <span className="agenda-stat-lbl">{t("agenda.statsTotal")}</span>
              </div>
              <div className="agenda-stat" style={{ color: "var(--green)" }}>
                <span className="agenda-stat-val">{stats.done}</span>
                <span className="agenda-stat-lbl">{t("agenda.statsDone")}</span>
              </div>
              <div className="agenda-stat" style={{ color: "var(--gold)" }}>
                <span className="agenda-stat-val">{stats.waiting}</span>
                <span className="agenda-stat-lbl">{t("agenda.statsWaiting")}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Day panel ── */}
        <div className="agenda-day">
          <div className="agenda-day-header">
            <div>
              <div className="agenda-day-date">
                {new Date(selDate + "T12:00:00").toLocaleDateString(locale, {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </div>
              <span className="agenda-day-count">{t("agenda.dayCount", { n: dayAppts.length })}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {apptsPendingWa.length > 0 && (
                <button
                  className="btn btn-ghost agenda-bulk-btn"
                  style={{ color: "#25D366", borderColor: "#25D366" }}
                  onClick={() => setShowBulkWa(true)}
                  title={t("agenda.bulkWaTitle")}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  {t("agenda.bulkWaAll", { n: apptsPendingWa.length })}
                </button>
              )}
              {unbilledCompleted.length > 1 && (
                <button
                  className="btn btn-ghost agenda-bulk-btn"
                  onClick={openBulkBill}
                  title={t("agenda.bulkBillTitle")}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M6 3v6M4 5h3.5a1.5 1.5 0 0 1 0 3H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  {t("agenda.bulkBillAll", { n: unbilledCompleted.length })}
                </button>
              )}
            </div>
          </div>

          {dayAppts.length === 0 ? (
            <div className="agenda-empty">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t("agenda.noAppts")}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                {t("agenda.noApptsSub")}
              </div>
              <button className="btn btn-primary" onClick={() => setModal({})}>{t("agenda.addApptBtn")}</button>
            </div>
          ) : (
            <div className="agenda-list">
              {dayAppts.map(appt => (
                <ApptCard
                  key={appt.id}
                  appt={appt}
                  onDetail={() => navigate(`/agenda/${appt.id}`)}
                  onWaClick={(() => {
                    const phone = appt.patientId ? patientPhoneMap.get(appt.patientId) : undefined;
                    if (!phone) return undefined;
                    return () => setWaPickerTarget({ appt, phone });
                  })()}
                  onEdit={() => setModal({ appt })}
                  onToggle={() => updateAppointment({
                    ...appt,
                    status: appt.status === "completed" ? "scheduled" : "completed",
                  })}
                  onBill={() => {
                    setBillModal({ appt });
                    const net = preparedNet(appt);
                    const tp = doctorProfile?.appointmentPrices?.[appt.type];
                    setBillAmt(
                      appt.billedAmount != null ? String(appt.billedAmount)
                      : net != null ? String(net)
                      : tp != null ? String(tp) : "200");
                  }}
                  onPrintReceipt={() => printReceipt({
                    patientName:      appt.patientName,
                    consultationType: APPT_TYPE_LABELS[appt.type],
                    appointmentDate:  appt.date,
                    appointmentTime:  appt.startTime,
                    amount:           appt.billedAmount ?? 0,
                    doctorProfile,
                  })}
                  onDelete={() => {
                    if (appt.recurringRuleId) {
                      setSeriesDeleteTarget(appt);
                    } else if (confirm(t("agenda.deleteAppt"))) {
                      deleteAppointment(appt.id);
                      showToast(t("agenda.apptDeleted"));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>}

      {/* ── Add/Edit modal ── */}
      {modal !== null && (
        <ApptModal
          initial={modal.appt ?? modal.prefill}
          isEdit={!!modal.appt}
          defaultDate={selDate}
          patients={patients}
          appointments={appointments}
          onSave={a => {
            if (modal.appt) updateAppointment({ ...a, id: modal.appt.id });
            else { addAppointment(a); track("action:create_rdv"); }
            showToast(modal.appt ? t("agenda.apptModified") : t("agenda.apptAdded"));
          }}
          onSaveBatch={appts => {
            appts.forEach(a => addAppointment(a));
            showToast(t("agenda.apptsBatch", { n: appts.length }));
          }}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Single bill modal ── */}
      {billModal && (
        <div className="modal-overlay" onClick={() => setBillModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t("agenda.billPayment")}</h2>
              <button className="modal-close" onClick={() => setBillModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{billModal.appt.patientName}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
                {APPT_TYPE_LABELS[billModal.appt.type]} · {billModal.appt.startTime}
              </div>

              {/* Bill prepared by the doctor — show his acts and remise so the
                  secretary collects exactly what was decided. */}
              {(billModal.appt.preparedItems?.length ?? 0) > 0 && (
                <div className="bill-prepared-box">
                  <div className="bill-prepared-title">{t("agenda.billPreparedTitle")}</div>
                  {billModal.appt.preparedItems!.map((l, i) => (
                    <div className="bill-prepared-row" key={i}>
                      <span className="bill-prepared-label">{l.label}</span>
                      <span className="bill-prepared-qty">{l.qty > 1 ? `${l.qty} × ` : ""}</span>
                      <span className="bill-prepared-price">
                        {(l.qty * l.unitPrice).toLocaleString("fr-MA")} MAD
                      </span>
                    </div>
                  ))}
                  {(billModal.appt.preparedReduction ?? 0) > 0 && (
                    <div className="bill-prepared-row bill-prepared-reduction">
                      <span className="bill-prepared-label">{t("apptDetail.billReduction")}</span>
                      <span className="bill-prepared-price">
                        − {billModal.appt.preparedReduction!.toLocaleString("fr-MA")} MAD
                      </span>
                    </div>
                  )}
                  <div className="bill-prepared-row bill-prepared-total">
                    <span className="bill-prepared-label">{t("apptDetail.billTotal")}</span>
                    <span className="bill-prepared-price">
                      {(preparedNet(billModal.appt) ?? 0).toLocaleString("fr-MA")} MAD
                    </span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  {(billModal.appt.preparedItems?.length ?? 0) > 0
                    ? t("agenda.collectedMAD")
                    : t("agenda.amountMAD")}
                </label>
                <input
                  className="form-input" type="number" min="0" step="0.01"
                  value={billAmt} onChange={e => setBillAmt(e.target.value)}
                  style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBillModal(null)}>{t("common.cancel")}</button>
              <button
                className="btn btn-primary"
                style={{ background: "var(--green)" }}
                onClick={handleBill}
              >
                {t("agenda.addRevenue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk billing modal ── */}
      {showBulk && (
        <BulkBillModal
          items={bulkItems}
          onChange={(id, amount) =>
            setBulkItems(prev => prev.map(i => i.appt.id === id ? { ...i, amount } : i))
          }
          onConfirm={handleBulkConfirm}
          onClose={() => setShowBulk(false)}
        />
      )}

      {/* ── WhatsApp template picker ── */}
      {waPickerTarget && (
        <WaPickerModal
          appt={waPickerTarget.appt}
          phone={waPickerTarget.phone}
          templates={waTemplates}
          doctorFullName={doctorProfile?.fullName}
          doctorArabicName={doctorProfile?.arabicFullName}
          patientArabicName={
            waPickerTarget.appt.patientId
              ? patients.find(p => p.id === waPickerTarget.appt.patientId)?.arabicName
              : undefined
          }
          onClose={() => setWaPickerTarget(null)}
        />
      )}

      {/* ── Series delete modal ── */}
      {seriesDeleteTarget && (
        <div className="modal-overlay" onClick={() => setSeriesDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t("agenda.recurringModal")}</h2>
              <button className="modal-close" onClick={() => setSeriesDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
                {t("agenda.recurringDeleteQ")}
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                {t("agenda.recurringDeleteInfo", { patient: seriesDeleteTarget.patientName, date: seriesDeleteTarget.date })}
              </p>
            </div>
            <div className="modal-footer" style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  deleteAppointment(seriesDeleteTarget.id);
                  setSeriesDeleteTarget(null);
                  showToast(t("agenda.apptDeleted"));
                }}
              >
                {t("agenda.deleteThis")}
              </button>
              <button
                className="btn"
                style={{ background: "var(--coral)", color: "#fff" }}
                onClick={() => {
                  if (seriesDeleteTarget.recurringRuleId) {
                    deleteAppointmentSeries(seriesDeleteTarget.recurringRuleId, seriesDeleteTarget.date);
                  }
                  setSeriesDeleteTarget(null);
                  showToast(t("agenda.seriesDeleted"));
                }}
              >
                {t("agenda.deleteSeries")}
              </button>
              <button className="btn btn-ghost" onClick={() => setSeriesDeleteTarget(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk WA reminder modal ── */}
      {showBulkWa && (
        <div className="modal-overlay" onClick={() => setShowBulkWa(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                {t("agenda.bulkWaTitle")}
              </h2>
              <button className="modal-close" onClick={() => setShowBulkWa(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                {t("agenda.bulkWaHint")}
              </div>
              {apptsPendingWa.map(appt => {
                const pt = appt.patientId ? patients.find(p => p.id === appt.patientId) : null;
                const phone = pt?.phone ?? "";
                const waTemplates2 = waTemplates.filter(t => t.category === "rappel");
                const tpl = waTemplates2[0];
                const bulkWaLang: WaMsgLang = i18n.language?.slice(0, 2) === "ar" ? "ar"
                  : i18n.language?.slice(0, 2) === "en" ? "en" : "fr";
                const link = tpl
                  ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(renderWaBody(tpl.body, appt, doctorProfile?.fullName, bulkWaLang, { patientArabicName: pt?.arabicName, doctorArabicName: doctorProfile?.arabicFullName }))}`
                  : `https://wa.me/${phone.replace(/\D/g, "")}`;
                return (
                  <a
                    key={appt.id}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bulk-wa-row"
                  >
                    <span className="bulk-wa-name">{appt.patientName}</span>
                    <span className="bulk-wa-meta">{appt.startTime} · {phone}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </a>
                );
              })}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowBulkWa(false)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating ghost while dragging a RDV to a new time/day */}
      {tgDrag?.preview && (
        <div
          className="tgrid-drag-ghost"
          style={{
            left: tgDrag.preview.left,
            top: tgDrag.preview.top,
            width: tgDrag.preview.width,
            height: tgDrag.preview.height,
            borderLeftColor: APPT_TYPE_COLORS[tgDrag.appt.type],
            color: APPT_TYPE_COLORS[tgDrag.appt.type],
          }}
        >
          <span className="tgrid-event-time">{tgDrag.preview.startTime}</span>
          <span className="tgrid-event-name">{tgDrag.appt.patientName}</span>
        </div>
      )}

    </Layout>
  );
}
