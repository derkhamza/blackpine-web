// Moroccan naming convention: last name (nom) first, then first name (prénom).
// Centralised here so every screen, picker, export and printer renders and
// stores full names in the same order. Change this one place to change it
// everywhere.

interface NameParts {
  firstName: string;
  lastName?: string | null;
}

/** Full display name in Moroccan order: "Nom Prénom". */
export function fullName(p: NameParts): string {
  return `${p.lastName ?? ""} ${p.firstName ?? ""}`.trim();
}

/** Same, from loose parts (e.g. an employee draft). */
export function personName(firstName: string, lastName?: string | null): string {
  return `${lastName ?? ""} ${firstName}`.trim();
}

/**
 * Civilité prefix for a patient on French documents (prescriptions): a child
 * (under 16 at the document date) → "l'enfant", otherwise "Mme" / "Mr" by sex.
 * Returns "" when neither age nor sex is known, so the name prints bare.
 */
export function civilityPrefix(
  opts: { gender?: "M" | "F" | null; dateOfBirth?: string | null },
  atIso?: string,
): string {
  const { gender, dateOfBirth } = opts;
  if (dateOfBirth) {
    const at  = new Date((atIso || dateOfBirth) + "T12:00:00");
    const dob = new Date(dateOfBirth + "T12:00:00");
    if (!isNaN(at.getTime()) && !isNaN(dob.getTime())) {
      let age = at.getFullYear() - dob.getFullYear();
      const m = at.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age--;
      if (age >= 0 && age < 16) return "l'enfant";
    }
  }
  if (gender === "F") return "Mme";
  if (gender === "M") return "Mr";
  return "";
}

/** Two-letter initials in the same order (Nom, Prénom). */
export function initials(p: NameParts): string {
  return `${(p.lastName ?? "")[0] ?? ""}${(p.firstName ?? "")[0] ?? ""}`.toUpperCase();
}

/** Initials from a free-form full-name string (where only a display name exists). */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable palette for identicon-style avatars. Kept here so every screen that
// draws a name badge picks the same colour for the same person.
const AVATAR_COLORS = [
  "#1890C5", "#15A876", "#D4962A", "#9B72D0", "#E85B5B", "#0A4E7E", "#2ECC71", "#E67E22",
];

/** Deterministic avatar colour from a seed string (usually the full name). */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
