import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import type { Appointment, CabinetDoctorProfile, Certificate, Employee, Patient, Prescription, PrescriptionTemplate, StockItem, WaTemplate, TeleSession, InternalNote, Supplier, PurchaseOrder, PurchaseOrderLine, ExamResult } from "../lib/cabinetTypes";
import { BLANK_DOCTOR_PROFILE } from "../lib/cabinetTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface CabinetCtx {
  appointments: Appointment[];
  addAppointment:    (a: Omit<Appointment, "id">) => void;
  updateAppointment: (a: Appointment) => void;
  deleteAppointment: (id: string) => void;

  patients: Patient[];
  addPatient:    (p: Omit<Patient, "id" | "createdAt">) => void;
  updatePatient: (p: Patient) => void;
  deletePatient: (id: string) => void;

  employees: Employee[];
  addEmployee:    (e: Omit<Employee, "id">) => void;
  updateEmployee: (e: Employee) => void;
  deleteEmployee: (id: string) => void;

  doctorProfile:    CabinetDoctorProfile;
  setDoctorProfile: (p: CabinetDoctorProfile) => void;

  // Prescription templates
  prescriptionTemplates:       PrescriptionTemplate[];
  addPrescriptionTemplate:     (t: Omit<PrescriptionTemplate, "id">) => void;
  updatePrescriptionTemplate:  (t: PrescriptionTemplate) => void;
  deletePrescriptionTemplate:  (id: string) => void;

  // Standalone prescriptions
  prescriptions:       Prescription[];
  addPrescription:     (p: Omit<Prescription, "id" | "createdAt">) => void;
  updatePrescription:  (p: Prescription) => void;
  deletePrescription:  (id: string) => void;

  // Stock management
  stockItems:        StockItem[];
  addStockItem:      (s: Omit<StockItem, "id" | "updatedAt">) => void;
  updateStockItem:   (s: StockItem) => void;
  deleteStockItem:   (id: string) => void;
  adjustStock:       (id: string, delta: number) => void;  // delta = +N or -N

  // WhatsApp message templates
  waTemplates:          WaTemplate[];
  addWaTemplate:        (t: Omit<WaTemplate, "id">) => void;
  updateWaTemplate:     (t: WaTemplate) => void;
  deleteWaTemplate:     (id: string) => void;

  // Teleconsultation sessions
  teleSessions:         TeleSession[];
  addTeleSession:       (s: Omit<TeleSession, "id" | "createdAt">) => void;
  updateTeleSession:    (s: TeleSession) => void;
  deleteTeleSession:    (id: string) => void;

  // Internal notes & tasks
  notes:             InternalNote[];
  addNote:           (n: Omit<InternalNote, "id" | "createdAt" | "updatedAt">) => void;
  updateNote:        (n: InternalNote) => void;
  deleteNote:        (id: string) => void;
  toggleNotePin:     (id: string) => void;
  toggleNoteDone:    (id: string) => void;

  // Suppliers
  suppliers:         Supplier[];
  addSupplier:       (s: Omit<Supplier, "id" | "createdAt">) => void;
  updateSupplier:    (s: Supplier) => void;
  deleteSupplier:    (id: string) => void;

  // Purchase orders
  purchaseOrders:      PurchaseOrder[];
  addPurchaseOrder:    (o: Omit<PurchaseOrder, "id" | "createdAt">) => void;
  updatePurchaseOrder: (o: PurchaseOrder) => void;
  deletePurchaseOrder: (id: string) => void;
  receiveOrder:        (orderId: string, lines: PurchaseOrderLine[]) => void;

  // Paraclinical exams & lab results
  examResults:         ExamResult[];
  addExamResult:       (e: Omit<ExamResult, "id" | "createdAt">) => void;
  updateExamResult:    (e: ExamResult) => void;
  deleteExamResult:    (id: string) => void;

  // Standalone certificates
  certificates:        Certificate[];
  addCertificate:      (c: Omit<Certificate, "id" | "createdAt">) => void;
  updateCertificate:   (c: Certificate) => void;
  deleteCertificate:   (id: string) => void;

  // Backup / restore
  exportCabinetJSON: () => string;
  importCabinetJSON: (json: string) => void;
  clearAppointments: () => void;
  clearPatients:     () => void;
}

const Ctx = createContext<CabinetCtx | null>(null);

// ── Default prescription templates (Moroccan clinical practice) ───────────────

const DEFAULT_TEMPLATES: PrescriptionTemplate[] = [
  {
    id: "tpl-grippe",
    name: "Grippe / Infection respiratoire",
    lines: [
      { drug: "Paracétamol cp 1g",    dosage: "1 comprimé", frequency: "toutes les 6 heures", duration: "5 jours",  notes: "maximum 4g/jour" },
      { drug: "Ibuprofène cp 400mg",  dosage: "1 comprimé", frequency: "3 fois par jour",     duration: "5 jours",  notes: "à prendre pendant les repas" },
      { drug: "Vitamine C 1g",        dosage: "1 sachet",   frequency: "1 fois par jour",     duration: "7 jours",  notes: "" },
    ],
  },
  {
    id: "tpl-infection",
    name: "Infection bactérienne",
    lines: [
      { drug: "Amoxicilline cp 500mg", dosage: "1 comprimé", frequency: "3 fois par jour", duration: "7 jours",  notes: "à prendre jusqu'à la fin du traitement" },
      { drug: "Paracétamol cp 1g",     dosage: "1 comprimé", frequency: "toutes les 6 heures", duration: "3 jours", notes: "si fièvre ou douleur" },
    ],
  },
  {
    id: "tpl-lombalgie",
    name: "Lombalgie / Douleur musculaire",
    lines: [
      { drug: "Ibuprofène cp 400mg",  dosage: "1 comprimé", frequency: "3 fois par jour",   duration: "7 jours", notes: "à prendre pendant les repas" },
      { drug: "Myorelax cp 50mg",     dosage: "1 comprimé", frequency: "2 fois par jour",   duration: "5 jours", notes: "" },
      { drug: "Paracétamol cp 1g",    dosage: "1 comprimé", frequency: "toutes les 6 heures", duration: "au besoin", notes: "" },
    ],
  },
  {
    id: "tpl-gastrite",
    name: "Gastrite / Reflux gastro-œsophagien",
    lines: [
      { drug: "Oméprazole gél 20mg", dosage: "1 gélule", frequency: "1 fois par jour",  duration: "14 jours", notes: "le matin à jeun, 30 min avant le repas" },
      { drug: "Gaviscon",            dosage: "2 sachets", frequency: "après les repas", duration: "au besoin", notes: "" },
    ],
  },
];

// ── Default WhatsApp templates ────────────────────────────────────────────────

const DEFAULT_WA_TEMPLATES: WaTemplate[] = [
  {
    id: "wa-rappel",
    name: "Rappel de rendez-vous",
    category: "rappel",
    body: "Bonjour {patient}, nous vous rappelons votre rendez-vous le {date} à {heure} chez {docteur}. En cas d'empêchement, merci de nous contacter. Merci.",
  },
  {
    id: "wa-confirmation",
    name: "Confirmation de rendez-vous",
    category: "confirmation",
    body: "Bonjour {patient}, votre rendez-vous du {date} à {heure} est confirmé au {cabinet}. Merci de vous présenter 5 minutes avant. À bientôt !",
  },
  {
    id: "wa-suivi",
    name: "Suivi post-consultation",
    category: "suivi",
    body: "Bonjour {patient}, suite à votre consultation du {date}, nous espérons que vous allez mieux. N'hésitez pas à nous contacter si vous avez des questions. Cordialement, {cabinet}.",
  },
  {
    id: "wa-resultats",
    name: "Résultats disponibles",
    category: "resultats",
    body: "Bonjour {patient}, vos résultats d'examens sont disponibles au {cabinet}. Merci de nous contacter ou de passer les récupérer. Cordialement.",
  },
  {
    id: "wa-annulation",
    name: "Annulation de rendez-vous",
    category: "autre",
    body: "Bonjour {patient}, nous sommes dans l'obligation d'annuler votre rendez-vous du {date} à {heure}. Merci de nous contacter pour reprogrammer. Nous nous excusons pour la gêne occasionnée.",
  },
];

// ── Provider ──────────────────────────────────────────────────────────────────

export function CabinetProvider({ children }: { children: ReactNode }) {
  const [appointments,   setAppts]    = useState<Appointment[]>(() => load("bp.appts", []));
  const [patients,       setPatients] = useState<Patient[]>(() => load("bp.patients", []));
  const [employees,      setEmployees] = useState<Employee[]>(() => load("bp.employees", []));
  const [doctorProfile,  setDoctorProfileState] = useState<CabinetDoctorProfile>(
    () => load("bp.doctor", BLANK_DOCTOR_PROFILE)
  );
  const [prescriptionTemplates, setTpls] = useState<PrescriptionTemplate[]>(
    () => load("bp.prescriptionTemplates", DEFAULT_TEMPLATES)
  );
  const [stockItems, setStock] = useState<StockItem[]>(
    () => load("bp.stock", [])
  );
  const [waTemplates, setWaTpls] = useState<WaTemplate[]>(
    () => load("bp.waTemplates", DEFAULT_WA_TEMPLATES)
  );
  const [teleSessions, setTele] = useState<TeleSession[]>(
    () => load("bp.teleSessions", [])
  );
  const [notes, setNotes] = useState<InternalNote[]>(
    () => load("bp.notes", [])
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(
    () => load("bp.suppliers", [])
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(
    () => load("bp.purchaseOrders", [])
  );
  const [examResults, setExamResults] = useState<ExamResult[]>(
    () => load("bp.examResults", [])
  );
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(
    () => load("bp.prescriptions", [])
  );
  const [certificates, setCertificates] = useState<Certificate[]>(
    () => load("bp.certificates", [])
  );

  // Persist to localStorage on every change
  useEffect(() => { save("bp.appts",     appointments);  }, [appointments]);
  useEffect(() => { save("bp.patients",  patients);      }, [patients]);
  useEffect(() => { save("bp.employees", employees);     }, [employees]);
  useEffect(() => { save("bp.doctor",    doctorProfile); }, [doctorProfile]);
  useEffect(() => { save("bp.prescriptionTemplates", prescriptionTemplates); }, [prescriptionTemplates]);
  useEffect(() => { save("bp.stock",       stockItems);    }, [stockItems]);
  useEffect(() => { save("bp.waTemplates",  waTemplates);   }, [waTemplates]);
  useEffect(() => { save("bp.teleSessions", teleSessions);  }, [teleSessions]);
  useEffect(() => { save("bp.notes",          notes);          }, [notes]);
  useEffect(() => { save("bp.suppliers",      suppliers);      }, [suppliers]);
  useEffect(() => { save("bp.purchaseOrders", purchaseOrders); }, [purchaseOrders]);
  useEffect(() => { save("bp.examResults",    examResults);    }, [examResults]);
  useEffect(() => { save("bp.prescriptions",  prescriptions);  }, [prescriptions]);
  useEffect(() => { save("bp.certificates",   certificates);   }, [certificates]);

  const setDoctorProfile = useCallback(
    (p: CabinetDoctorProfile) => setDoctorProfileState(p), []);

  // ── Appointments ──────────────────────────────────────────────────────────
  const addAppointment = useCallback(
    (a: Omit<Appointment, "id">) => setAppts(p => [...p, { ...a, id: uid() }]), []);
  const updateAppointment = useCallback(
    (a: Appointment) => setAppts(p => p.map(x => x.id === a.id ? a : x)), []);
  const deleteAppointment = useCallback(
    (id: string) => setAppts(p => p.filter(x => x.id !== id)), []);

  // ── Patients ──────────────────────────────────────────────────────────────
  const addPatient = useCallback(
    (p: Omit<Patient, "id" | "createdAt">) =>
      setPatients(prev => [...prev, { ...p, id: uid(), createdAt: new Date().toISOString() }]), []);
  const updatePatient = useCallback(
    (p: Patient) => setPatients(prev => prev.map(x => x.id === p.id ? p : x)), []);
  const deletePatient = useCallback(
    (id: string) => setPatients(prev => prev.filter(x => x.id !== id)), []);

  // ── Employees ─────────────────────────────────────────────────────────────
  const addEmployee = useCallback(
    (e: Omit<Employee, "id">) => setEmployees(p => [...p, { ...e, id: uid() }]), []);
  const updateEmployee = useCallback(
    (e: Employee) => setEmployees(p => p.map(x => x.id === e.id ? e : x)), []);
  const deleteEmployee = useCallback(
    (id: string) => setEmployees(p => p.filter(x => x.id !== id)), []);

  // ── Backup / restore ─────────────────────────────────────────────────────
  const exportCabinetJSON = useCallback(() =>
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      appointments, patients, employees, doctorProfile,
    }, null, 2),
  [appointments, patients, employees, doctorProfile]);

  const importCabinetJSON = useCallback((json: string) => {
    try {
      const d = JSON.parse(json) as {
        appointments?: Appointment[];
        patients?:     Patient[];
        employees?:    Employee[];
        doctorProfile?: CabinetDoctorProfile;
      };
      if (Array.isArray(d.appointments)) setAppts(d.appointments);
      if (Array.isArray(d.patients))     setPatients(d.patients);
      if (Array.isArray(d.employees))    setEmployees(d.employees);
      if (d.doctorProfile)               setDoctorProfileState(d.doctorProfile);
    } catch (e) {
      throw new Error("Fichier JSON invalide");
    }
  }, []);

  const clearAppointments = useCallback(() => setAppts([]),     []);
  const clearPatients     = useCallback(() => setPatients([]),  []);

  // ── WhatsApp templates ────────────────────────────────────────────────────
  const addWaTemplate = useCallback(
    (t: Omit<WaTemplate, "id">) =>
      setWaTpls(prev => [...prev, { ...t, id: uid() }]), []);
  const updateWaTemplate = useCallback(
    (t: WaTemplate) => setWaTpls(prev => prev.map(x => x.id === t.id ? t : x)), []);
  const deleteWaTemplate = useCallback(
    (id: string) => setWaTpls(prev => prev.filter(x => x.id !== id)), []);

  // ── Teleconsultation sessions ─────────────────────────────────────────────
  const addTeleSession = useCallback(
    (s: Omit<TeleSession, "id" | "createdAt">) =>
      setTele(prev => [...prev, { ...s, id: uid(), createdAt: new Date().toISOString() }]), []);
  const updateTeleSession = useCallback(
    (s: TeleSession) => setTele(prev => prev.map(x => x.id === s.id ? s : x)), []);
  const deleteTeleSession = useCallback(
    (id: string) => setTele(prev => prev.filter(x => x.id !== id)), []);

  // ── Internal notes & tasks ────────────────────────────────────────────────
  const now = () => new Date().toISOString();
  const addNote = useCallback(
    (n: Omit<InternalNote, "id" | "createdAt" | "updatedAt">) =>
      setNotes(prev => [{ ...n, id: uid(), createdAt: now(), updatedAt: now() }, ...prev]), []);
  const updateNote = useCallback(
    (n: InternalNote) =>
      setNotes(prev => prev.map(x => x.id === n.id ? { ...n, updatedAt: now() } : x)), []);
  const deleteNote = useCallback(
    (id: string) => setNotes(prev => prev.filter(x => x.id !== id)), []);
  const toggleNotePin = useCallback(
    (id: string) =>
      setNotes(prev => prev.map(x => x.id === id ? { ...x, isPinned: !x.isPinned, updatedAt: now() } : x)), []);
  const toggleNoteDone = useCallback(
    (id: string) =>
      setNotes(prev => prev.map(x => x.id === id ? { ...x, isDone: !x.isDone, updatedAt: now() } : x)), []);

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const addSupplier = useCallback(
    (s: Omit<Supplier, "id" | "createdAt">) =>
      setSuppliers(prev => [...prev, { ...s, id: uid(), createdAt: now() }]), []);
  const updateSupplier = useCallback(
    (s: Supplier) => setSuppliers(prev => prev.map(x => x.id === s.id ? s : x)), []);
  const deleteSupplier = useCallback(
    (id: string) => setSuppliers(prev => prev.filter(x => x.id !== id)), []);

  // ── Purchase orders ───────────────────────────────────────────────────────
  const addPurchaseOrder = useCallback(
    (o: Omit<PurchaseOrder, "id" | "createdAt">) =>
      setPurchaseOrders(prev => [...prev, { ...o, id: uid(), createdAt: now() }]), []);
  const updatePurchaseOrder = useCallback(
    (o: PurchaseOrder) => setPurchaseOrders(prev => prev.map(x => x.id === o.id ? o : x)), []);
  const deletePurchaseOrder = useCallback(
    (id: string) => setPurchaseOrders(prev => prev.filter(x => x.id !== id)), []);
  const receiveOrder = useCallback(
    (orderId: string, lines: PurchaseOrderLine[]) => {
      // Update stock quantities for lines that link to a stock item
      setStock(prev => {
        let next = prev;
        for (const line of lines) {
          if (!line.stockItemId) continue;
          const qty = line.receivedQty ?? line.quantity;
          next = next.map(x =>
            x.id === line.stockItemId
              ? { ...x, quantity: x.quantity + qty, updatedAt: new Date().toISOString() }
              : x
          );
        }
        return next;
      });
      // Mark the order received
      setPurchaseOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, status: "received" as const, receivedAt: new Date().toISOString().slice(0, 10), lines }
          : o
      ));
    }, []);

  // ── Prescription templates ────────────────────────────────────────────────
  const addPrescriptionTemplate = useCallback(
    (t: Omit<PrescriptionTemplate, "id">) =>
      setTpls(prev => [...prev, { ...t, id: uid() }]), []);
  const updatePrescriptionTemplate = useCallback(
    (t: PrescriptionTemplate) => setTpls(prev => prev.map(x => x.id === t.id ? t : x)), []);
  const deletePrescriptionTemplate = useCallback(
    (id: string) => setTpls(prev => prev.filter(t => t.id !== id)), []);

  // ── Certificates ─────────────────────────────────────────────────────────
  const addCertificate = useCallback(
    (c: Omit<Certificate, "id" | "createdAt">) =>
      setCertificates(prev => [...prev, { ...c, id: uid(), createdAt: new Date().toISOString() }]), []);
  const updateCertificate = useCallback(
    (c: Certificate) => setCertificates(prev => prev.map(x => x.id === c.id ? c : x)), []);
  const deleteCertificate = useCallback(
    (id: string) => setCertificates(prev => prev.filter(x => x.id !== id)), []);

  // ── Standalone prescriptions ──────────────────────────────────────────────
  const addPrescription = useCallback(
    (p: Omit<Prescription, "id" | "createdAt">) =>
      setPrescriptions(prev => [...prev, { ...p, id: uid(), createdAt: new Date().toISOString() }]), []);
  const updatePrescription = useCallback(
    (p: Prescription) => setPrescriptions(prev => prev.map(x => x.id === p.id ? p : x)), []);
  const deletePrescription = useCallback(
    (id: string) => setPrescriptions(prev => prev.filter(x => x.id !== id)), []);

  // ── Stock management ──────────────────────────────────────────────────────
  const addStockItem = useCallback(
    (s: Omit<StockItem, "id" | "updatedAt">) =>
      setStock(prev => [...prev, { ...s, id: uid(), updatedAt: new Date().toISOString() }]), []);
  const updateStockItem = useCallback(
    (s: StockItem) => setStock(prev => prev.map(x => x.id === s.id ? s : x)), []);
  const deleteStockItem = useCallback(
    (id: string) => setStock(prev => prev.filter(x => x.id !== id)), []);
  const adjustStock = useCallback(
    (id: string, delta: number) =>
      setStock(prev => prev.map(x =>
        x.id === id
          ? { ...x, quantity: Math.max(0, x.quantity + delta), updatedAt: new Date().toISOString() }
          : x
      )), []);

  // ── Exam results ──────────────────────────────────────────────────────────
  const addExamResult = useCallback(
    (e: Omit<ExamResult, "id" | "createdAt">) =>
      setExamResults(prev => [...prev, { ...e, id: uid(), createdAt: new Date().toISOString() }]), []);
  const updateExamResult = useCallback(
    (e: ExamResult) => setExamResults(prev => prev.map(x => x.id === e.id ? e : x)), []);
  const deleteExamResult = useCallback(
    (id: string) => setExamResults(prev => prev.filter(x => x.id !== id)), []);

  const value: CabinetCtx = {
    appointments, addAppointment, updateAppointment, deleteAppointment,
    patients,     addPatient,     updatePatient,     deletePatient,
    employees,    addEmployee,    updateEmployee,    deleteEmployee,
    doctorProfile, setDoctorProfile,
    prescriptionTemplates, addPrescriptionTemplate, updatePrescriptionTemplate, deletePrescriptionTemplate,
    prescriptions, addPrescription, updatePrescription, deletePrescription,
    certificates, addCertificate, updateCertificate, deleteCertificate,
    stockItems, addStockItem, updateStockItem, deleteStockItem, adjustStock,
    waTemplates, addWaTemplate, updateWaTemplate, deleteWaTemplate,
    teleSessions, addTeleSession, updateTeleSession, deleteTeleSession,
    notes, addNote, updateNote, deleteNote, toggleNotePin, toggleNoteDone,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receiveOrder,
    examResults, addExamResult, updateExamResult, deleteExamResult,
    exportCabinetJSON, importCabinetJSON, clearAppointments, clearPatients,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCabinet(): CabinetCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCabinet must be inside CabinetProvider");
  return ctx;
}
