// Synchronous key-value cache for the cabinet collections, backed by IndexedDB.
//
// Why: appointments / patients / clinical documents were stored raw in
// localStorage (~5-10 MB cap), which a busy practice fills in ~1-2 years — after
// which writes silently fail. IndexedDB's quota is a large fraction of free disk.
//
// How: the whole KV store is read into an in-memory Map ONCE at startup
// (hydrateKvCache, awaited before React renders). Reads/writes then stay
// synchronous — preserving the app's synchronous state-hydration + sync-engine
// contract exactly — while writes fan out to IndexedDB in the background and the
// localStorage copy is dropped only after the IDB write actually commits.
//
// Fail-soft: if IndexedDB is unavailable (private mode, blocked, ancient browser)
// every path falls back to localStorage, so behaviour is identical to before.

import { idbEntries, idbSet } from "./idbStore";

const kvCache = new Map<string, unknown>();
let hydrated = false;

// Read the entire IDB KV store into the cache. Awaited once before render. A hard
// timeout guarantees startup is never blocked by a slow/hung IndexedDB — on
// timeout we proceed with whatever loaded (cacheGet still falls back to
// localStorage for anything missing).
export async function hydrateKvCache(timeoutMs = 3000): Promise<void> {
  if (hydrated) return;
  try {
    const entries = await Promise.race([
      idbEntries(),
      new Promise<Array<[string, unknown]>>((res) => setTimeout(() => res([]), timeoutMs)),
    ]);
    for (const [k, v] of entries) if (!kvCache.has(k)) kvCache.set(k, v);
  } catch { /* proceed with localStorage fallback */ }
  hydrated = true;
}

// Synchronous read: cache first, then legacy localStorage (not yet migrated), else
// undefined. A localStorage hit is promoted into the cache.
export function cacheGet(key: string): unknown {
  if (kvCache.has(key)) return kvCache.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      kvCache.set(key, parsed);
      return parsed;
    }
  } catch { /* corrupt JSON → treat as absent */ }
  return undefined;
}

// Synchronous write: update the cache now, persist to IndexedDB in the background.
// On a committed IDB write we drop the localStorage copy (freeing the old cap); if
// IDB is unavailable we keep it in localStorage so nothing is ever lost.
export function cacheSet(key: string, value: unknown): void {
  kvCache.set(key, value);
  void idbSet(key, value).then((ok) => {
    if (ok) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    } else {
      writeLocalStorage(key, value);
    }
  });
}

function writeLocalStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded (or private-mode block): the write did NOT persist. Signal it
    // so the provider can surface the storage-pressure banner (unchanged behaviour).
    if (isQuotaError(e)) {
      try { window.dispatchEvent(new Event("bp:storage-quota")); } catch { /* no window */ }
    }
  }
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 || e.code === 1014)
  );
}
