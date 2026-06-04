import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import type { Appointment, CabinetDoctorProfile, Employee, Patient } from "../lib/cabinetTypes";
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

  // Backup / restore
  exportCabinetJSON: () => string;
  importCabinetJSON: (json: string) => void;
  clearAppointments: () => void;
  clearPatients:     () => void;
}

const Ctx = createContext<CabinetCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CabinetProvider({ children }: { children: ReactNode }) {
  const [appointments,   setAppts]    = useState<Appointment[]>(() => load("bp.appts", []));
  const [patients,       setPatients] = useState<Patient[]>(() => load("bp.patients", []));
  const [employees,      setEmployees] = useState<Employee[]>(() => load("bp.employees", []));
  const [doctorProfile,  setDoctorProfileState] = useState<CabinetDoctorProfile>(
    () => load("bp.doctor", BLANK_DOCTOR_PROFILE)
  );

  // Persist to localStorage on every change
  useEffect(() => { save("bp.appts",     appointments);  }, [appointments]);
  useEffect(() => { save("bp.patients",  patients);      }, [patients]);
  useEffect(() => { save("bp.employees", employees);     }, [employees]);
  useEffect(() => { save("bp.doctor",    doctorProfile); }, [doctorProfile]);

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

  const value: CabinetCtx = {
    appointments, addAppointment, updateAppointment, deleteAppointment,
    patients,     addPatient,     updatePatient,     deletePatient,
    employees,    addEmployee,    updateEmployee,    deleteEmployee,
    doctorProfile, setDoctorProfile,
    exportCabinetJSON, importCabinetJSON, clearAppointments, clearPatients,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCabinet(): CabinetCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCabinet must be inside CabinetProvider");
  return ctx;
}
