/// <reference types="vite/client" />
import type { DoctorProfile, Transaction, FixedAsset } from "../engine";
import type { RecurringRule } from "../lib/recurringTransactions";

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://blackpine-backend.vercel.app";

const TOKEN_KEY  = "bp.token";
const USER_KEY   = "bp.user";
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

// ── Fetch wrapper ──────────────────────────────────────────────────────────

async function request(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, { ...opts, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
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

export async function pullData(): Promise<SyncData> {
  const res = await request("/sync/pull");
  if (!res.ok) {
    if (res.status === 401) { clearToken(); throw new Error("TOKEN_EXPIRED"); }
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

// ── Password reset ─────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const res  = await request("/reset/request", { method: "POST", body: JSON.stringify({ email }) });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || "Request failed");
}
