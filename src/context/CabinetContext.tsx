import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import type { Appointment, ApptDocument, CabinetDoctorProfile, Certificate, Employee, InvoiceRecord, Patient, Prescription, PrescriptionTemplate, StockItem, WaTemplate, TeleSession, InternalNote, Supplier, PurchaseOrder, PurchaseOrderLine, ExamResult, ExamRequest } from "../lib/cabinetTypes";
import { BLANK_DOCTOR_PROFILE } from "../lib/cabinetTypes";
import { idbGet, idbSet } from "../lib/idbStore";
import { fullName } from "../lib/nameFormat";
import {
  getToken, pullCabinet, pushCabinet, CabinetConflictError, type CabinetSnapshot,
  getSecretaryToken, secretaryPull, secretaryPushAppointments, secretaryPushPatients,
  secretaryPushApptDocuments, NOT_MODIFIED,
  listBackups, restoreBackup, type CabinetBackup,
} from "../api/client";

export interface SecretarySessionRef { ownerUserId: string; ownerName: string; }

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

/** Estimate total localStorage usage for the bp. prefix (bytes, approximate). */
export function estimateStorageBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) ?? "";
    if (!k.startsWith("bp.")) continue;
    total += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2; // UTF-16
  }
  return total;
}

const BACKUP_KEY = "bp.lastBackupAt";

/**
 * Per-record conflict merge used when our push is rejected (409) because
 * another device (typically the secretary) wrote in between. The old behaviour
 * adopted the server snapshot wholesale, silently discarding every local edit
 * made since the last successful sync — including freshly created patients
 * (the "patient introuvable" bug). Instead:
 *   - records we deleted locally stay deleted (tombstones),
 *   - records we edited/created locally win over the server copy,
 *   - everything else adopts the server copy (keeps the other device's edits).
 */
function mergeConflict<T extends { id: string }>(
  server: T[], local: T[], tombstones: Set<string>, touched: Set<string>,
): T[] {
  const localById = new Map(local.map(x => [x.id, x]));
  const out: T[] = [];
  for (const srv of server ?? []) {
    if (!srv || !srv.id) continue;
    if (tombstones.has(srv.id)) continue;               // deleted here → stays deleted
    const loc = localById.get(srv.id);
    out.push(loc && touched.has(srv.id) ? loc : srv);   // local edit wins, else server
    localById.delete(srv.id);
  }
  for (const loc of localById.values()) out.push(loc);  // created here → keep
  return out;
}

// Sub-keys that hold per-cabinet data. Must stay in sync with all save() calls below.
const CABINET_SUBKEYS = [
  "appts", "patients", "employees", "doctor", "prescriptionTemplates",
  "stock", "waTemplates", "teleSessions", "notes", "suppliers",
  "purchaseOrders", "examResults", "examRequests", "prescriptions", "certificates",
  "invoices", "apptDocs",
] as const;

/**
 * One-time migration: the first time a user logs in after this update, copy
 * any existing non-namespaced bp.* keys into their user-scoped namespace.
 * Subsequent logins (same or different users) are no-ops.
 */
function migrateToUser(pfx: string): void {
  if (localStorage.getItem("bp.migrated_to")) return; // already claimed
  let migrated = false;
  for (const k of CABINET_SUBKEYS) {
    const legacy = localStorage.getItem(`bp.${k}`);
    if (legacy && !localStorage.getItem(`${pfx}.${k}`)) {
      localStorage.setItem(`${pfx}.${k}`, legacy);
      migrated = true;
    }
  }
  if (migrated) localStorage.setItem("bp.migrated_to", pfx);
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface CabinetCtx {
  appointments: Appointment[];
  addAppointment:          (a: Omit<Appointment, "id">) => void;
  updateAppointment:       (a: Appointment) => void;
  deleteAppointment:       (id: string) => void;
  deleteAppointmentSeries: (ruleId: string, fromDate: string) => void;

  patients: Patient[];
  addPatient:    (p: Omit<Patient, "id" | "createdAt">) => Patient;
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
  // Exam requests (demandes d'examens)
  examRequests:        ExamRequest[];
  addExamRequest:      (e: Omit<ExamRequest, "id" | "createdAt">) => ExamRequest;
  updateExamRequest:   (e: ExamRequest) => void;
  deleteExamRequest:   (id: string) => void;

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

  // Invoice records
  invoices:      InvoiceRecord[];
  addInvoice:    (inv: Omit<InvoiceRecord, "id">) => void;
  deleteInvoice: (id: string) => void;

  // Appointment document attachments
  apptDocuments:       ApptDocument[];
  addApptDocument:     (doc: Omit<ApptDocument, "id">) => void;
  deleteApptDocument:  (id: string) => void;

  // Secretary mode (local, PIN-protected)
  secretaryMode:    boolean;
  setSecretaryMode: (v: boolean) => void;

  // Backup / restore
  exportCabinetJSON: () => string;
  importCabinetJSON: (json: string) => void;
  clearAppointments: () => void;
  clearPatients:     () => void;

  // Storage health
  lastBackupAt: string | null;

  // Remote sync state
  syncState:  "idle" | "syncing" | "synced" | "error";
  lastSynced: string | null;

  // Role of the current session
  role: "doctor" | "secretary";
  secretaryOwnerName?: string;

  // Automatic backups (doctor only)
  listCabinetBackups: () => Promise<CabinetBackup[]>;
  restoreCabinetBackup: (backupId: string) => Promise<void>;
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

export function CabinetProvider({
  children, userId, secretarySession = null, onSecretaryRevoked,
}: {
  children: ReactNode;
  userId?: string;
  secretarySession?: SecretarySessionRef | null;
  onSecretaryRevoked?: () => void;
}) {
  const isSecretary = !!secretarySession;
  // Namespace: secretary caches under the doctor's id they're linked to.
  const pfx = secretarySession ? `bp.sec.${secretarySession.ownerUserId}`
            : userId           ? `bp.${userId}`
            : "bp";

  // One-time migration: pull legacy non-namespaced data for the first user that logs in.
  if (userId && !secretarySession) migrateToUser(pfx);

  const [appointments,   setAppts]    = useState<Appointment[]>(() => load(`${pfx}.appts`, []));
  const [patients,       setPatients] = useState<Patient[]>(() => load(`${pfx}.patients`, []));
  const [employees,      setEmployees] = useState<Employee[]>(() => load(`${pfx}.employees`, []));
  const [doctorProfile,  setDoctorProfileState] = useState<CabinetDoctorProfile>(
    () => load(`${pfx}.doctor`, BLANK_DOCTOR_PROFILE)
  );
  const [prescriptionTemplates, setTpls] = useState<PrescriptionTemplate[]>(
    () => load(`${pfx}.prescriptionTemplates`, DEFAULT_TEMPLATES)
  );
  const [stockItems, setStock] = useState<StockItem[]>(
    () => load(`${pfx}.stock`, [])
  );
  const [waTemplates, setWaTpls] = useState<WaTemplate[]>(
    () => load(`${pfx}.waTemplates`, DEFAULT_WA_TEMPLATES)
  );
  const [teleSessions, setTele] = useState<TeleSession[]>(
    () => load(`${pfx}.teleSessions`, [])
  );
  const [notes, setNotes] = useState<InternalNote[]>(
    () => load(`${pfx}.notes`, [])
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(
    () => load(`${pfx}.suppliers`, [])
  );
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(
    () => load(`${pfx}.purchaseOrders`, [])
  );
  const [examResults, setExamResults] = useState<ExamResult[]>(
    () => load(`${pfx}.examResults`, [])
  );
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(
    () => load(`${pfx}.prescriptions`, [])
  );
  const [examRequests, setExamRequests] = useState<ExamRequest[]>(
    () => load(`${pfx}.examRequests`, [])
  );
  const [certificates, setCertificates] = useState<Certificate[]>(
    () => load(`${pfx}.certificates`, [])
  );
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(
    () => load(`${pfx}.invoices`, [])
  );
  // Attachments live in IndexedDB (big quota), not localStorage (~10 MB cap).
  // State starts empty and is hydrated asynchronously from IDB just below.
  const [apptDocuments, setApptDocuments] = useState<ApptDocument[]>([]);
  const apptDocsLoaded    = useRef(false); // IDB hydration finished (gates persist)
  const serverDocsApplied = useRef(false); // a pull already set the authoritative copy
  // Secretary mode — session only (resets on page reload for security)
  const [secretaryMode, setSecretaryMode] = useState(false);

  // Keep every LINKED appointment's denormalised patientName in lockstep with
  // its patient record — no matter how the name changed: a rename, a merge, a
  // .json import, a re-link, or a server pull that carried a stale name. This is
  // the safety net behind updatePatient(); it guarantees the agenda, ordonnance
  // and facture never show an out-of-date name for a linked patient. It is a
  // no-op (returns the same array) once everything already matches, so it does
  // not loop despite depending on `appointments`.
  useEffect(() => {
    if (patients.length === 0) return;
    const nameById = new Map(patients.map(p => [p.id, fullName(p)]));
    setAppts(prev => {
      let changed = false;
      const next = prev.map(a => {
        if (!a.patientId) return a;
        const name = nameById.get(a.patientId);
        if (name && name !== a.patientName) {
          changed = true;
          touchedRef.current.appts.add(a.id);
          return { ...a, patientName: name };
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [patients, appointments]);

  // Persist to localStorage on every change (namespaced by user)
  useEffect(() => { save(`${pfx}.appts`,     appointments);  }, [appointments, pfx]);
  useEffect(() => { save(`${pfx}.patients`,  patients);      }, [patients, pfx]);
  useEffect(() => { save(`${pfx}.employees`, employees);     }, [employees, pfx]);
  useEffect(() => { save(`${pfx}.doctor`,    doctorProfile); }, [doctorProfile, pfx]);
  useEffect(() => { save(`${pfx}.prescriptionTemplates`, prescriptionTemplates); }, [prescriptionTemplates, pfx]);
  useEffect(() => { save(`${pfx}.stock`,       stockItems);    }, [stockItems, pfx]);
  useEffect(() => { save(`${pfx}.waTemplates`,  waTemplates);   }, [waTemplates, pfx]);
  useEffect(() => { save(`${pfx}.teleSessions`, teleSessions);  }, [teleSessions, pfx]);
  useEffect(() => { save(`${pfx}.notes`,          notes);          }, [notes, pfx]);
  useEffect(() => { save(`${pfx}.suppliers`,      suppliers);      }, [suppliers, pfx]);
  useEffect(() => { save(`${pfx}.purchaseOrders`, purchaseOrders); }, [purchaseOrders, pfx]);
  useEffect(() => { save(`${pfx}.examResults`,    examResults);    }, [examResults, pfx]);
  useEffect(() => { save(`${pfx}.prescriptions`,  prescriptions);  }, [prescriptions, pfx]);
  useEffect(() => { save(`${pfx}.examRequests`,   examRequests);   }, [examRequests, pfx]);
  useEffect(() => { save(`${pfx}.certificates`,   certificates);   }, [certificates, pfx]);
  useEffect(() => { save(`${pfx}.invoices`,       invoices);       }, [invoices, pfx]);

  // Attachments: hydrate from IndexedDB, migrating any legacy localStorage copy
  // once. Runs before the server pull; a completed pull (serverDocsApplied) wins
  // so this cache never clobbers fresh server data.
  useEffect(() => {
    apptDocsLoaded.current = false;
    serverDocsApplied.current = false;
    let cancelled = false;
    const key = `${pfx}.apptDocs`;
    (async () => {
      let docs = await idbGet<ApptDocument[]>(key);
      if (!docs) {
        const legacy = load<ApptDocument[]>(key, []); // one-time move off localStorage
        if (Array.isArray(legacy) && legacy.length) { docs = legacy; await idbSet(key, legacy); }
      }
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      if (!cancelled && !serverDocsApplied.current) {
        const loaded = (docs as ApptDocument[]) ?? [];
        const loadedIds = new Set(loaded.map(d => d.id));
        // If the user attached a file before this async load resolved, keep it
        // (it's marked touched) instead of letting the cache overwrite it.
        setApptDocuments(prev => {
          if (prev.length === 0) return loaded;
          const extras = prev.filter(d => touchedRef.current.apptDocs.has(d.id) && !loadedIds.has(d.id));
          return extras.length ? [...loaded, ...extras] : loaded;
        });
      }
      apptDocsLoaded.current = true;
    })();
    return () => { cancelled = true; };
  }, [pfx]);

  // Persist attachments to IndexedDB (not localStorage — they are the space hog).
  // Gated on hydration so the initial empty state can't overwrite the cache.
  useEffect(() => {
    if (!apptDocsLoaded.current) return;
    void idbSet(`${pfx}.apptDocs`, apptDocuments);
  }, [apptDocuments, pfx]);

  const setDoctorProfile = useCallback(
    (p: CabinetDoctorProfile) => setDoctorProfileState(p), []);

  // ── Appointments ──────────────────────────────────────────────────────────
  const addAppointment = useCallback(
    (a: Omit<Appointment, "id">) => {
      const id = uid();
      touchedRef.current.appts.add(id);
      setAppts(p => [...p, { ...a, id }]);
    }, []);
  const updateAppointment = useCallback(
    (a: Appointment) => {
      touchedRef.current.appts.add(a.id);
      setAppts(p => p.map(x => x.id === a.id ? a : x));
    }, []);
  const deleteAppointment = useCallback(
    (id: string) => {
      tombstonesRef.current.appts.add(id);
      setAppts(p => p.filter(x => x.id !== id));
    }, []);
  /** Delete all appointments in the same recurring series from `fromDate` onwards (inclusive). */
  const deleteAppointmentSeries = useCallback(
    (ruleId: string, fromDate: string) =>
      setAppts(p => p.filter(x => {
        const gone = x.recurringRuleId === ruleId && x.date >= fromDate;
        if (gone) tombstonesRef.current.appts.add(x.id);
        return !gone;
      })),
    []);

  // ── Patients ──────────────────────────────────────────────────────────────
  const addPatient = useCallback(
    (p: Omit<Patient, "id" | "createdAt">) => {
      const created: Patient = { ...p, id: uid(), createdAt: new Date().toISOString() };
      touchedRef.current.patients.add(created.id);
      setPatients(prev => [...prev, created]);
      return created;
    }, []);
  const updatePatient = useCallback(
    (p: Patient) => {
      touchedRef.current.patients.add(p.id);
      setPatients(prev => prev.map(x => x.id === p.id ? p : x));
      // Appointments store a denormalised patientName (used by the agenda,
      // ordonnance and facture). Keep it in sync when the patient is renamed so
      // the new name shows everywhere immediately, not just on the patient page.
      const fullNameStr = fullName(p);
      setAppts(prev => {
        let changed = false;
        const next = prev.map(a => {
          if (a.patientId === p.id && a.patientName !== fullNameStr && fullNameStr) {
            changed = true;
            touchedRef.current.appts.add(a.id);
            return { ...a, patientName: fullNameStr };
          }
          return a;
        });
        return changed ? next : prev;
      });
    }, []);
  const deletePatient = useCallback(
    (id: string) => {
      // Removing a patient also clears their calendar entries so the agenda
      // never shows orphaned appointments pointing at a deleted record.
      tombstonesRef.current.patients.add(id);
      setPatients(prev => prev.filter(x => x.id !== id));
      setAppts(prev => prev.filter(x => {
        const gone = x.patientId === id;
        if (gone) tombstonesRef.current.appts.add(x.id);
        return !gone;
      }));
    }, []);

  // ── Employees ─────────────────────────────────────────────────────────────
  const addEmployee = useCallback(
    (e: Omit<Employee, "id">) => setEmployees(p => [...p, { ...e, id: uid() }]), []);
  const updateEmployee = useCallback(
    (e: Employee) => setEmployees(p => p.map(x => x.id === e.id ? e : x)), []);
  const deleteEmployee = useCallback(
    (id: string) => setEmployees(p => p.filter(x => x.id !== id)), []);

  // ── Storage health ────────────────────────────────────────────────────────
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(
    () => localStorage.getItem(BACKUP_KEY),
  );

  // ── Remote sync (multi-device, optimistic concurrency) ────────────────────
  const [syncState,  setSyncState]  = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: never push to the server until the initial pull has resolved.
  // Otherwise a fresh device's empty state could overwrite the server snapshot.
  const hydrated = useRef(false);
  // The server `updatedAt` our current state is based on (concurrency token).
  const baseUpdatedAt = useRef<string | null>(null);
  // True while applying a server snapshot, so the push effect can tell a
  // remote apply apart from a local user edit and not echo it back.
  const applyingRemote = useRef(false);
  // Consecutive unchanged (304) polls — drives adaptive poll back-off when idle.
  const pollMissRef = useRef(0);
  // True when there are local edits not yet confirmed on the server.
  const dirtyRef = useRef(false);
  // Bumped on every genuine local edit. A push captures it at start; if it has
  // moved by the time the response lands, an edit happened DURING the push, so
  // adopting the server's merged arrays would revert it — we skip instead.
  const editSeqRef = useRef(0);
  // Ids deleted/edited locally since the last successful sync — consumed by the
  // conflict merge so a 409 never resurrects deletions nor drops local edits.
  const tombstonesRef = useRef({ appts: new Set<string>(), patients: new Set<string>(), apptDocs: new Set<string>() });
  const touchedRef    = useRef({ appts: new Set<string>(), patients: new Set<string>(), apptDocs: new Set<string>() });
  const clearMergeMarks = () => {
    tombstonesRef.current.appts.clear();   tombstonesRef.current.patients.clear();
    touchedRef.current.appts.clear();      touchedRef.current.patients.clear();
    tombstonesRef.current.apptDocs.clear(); touchedRef.current.apptDocs.clear();
  };

  // Apply a full snapshot received from the server into local state.
  const applySnapshot = useCallback((snapshot: CabinetSnapshot) => {
    applyingRemote.current = true;
    if (Array.isArray(snapshot.appointments))          setAppts(snapshot.appointments as Appointment[]);
    if (Array.isArray(snapshot.patients))              setPatients(snapshot.patients as Patient[]);
    if (snapshot.doctorProfile && typeof snapshot.doctorProfile === "object")
      setDoctorProfileState(snapshot.doctorProfile as CabinetDoctorProfile);
    if (Array.isArray(snapshot.employees))             setEmployees(snapshot.employees as Employee[]);
    if (Array.isArray(snapshot.prescriptionTemplates)) setTpls(snapshot.prescriptionTemplates as PrescriptionTemplate[]);
    if (Array.isArray(snapshot.prescriptions))         setPrescriptions(snapshot.prescriptions as Prescription[]);
    if (Array.isArray(snapshot.examRequests))          setExamRequests(snapshot.examRequests as ExamRequest[]);
    if (Array.isArray(snapshot.certificates))          setCertificates(snapshot.certificates as Certificate[]);
    if (Array.isArray(snapshot.stockItems))            setStock(snapshot.stockItems as StockItem[]);
    if (Array.isArray(snapshot.waTemplates))           setWaTpls(snapshot.waTemplates as WaTemplate[]);
    if (Array.isArray(snapshot.teleSessions))          setTele(snapshot.teleSessions as TeleSession[]);
    if (Array.isArray(snapshot.notes))                 setNotes(snapshot.notes as InternalNote[]);
    if (Array.isArray(snapshot.suppliers))             setSuppliers(snapshot.suppliers as Supplier[]);
    if (Array.isArray(snapshot.purchaseOrders))        setPurchaseOrders(snapshot.purchaseOrders as PurchaseOrder[]);
    if (Array.isArray(snapshot.examResults))           setExamResults(snapshot.examResults as ExamResult[]);
    if (Array.isArray(snapshot.invoices))              setInvoices(snapshot.invoices as InvoiceRecord[]);
    if (Array.isArray(snapshot.apptDocuments)) {
      // Server copy is authoritative; block the IDB hydration from overwriting it
      // and mark loaded so this fresh copy is written back to IDB.
      serverDocsApplied.current = true;
      apptDocsLoaded.current = true;
      const serverDocs = snapshot.apptDocuments as ApptDocument[];
      const serverIds  = new Set(serverDocs.map(d => d.id));
      // Preserve attachments this device added but hasn't pushed yet (still
      // marked touched). Without this, a boot/refocus pull whose snapshot
      // predates the new file makes it vanish "the first time" it's added.
      const touched = new Set(touchedRef.current.apptDocs);
      setApptDocuments(prev => {
        const extras = prev.filter(d => touched.has(d.id) && !serverIds.has(d.id));
        return extras.length ? [...serverDocs, ...extras] : serverDocs;
      });
    }
    baseUpdatedAt.current = snapshot.updatedAt ?? null;
    clearMergeMarks(); // fresh baseline — nothing local is pending anymore
  }, []);

  // ── Automatic backups (doctor only) ───────────────────────────────────────
  const listCabinetBackups = useCallback(() => listBackups(), []);
  const restoreCabinetBackup = useCallback(async (backupId: string) => {
    const snapshot = await restoreBackup(backupId);
    applySnapshot(snapshot);            // adopt restored data locally
    setLastSynced(new Date().toISOString());
    setSyncState("synced");
  }, [applySnapshot]);

  // Pull the latest snapshot from the server (used on mount and on refocus).
  // Returns true when the server had changes (or on boot), false on a 304 / no
  // session / error — the adaptive poller uses this to back off when idle.
  const pullFromServer = useCallback(async (boot = false): Promise<boolean> => {
    if (secretarySession) {
      if (!getSecretaryToken()) return false;
      setSyncState("syncing");
      try {
        // On boot a cold-start 401 is transient — keep the session so a valid
        // secretary stays logged in across tab reopens. A genuine revoke is
        // honoured on the next live refocus pull (boot=false).
        const snap = await secretaryPull(!boot);
        // Don't clobber an edit the secretary made while this pull was in flight
        // (see the doctor branch below for the full rationale). NOT_MODIFIED =
        // the server's 304, i.e. nothing changed — keep local state as-is.
        if (snap !== NOT_MODIFIED && (boot || !dirtyRef.current)) applySnapshot({
          appointments:  snap.appointments,
          patients:      snap.patients,
          doctorProfile: snap.doctorProfile,
          apptDocuments: snap.apptDocuments,
        } as CabinetSnapshot);
        hydrated.current = true;
        setSyncState("synced");
        setLastSynced(new Date().toISOString());
        return snap !== NOT_MODIFIED;
      } catch (err) {
        if (!boot && (err as Error).message === "SECRETARY_REVOKED") onSecretaryRevoked?.();
        setSyncState("error");
        return false;
      }
    }
    if (!userId || !getToken()) return false;
    setSyncState("syncing");
    try {
      const snapshot = await pullCabinet();
      // The dirty check at the call site only covers edits made BEFORE the pull
      // started. If the user edited WHILE this ~1-2s network round-trip was in
      // flight, their change is newer — applying the snapshot now would revert it
      // ("action cancelled after a second"). Skip: the pending push carries the
      // edit up, and the next idle pull brings server changes down. (Boot always
      // applies — it's the initial hydration and sets baseUpdatedAt.)
      // NOT_MODIFIED = the server's 304, i.e. unchanged — keep local state as-is.
      if (snapshot && snapshot !== NOT_MODIFIED && (boot || !dirtyRef.current)) applySnapshot(snapshot);
      hydrated.current = true;
      setSyncState("synced");
      setLastSynced(new Date().toISOString());
      return snapshot !== NOT_MODIFIED;
    } catch {
      // Leave hydrated=false on the first failure so we never push (and risk
      // clobbering the server) until a successful pull. Local data is saved.
      setSyncState("error");
      return false;
    }
  }, [userId, secretarySession, applySnapshot, onSecretaryRevoked]);

  // Pull on mount (when a session is active)
  useEffect(() => {
    if (!secretarySession && (!userId || !getToken())) { hydrated.current = true; return; }
    pullFromServer(true); // boot: resilient to transient cold-start 401s
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, secretarySession?.ownerUserId]);

  // Refresh when the app/tab regains focus, so a returning device shows the
  // latest data — but only when there are no unsynced local edits to protect.
  useEffect(() => {
    if (!userId && !secretarySession) return;
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      if (!hydrated.current || dirtyRef.current) return;
      pollMissRef.current = 0; // user is back → return to fast polling
      pullFromServer();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [userId, secretarySession, pullFromServer]);

  // Adaptive poll while the tab is visible. Conditional pulls (304) make an
  // unchanged poll almost free on bytes, but each still costs a request +
  // function invocation, so we back off when nothing is happening: 30s while
  // active, stepping to 45/60/90s after consecutive unchanged polls. Any change
  // (or a refocus — see the focus effect) resets to 30s, so co-editing stays
  // near-real-time while an idle tab goes quiet. Skipped when there are unsynced
  // local edits (dirtyRef) so a pull can never clobber work in progress.
  useEffect(() => {
    if (!userId && !secretarySession) return;
    const STEPS = [30000, 45000, 60000, 90000];
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = STEPS[Math.min(pollMissRef.current, STEPS.length - 1)];
      timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (document.visibilityState === "visible" && hydrated.current && !dirtyRef.current) {
        const changed = await pullFromServer();
        pollMissRef.current = changed ? 0 : pollMissRef.current + 1;
      }
      schedule();
    };
    schedule();
    return () => clearTimeout(timer);
  }, [userId, secretarySession, pullFromServer]);

  // Debounced push — fires 3s after the last mutation while a session is active
  useEffect(() => {
    if (!secretarySession && (!userId || !getToken())) return;
    if (!hydrated.current) return;        // wait for initial pull before pushing
    if (applyingRemote.current) {         // this change came from the server, not the user
      applyingRemote.current = false;
      return;
    }
    dirtyRef.current = true;
    editSeqRef.current++;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      setSyncState("syncing");
      const seqAtPush = editSeqRef.current;

      // ── Secretary: push only the appointments + patients slices ──
      if (secretarySession) {
        Promise.all([
          // The server merge never drops records on its own; explicit local
          // deletions travel as an id list so they actually stick.
          secretaryPushAppointments(appointments, [...tombstonesRef.current.appts]),
          secretaryPushPatients(patients, [...tombstonesRef.current.patients]),
          secretaryPushApptDocuments(apptDocuments, [...tombstonesRef.current.apptDocs]),
        ])
          .then(([mergedAppts, mergedPatients, mergedDocs]) => {
            // If the secretary edited WHILE this push was in flight, the merged
            // arrays predate that edit — adopting them would revert it. Skip; the
            // edit's own pending push adopts a fresh merge. (Same race the pull
            // guard fixes, on the push side.)
            if (editSeqRef.current !== seqAtPush) {
              setSyncState("synced");
              setLastSynced(new Date().toISOString());
              return;
            }
            // Adopt the server's merged arrays (clinical fields preserved).
            applyingRemote.current = true;
            if (Array.isArray(mergedAppts))    setAppts(mergedAppts as Appointment[]);
            if (Array.isArray(mergedPatients)) setPatients(mergedPatients as Patient[]);
            if (Array.isArray(mergedDocs))     setApptDocuments(mergedDocs as ApptDocument[]);
            dirtyRef.current = false;
            clearMergeMarks();
            setSyncState("synced");
            setLastSynced(new Date().toISOString());
          })
          .catch((err) => {
            if ((err as Error).message === "SECRETARY_REVOKED") onSecretaryRevoked?.();
            setSyncState("error");
          });
        return;
      }

      // ── Doctor: full snapshot with optimistic concurrency ──
      pushCabinet({
        appointments, patients, doctorProfile,
        employees, prescriptionTemplates, prescriptions, examRequests, certificates,
        stockItems, waTemplates, teleSessions, notes, suppliers,
        purchaseOrders, examResults, invoices, apptDocuments,
      }, baseUpdatedAt.current)
        .then((newUpdatedAt) => {
          if (newUpdatedAt) baseUpdatedAt.current = newUpdatedAt;
          // Only declare the tree clean if nothing was edited during the push.
          // Otherwise keep dirtyRef true so pulls stay blocked and the pending
          // edit's push still fires — the just-pushed edit can't be clobbered.
          if (editSeqRef.current === seqAtPush) {
            dirtyRef.current = false;
            clearMergeMarks();
          }
          setSyncState("synced");
          setLastSynced(new Date().toISOString());
        })
        .catch((err) => {
          if (err instanceof CabinetConflictError) {
            // Another device wrote newer data since we last pulled. Merge per
            // record (local edits/creations win, local deletions stick, the
            // other device's records are adopted) instead of clobbering local
            // state — then re-push on the fresh base token. Collections other
            // than appointments/patients are doctor-only, so local wins there.
            const snap = err.snapshot;
            baseUpdatedAt.current = snap.updatedAt ?? null;
            setAppts(local => mergeConflict(
              (snap.appointments ?? []) as Appointment[], local,
              tombstonesRef.current.appts, touchedRef.current.appts));
            setPatients(local => mergeConflict(
              (snap.patients ?? []) as Patient[], local,
              tombstonesRef.current.patients, touchedRef.current.patients));
            // Attachments can also be added by the secretary between our pulls
            // — merge them too so her scans survive the doctor's next push.
            setApptDocuments(local => mergeConflict(
              (snap.apptDocuments ?? []) as ApptDocument[], local,
              tombstonesRef.current.apptDocs, touchedRef.current.apptDocs));
            // dirty stays true — the state changes above re-arm the debounced
            // push, which now carries the merged data + fresh base token.
            setSyncState("syncing");
          } else {
            setSyncState("error"); // keep dirty; will retry on next change
          }
        });
    }, 3000);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    userId, secretarySession,
    appointments, patients, doctorProfile,
    employees, prescriptionTemplates, prescriptions, examRequests, certificates,
    stockItems, waTemplates, teleSessions, notes, suppliers,
    purchaseOrders, examResults, invoices, apptDocuments,
  ]);

  // ── Backup / restore ─────────────────────────────────────────────────────
  const exportCabinetJSON = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(BACKUP_KEY, now);
    setLastBackupAt(now);
    return JSON.stringify({
      version: 2,
      exportedAt: now,
      // Clinical
      appointments, patients, employees, doctorProfile,
      // Documents
      prescriptions, examRequests, certificates,
      // Exams & tele
      examResults, teleSessions,
      // Messaging
      waTemplates,
      // Notes
      notes,
      // Stock & supply
      stockItems, suppliers, purchaseOrders,
      // Invoice history
      invoices,
    }, null, 2);
  }, [appointments, patients, employees, doctorProfile,
     prescriptions, examRequests, certificates, examResults, teleSessions,
     waTemplates, notes, stockItems, suppliers, purchaseOrders, invoices]);

  const importCabinetJSON = useCallback((json: string) => {
    try {
      const d = JSON.parse(json) as Record<string, unknown>;
      // Core clinical
      if (Array.isArray(d.appointments)) setAppts(d.appointments as Appointment[]);
      if (Array.isArray(d.patients))     setPatients(d.patients as Patient[]);
      if (Array.isArray(d.employees))    setEmployees(d.employees as Employee[]);
      if (d.doctorProfile && typeof d.doctorProfile === "object") setDoctorProfileState(d.doctorProfile as CabinetDoctorProfile);
      // Documents
      if (Array.isArray(d.prescriptions))  setPrescriptions(d.prescriptions as Prescription[]);
      if (Array.isArray(d.examRequests))   setExamRequests(d.examRequests as ExamRequest[]);
      if (Array.isArray(d.certificates))   setCertificates(d.certificates as Certificate[]);
      // Exams & tele
      if (Array.isArray(d.examResults))    setExamResults(d.examResults as ExamResult[]);
      if (Array.isArray(d.teleSessions))   setTele(d.teleSessions as TeleSession[]);
      // Messaging
      if (Array.isArray(d.waTemplates))    setWaTpls(d.waTemplates as WaTemplate[]);
      // Notes
      if (Array.isArray(d.notes))          setNotes(d.notes as InternalNote[]);
      // Stock & supply
      if (Array.isArray(d.stockItems))     setStock(d.stockItems as StockItem[]);
      if (Array.isArray(d.suppliers))      setSuppliers(d.suppliers as Supplier[]);
      if (Array.isArray(d.purchaseOrders)) setPurchaseOrders(d.purchaseOrders as PurchaseOrder[]);
      if (Array.isArray(d.invoices))       setInvoices(d.invoices as InvoiceRecord[]);
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

  // ── Exam requests (demandes d'examens) ────────────────────────────────────
  const addExamRequest = useCallback(
    (e: Omit<ExamRequest, "id" | "createdAt">) => {
      const created: ExamRequest = { ...e, id: uid(), createdAt: new Date().toISOString() };
      setExamRequests(prev => [...prev, created]);
      return created;
    }, []);
  const updateExamRequest = useCallback(
    (e: ExamRequest) => setExamRequests(prev => prev.map(x => x.id === e.id ? e : x)), []);
  const deleteExamRequest = useCallback(
    (id: string) => setExamRequests(prev => prev.filter(x => x.id !== id)), []);

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

  // ── Invoice records ───────────────────────────────────────────────────────
  const addInvoice = useCallback(
    (inv: Omit<InvoiceRecord, "id">) =>
      setInvoices(prev => [...prev, { ...inv, id: uid() }]), []);
  const deleteInvoice = useCallback(
    (id: string) => setInvoices(prev => prev.filter(x => x.id !== id)), []);

  // ── Appointment document attachments ──────────────────────────────────────
  const addApptDocument = useCallback(
    (doc: Omit<ApptDocument, "id">) => {
      const id = uid();
      touchedRef.current.apptDocs.add(id);
      setApptDocuments(prev => [...prev, { ...doc, id }]);
    }, []);
  const deleteApptDocument = useCallback(
    (id: string) => {
      tombstonesRef.current.apptDocs.add(id);
      setApptDocuments(prev => prev.filter(x => x.id !== id));
    }, []);

  const value: CabinetCtx = {
    appointments, addAppointment, updateAppointment, deleteAppointment, deleteAppointmentSeries,
    patients,     addPatient,     updatePatient,     deletePatient,
    employees,    addEmployee,    updateEmployee,    deleteEmployee,
    doctorProfile, setDoctorProfile,
    prescriptionTemplates, addPrescriptionTemplate, updatePrescriptionTemplate, deletePrescriptionTemplate,
    prescriptions, addPrescription, updatePrescription, deletePrescription,
    examRequests, addExamRequest, updateExamRequest, deleteExamRequest,
    certificates, addCertificate, updateCertificate, deleteCertificate,
    stockItems, addStockItem, updateStockItem, deleteStockItem, adjustStock,
    waTemplates, addWaTemplate, updateWaTemplate, deleteWaTemplate,
    teleSessions, addTeleSession, updateTeleSession, deleteTeleSession,
    notes, addNote, updateNote, deleteNote, toggleNotePin, toggleNoteDone,
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receiveOrder,
    examResults, addExamResult, updateExamResult, deleteExamResult,
    invoices, addInvoice, deleteInvoice,
    apptDocuments, addApptDocument, deleteApptDocument,
    secretaryMode, setSecretaryMode,
    exportCabinetJSON, importCabinetJSON, clearAppointments, clearPatients,
    lastBackupAt,
    syncState, lastSynced,
    role: isSecretary ? "secretary" : "doctor",
    secretaryOwnerName: secretarySession?.ownerName,
    listCabinetBackups, restoreCabinetBackup,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCabinet(): CabinetCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCabinet must be inside CabinetProvider");
  return ctx;
}
