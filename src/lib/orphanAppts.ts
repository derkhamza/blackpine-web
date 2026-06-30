import type { Appointment } from "./cabinetTypes";

function normName(s: string): string {
  return s.trim().toLowerCase();
}

// Appointments booked before the patient had a record carry a name but no
// patientId. Once the record exists, these "orphans" should be attached to it.
// We only ever match appointments that have NO patientId, so an appointment
// already linked to a (possibly same-name) patient is never reassigned.
export function findOrphanAppts(appointments: Appointment[], fullName: string): Appointment[] {
  const n = normName(fullName);
  if (!n) return [];
  return appointments.filter(a => !a.patientId && normName(a.patientName ?? "") === n);
}
