// Optional app-lock — an ACCESS GATE, not encryption. When the doctor sets a PIN,
// the app asks for it on load / reload before showing any clinical data, so a
// stepped-away or shared device isn't left open. The PIN is stored only as a
// salted SHA-256 hash in localStorage; a successful unlock sets a session flag so
// it isn't re-asked while navigating. Forgetting the PIN falls back to a full
// re-login with the account password (see LockScreen), so it can't be bypassed
// without credentials — but note the local data itself is not encrypted.

const HASH_KEY   = "bp.appLockHash";
const SALT_KEY   = "bp.appLockSalt";
const UNLOCK_KEY = "bp.appUnlocked";

export function hasAppLock(): boolean {
  try { return !!localStorage.getItem(HASH_KEY); } catch { return false; }
}
export function isUnlocked(): boolean {
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return true; }
}
export function markUnlocked(): void {
  try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* ignore */ }
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function setAppLock(pin: string): Promise<void> {
  const salt = (crypto.randomUUID?.() ?? String(Math.random()) + String(Math.random())).replace(/-/g, "");
  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(HASH_KEY, await hashPin(pin, salt));
  markUnlocked();
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const h = localStorage.getItem(HASH_KEY);
    if (!h) return true;
    return (await hashPin(pin, localStorage.getItem(SALT_KEY) ?? "")) === h;
  } catch { return false; }
}

export function clearAppLock(): void {
  try {
    localStorage.removeItem(HASH_KEY);
    localStorage.removeItem(SALT_KEY);
    markUnlocked();
  } catch { /* ignore */ }
}
