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
  // Optional Arabic spelling of the doctor's name, used for the {docteur} /
  // {cabinet} variables in Arabic WhatsApp messages; falls back to fullName.
  arabicFullName?: string;
  specialtyLabel?: string;
  inpe?:           string;   // INPE — Identifiant National des Professionnels et Établissements de santé
  ordre?:          string;   // N° d'inscription au Conseil National de l'Ordre des Médecins
  ice?:            string;   // ICE — Identifiant Commun de l'Entreprise (obligatoire sur les factures)
  rib?:            string;   // RIB / IBAN du cabinet (affiché sur la facture)
  address?:        string;   // Adresse principale du cabinet
  phone?:          string;   // Téléphone fixe du cabinet
  whatsApp?:       string;   // WhatsApp cabinet (patients)
  accountantPhone?: string;  // WhatsApp expert-comptable
  locations?:      CabinetLocation[];  // multi-location support
  secretaryPin?:   string;   // 4-digit PIN to exit secretary mode (doctor sets this)
  customDrugs?:    string[]; // Custom medications added by the doctor
  hiddenConsultationTypes?: AppointmentType[]; // types hidden from the type selector
  appointmentPrices?: Partial<Record<AppointmentType, number>>; // doctor-set fee (MAD) per RDV type
  secretaryPermissions?: SecretaryPermissions; // granular access the doctor grants the secretary
  acteCodes?:      ActeCode[];        // doctor-maintained list of medical act codes
  documentSettings?: DocumentSettings; // facture / ordonnance customisation
  noteTemplates?:  CustomNoteTemplate[]; // doctor-saved clinical-note templates
  extraBilans?:    string[];          // extra bilan groups (keys of BILAN_CATALOG) shown on every note
}

// A clinical-note template the doctor saved themselves (in addition to the
// built-in NOTE_TEMPLATES library). Rides the synced doctorProfile.
export interface CustomNoteTemplate {
  id:           string;
  label:        string;
  motif?:       string;
  examination?: string;
  diagnosis?:   string;
  treatment?:   string;
}

// A medical act code the doctor maintains themselves (no official tariff is
// shipped — the doctor controls codes, labels and default prices).
export interface ActeCode {
  id:     string;
  code:   string;   // e.g. "C", "CS", "K50", a CCAM/ANAM code…
  label:  string;   // "Consultation spécialisée", "Petite chirurgie"…
  price?: number;   // default fee in MAD
}

// One line on a facture / receipt: the consultation base or a performed act.
export interface BillingLine {
  label:     string;   // "Consultation", "Petite chirurgie"…
  qty:       number;   // usually 1
  unitPrice: number;   // MAD per unit
}

export type PaymentMethod = "cash" | "card" | "cheque" | "transfer";

// A single payment a patient made toward an appointment's bill. A bill can be
// settled in several instalments (deferred / partial payment), so each one is
// recorded with its own date and (optional) method.
export interface PaymentRecord {
  amount: number;          // MAD collected
  date:   string;          // ISO timestamp
  method?: PaymentMethod;
}

export type DocumentLayout = "classic" | "compact" | "letterhead";

export const DOCUMENT_LAYOUT_LABELS: Record<DocumentLayout, string> = {
  classic:    "Classique",
  compact:    "Compact",
  letterhead: "Papier à en-tête",
};

// Customisation applied to printed factures and ordonnances.
// Free-form positioning of one printed block (mm from the PAGE edge, so the
// doctor can line the output up with their pre-printed letterhead paper).
export interface DocBlockDesign {
  show?: boolean;   // default true
  x?: number;       // mm from the left page edge; undefined = natural flow
  y?: number;       // mm from the top page edge
}

// Custom page design for a printed document (facture / ordonnance).
export type PaperSize = "A4" | "A5" | "Letter";

export interface PageDesign {
  pageSize?:     PaperSize; // paper size (defaults: ordonnance=A5, facture=A4)
  marginTop?:    number;  // mm
  marginRight?:  number;
  marginBottom?: number;
  marginLeft?:   number;
  logo?:   string;        // small data-URL image (resized on upload; synced)
  logoX?:  number;        // mm from left page edge
  logoY?:  number;        // mm from top page edge
  logoW?:  number;        // mm wide
  background?:   string;  // full-page reference image (letterhead scan) — data URL
  printBackground?: boolean; // also print the background (off = pre-printed paper)
  blocks?: Record<string, DocBlockDesign>;
}

export interface DocumentSettings {
  layout?:     DocumentLayout;
  showInpe?:   boolean;
  showIce?:    boolean;
  showRib?:    boolean;
  headerNote?: string;   // extra line under the doctor's identity
  footerNote?: string;   // custom footer text
  // Advanced per-document page designs (margins, block positions, logo).
  ordonnanceDesign?: PageDesign;
  factureDesign?:    PageDesign;
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  layout: "classic", showInpe: true, showIce: true, showRib: true,
};

// What a secretary account is allowed to see/do. Undefined → sensible defaults
// (agenda + waiting room + patient contact info; no clinical/financial detail).
export interface SecretaryPermissions {
  recordVitals?:        boolean; // take measurements (TA, poids, taille, T°, SpO₂…)
  handleBilling?:       boolean; // facturation: encaisser, émettre factures/reçus
  viewFinances?:        boolean; // full accounting: comptabilité, transactions, rapports
  viewClinical?:        boolean; // consultation notes, diagnoses, ordonnances
  viewDocuments?:       boolean; // attachments, certificates
  editPatients?:        boolean; // create/edit patient records
  managePayroll?:       boolean; // salaries / bulletins
}

// In Morocco a secretary commonly takes vital-sign measurements and handles
// billing/payments, so those are granted by default; clinical detail, full
// accounting and payroll stay off until the doctor enables them.
export const DEFAULT_SECRETARY_PERMISSIONS: SecretaryPermissions = {
  recordVitals:  true,
  handleBilling: true,
  viewFinances:  false,
  viewClinical:  false,
  viewDocuments: false,
  editPatients:  true,
  managePayroll: false,
};

export const SPECIALTIES: { id: string; label: string }[] = [
  // Médecine générale
  { id: "medecin_generaliste",     label: "Médecin généraliste" },
  // Médecines spécialisées
  { id: "allergologie",            label: "Allergologie et immunologie clinique" },
  { id: "anesthesie",              label: "Anesthésie-Réanimation" },
  { id: "cardiologie",             label: "Cardiologie et maladies vasculaires" },
  { id: "chirurgie_generale",      label: "Chirurgie générale" },
  { id: "chirurgie_ortho",         label: "Chirurgie orthopédique et traumatologie" },
  { id: "chirurgie_pediatrique",   label: "Chirurgie pédiatrique" },
  { id: "chirurgie_plastique",     label: "Chirurgie plastique, reconstructrice et esthétique" },
  { id: "chirurgie_cardio",        label: "Chirurgie thoracique et cardio-vasculaire" },
  { id: "urologie_chir",           label: "Chirurgie urologique" },
  { id: "dermatologie",            label: "Dermatologie-vénérologie" },
  { id: "endocrinologie",          label: "Endocrinologie et maladies métaboliques" },
  { id: "gastroenterologie",       label: "Gastro-entérologie et hépatologie" },
  { id: "geriatrie",               label: "Gériatrie" },
  { id: "gynecologie",             label: "Gynécologie-Obstétrique" },
  { id: "gynecologie_med",         label: "Gynécologie médicale" },
  { id: "hematologie",             label: "Hématologie clinique" },
  { id: "infectiologie",           label: "Infectiologie" },
  { id: "medecine_interne",        label: "Médecine interne" },
  { id: "medecine_urgence",        label: "Médecine d'urgence" },
  { id: "medecine_physique",       label: "Médecine physique et réadaptation" },
  { id: "medecine_travail",        label: "Médecine du travail" },
  { id: "nephrologie",             label: "Néphrologie" },
  { id: "neurochirurgie",          label: "Neurochirurgie" },
  { id: "neurologie",              label: "Neurologie" },
  { id: "oncologie",               label: "Oncologie médicale" },
  { id: "ophtalmologie",           label: "Ophtalmologie" },
  { id: "orl",                     label: "ORL (Oto-rhino-laryngologie)" },
  { id: "pediatrie",               label: "Pédiatrie" },
  { id: "pneumologie",             label: "Pneumologie" },
  { id: "psychiatrie",             label: "Psychiatrie" },
  { id: "radiologie",              label: "Radiologie et imagerie médicale" },
  { id: "rhumatologie",            label: "Rhumatologie" },
  { id: "stomatologie",            label: "Stomatologie et chirurgie maxillo-faciale" },
  { id: "urologie",                label: "Urologie" },
  // Paramédicaux
  { id: "dentiste",                label: "Chirurgien-dentiste" },
  { id: "kinesitherapeute",        label: "Kinésithérapeute" },
  { id: "sage_femme",              label: "Sage-femme" },
  { id: "autre",                   label: "Autre profession de santé" },
];

export const MOROCCAN_CITIES: string[] = [
  "Casablanca", "Rabat", "Marrakech", "Fès", "Agadir", "Tanger",
  "Meknès", "Oujda", "Kénitra", "Tétouan", "Safi", "El Jadida",
  "Beni Mellal", "Nador", "Settat", "Berrechid", "Khemisset",
  "Khouribga", "Taza", "Mohammedia", "Dakhla", "Laâyoune",
  "Errachidia", "Ouarzazate", "Taroudant", "Guelmim", "Ifrane",
  "Chefchaouen", "Larache", "Al Hoceima",
];

export const MUTUELLES: string[] = [
  "CNOPS",
  "MGPAP",
  "MGEN",
  "MGPPS",
  "CMR",
  "FAR",
  "OMFAM",
  "ONDH",
  "CNSS – AMO",
  "RAMED",
  "Allianz Maroc",
  "AXA Assurance Maroc",
  "Atlanta",
  "Saham Assurance",
  "RMA",
  "Wafa Assurance",
  "Zurich Maroc",
  "MCM",
  "Aucune",
];

export const BLANK_DOCTOR_PROFILE: CabinetDoctorProfile = {
  fullName: "", specialtyLabel: "", inpe: "", address: "", phone: "", whatsApp: "", accountantPhone: "",
};

// ── Clinical record types ─────────────────────────────────────────────────────

export interface ConsultationNote {
  motif?:        string;
  examination?:  string;
  diagnosis?:    string;
  treatment?:    string;
  extraFields?:  Record<string, string>;
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

export type AppointmentType = "consultation" | "controle" | "suivi" | "procedure" | "urgence" | "autre";

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

// ── Exam request (demande d'examens) ──────────────────────────────────────────
// A document the doctor issues asking a lab / imaging centre to perform specific
// exams (blood analysis, radiology, ultrasound, CT, MRI…) with given parameters.

export type ExamRequestCategory =
  | "biologie" | "radiologie" | "echographie" | "scanner" | "irm" | "autre";

export interface ExamRequestLine {
  category: ExamRequestCategory;
  label:    string;    // "NFS", "IRM cérébrale", "Échographie abdominale"
  detail?:  string;    // parameters: "à jeun", "face + profil", "avec injection"
}

// Standalone exam-request record (also used for appointment-sourced ones, which
// carry source:"appointment" + appointmentId — single source of truth).
export interface ExamRequest {
  id:            string;
  patientId?:    string;
  patientName:   string;
  date:          string;          // YYYY-MM-DD
  lines:         ExamRequestLine[];
  indication?:   string;          // renseignements cliniques
  source:        "standalone" | "appointment";
  appointmentId?: string;
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
  billedAmount?: number;   // MAD — net amount billed (base + acts − reduction)
  // Itemized billing: the consultation base fee plus every act performed. Each
  // act has its own doctor-set price. billedAmount is the net after reduction.
  billedItems?:     BillingLine[];
  billedReduction?: number;   // MAD discount applied to the subtotal
  // Bill PREPARED by the doctor (acts + prices + reduction decided medically),
  // awaiting encaissement at the front desk. The secretary turns it into the
  // final bill (billedAt/billedItems) when the patient pays / defers.
  // Explicit null (not undefined) when consumed: the secretary sync merge only
  // overwrites fields present in the JSON payload, and undefined keys are
  // dropped by JSON.stringify.
  preparedItems?:     BillingLine[] | null;
  preparedReduction?: number | null;
  // Payment tracking. A patient may pay in full, in part, or defer entirely.
  // paidAmount is the cumulative cash collected so far (0 = fully deferred).
  // Undefined on a billed appointment means a legacy record paid in full.
  paidAmount?: number;
  payments?:   PaymentRecord[];   // individual instalments (audit trail)
  // Mutuelle paperwork — doctors have no visibility on the actual reimbursement,
  // so we only track whether the mutuelle forms were filled, and when.
  mutuellePapersFilled?: boolean;
  mutuellePapersDate?:   string;   // YYYY-MM-DD
  // AMO / CNOPS reimbursement (legacy — kept for back-compat with old records)
  reimbursementStatus?: "pending" | "received" | "rejected";
  reimbursementAmount?: number;
  reimbursementDate?: string;
  // Ordonnance
  savedOrdonnance?: SavedOrdonnance;
  // Online self-booking (created via the public booking page)
  bookingSource?: "online";
  bookingPhone?:  string;
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
  // Extra bilan groups enabled ON THIS APPOINTMENT (keys of BILAN_CATALOG),
  // in addition to the doctor's profile-level default (doctorProfile.extraBilans).
  // Stored per-appointment so a secretary — who cannot sync the doctor profile —
  // can still add a bilan and fill in the measurements at the desk.
  extraBilans?:    string[];
}

export type PatientGender = "M" | "F";

// A free-form event the doctor adds directly to a patient's timeline
// (hospitalisation, phone call, external report received…).
export interface PatientTimelineEvent {
  id:     string;
  date:   string;   // YYYY-MM-DD
  title:  string;
  notes?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  // Optional Arabic spelling of the name, typed by the doctor/secretary (Latin→
  // Arabic transliteration is too lossy to auto-generate). Used for the {patient}
  // variable in Arabic WhatsApp messages; falls back to firstName + lastName.
  arabicName?: string;
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
  mutuelle?: string;
  city?: string;
  timelineEvents?: PatientTimelineEvent[];
}

export type EmployeeRole =
  | "secretaire"
  | "infirmier"
  | "aide_soignant"
  | "technicien"
  | "autre";

export type ContractType = "cdi" | "cdd" | "anapec";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi:    "CDI",
  cdd:    "CDD",
  anapec: "ANAPEC (Idmaj)",
};

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
  // ANAPEC (contrat d'insertion Idmaj): salary is exempt from CNSS/AMO/IR — the
  // employee receives the entire gross, the cabinet pays no charges.
  contractType?: ContractType;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const APPT_TYPE_LABELS: Record<AppointmentType, string> = {
  consultation: "Consultation",
  controle:     "Contrôle",
  suivi:        "Suivi",
  procedure:    "Procédure",
  urgence:      "Urgence",
  autre:        "Autre",
};

export const APPT_TYPE_COLORS: Record<AppointmentType, string> = {
  consultation: "#2563EB",
  controle:     "#10B981",
  suivi:        "#06B6D4",
  procedure:    "#8B5CF6",
  urgence:      "#EF4444",
  autre:        "#F59E0B",
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
  expiryDate?:  string;       // YYYY-MM-DD — péremption (alert when approaching)
  updatedAt:    string;       // ISO — last adjustment
}

// Days before an expiry date at which to start warning the doctor.
export const EXPIRY_WARN_DAYS = 60;

// Returns "expired" | "soon" | "ok" | null(no date) for a stock item's péremption.
export function expiryStatus(expiryDate: string | undefined, today: Date): "expired" | "soon" | "ok" | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate + "T00:00:00");
  if (Number.isNaN(exp.getTime())) return null;
  const days = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= EXPIRY_WARN_DAYS) return "soon";
  return "ok";
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
