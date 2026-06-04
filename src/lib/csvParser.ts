import type { Patient, PatientGender } from "./cabinetTypes";

// ── CSV parser ─────────────────────────────────────────────────────────────────

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Strip BOM
  const clean = text.replace(/^﻿/, "").trim();
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Auto-detect delimiter
  const first     = lines[0];
  const counts    = { ",": 0, ";": 0, "\t": 0 };
  let inQ = false;
  for (const ch of first) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && ch in counts) counts[ch as keyof typeof counts]++;
  }
  const delim = counts["\t"] > 0 ? "\t"
    : counts[";"] >= counts[","] ? ";"
    : ",";

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let cur = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === delim && !inQuotes) {
        fields.push(cur.trim()); cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  return {
    headers: parseLine(lines[0]),
    rows:    lines.slice(1).map(parseLine),
  };
}

// ── Field keys ─────────────────────────────────────────────────────────────────

export type ImportField =
  | "firstName" | "lastName" | "phone"
  | "dateOfBirth" | "gender" | "cin" | "notes";

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  firstName:   "Prénom *",
  lastName:    "Nom *",
  phone:       "Téléphone",
  dateOfBirth: "Date de naissance",
  gender:      "Sexe",
  cin:         "CIN",
  notes:       "Notes",
};

export type ColumnMapping = Record<ImportField, number | null>;

const FIELD_PATTERNS: Record<ImportField, RegExp> = {
  firstName:   /^(pr[ée]nom|first.?name|given.?name|fname|forename)$/i,
  lastName:    /^(^nom$|nom.?famille|last.?name|surname|lname|family.?name)$/i,
  phone:       /^(t[ée]l[ée]phone?|mobile|phone|portable|gsm|num[ée]ro|tel\.?|cel)$/i,
  dateOfBirth: /^(date.?de?.?naissance|dob|birth.?date|naissance|n[ée]e?|birthday)$/i,
  gender:      /^(sexe|gender|genre|sex)$/i,
  cin:         /^(cin|cni|id.?national|carte.?nationale|identit[ée])$/i,
  notes:       /^(notes?|remarques?|commentaires?|observations?)$/i,
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const result: ColumnMapping = {
    firstName: null, lastName: null, phone: null,
    dateOfBirth: null, gender: null, cin: null, notes: null,
  };
  headers.forEach((h, i) => {
    for (const [field, pattern] of Object.entries(FIELD_PATTERNS) as [ImportField, RegExp][]) {
      if (pattern.test(h.trim()) && result[field] === null) result[field] = i;
    }
  });
  return result;
}

// ── Value normalizers ──────────────────────────────────────────────────────────

export function normalizeGender(val: string): PatientGender | undefined {
  const v = val.trim().toLowerCase();
  if (["m", "h", "male", "homme", "masculin", "masc"].includes(v)) return "M";
  if (["f", "female", "femme", "féminin", "fem"].includes(v))       return "F";
  return undefined;
}

export function normalizeDate(val: string): string | undefined {
  const v = val.trim();
  if (!v) return undefined;
  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
  const dmy = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return undefined;
}

// ── Row → Patient ──────────────────────────────────────────────────────────────

export function rowToPatient(
  row: string[],
  mapping: ColumnMapping,
): Omit<Patient, "id" | "createdAt"> | null {
  const get = (f: ImportField): string =>
    mapping[f] !== null ? (row[mapping[f]!] ?? "").trim() : "";

  const firstName = get("firstName");
  const lastName  = get("lastName");
  if (!firstName || !lastName) return null;  // required

  return {
    firstName,
    lastName,
    phone:       get("phone")       || undefined,
    dateOfBirth: normalizeDate(get("dateOfBirth")),
    gender:      normalizeGender(get("gender")),
    cin:         get("cin")         || undefined,
    notes:       get("notes")       || undefined,
  };
}
