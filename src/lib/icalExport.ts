import type { Appointment } from "./cabinetTypes";
import { APPT_TYPE_LABELS } from "./cabinetTypes";

// ── RFC 5545 helpers ──────────────────────────────────────────────────────────

/** Fold long content lines (RFC 5545 §3.1 — max 75 octets). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

/** Escape TEXT values per RFC 5545 §3.3.11. */
function escText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** "YYYY-MM-DD" + "HH:MM" → "YYYYMMDDTHHMMSS" (local time, no Z). */
function icalDt(date: string, time: string): string {
  return date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
}

/** UTC timestamp for DTSTAMP. */
function utcStamp(): string {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return (
    `${n.getUTCFullYear()}${p(n.getUTCMonth() + 1)}${p(n.getUTCDate())}` +
    `T${p(n.getUTCHours())}${p(n.getUTCMinutes())}${p(n.getUTCSeconds())}Z`
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate and download an iCalendar (.ics) file from a list of appointments.
 * Compatible with Google Calendar, Outlook, and Apple Calendar.
 *
 * Morocco has been on UTC+1 (no DST) since October 2018.
 */
export function exportAgendaIcal(
  appointments: Appointment[],
  calName: string,
  filename?: string,
): void {
  const stamp = utcStamp();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Iyadaty//Cabinet Web//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escText(calName)}`),
    "X-WR-TIMEZONE:Africa/Casablanca",
    // Morocco fixed offset UTC+1 (no DST since 2018)
    "BEGIN:VTIMEZONE",
    "TZID:Africa/Casablanca",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0100",
    "TZNAME:+01",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const a of appointments) {
    const typeLabel = APPT_TYPE_LABELS[a.type] ?? a.type;
    const summary   = `${a.patientName} — ${typeLabel}`;

    const descParts: string[] = [];
    if (a.consultationNote?.motif)     descParts.push(`Motif: ${a.consultationNote.motif}`);
    if (a.consultationNote?.diagnosis) descParts.push(`Diagnostic: ${a.consultationNote.diagnosis}`);
    if (a.notes)                       descParts.push(`Notes: ${a.notes}`);
    const desc = descParts.map(escText).join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@blackpine-cabinet`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Africa/Casablanca:${icalDt(a.date, a.startTime)}`,
      `DTEND;TZID=Africa/Casablanca:${icalDt(a.date, a.endTime)}`,
      fold(`SUMMARY:${escText(summary)}`),
      ...(desc ? [fold(`DESCRIPTION:${desc}`)] : []),
      `STATUS:${a.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const content = lines.join("\r\n") + "\r\n";
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const el   = Object.assign(document.createElement("a"), {
    href:     url,
    download: filename ?? `agenda-${new Date().toISOString().slice(0, 10)}.ics`,
  });
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
  URL.revokeObjectURL(url);
}
