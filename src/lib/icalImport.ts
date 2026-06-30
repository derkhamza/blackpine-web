// Parse an iCalendar (.ics) file into appointment drafts.
// Complements lib/icalExport.ts — handles Google Calendar, Outlook and Apple
// Calendar exports. Times are read as local wall-clock (Morocco is UTC+1, no DST).

import type { Appointment } from "./cabinetTypes";

export interface ParsedIcalEvent {
  patientName: string;
  date:        string;   // YYYY-MM-DD
  startTime:   string;   // HH:MM
  endTime:     string;   // HH:MM
  notes?:      string;
}

/** Unescape RFC 5545 TEXT values. */
function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** Unfold folded content lines (a line starting with space/tab continues the previous). */
function unfold(raw: string): string[] {
  const physical = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** "YYYYMMDDTHHMMSS" / "YYYYMMDD" (optionally trailing Z) → { date, time }. */
function parseIcalDate(val: string): { date: string; time: string | null } | null {
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const date = `${y}-${mo}-${d}`;
  const time = hh != null && mm != null ? `${hh}:${mm}` : null;
  return { date, time };
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  let total = h * 60 + m + mins;
  total = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** Read the value of a content line, ignoring any property parameters (after ';'). */
function lineValue(line: string): { params: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = head.indexOf(";");
  const params = semi >= 0 ? head.slice(semi + 1) : "";
  return { params, value };
}

export function parseAgendaIcal(text: string): ParsedIcalEvent[] {
  const lines = unfold(text);
  const events: ParsedIcalEvent[] = [];

  let inEvent = false;
  let summary = "", description = "";
  let dtStart: { date: string; time: string | null } | null = null;
  let dtEnd:   { date: string; time: string | null } | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      inEvent = true; summary = ""; description = ""; dtStart = null; dtEnd = null;
      continue;
    }
    if (upper === "END:VEVENT") {
      if (dtStart) {
        const start = dtStart.time ?? "09:00";
        const end = dtEnd?.time ?? addMinutes(start, 30);
        events.push({
          patientName: summary.trim() || "Rendez-vous importé",
          date:        dtStart.date,
          startTime:   start,
          endTime:     end >= start ? end : addMinutes(start, 30),
          notes:       description.trim() || undefined,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (upper.startsWith("SUMMARY")) {
      const lv = lineValue(line); if (lv) summary = unescapeText(lv.value);
    } else if (upper.startsWith("DESCRIPTION")) {
      const lv = lineValue(line); if (lv) description = unescapeText(lv.value);
    } else if (upper.startsWith("DTSTART")) {
      const lv = lineValue(line); if (lv) dtStart = parseIcalDate(lv.value);
    } else if (upper.startsWith("DTEND")) {
      const lv = lineValue(line); if (lv) dtEnd = parseIcalDate(lv.value);
    }
  }

  return events;
}

/** Map parsed events to appointment drafts ready for addAppointment. */
export function icalEventsToAppointments(
  events: ParsedIcalEvent[],
): Omit<Appointment, "id">[] {
  return events.map(e => ({
    patientName: e.patientName,
    date:        e.date,
    startTime:   e.startTime,
    endTime:     e.endTime,
    type:        "autre" as const,
    status:      "scheduled" as const,
    notes:       e.notes,
  }));
}
