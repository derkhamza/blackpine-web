// Cabinet types — mirrors blackpine-app/lib/cabinetTypes.ts
// (subset: only what the web app needs)

// ── Doctor / cabinet identity ─────────────────────────────────────────────────

export interface CabinetDoctorProfile {
  fullName:        string;
  specialtyLabel?: string;
  inpe?:           string;   // N° d'inscription registre national professionnel
  address?:        string;   // Adresse du cabinet
  phone?:          string;
  accountantPhone?: string;  // WhatsApp expert-comptable
}

export const SPECIALTIES: { id: string; label: string }[] = [
  { id: "medecin_generaliste",  label: "Médecin généraliste" },
  { id: "medecin_specialiste",  label: "Médecin spécialiste" },
  { id: "dentiste",             label: "Dentiste" },
  { id: "kinesitherapeute",     label: "Kinésithérapeute" },
  { id: "sage_femme",           label: "Sage-femme" },
  { id: "autre",                label: "Autre profession de santé" },
];

export const BLANK_DOCTOR_PROFILE: CabinetDoctorProfile = {
  fullName: "", specialtyLabel: "", inpe: "", address: "", phone: "", accountantPhone: "",
};

export type AppointmentType = "consultation" | "suivi" | "procedure" | "urgence" | "autre";
export type AppointmentStatus =
  | "scheduled"
  | "arrived"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  type: AppointmentType;
  notes?: string;
  status: AppointmentStatus;
  followUpDate?: string;
  billedAt?: string;   // ISO — set when fee is added to finances
}

export type PatientGender = "M" | "F";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;   // "YYYY-MM-DD"
  gender?: PatientGender;
  notes?: string;
  bloodType?: string;
  allergies?: string;
  antecedents?: string;
  currentMedications?: string;
  createdAt: string;
  cin?: string;
  cnopsNumber?: string;
}

export type EmployeeRole =
  | "secretaire"
  | "infirmier"
  | "aide_soignant"
  | "technicien"
  | "autre";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  baseSalary: number;
  cnssNumber?: string;
  hireDate?: string;
  dependents?: number;
  notes?: string;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const APPT_TYPE_LABELS: Record<AppointmentType, string> = {
  consultation: "Consultation",
  suivi:        "Suivi",
  procedure:    "Procédure",
  urgence:      "Urgence",
  autre:        "Autre",
};

export const APPT_TYPE_COLORS: Record<AppointmentType, string> = {
  consultation: "#1890C5",
  suivi:        "#15A876",
  procedure:    "#9B72D0",
  urgence:      "#E85B5B",
  autre:        "#D4962A",
};

export const APPT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled:       "Planifié",
  arrived:         "Arrivé",
  in_consultation: "En consultation",
  completed:       "Terminé",
  cancelled:       "Annulé",
  no_show:         "Non présenté",
};

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  secretaire:    "Secrétaire",
  infirmier:     "Infirmier(e)",
  aide_soignant: "Aide-soignant",
  technicien:    "Technicien(ne)",
  autre:         "Autre",
};
