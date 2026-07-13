// Conflict reconciliation for the optimistic-concurrency sync (see CabinetContext).
// When our push is rejected (409) because another device — typically the
// secretary — wrote in between, we merge our local records against the server's
// instead of taking one side's record wholesale.
//
// The old behaviour was record-level: a "touched" record was kept entirely from
// the local copy, silently discarding whatever field the OTHER device changed on
// the same record. For medical/billing data that's a real data-loss risk (e.g.
// the doctor writes the consultation note while the secretary records the
// payment on the same appointment). mergeRecord() fixes that with a 3-way,
// field-level merge.

/** Structural value-equality, good enough for change detection: our records are
 *  built consistently so JSON key order is stable. */
function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 3-way field merge of a single record.
 *   - `base`   = the record as of our last successful sync,
 *   - `local`  = our edited copy,
 *   - `server` = the other device's copy (from the 409 snapshot).
 * For each field: if WE changed it since base, our value wins (our explicit
 * intent); otherwise the server's value wins (their edit, or unchanged). With no
 * base to diff against we can't attribute changes, so local wins the whole
 * record — the previous, safe fallback.
 */
export function mergeRecord<T extends { id: string }>(
  base: T | undefined, local: T, server: T,
): T {
  if (!base) return local;
  const out: any = { ...server };
  const keys = new Set<string>([
    ...Object.keys(base as any),
    ...Object.keys(local as any),
    ...Object.keys(server as any),
  ]);
  for (const k of keys) {
    if (k === "id") continue;
    // We changed this field relative to the base → keep our value. Includes a
    // field we cleared (present in base, gone locally): out[k] becomes undefined,
    // which JSON.stringify drops on the next push.
    if (!eq((local as any)[k], (base as any)[k])) out[k] = (local as any)[k];
    // else: leave server[k] (their edit, or a value neither side touched).
  }
  return out as T;
}

/**
 * Reconcile a server array against our local array after a 409.
 *   - records we deleted locally stay deleted (tombstones),
 *   - records we touched are field-merged against the server copy (3-way when a
 *     `base` map is supplied, else local-wins),
 *   - untouched records adopt the server copy (keeps the other device's edits),
 *   - records we created locally (absent on the server) are kept.
 */
export function mergeConflict<T extends { id: string }>(
  server: T[], local: T[], tombstones: Set<string>, touched: Set<string>,
  base?: Map<string, T>,
): T[] {
  const localById = new Map(local.map(x => [x.id, x]));
  const out: T[] = [];
  for (const srv of server ?? []) {
    if (!srv || !srv.id) continue;
    if (tombstones.has(srv.id)) continue;             // deleted here → stays deleted
    const loc = localById.get(srv.id);
    if (loc && touched.has(srv.id)) {
      out.push(mergeRecord(base?.get(srv.id), loc, srv));  // 3-way (or local-wins w/o base)
    } else {
      out.push(srv);                                  // untouched here → adopt server
    }
    localById.delete(srv.id);
  }
  for (const loc of localById.values()) out.push(loc); // created here → keep
  return out;
}
