// Cabinet types — mirrors blackpine-app/lib/cabinetTypes.ts
// (subset: only what the web app needs)

// ── Doctor / cabinet identity ─────────────────────────────────────────────────

// ── Cabinet locations ─────────────────────────────────────────────────────────

export interface CabinetLocation {
  id:       string;
  name:     string;         // e.g. "Cabinet principal", "Clinique Sud"
  address?: string;
  color?:   string;         // hex — color-codes appointments on agenda
}

export interface CabinetDoctorProfile {
  fullName:        string;
  specialtyLabel?: string;
  inpe?:           string;   // N° d'inscription registre national professionnel
  address?:        string;   // Adresse principale du cabinet
  phone?:          string;
  accountantPhone?: string;  // WhatsApp expert-comptable
  locations?:      CabinetLocation[];  // multi-location support
  secretaryPin?:   string;   // 4-digit PIN to exit secretary mode (doctor sets this)
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

export type CertificateType = "medical" | "arret_travail" | "orientation" | "aptitude" | "presence";

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

// Standalone certificate record (not only embedded in an appointment)
export const CERT_TYPE_LABELS: Record<CertificateType, string> = {
  medical:       "Certificat médical",
  arret_travail: "Arrêt de travail",
  orientation:   "Lettre d'orientation",
  aptitude:      "Certificat d'aptitude",
  presence:      "Attestation de présence",
};

export const CERT_TYPE_COLORS: Record<CertificateType, string> = {
  medical:       "#1890C5",
  arret_travail: "#E85B5B",
  orientation:   "#9B72D0",
  aptitude:      "#15A876",
  presence:      "#D4962A",
};

export interface Certificate {
  id:             string;
  type:           CertificateType;
  patientId?:     string;
  patientName:    string;
  date:           string;   // YYYY-MM-DD
  content?:       string;   // médical: observations / arret: diagnostic
  dateFrom?:      string;   // arret: YYYY-MM-DD
  dateTo?:        string;   // arret: YYYY-MM-DD
  duration?:      number;   // arret: nb jours
  specialist?:    string;   // orientation: destinataire (Dr. Dupont, cardiologue…)
  reason?:        string;   // orientation: motif
  clinicalSummary?: string; // orientation: résumé clinique
  source:         "standalone" | "appointment";
  appointmentId?: string;
  createdAt:      string;   // ISO
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

// Standalone prescription record (not embedded in an appointment)
export interface Prescription {
  id:            string;
  patientId?:    string;
  patientName:   string;
  date:          string;          // YYYY-MM-DD
  lines:         OrdonnanceLine[];
  notes?:        string;
  source:        "standalone" | "appointment";
  appointmentId?: string;         // if linked to an appointment
  createdAt:     string;          // ISO
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
  // Recurring series — shared ID for all appointments in the same recurring series
  recurringRuleId?: string;
  // Multi-location — refers to DoctorProfile.locations[].id
  locationId?:      string;
  // Consultation duration tracking (seconds, set by consultation timer)
  consultationDuration?: number;
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

// ── Suppliers & purchase orders ───────────────────────────────────────────────

export interface Supplier {
  id:        string;
  name:      string;
  phone?:    string;
  email?:    string;
  address?:  string;
  products?: string;   // free-text: what they supply
  notes?:    string;
  createdAt: string;
}

export type PurchaseOrderStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft:     "Brouillon",
  ordered:   "Commandé",
  partial:   "Partiellement reçu",
  received:  "Reçu",
  cancelled: "Annulé",
};

export const PO_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft:     "#888888",
  ordered:   "#1890C5",
  partial:   "#D4962A",
  received:  "#15A876",
  cancelled: "#E85B5B",
};

export interface PurchaseOrderLine {
  stockItemId?: string;   // links to StockItem.id (optional)
  itemName:     string;   // denormalized or free-text
  quantity:     number;
  unitPrice?:   number;   // MAD
  receivedQty?: number;   // actual qty received (set on partial/received)
}

export interface PurchaseOrder {
  id:             string;
  supplierId?:    string;
  supplierName?:  string;  // denormalized
  lines:          PurchaseOrderLine[];
  status:         PurchaseOrderStatus;
  orderedAt?:     string;  // YYYY-MM-DD
  expectedAt?:    string;  // YYYY-MM-DD expected delivery
  receivedAt?:    string;  // YYYY-MM-DD
  notes?:         string;
  createdAt:      string;
}

// ── Internal notes & tasks ────────────────────────────────────────────────────

export type NoteColor = "yellow" | "blue" | "green" | "pink";

export const NOTE_COLOR_VALUES: Record<NoteColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: "#FFFDE7", border: "#FFE082", text: "#6B4F00" },
  blue:   { bg: "#E3F2FD", border: "#90CAF9", text: "#0D47A1" },
  green:  { bg: "#E8F5E9", border: "#A5D6A7", text: "#1B5E20" },
  pink:   { bg: "#FCE4EC", border: "#F48FB1", text: "#880E4F" },
};

export interface InternalNote {
  id:        string;
  type:      "note" | "task";
  title:     string;
  body?:     string;          // free text (notes) or undefined (tasks)
  color:     NoteColor;
  isPinned:  boolean;
  isDone:    boolean;         // tasks only
  dueDate?:  string;          // YYYY-MM-DD, tasks only
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
}

// ── Paraclinical exams & lab results ─────────────────────────────────────────

export type ExamType = "biologie" | "imagerie" | "ecg" | "autre";

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  biologie: "Biologie",
  imagerie: "Imagerie",
  ecg:      "ECG / Cardiologie",
  autre:    "Autre",
};

export const EXAM_TYPE_COLORS: Record<ExamType, string> = {
  biologie: "#1890C5",
  imagerie: "#9B72D0",
  ecg:      "#E85B5B",
  autre:    "#888888",
};

export interface ExamValue {
  label:      string;    // "Hémoglobine", "Glucose"
  value:      string;    // "12.5" (string for flexibility: can be text like "Normal")
  unit?:      string;    // "g/dL", "mmol/L"
  refMin?:    number;    // lower bound of normal range
  refMax?:    number;    // upper bound of normal range
  isAbnormal?: boolean;  // manually flagged or auto-computed
}

export interface ExamResult {
  id:           string;
  patientId?:   string;
  patientName:  string;
  type:         ExamType;
  date:         string;   // YYYY-MM-DD
  title:        string;   // "NFS", "Glycémie à jeun", "Échographie abdominale"
  labName?:     string;   // laboratory name
  requestedBy?: string;   // referring doctor
  values:       ExamValue[];
  notes?:       string;
  createdAt:    string;   // ISO
}

// ── Invoice record ─────────────────────────────────────────────────────────────
// Lightweight history entry created each time a formal invoice (Note d'honoraires)
// is generated, mirroring the mobile app's InvoiceRecord.

export interface InvoiceRecord {
  id:            string;
  appointmentId: string;
  patientId?:    string;
  patientName:   string;
  amount:        number;         // MAD
  actLabel:      string;         // e.g. "Consultation médicale"
  invoiceNumber: string;         // FAC-YYYY-NNNN
  issuedAt:      string;         // ISO timestamp
  cnopsNumber?:  string;
  taux?:         number;         // reimbursement rate (0–100)
}

// ── Appointment document attachment ──────────────────────────────────────────
// Files attached to a specific appointment (scan, photo, PDF result…).
// Stored as base64 in localStorage — max 2 MB per file recommended.

export interface ApptDocument {
  id:            string;
  appointmentId: string;
  filename:      string;
  mimeType:      string;   // "image/jpeg", "application/pdf" …
  sizeBytes:     number;
  data:          string;   // base64 data URL ("data:image/jpeg;base64,…")
  label?:        string;   // optional user label (e.g. "Radio pulmonaire")
  uploadedAt:    string;   // ISO
}
