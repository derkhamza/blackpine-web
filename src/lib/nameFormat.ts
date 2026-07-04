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
