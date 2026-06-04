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

// ── Clinical record types ─────────────────────────────────────────────────────

export interface ConsultationNote {
  motif?:       string;
  examination?:  string;
  diagnosis?:    string;
  treatment?:    string;
}

export interface VitalSigns {
  bpSys?:  number;  // Systolic BP (mmHg)
  bpDia?:  number;  // Diastolic BP (mmHg)
  hr?:     number;  // Heart rate (bpm)
  temp?:   number;  // Temperature (°C)
  spo2?:   number;  // SpO₂ (%)
  weight?: number;  // Weight (kg)
  height?: number;  // Height (cm)
}

// ── Appointment types ─────────────────────────────────────────────────────────

export type AppointmentType = "consultation" | "suivi" | "procedure" | "urgence" | "autre";

// ── Certificates ──────────────────────────────────────────────────────────────

export type CertificateType = "medical" | "arret_travail" | "orientation";

export interface SavedCertificate {
  id:               string;
  type:             CertificateType;
  issuedAt:         string;      // ISO datetime
  content?:         string;      // medical: observation; arret: diagnosis
  dateFrom?:        string;      // arret de travail start date (YYYY-MM-DD)
  dateTo?:          string;      // arret de travail end date (YYYY-MM-DD)
  duration?:        number;      // arret de travail: days
  specialist?:      string;      // orientation: addressee
  reason?:          string;      // orientation: motif d'orientation
  clinicalSummary?: string;      // orientation: résumé clinique
}
export type AppointmentStatus =
  | "scheduled"
  | "arrived"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show";

// ── Ordonnance ────────────────────────────────────────────────────────────────

export interface OrdonnanceLine {
  drug:      string;   // "Amoxicilline cp 500 mg"
  dosage?:   string;   // "1 comprimé" (optional dosage detail)
  frequency: string;   // "3 fois par jour"
  duration:  string;   // "7 jours"
  notes?:    string;   // "à prendre pendant les repas"
}

export interface SavedOrdonnance {
  lines:     OrdonnanceLine[];
  printedAt: string;  // ISO datetime
}

// ── Appointment ───────────────────────────────────────────────────────────────

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
  consultationNote?: ConsultationNote;
  vitalSigns?: VitalSigns;
  followUpDate?: string;
  billedAt?:     string;   // ISO — set when fee is added to finances
  billedAmount?: number;   // MAD — amount billed (for receipt printing)
  // AMO / CNOPS reimbursement
  reimbursementStatus?: "pending" | "received" | "rejected";
  reimbursementAmount?: number;
  reimbursementDate?: string;
  // Ordonnance
  savedOrdonnance?: SavedOrdonnance;
  // Waiting-room timestamps
  checkedInAt?:      string;  // ISO — set when patient marks "arrived"
  inConsultationAt?: string;  // ISO — set when doctor calls patient
  // Certificates
  savedCertificates?: SavedCertificate[];
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
