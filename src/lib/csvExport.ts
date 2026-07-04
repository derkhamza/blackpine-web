import type { Patient, Appointment } from "./cabinetTypes";
import { APPT_TYPE_LABELS, APPT_STATUS_LABELS } from "./cabinetTypes";
import { calcAge } from "./format";

// ── Core ──────────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function download(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [
    headers.map(esc).join(","),
    ...rows.map(r => r.map(esc).join(",")),
  ];
  // BOM ensures Excel opens UTF-8 correctly (French/Arabic names with diacritics)
  const content = "﻿" + lines.join("\r\n");
  const blob    = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  const a       = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Patients ──────────────────────────────────────────────────────────────────

export function exportPatientsCsv(patients: Patient[]): void {
  const headers = [
    "Nom", "Prénom", "Date de naissance", "Âge", "Sexe",
    "Téléphone", "CIN", "Groupe sanguin", "N° AMO/CNOPS",
    "Allergies", "Antécédents médicaux", "Médicaments en cours", "Notes",
    "Créé le",
  ];

  const rows = [...patients]
    .sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    )
    .map(p => [
      p.lastName,
      p.firstName,
      p.dateOfBirth ?? "",
      calcAge(p.dateOfBirth) ?? "",
      p.gender === "M" ? "Masculin" : p.gender === "F" ? "Féminin" : "",
      p.phone          ?? "",
      p.cin            ?? "",
      p.bloodType      ?? "",
      p.cnopsNumber    ?? "",
      p.allergies      ?? "",
      p.antecedents    ?? "",
      p.currentMedications ?? "",
      p.notes          ?? "",
      new Date(p.createdAt).toLocaleDateString("fr-FR"),
    ]);

  download(`patients-${today()}.csv`, headers, rows);
}

// ── Appointments ──────────────────────────────────────────────────────────────

export function exportAppointmentsCsv(appointments: Appointment[]): void {
  const headers = [
    "Date", "Heure début", "Heure fin", "Patient", "Type", "Statut",
    "Montant facturé (MAD)", "N° Facture",
    "Statut AMO", "Montant AMO (MAD)", "Date encaissement AMO",
    "Date suivi prévu", "Diagnostic", "Motif de consultation", "Notes",
  ];

  const rmbLabel = (s: Appointment["reimbursementStatus"]) =>
    s === "pending" ? "En attente" : s === "received" ? "Encaissé" : s === "rejected" ? "Refusé" : "";

  const rows = [...appointments]
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    .map(a => [
      a.date,
      a.startTime,
      a.endTime,
      a.patientName,
      APPT_TYPE_LABELS[a.type]   ?? a.type,
      APPT_STATUS_LABELS[a.status] ?? a.status,
      a.billedAmount       ?? "",
      a.invoiceNumber      ?? "",
      rmbLabel(a.reimbursementStatus),
      a.reimbursementAmount ?? "",
      a.reimbursementDate   ?? "",
      a.followUpDate        ?? "",
      a.consultationNote?.diagnosis ?? "",
      a.consultationNote?.motif     ?? "",
      a.notes ?? "",
    ]);

  download(`rendez-vous-${today()}.csv`, headers, rows);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
