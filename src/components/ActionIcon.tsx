// Reusable line-style action icons — a consistent SVG set that replaces the
// emoji glyphs previously used as UI icons (context menus, action rows). Emoji
// render differently on every OS and read as informal; these inherit currentColor
// and match the nav Icon set. Add new glyphs here so every surface stays uniform.
import type { JSX } from "react";

const S = { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none" as const };

const ICONS: Record<string, JSX.Element> = {
  // Printer — reprint
  print: (
    <svg {...S}><path d="M4 6V2h8v4M4 12H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><rect x="4.5" y="10" width="7" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.4"/></svg>
  ),
  // Document — emit invoice / certificate
  file: (
    <svg {...S}><path d="M4 1.5h5l3 3V14a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 14V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M9 1.5v3h3M6 8h4M6 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Clipboard — open consultation / appointment
  clipboard: (
    <svg {...S}><rect x="3" y="2.5" width="10" height="12" rx="1.4" stroke="currentColor" strokeWidth="1.4"/><path d="M6 2.5a2 2 0 0 1 4 0" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 7.5h5M5.5 10h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // User — patient file
  user: (
    <svg {...S}><circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.4"/><path d="M2.5 13.5c0-2.6 2.5-4.2 5.5-4.2s5.5 1.6 5.5 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  ),
  // Folder — open file
  folder: (
    <svg {...S}><path d="M2 4.5a1 1 0 0 1 1-1h3l1.3 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
  ),
  // Trash — delete
  trash: (
    <svg {...S}><path d="M3 4.5h10M6.5 4.5V3.2a.7.7 0 0 1 .7-.7h1.6a.7.7 0 0 1 .7.7v1.3M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Pencil — edit
  edit: (
    <svg {...S}><path d="M11 2.5l2.5 2.5M3 13.5l.8-3L11 3.3a.7.7 0 0 1 1 0l1.7 1.7a.7.7 0 0 1 0 1L6.5 12.7l-3.5.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Calendar — new appointment
  calendar: (
    <svg {...S}><rect x="2.5" y="3" width="11" height="10.5" rx="1.6" stroke="currentColor" strokeWidth="1.4"/><path d="M5 2v2M11 2v2M2.5 6.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M8 8.5v3M6.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Phone — call
  phone: (
    <svg {...S}><path d="M5.5 2.5 6.8 5 5.6 6.3a8 8 0 0 0 4.1 4.1L11 9.2l2.5 1.3v2.3a1 1 0 0 1-1.1 1A11 11 0 0 1 2.2 3.6a1 1 0 0 1 1-1.1h2.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
  ),
  // Coins — billing
  money: (
    <svg {...S}><ellipse cx="8" cy="4.5" rx="5" ry="2" stroke="currentColor" strokeWidth="1.4"/><path d="M3 4.5v3.5c0 1.1 2.2 2 5 2s5-.9 5-2V4.5M3 8v3.5c0 1.1 2.2 2 5 2s5-.9 5-2V8" stroke="currentColor" strokeWidth="1.4"/></svg>
  ),
  // Receipt
  receipt: (
    <svg {...S}><path d="M4 1.8l1 1 1-1 1 1 1-1 1 1 1-1 1 1v11l-1-1-1 1-1-1-1 1-1-1-1 1-1-1V2.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 6h5M5.5 8.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  ),
  // Check — mark done
  check: (
    <svg {...S}><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Chat bubble — WhatsApp / message
  chat: (
    <svg {...S}><path d="M2.5 12.5V4.5A1.5 1.5 0 0 1 4 3h8a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 11H5.5L2.5 12.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
  ),
  // Balance scale — IMC / weight status
  scale: (
    <svg {...S}><path d="M8 2v11M4 13h8M3 5h10M8 5 4.5 5 3 9a2 2 0 0 0 3 0L4.5 5M8 5l3.5 0L13 9a2 2 0 0 1-3 0l1.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Kidney (bean) — renal / DFG
  kidney: (
    <svg {...S}><path d="M9.5 2.5c2.4 0 3.5 2.4 3.5 5.5s-1.4 5.5-4 5.5c-1.6 0-2.3-1.1-2.3-2.2 0-1.3 1-1.7 1-3 0-1-.7-1.4-.7-2.6 0-1.9 1-3.2 2.5-3.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
  ),
  // Heart — cardiovascular
  heart: (
    <svg {...S}><path d="M8 13.5S2 10 2 5.8A3.3 3.3 0 0 1 8 4a3.3 3.3 0 0 1 6 1.8C14 10 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
  ),
  // Maternity — pregnancy
  pregnant: (
    <svg {...S}><circle cx="8" cy="3" r="1.6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5.2v3.3M8 5.2c2.2 0 3.4 1.6 3.4 3.2 0 1.3-.9 2.1-2 2.3M8 8.5l-2 5M9.4 11v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Ruler — measurements
  ruler: (
    <svg {...S}><rect x="2" y="5" width="12" height="6" rx="1" transform="rotate(45 8 8)" stroke="currentColor" strokeWidth="1.3"/><path d="M6 6l1 1M8 8l1 1M10 4l1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  ),
  // Hospital / clinic
  hospital: (
    <svg {...S}><rect x="2.5" y="4" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M8 6v4M6 8h4M6.5 4V2.5h3V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Magnifier — review / search
  search: (
    <svg {...S}><circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4"/><path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  ),
  // Monitor — equipment / assets
  monitor: (
    <svg {...S}><rect x="1.5" y="2.5" width="13" height="8.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><path d="M6 13.5h4M8 11v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Repeat — recurring
  repeat: (
    <svg {...S}><path d="M3 6.5A4 4 0 0 1 11 5.5l1.5 1.2M13 9.5A4 4 0 0 1 5 10.5L3.5 9.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M12.5 4v2.7h-2.7M3.5 12V9.3h2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Trend up
  chartUp: (
    <svg {...S}><path d="M2 11l3.5-4 3 2 4.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 4h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Trend down
  chartDown: (
    <svg {...S}><path d="M2 5l3.5 4 3-2 4.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 12h3V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  // Bar chart — ratio / stats
  chartBar: (
    <svg {...S}><path d="M2.5 13.5V9M6.5 13.5V4M10.5 13.5V7M13.5 13.5v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  // Flask — lab / analyses
  flask: (
    <svg {...S}><path d="M6.5 2v4.2L3.2 12a1.3 1.3 0 0 0 1.1 2h7.4a1.3 1.3 0 0 0 1.1-2L9.5 6.2V2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 2h4M5 9.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Stethoscope — consultation / clinical
  stethoscope: (
    <svg {...S}><path d="M4 2.5v3a2.5 2.5 0 0 0 5 0v-3M6.5 10.2A3.5 3.5 0 0 0 13 8.5v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 8v.5a4 4 0 0 1-4 0V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="13" cy="5.5" r="1.4" stroke="currentColor" strokeWidth="1.3"/></svg>
  ),
  // Pin — timeline / note
  pin: (
    <svg {...S}><path d="M8 14s4.5-4 4.5-7A4.5 4.5 0 0 0 3.5 7c0 3 4.5 7 4.5 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><circle cx="8" cy="6.7" r="1.6" stroke="currentColor" strokeWidth="1.3"/></svg>
  ),
  // Bell — reminder
  bell: (
    <svg {...S}><path d="M4 7a4 4 0 0 1 8 0c0 3 1.2 4 1.2 4H2.8S4 10 4 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.5 13a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Warning triangle
  warning: (
    <svg {...S}><path d="M8 2.5l6 10.5H2L8 2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 6.5v3M8 11.2v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  ),
  // Capsule / pills — prescription
  pills: (
    <svg {...S}><path d="M3.7 9.2 9.2 3.7a2.6 2.6 0 0 1 3.7 3.7L7.4 12.9a2.6 2.6 0 0 1-3.7-3.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.4 6.4l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  // Radiography film — imaging
  xray: (
    <svg {...S}><rect x="3" y="2" width="10" height="12" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M6.4 5.6c1 .9 2.2.9 3.2 0M6.4 8c1 .9 2.2.9 3.2 0M6.4 10.4c1 .9 2.2.9 3.2 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
  ),
};

export function ActionIcon({ name }: { name: keyof typeof ICONS | string }) {
  return ICONS[name] ?? null;
}
