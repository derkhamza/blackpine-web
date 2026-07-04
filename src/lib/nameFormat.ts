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
