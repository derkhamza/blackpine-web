// Minimal async key-value store backed by IndexedDB.
//
// Used for data that would otherwise blow past the browser's ~5-10 MB
// localStorage cap — chiefly appointment attachments (scans / photos kept as
// base64). IndexedDB's quota is a large fraction of free disk (hundreds of MB
// to GBs), so the "storage almost full" wall effectively disappears.
//
// Values are stored via structured clone (no JSON needed). Every call fails
// soft: if IndexedDB is unavailable (private mode, ancient browser, blocked),
// reads return null and writes are no-ops, so callers keep working.

const DB_NAME = "blackpine";
const STORE = "kv";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

// Resolves true only when the write actually committed, so callers can safely
// drop a localStorage fallback copy on success (and keep it on failure).
export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}

// All [key, value] pairs in the store — used to warm a synchronous in-memory
// cache at startup (see cabinetStore). Returns [] if IndexedDB is unavailable.
export async function idbEntries(): Promise<Array<[string, unknown]>> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const store   = db.transaction(STORE, "readonly").objectStore(STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      let keys: IDBValidKey[] | null = null;
      let vals: unknown[] | null = null;
      const done = () => {
        if (keys && vals) resolve(keys.map((k, i) => [String(k), (vals as unknown[])[i]]));
      };
      keysReq.onsuccess = () => { keys = keysReq.result; done(); };
      valsReq.onsuccess = () => { vals = valsReq.result; done(); };
      keysReq.onerror = () => resolve([]);
      valsReq.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch { resolve(); }
  });
}
