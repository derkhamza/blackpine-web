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

// ── Context shape ──────────────────────────────────────────────────────────
interface AppCtx {
  // auth
  user: AuthUser | null;
  isAuthenticated: boolean;
  login:  (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  logout: () => void;

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

  // sync
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  retrySync: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);
const uid = () => Math.random().toString(36).slice(2, 9);

// ── Provider ───────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuth]    = useState(false);
  const [profile, setProfileState]      = useState<DoctorProfile>(DEFAULT_PROFILE);
  const [transactions, setTx]           = useState<Transaction[]>([]);
  const [assets, setAssets]             = useState<FixedAsset[]>([]);
  const [recurringRules, setRules]      = useState<RecurringRule[]>([]);
  const [syncStatus, setSyncStatus]     = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [fiscalYearRaw, setFiscalYearRaw] = useState(FISCAL_MAX);

  const fiscalYear    = Math.max(FISCAL_MIN, Math.min(FISCAL_MAX, fiscalYearRaw));
  const setFiscalYear = (y: number) => setFiscalYearRaw(Math.max(FISCAL_MIN, Math.min(FISCAL_MAX, y)));

  // ── Boot: restore session ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn()) return;
    const stored = getStoredUser();
    if (stored) { setUser(stored); setIsAuth(true); }
    // pull data on boot
    setSyncStatus("syncing");
    pullData()
      .then((d) => {
        if (d.profile)            setProfileState(d.profile);
        if (d.transactions.length) setTx(d.transactions);
        if (d.assets.length)       setAssets(d.assets);
        if (d.recurringRules.length) setRules(d.recurringRules);
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

  const triggerSync = useCallback(() => {
    if (!isAuthenticated) return;
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
    const u = await apiLogin(email, pass);
    setUser(u); setIsAuth(true);
    setSyncStatus("syncing");
    const d = await pullData();
    if (d.profile)             setProfileState(d.profile);
    if (d.transactions.length)  setTx(d.transactions);
    if (d.assets.length)        setAssets(d.assets);
    if (d.recurringRules.length) setRules(d.recurringRules);
    setSyncStatus("synced");
    setLastSyncedAt(new Date().toISOString());
  }, []);

  const signup = useCallback(async (email: string, pass: string) => {
    const u = await apiSignup(email, pass);
    setUser(u); setIsAuth(true);
    setSyncStatus("synced");
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null); setIsAuth(false);
    setProfileState(DEFAULT_PROFILE);
    setTx([]); setAssets([]); setRules([]);
    setSyncStatus("idle");
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

  const value: AppCtx = {
    user, isAuthenticated, login, signup, logout,
    profile, setProfile,
    transactions, addTransaction, updateTransaction, deleteTransaction,
    assets, addAsset, updateAsset, deleteAsset,
    recurringRules, addRecurringRule, deleteRecurringRule,
    result, fiscalYear, setFiscalYear, FISCAL_MIN, FISCAL_MAX,
    syncStatus, lastSyncedAt, retrySync,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
