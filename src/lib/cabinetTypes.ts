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

// ── Prescription templates ────────────────────────────────────────────────────

export interface PrescriptionTemplate {
  id:   string;
  name: string;
  lines: OrdonnanceLine[];
}

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
  // Invoice
  invoiceNumber?:   string;   // FAC-YYYY-NNNN — set when formal invoice is issued
  invoiceIssuedAt?: string;   // ISO datetime
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

// ── Stock management ──────────────────────────────────────────────────────────

export type StockCategory = "medicament" | "consommable" | "equipement" | "autre";

export const STOCK_CATEGORY_LABELS: Record<StockCategory, string> = {
  medicament:  "Médicament",
  consommable: "Consommable",
  equipement:  "Équipement",
  autre:       "Autre",
};

export const STOCK_CATEGORY_COLORS: Record<StockCategory, string> = {
  medicament:  "#1890C5",
  consommable: "#15A876",
  equipement:  "#9B72D0",
  autre:       "#D4962A",
};

export interface StockItem {
  id:           string;
  name:         string;
  category:     StockCategory;
  quantity:     number;       // current count
  unit:         string;       // "boîtes", "ml", "pièces", "flacons"…
  minThreshold: number;       // alert when quantity ≤ this
  supplier?:    string;
  notes?:       string;
  updatedAt:    string;       // ISO — last adjustment
}

// ── WhatsApp message templates ────────────────────────────────────────────────

export type WaTemplateCategory = "rappel" | "confirmation" | "suivi" | "resultats" | "autre";

export const WA_TEMPLATE_CATEGORY_LABELS: Record<WaTemplateCategory, string> = {
  rappel:       "Rappel de RDV",
  confirmation: "Confirmation",
  suivi:        "Suivi",
  resultats:    "Résultats",
  autre:        "Autre",
};

export const WA_TEMPLATE_CATEGORY_COLORS: Record<WaTemplateCategory, string> = {
  rappel:       "#25D366",
  confirmation: "#1890C5",
  suivi:        "#9B72D0",
  resultats:    "#D4962A",
  autre:        "#888888",
};

// Variables available in body: {patient} {date} {heure} {docteur} {cabinet}
export interface WaTemplate {
  id:       string;
  name:     string;
  category: WaTemplateCategory;
  body:     string;
}

// ── Teleconsultation sessions ─────────────────────────────────────────────────

export type TelePlatform = "googlemeet" | "zoom" | "teams" | "jitsi" | "autre";

export const TELE_PLATFORM_LABELS: Record<TelePlatform, string> = {
  googlemeet: "Google Meet",
  zoom:       "Zoom",
  teams:      "Microsoft Teams",
  jitsi:      "Jitsi",
  autre:      "Autre lien",
};

export const TELE_PLATFORM_COLORS: Record<TelePlatform, string> = {
  googlemeet: "#1A73E8",
  zoom:       "#2D8CFF",
  teams:      "#6264A7",
  jitsi:      "#15A876",
  autre:      "#888888",
};

export type TeleStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export const TELE_STATUS_LABELS: Record<TeleStatus, string> = {
  scheduled:   "Planifiée",
  in_progress: "En cours",
  completed:   "Terminée",
  cancelled:   "Annulée",
};

export const TELE_STATUS_COLORS: Record<TeleStatus, string> = {
  scheduled:   "#1890C5",
  in_progress: "#15A876",
  completed:   "#888888",
  cancelled:   "#E85B5B",
};

export interface TeleSession {
  id:            string;
  patientName:   string;
  patientId?:    string;
  patientPhone?: string;
  platform:      TelePlatform;
  link?:         string;
  scheduledDate: string;   // YYYY-MM-DD
  scheduledTime: string;   // HH:MM
  status:        TeleStatus;
  notes?:        string;
  duration?:     number;   // minutes
  createdAt:     string;   // ISO
}
