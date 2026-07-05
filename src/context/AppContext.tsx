import {
  createContext, useCallback, useContext, useEffect, useMemo,
  useRef, useState, type ReactNode,
} from "react";
import {
  computeTaxFromTransactions, type DoctorProfile,
  type FullTaxComputation, type Transaction, type FixedAsset,
  calculateTotalDotation,
} from "../engine";
import {
  getStoredUser, isLoggedIn, login as apiLogin, logout as apiLogout,
  pullData, pushData, signup as apiSignup, type AuthUser,
  getSecretaryToken, getSecretaryOwner, clearSecretarySession,
  secretaryLogin, warmup, validateActivationCode, type SecretaryOwner,
} from "../api/client";
import { generateRecurringTransactions, type RecurringRule } from "../lib/recurringTransactions";
import { todayIso } from "../lib/format";

// ── Fiscal year bounds (mirrors mobile app) ────────────────────────────────
const FISCAL_MIN = 2015;
const FISCAL_MAX = Math.min(new Date().getFullYear(), 2030);

// ── Default profile used before onboarding ─────────────────────────────────
const DEFAULT_PROFILE: DoctorProfile = {
  id: "web",
  legalForm: "PERSONNE_PHYSIQUE",
  practiceType: "CABINET_ONLY",
  activityStartDate: "2020-01-01",
  commune: "Casablanca",
  communeType: "URBAN",
  maritalStatus: "SINGLE",
  dependentsCount: 0,
  tpRegistered: true,
};

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

// ── Subscription / free trial ──────────────────────────────────────────────
// No-card 30-day trial: signup starts the clock server-side; the app reads the
// status from the sync pull and shows a countdown, then a subscribe gate.
export const TRIAL_DAYS = 30;
export interface ServerSubscription { trialStart: string | null; plan: string; expiresAt: string | null }
export interface TrialStatus {
  plan: string;
  isTrial: boolean;      // on the free trial (whether or not still running)
  active: boolean;       // may use the app right now
  expired: boolean;      // trial or paid plan has run out → show the gate
  daysLeft: number | null; // days remaining (null = lifetime / not yet known)
  known: boolean;        // we've actually received a status from the server
}

/** Derive the trial/subscription state. When the status is unknown (offline,
 *  first boot before the pull lands) we default to ACTIVE — a failed sync must
 *  never lock a doctor out of patient data. */
export function computeTrial(sub: ServerSubscription | null): TrialStatus {
  if (!sub) return { plan: "free_trial", isTrial: true, active: true, expired: false, daysLeft: null, known: false };
  const plan = sub.plan || "free_trial";
  if (plan === "lifetime") return { plan, isTrial: false, active: true, expired: false, daysLeft: null, known: true };
  if (plan !== "free_trial") {
    const exp = sub.expiresAt ? new Date(sub.expiresAt).getTime() : null;
    if (exp && exp > Date.now()) return { plan, isTrial: false, active: true, expired: false, daysLeft: Math.ceil((exp - Date.now()) / 86400000), known: true };
    return { plan, isTrial: false, active: false, expired: true, daysLeft: 0, known: true };
  }
  if (!sub.trialStart) return { plan, isTrial: true, active: true, expired: false, daysLeft: TRIAL_DAYS, known: true };
  const elapsed  = Math.floor((Date.now() - new Date(sub.trialStart).getTime()) / 86400000);
  const daysLeft = Math.max(0, TRIAL_DAYS - elapsed);
  return { plan, isTrial: true, active: daysLeft > 0, expired: daysLeft <= 0, daysLeft, known: true };
}

// ── Context shape ──────────────────────────────────────────────────────────
interface AppCtx {
  // auth
  user: AuthUser | null;
  isAuthenticated: boolean;
  login:  (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, code: string) => Promise<void>;
  logout: () => void;

  // secretary session (restricted, separate-device login via secretary account)
  secretaryOwner: SecretaryOwner | null;
  isSecretary: boolean;
  startSecretaryLogin: (username: string, password: string) => Promise<void>;
  endSecretarySession: () => void;

  // data
  profile: DoctorProfile;
  setProfile: (p: DoctorProfile) => void;
  transactions: Transaction[];
  addTransaction:    (tx: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  assets: FixedAsset[];
  addAsset:    (a: Omit<FixedAsset, "id">) => void;
  updateAsset: (id: string, patch: Partial<FixedAsset>) => void;
  deleteAsset: (id: string) => void;
  recurringRules: RecurringRule[];
  addRecurringRule:    (r: Omit<RecurringRule, "id">) => void;
  deleteRecurringRule: (id: string) => void;

  // computed
  result: FullTaxComputation;
  fiscalYear: number;
  setFiscalYear: (y: number) => void;
  FISCAL_MIN: number;
  FISCAL_MAX: number;

  // subscription / free trial
  trial: TrialStatus;
  applyActivation: (code: string) => Promise<void>;

  // sync
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  retrySync: () => Promise<void>;

  // backup
  exportFinancesJSON: () => string;
  importFinancesJSON: (json: string) => void;
}

const Ctx = createContext<AppCtx | null>(null);
const uid = () => Math.random().toString(36).slice(2, 9);

// ── Provider ───────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  // Restore the session synchronously from localStorage so a fresh page load
  // (new tab / reopened tab) is already authenticated on the very first render —
  // otherwise RequireAuth would bounce to /login before the boot effect runs.
  const [user, setUser]                 = useState<AuthUser | null>(() => (isLoggedIn() ? getStoredUser() : null));
  const [isAuthenticated, setIsAuth]    = useState<boolean>(() => isLoggedIn());
  const [secretaryOwner, setSecretaryOwner] = useState<SecretaryOwner | null>(
    () => (getSecretaryToken() ? getSecretaryOwner() : null),
  );
  const [profile, setProfileState]      = useState<DoctorProfile>(DEFAULT_PROFILE);
  const [transactions, setTx]           = useState<Transaction[]>([]);
  const [assets, setAssets]             = useState<FixedAsset[]>([]);
  const [recurringRules, setRules]      = useState<RecurringRule[]>([]);
  const [syncStatus, setSyncStatus]     = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [fiscalYearRaw, setFiscalYearRaw] = useState(FISCAL_MAX);

  const fiscalYear    = Math.max(FISCAL_MIN, Math.min(FISCAL_MAX, fiscalYearRaw));
  const setFiscalYear = (y: number) => setFiscalYearRaw(Math.max(FISCAL_MIN, Math.min(FISCAL_MAX, y)));

  const [subscription, setSubscription] = useState<ServerSubscription | null>(null);
  const trial = useMemo(() => computeTrial(subscription), [subscription]);

  // ── Boot: restore session ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn()) return;
    const stored = getStoredUser();
    if (stored) { setUser(stored); setIsAuth(true); }
    // pull data on boot — warm the serverless backend first so a cold-start
    // hiccup doesn't surface as a 401, and never clear the token on a boot 401
    // (a valid 365-day session must survive tab reopen).
    setSyncStatus("syncing");
    warmup()
      .then(() => pullData(false))
      .then((d) => {
        if (d.profile)            setProfileState(d.profile);
        if (d.transactions.length) setTx(d.transactions);
        if (d.assets.length)       setAssets(d.assets);
        if (d.recurringRules.length) setRules(d.recurringRules);
        if (d.serverSubscription) setSubscription(d.serverSubscription);
        hydratedRef.current = true;
        setSyncStatus("synced");
        setLastSyncedAt(new Date().toISOString());
      })
      .catch(() => setSyncStatus("error"));
  }, []);

  // ── Auto-sync (debounced, 2 s after last change) ───────────────────────
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef({ profile, transactions, assets, recurringRules });
  useEffect(() => { pendingRef.current = { profile, transactions, assets, recurringRules }; },
    [profile, transactions, assets, recurringRules]);
  // Don't push until the initial pull has succeeded — otherwise an empty
  // mount state could clobber the server snapshot on a slow cold start.
  const hydratedRef = useRef(false);

  const triggerSync = useCallback(() => {
    if (!isAuthenticated) return;
    if (!hydratedRef.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncStatus("syncing");
      const { profile: p, transactions: t, assets: a, recurringRules: r } = pendingRef.current;
      try {
        await pushData(p, t, a, r);
        setSyncStatus("synced");
        setLastSyncedAt(new Date().toISOString());
      } catch (err: any) {
        const msg = String(err?.message ?? "").toLowerCase();
        const offline = msg.includes("failed to fetch") || msg.includes("network") || err?.name === "AbortError";
        setSyncStatus(offline ? "offline" : "error");
      }
    }, 2000);
  }, [isAuthenticated]);

  const retrySync = useCallback(async () => {
    if (!isAuthenticated) return;
    setSyncStatus("syncing");
    const { profile: p, transactions: t, assets: a, recurringRules: r } = pendingRef.current;
    try {
      await pushData(p, t, a, r);
      setSyncStatus("synced");
      setLastSyncedAt(new Date().toISOString());
    } catch {
      setSyncStatus("error");
    }
  }, [isAuthenticated]);

  // ── Trigger sync whenever data changes ────────────────────────────────
  useEffect(() => { triggerSync(); }, [profile, transactions, assets, recurringRules, triggerSync]);

  // ── Auth ───────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, pass: string) => {
    // Auth is the only step that must succeed for login. The initial data
    // pull is best-effort: a cold serverless start can exceed the request
    // timeout, and we must not fail the login (and strand an already-
    // authenticated user on the login screen) just because the pull was slow.
    hydratedRef.current = false;
    clearSecretarySession(); setSecretaryOwner(null);
    const u = await apiLogin(email, pass);
    setUser(u); setIsAuth(true);
    setSyncStatus("syncing");
    try {
      const d = await pullData();
      if (d.profile)             setProfileState(d.profile);
      if (d.transactions.length)  setTx(d.transactions);
      if (d.assets.length)        setAssets(d.assets);
      if (d.recurringRules.length) setRules(d.recurringRules);
      if (d.serverSubscription) setSubscription(d.serverSubscription);
      hydratedRef.current = true;
      setSyncStatus("synced");
      setLastSyncedAt(new Date().toISOString());
    } catch {
      // Already authenticated; data will load on the next sync / reload.
      setSyncStatus("error");
    }
  }, []);

  const signup = useCallback(async (email: string, pass: string, code: string) => {
    clearSecretarySession(); setSecretaryOwner(null);
    const u = await apiSignup(email, pass, code);
    setUser(u); setIsAuth(true);
    // Brand-new account: nothing on the server to clobber, so allow pushes.
    hydratedRef.current = true;
    // Start the 30-day free trial immediately (server set trial_start at signup).
    setSubscription({ trialStart: new Date().toISOString(), plan: "free_trial", expiresAt: null });
    setSyncStatus("synced");
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    hydratedRef.current = false;
    setUser(null); setIsAuth(false);
    setProfileState(DEFAULT_PROFILE);
    setTx([]); setAssets([]); setRules([]);
    setSubscription(null);
    setSyncStatus("idle");
  }, []);

  // ── Subscription: redeem a no-card activation code ─────────────────────────
  const applyActivation = useCallback(async (code: string) => {
    const r = await validateActivationCode(code);
    setSubscription({ trialStart: null, plan: r.plan, expiresAt: r.expiresAt });
  }, []);

  // ── Secretary session ────────────────────────────────────────────────────
  // Persistent account login (username + password) — no expiry, revocable by doctor.
  // A secretary login is mutually exclusive with a doctor login.
  const startSecretaryLogin = useCallback(async (username: string, password: string) => {
    apiLogout();
    setUser(null); setIsAuth(false);
    const owner = await secretaryLogin(username.trim(), password);
    setSecretaryOwner(owner);
  }, []);

  const endSecretarySession = useCallback(() => {
    clearSecretarySession();
    setSecretaryOwner(null);
  }, []);

  // ── Profile ────────────────────────────────────────────────────────────
  const setProfile = useCallback((p: DoctorProfile) => { setProfileState(p); }, []);

  // ── Transactions ───────────────────────────────────────────────────────
  const addTransaction    = useCallback((tx: Omit<Transaction, "id">) => setTx(p => [...p, { ...tx, id: uid() }]), []);
  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) =>
    setTx(p => p.map(t => t.id === id ? { ...t, ...patch } : t)), []);
  const deleteTransaction = useCallback((id: string) => setTx(p => p.filter(t => t.id !== id)), []);

  // ── Assets ─────────────────────────────────────────────────────────────
  const addAsset    = useCallback((a: Omit<FixedAsset, "id">) => setAssets(p => [...p, { ...a, id: uid() }]), []);
  const updateAsset = useCallback((id: string, patch: Partial<FixedAsset>) =>
    setAssets(p => p.map(a => a.id === id ? { ...a, ...patch } : a)), []);
  const deleteAsset = useCallback((id: string) => setAssets(p => p.filter(a => a.id !== id)), []);

  // ── Recurring rules ────────────────────────────────────────────────────
  const addRecurringRule    = useCallback((r: Omit<RecurringRule, "id">) => setRules(p => [...p, { ...r, id: uid() }]), []);
  const deleteRecurringRule = useCallback((id: string) => setRules(p => p.filter(r => r.id !== id)), []);

  // ── Tax computation (same logic as mobile app) ─────────────────────────
  const result = useMemo<FullTaxComputation>(() => {
    const { totalDotation } = calculateTotalDotation(assets, fiscalYear);
    const yearTx = transactions.filter((t) => t.date.startsWith(String(fiscalYear)));
    const recurTx = generateRecurringTransactions(
      recurringRules,
      `${fiscalYear}-01-01`,
      `${fiscalYear}-12-31`,
    );
    const allTx = [
      ...yearTx,
      ...recurTx.map((t) => ({ ...t, id: "rec_" + uid() })),
    ];
    const txWithAmort: Transaction[] = totalDotation > 0
      ? [...allTx, {
          id: "amort_auto", type: "CHARGE" as const, amount: totalDotation,
          date: `${fiscalYear}-12-31`, category: "gros_equipement_medical",
          deductibilityStatus: "FULLY_DEDUCTIBLE" as const, professionalUseRatio: 1,
        }]
      : allTx;

    const safeYear = Math.max(2015, Math.min(fiscalYear, 2030));
    try {
      return computeTaxFromTransactions(profile, txWithAmort, fiscalYear, `${fiscalYear}-12-31`);
    } catch {
      try {
        return computeTaxFromTransactions(profile, [], safeYear, `${safeYear}-12-31`);
      } catch {
        return computeTaxFromTransactions(profile, [], 2030, "2030-12-31");
      }
    }
  }, [profile, transactions, assets, recurringRules, fiscalYear]);

  const exportFinancesJSON = useCallback(() =>
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions, assets, recurringRules, profile,
    }, null, 2),
  [transactions, assets, recurringRules, profile]);

  const importFinancesJSON = useCallback((json: string) => {
    try {
      const d = JSON.parse(json) as Record<string, unknown>;
      if (Array.isArray(d.transactions))    setTx(d.transactions as Transaction[]);
      if (Array.isArray(d.assets))          setAssets(d.assets as FixedAsset[]);
      if (Array.isArray(d.recurringRules))  setRules(d.recurringRules as RecurringRule[]);
      if (d.profile && typeof d.profile === "object") setProfileState(d.profile as DoctorProfile);
    } catch {
      throw new Error("Fichier JSON invalide");
    }
  }, []);

  const value: AppCtx = {
    user, isAuthenticated, login, signup, logout,
    secretaryOwner, isSecretary: !!secretaryOwner, startSecretaryLogin, endSecretarySession,
    profile, setProfile,
    transactions, addTransaction, updateTransaction, deleteTransaction,
    assets, addAsset, updateAsset, deleteAsset,
    recurringRules, addRecurringRule, deleteRecurringRule,
    result, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX,
    trial, applyActivation,
    syncStatus, lastSyncedAt, retrySync,
    exportFinancesJSON, importFinancesJSON,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
