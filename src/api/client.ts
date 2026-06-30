/// <reference types="vite/client" />
import type { DoctorProfile, Transaction, FixedAsset } from "../engine";
import type { RecurringRule } from "../lib/recurringTransactions";

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://blackpine-backend.vercel.app";

const TOKEN_KEY      = "bp.token";
const USER_KEY       = "bp.user";
const SEC_TOKEN_KEY  = "bp.sec.token";
const SEC_OWNER_KEY  = "bp.sec.owner";
const TIMEOUT_MS = 15_000;

// ── Token helpers ──────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Secretary token helpers ──────────────────────────────────────────────────

export interface SecretaryOwner {
  ownerUserId: string;
  ownerName:   string;
  inviteCode:  string;   // legacy code logins; for account logins this is "@username"
  linkedAt:    string;
  username?:   string;   // present for persistent account-based logins
  name?:       string;   // secretary's display name
}

export function getSecretaryToken(): string | null {
  return localStorage.getItem(SEC_TOKEN_KEY);
}
export function getSecretaryOwner(): SecretaryOwner | null {
  const raw = localStorage.getItem(SEC_OWNER_KEY);
  return raw ? (JSON.parse(raw) as SecretaryOwner) : null;
}
function setSecretarySession(token: string, owner: SecretaryOwner) {
  localStorage.setItem(SEC_TOKEN_KEY, token);
  localStorage.setItem(SEC_OWNER_KEY, JSON.stringify(owner));
}
export function clearSecretarySession() {
  localStorage.removeItem(SEC_TOKEN_KEY);
  localStorage.removeItem(SEC_OWNER_KEY);
}

// ── Fetch wrapper (with transient-failure retry) ─────────────────────────────
//
// The backend is serverless: the first request after idle pays a cold start
// (lambda boot + DB schema init), so it can time out or 5xx where a retry to a
// now-warm instance succeeds. We retry transient failures automatically so the
// user never has to "click twice". We retry on: request timeout, network error,
// and gateway statuses (502/503/504) — never on 4xx (real errors like a wrong
// password) so genuine failures still surface immediately.

const MAX_RETRIES = 2;
// 500 included: a Vercel cold start that errors during DB init returns 500
// (FUNCTION_INVOCATION_FAILED); the retry hits a now-warm instance. All our
// endpoints are idempotent (credential checks + snapshot-replace sync), so
// retrying is safe.
const RETRY_STATUS = new Set([500, 502, 503, 504]);

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const backoffMs = (attempt: number) => 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);

async function fetchOnce(url: string, opts: RequestInit, headers: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

async function fetchWithRetry(url: string, opts: RequestInit, headers: Record<string, string>): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchOnce(url, opts, headers);
      if (RETRY_STATUS.has(res.status) && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return res;
    } catch (err) {
      // AbortError (timeout) or TypeError (network/"failed to fetch") → retry
      lastErr = err;
      if (attempt < MAX_RETRIES) { await sleep(backoffMs(attempt)); continue; }
      throw err;
    }
  }
  throw lastErr;
}

async function request(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetchWithRetry(`${API_BASE}${path}`, opts, headers);
}

/** Fetch wrapper that authenticates with the secretary token instead. */
async function secretaryRequest(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getSecretaryToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetchWithRetry(`${API_BASE}${path}`, opts, headers);
}

// ── Auth types ─────────────────────────────────────────────────────────────

export interface AuthUser { id: string; email: string; }

// ── Auth ───────────────────────────────────────────────────────────────────

export async function signup(email: string, password: string): Promise<AuthUser> {
  const res  = await request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Inscription échouée");
  setToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser & { trialStart?: string }> {
  const res  = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Connexion échouée");
  setToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return { ...data.user, trialStart: data.user?.trialStart };
}

export function logout(): void {
  clearToken();
}

// Permanently delete the signed-in doctor's own account + all associated data.
// Requires re-typing the account email as confirmation. Clears the local session
// on success. Irreversible.
export async function deleteMyAccount(confirmEmail: string): Promise<void> {
  const res = await request("/account", {
    method: "DELETE",
    body: JSON.stringify({ confirmEmail }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any).error || "Échec de la suppression");
  }
  clearToken();
}

// Best-effort pre-warm of the serverless backend so the user's first real
// request (login) hits an already-booted function with the DB initialised.
// Fire-and-forget; safe to call repeatedly. Pings /health (which also triggers
// the shared DB-init), retrying a few times to ride out a cold-start error.
export async function warmup(): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res  = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) return;            // warm and ready
    } catch { /* cold start / network — retry */ }
    await sleep(500 * (attempt + 1));
  }
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Sync ───────────────────────────────────────────────────────────────────

export interface SyncData {
  profile: DoctorProfile | null;
  transactions: Transaction[];
  assets: FixedAsset[];
  recurringRules: RecurringRule[];
  serverSubscription: {
    trialStart: string | null;
    plan: string;
    expiresAt: string | null;
  } | null;
}

export async function pullData(clearOn401 = true): Promise<SyncData> {
  const res = await request("/sync/pull");
  if (!res.ok) {
    // On a 365-day token a boot-time 401 is almost always a transient cold-start
    // hiccup, not a real expiry — clearing the token would log out a valid user
    // on every tab reopen. Callers that boot the session pass clearOn401=false.
    if (res.status === 401) { if (clearOn401) clearToken(); throw new Error("TOKEN_EXPIRED"); }
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any).error || "Sync failed");
  }
  const data = await res.json();
  return {
    profile:            data.profile        || null,
    transactions:       data.transactions   || [],
    assets:             data.assets         || [],
    recurringRules:     data.recurringRules || [],
    serverSubscription: data.subscription   ?? null,
  };
}

export async function pushData(
  profile: DoctorProfile,
  transactions: Transaction[],
  assets: FixedAsset[],
  recurringRules: RecurringRule[],
): Promise<void> {
  const res = await request("/sync/push", {
    method: "POST",
    body: JSON.stringify({ profile, transactions, assets, recurringRules }),
  });
  if (!res.ok) {
    if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
    const d = await res.json().catch(() => ({}));
    const err: any = new Error((d as any).error || "Sync failed");
    if (res.status === 403 && (d as any).error === "subscription_expired") {
      err.code = "subscription_expired";
    }
    throw err;
  }
}

// ── Cabinet sync ───────────────────────────────────────────────────────────────

export interface CabinetSnapshot {
  appointments:           unknown[];
  patients:               unknown[];
  doctorProfile:          unknown;
  employees?:             unknown[];
  prescriptionTemplates?: unknown[];
  prescriptions?:         unknown[];
  examRequests?:          unknown[];
  certificates?:          unknown[];
  stockItems?:            unknown[];
  waTemplates?:           unknown[];
  teleSessions?:          unknown[];
  notes?:                 unknown[];
  suppliers?:             unknown[];
  purchaseOrders?:        unknown[];
  examResults?:           unknown[];
  invoices?:              unknown[];
  apptDocuments?:         unknown[];
  updatedAt?:             string;
}

export async function pullCabinet(): Promise<CabinetSnapshot | null> {
  const res = await request("/cabinet/my");
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any).error || "Cabinet pull failed");
  }
  return res.json();
}

/** Thrown when the server has newer data than the version we based our push on. */
export class CabinetConflictError extends Error {
  snapshot: CabinetSnapshot;
  constructor(snapshot: CabinetSnapshot) {
    super("CABINET_CONFLICT");
    this.name = "CabinetConflictError";
    this.snapshot = snapshot;
  }
}

/** Returns the new server `updatedAt` token to carry into the next push. */
export async function pushCabinet(
  snapshot: Omit<CabinetSnapshot, "updatedAt">,
  baseUpdatedAt?: string | null,
): Promise<string | undefined> {
  const res = await request("/cabinet/push", {
    method: "POST",
    body: JSON.stringify({ ...snapshot, baseUpdatedAt: baseUpdatedAt ?? null }),
  });
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  if (res.status === 409) {
    const d = await res.json().catch(() => ({}));
    throw new CabinetConflictError((d as any).snapshot as CabinetSnapshot);
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any).error || "Cabinet push failed");
  }
  const data = await res.json().catch(() => ({}));
  return (data as any).updatedAt as string | undefined;
}

// ── Automatic backups (doctor side) ──────────────────────────────────────────

export interface CabinetBackup {
  id:        string;
  createdAt: string;
  reason:    string;
}

export async function listBackups(): Promise<CabinetBackup[]> {
  const res = await request("/cabinet/backups");
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Backups list failed");
  return ((data as any).backups ?? []) as CabinetBackup[];
}

/** Restore a backup; returns the restored snapshot to adopt into local state. */
export async function restoreBackup(backupId: string): Promise<CabinetSnapshot> {
  const res = await request("/cabinet/restore", {
    method: "POST",
    body: JSON.stringify({ backupId }),
  });
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Restore failed");
  return (data as any).snapshot as CabinetSnapshot;
}

// ── Medication search (official DMP/CNOPS reference) ─────────────────────────

export interface MedicationHit {
  code:              string;
  nom:               string;
  dci:               string;
  dosage:            string;
  unite:             string;
  forme:             string;
  presentation:      string;
  ppv:               number | null;
  ph:                number | null;
  prixBR:            number | null;
  type:              string;  // "P" | "G"
  tauxRemboursement: string;
}

export async function searchMedications(q: string, signal?: AbortSignal): Promise<MedicationHit[]> {
  const token = getToken();
  if (!token || q.trim().length < 2) return [];
  const res = await fetch(`${API_BASE}/medications/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return ((data as any).medications ?? []) as MedicationHit[];
}

// ── Secretary invites (doctor side) ──────────────────────────────────────────

export interface InviteCode { code: string; expiresAt: string; }

export async function inviteCreate(): Promise<InviteCode> {
  const res = await request("/invite/create", { method: "POST" });
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Invite create failed");
  return data as InviteCode;
}

export async function inviteRevoke(): Promise<void> {
  const res = await request("/invite/revoke", { method: "DELETE" });
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any).error || "Invite revoke failed");
  }
}

// ── Secretary login + restricted sync (secretary side) ────────────────────────

/** Redeem an invite code; on success the secretary session is persisted. */
export async function inviteRedeem(code: string): Promise<SecretaryOwner> {
  const res = await fetch(`${API_BASE}/invite/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Code invalide ou expiré");
  const owner: SecretaryOwner = {
    ownerUserId: (data as any).ownerUserId,
    ownerName:   (data as any).ownerName,
    inviteCode:  (data as any).inviteCode,
    linkedAt:    (data as any).linkedAt,
  };
  setSecretarySession((data as any).secretaryToken as string, owner);
  return owner;
}

/** Secretary logs in with a persistent username + password account. */
export async function secretaryLogin(username: string, password: string): Promise<SecretaryOwner> {
  const res = await fetch(`${API_BASE}/secretary-accounts/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Identifiants invalides");
  const owner: SecretaryOwner = {
    ownerUserId: (data as any).ownerUserId,
    ownerName:   (data as any).ownerName,
    inviteCode:  `@${(data as any).username}`,
    linkedAt:    (data as any).linkedAt,
    username:    (data as any).username,
    name:        (data as any).name ?? undefined,
  };
  setSecretarySession((data as any).secretaryToken as string, owner);
  return owner;
}

// ── Secretary accounts (doctor side) ──────────────────────────────────────────

export interface SecretaryAccount {
  id: string; username: string; name: string | null; createdAt: string; revoked: boolean;
}

export async function secretaryAccountCreate(input: { username: string; password: string; name?: string }): Promise<SecretaryAccount> {
  const res = await request("/secretary-accounts", { method: "POST", body: JSON.stringify(input) });
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Création du compte échouée");
  return data as SecretaryAccount;
}

export async function secretaryAccountList(): Promise<SecretaryAccount[]> {
  const res = await request("/secretary-accounts");
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Chargement échoué");
  return ((data as any).accounts ?? []) as SecretaryAccount[];
}

export async function secretaryAccountRevoke(id: string): Promise<void> {
  const res = await request(`/secretary-accounts/${id}`, { method: "DELETE" });
  if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as any).error || "Révocation échouée");
  }
}

// ── Online booking ─────────────────────────────────────────────────────────
export interface BookingConfig {
  slug:        string | null;
  enabled?:    boolean;
  doctorName?: string;
  specialty?:  string;
  startMin?:   number;
  endMin?:     number;
  slotMin?:    number;
  days?:       string;   // CSV of weekday numbers, 0=Sun..6=Sat
}

export async function bookingGetMe(): Promise<BookingConfig> {
  const res = await request("/booking/me");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

export async function bookingSave(cfg: Partial<BookingConfig>): Promise<BookingConfig> {
  const res = await request("/booking/me", { method: "POST", body: JSON.stringify(cfg) });
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

// Public (unauthenticated) — used by the patient-facing /book/:slug page.
export interface BookingPublicInfo { doctorName: string; specialty: string; slotMin: number; days: string; maxDaysAhead: number; }

export async function bookingPublicInfo(slug: string): Promise<BookingPublicInfo> {
  const res = await fetch(`${API_BASE}/booking/${slug}`);
  if (!res.ok) throw new Error("UNAVAILABLE");
  return res.json();
}

export async function bookingPublicSlots(slug: string, date: string): Promise<{ date: string; slots: string[] }> {
  const res = await fetch(`${API_BASE}/booking/${encodeURIComponent(slug)}/slots?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

export async function bookingPublicCreate(
  slug: string,
  payload: { date: string; time: string; name: string; phone: string; reason?: string },
): Promise<{ success: boolean; date: string; time: string; doctorName: string }> {
  const res = await fetch(`${API_BASE}/booking/${encodeURIComponent(slug)}/book`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Erreur");
  return data;
}

// ── SMS reminders ──────────────────────────────────────────────────────────
export interface SmsConfig {
  enabled:          boolean;
  leadDays:         number;
  template:         string;
  defaultTemplate?: string;
  serverConfigured?: boolean;   // true when the server has provider credentials
  provider?:        string | null;
}

export async function smsGetConfig(): Promise<SmsConfig> {
  const res = await request("/sms/config");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

export async function smsSaveConfig(cfg: { enabled: boolean; leadDays: number; template: string }): Promise<SmsConfig> {
  const res = await request("/sms/config", { method: "POST", body: JSON.stringify(cfg) });
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

// ── Admin usage analytics (owner only) ───────────────────────────────────────
export interface AdminStats {
  generatedAt: string;
  doctors:  { total: number; newToday: number; new7: number; new30: number };
  active:   { dau: number; wau: number; mau: number };
  signupsByDay: { date: string; count: number }[];
  subscriptions: Record<string, number>;
  trialsExpiring7: number;
  features: {
    bookingEnabled: number; smsEnabled: number; smsSent30: number;
    pushDoctors: number; pushDevices: number;
    secretaryDoctors: number; secretaryAccounts: number;
  };
  volumes: { snapshots: number; totalAppointments: number; totalPatients: number; onlineBookings: number };
}

export async function adminGetStats(): Promise<AdminStats> {
  const res = await request("/admin/stats");
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

export interface AdminEvents {
  days: number; totalEvents: number; activeUsers: number;
  topEvents: { name: string; count: number }[];
  topPages: { name: string; count: number }[];
  topActions: { name: string; count: number }[];
  byDay: { date: string; count: number }[];
  byPlatform?: { platform: string; count: number; users: number }[];
}
export async function adminGetEvents(days = 30): Promise<AdminEvents> {
  const res = await request(`/admin/events?days=${days}`);
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

export interface AdminRetention {
  generatedAt: string;
  segments: { total: number; active7: number; sleeping: number; inactive: number; never: number };
  newVsReturning: { returning: number; new: number };
  stickiness: { dau: number; mau: number; ratio: number };
  cohorts: { label: string; size: number; retained: number; rate: number }[];
}
export async function adminGetRetention(): Promise<AdminRetention> {
  const res = await request(`/admin/retention`);
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

export interface AdminDoctor {
  id: string; email: string; createdAt: string;
  plan: string; expiresAt: string | null; lastActive: string | null;
  specialty: string; commune: string;
  apptCount: number; patientCount: number; onlineBookings: number;
  eventCount: number; lastEvent: string | null;
  secretaryCount: number; pushDevices: number;
}
export interface AdminDoctorDetail {
  doctor: AdminDoctor;
  features: { bookingEnabled: boolean; smsEnabled: boolean };
  byPlatform: { platform: string; count: number }[];
  topPages: { name: string; count: number }[];
  topActions: { name: string; count: number }[];
  byDay: { date: string; count: number }[];
}
export async function adminGetDoctors(): Promise<{ generatedAt: string; count: number; doctors: AdminDoctor[] }> {
  const res = await request(`/admin/doctors`);
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}
export async function adminGetDoctor(id: string): Promise<AdminDoctorDetail> {
  const res = await request(`/admin/doctors/${encodeURIComponent(id)}`);
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error("Erreur");
  return res.json();
}

async function adminWrite(path: string, method: string, body?: unknown): Promise<void> {
  const res = await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error((data as { error?: string }).error || `Erreur (${res.status})`);
}
export const adminSetPlan = (id: string, plan: string, expiresAt: string | null) =>
  adminWrite(`/admin/doctors/${encodeURIComponent(id)}/plan`, "POST", { plan, expiresAt });
export const adminResetTrial = (id: string) =>
  adminWrite(`/admin/doctors/${encodeURIComponent(id)}/trial`, "POST");
export const adminExpireAccount = (id: string) =>
  adminWrite(`/admin/doctors/${encodeURIComponent(id)}/expire`, "POST");
export const adminDeleteAccount = (id: string, confirmEmail: string) =>
  adminWrite(`/admin/doctors/${encodeURIComponent(id)}`, "DELETE", { confirmEmail });

/** Best-effort: log behavioural event names (no PII). Never throws. */
export async function postEvents(names: string[]): Promise<void> {
  if (names.length === 0) return;
  try {
    await request("/events", { method: "POST", body: JSON.stringify({ events: names.map(name => ({ name })), platform: "web" }) });
  } catch { /* analytics is best-effort */ }
}

export interface SecretaryCabinet {
  appointments:  unknown[];
  patients:      unknown[];
  doctorProfile: unknown;
}

export async function secretaryPull(clearOn401 = true): Promise<SecretaryCabinet> {
  const res = await secretaryRequest("/cabinet/pull");
  // Boot passes clearOn401=false so a transient cold-start 401 doesn't end the
  // session on every reopen; a genuine revoke is caught on the next live sync.
  if (res.status === 401) { if (clearOn401) clearSecretarySession(); throw new Error("SECRETARY_REVOKED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Secretary pull failed");
  return {
    appointments:  (data as any).appointments  ?? [],
    patients:      (data as any).patients       ?? [],
    doctorProfile: (data as any).doctorProfile  ?? {},
  };
}

/** Returns the server's merged appointments array (clinical fields preserved). */
export async function secretaryPushAppointments(appointments: unknown[]): Promise<unknown[] | undefined> {
  const res = await secretaryRequest("/cabinet/appointments", {
    method: "POST",
    body: JSON.stringify({ appointments }),
  });
  if (res.status === 401) { clearSecretarySession(); throw new Error("SECRETARY_REVOKED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Secretary appointments push failed");
  return (data as any).appointments as unknown[] | undefined;
}

/** Returns the server's merged patients array (clinical fields preserved). */
export async function secretaryPushPatients(patients: unknown[]): Promise<unknown[] | undefined> {
  const res = await secretaryRequest("/cabinet/patients", {
    method: "POST",
    body: JSON.stringify({ patients }),
  });
  if (res.status === 401) { clearSecretarySession(); throw new Error("SECRETARY_REVOKED"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Secretary patients push failed");
  return (data as any).patients as unknown[] | undefined;
}

// ── Password reset ─────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const res  = await request("/reset/request", { method: "POST", body: JSON.stringify({ email }) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || "Request failed");
}

export async function verifyPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  const res  = await request("/reset/verify", { method: "POST", body: JSON.stringify({ email, code, newPassword }) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || "Vérification échouée");
}
