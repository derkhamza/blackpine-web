import { uploadAttachment, fetchAttachment, getStorageMode } from "../api/client";
import type { DocumentSettings, PageDesign, DocKind } from "./cabinetTypes";

// Letterhead / logo images (doctorProfile.documentSettings) used to be stored
// inline as data: URLs — which bloated localStorage and every synced snapshot
// (they ride the whole profile). They're now offloaded to blob and referenced by
// a "blob:<url>" marker. This module resolves a marker back to a usable data URL
// (cached in memory) for rendering and printing.
//
// Safety: resolveDocImage() passes data: URLs through UNCHANGED, so any image not
// yet offloaded — existing profiles, or a fresh upload before it's swapped —
// renders/prints exactly as before. Only "blob:" markers depend on the cache.

const cache = new Map<string, string>(); // "blob:<url>"  →  data: URL

/** Synchronous resolve for render/print. data: URLs pass through; a blob: marker
 *  resolves from cache, or "" if not warmed yet (image simply omitted that once). */
export function resolveDocImage(v: string | undefined): string {
  if (!v) return "";
  if (v.startsWith("blob:")) return cache.get(v) ?? "";
  return v;
}

/** Offload a data: image to blob; returns the blob marker (and caches the data
 *  URL so resolveDocImage keeps working) or the original data URL on any failure.
 *  `id` namespaces the blob per field so re-uploads overwrite instead of orphaning. */
export async function offloadDocImage(id: string, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  try {
    const mode = await getStorageMode();
    if (!mode.blob) return dataUrl;
    const url = await uploadAttachment(`docimg-${id}`, dataUrl);
    if (!url) return dataUrl;
    const marker = `blob:${url}`;
    cache.set(marker, dataUrl);
    return marker;
  } catch { return dataUrl; }
}

function markersOf(ds?: DocumentSettings): string[] {
  const out: string[] = [];
  const add = (d?: PageDesign) => { if (d?.logo) out.push(d.logo); if (d?.background) out.push(d.background); };
  add(ds?.ordonnanceDesign); add(ds?.factureDesign);
  for (const d of Object.values(ds?.designs ?? {})) add(d);
  return out.filter(m => m.startsWith("blob:"));
}

/** On load: fetch + decrypt any blob-referenced images into the cache so print /
 *  preview find them synchronously. Best-effort, idempotent (skips cached). */
export async function warmDocImages(ds?: DocumentSettings): Promise<void> {
  const markers = [...new Set(markersOf(ds))].filter(m => !cache.has(m));
  await Promise.all(markers.map(async m => {
    const data = await fetchAttachment(m.slice(5)); // strip "blob:"
    if (data) cache.set(m, data);
  }));
}

/** One-time backfill: offload any still-inline (data:) letterhead/logo image in the
 *  profile to blob, returning an updated DocumentSettings — or null if nothing to
 *  do (no blob store, or no inline images). */
export async function offloadProfileImages(ds: DocumentSettings): Promise<DocumentSettings | null> {
  const mode = await getStorageMode();
  if (!mode.blob) return null;
  let changed = false;
  const one = async (d: PageDesign | undefined, tag: string): Promise<PageDesign | undefined> => {
    if (!d) return d;
    let out = d;
    if (d.logo?.startsWith("data:")) {
      const m = await offloadDocImage(`${tag}-logo`, d.logo);
      if (m !== d.logo) { out = { ...out, logo: m }; changed = true; }
    }
    if (d.background?.startsWith("data:")) {
      const m = await offloadDocImage(`${tag}-bg`, d.background);
      if (m !== d.background) { out = { ...out, background: m }; changed = true; }
    }
    return out;
  };
  const ordonnanceDesign = await one(ds.ordonnanceDesign, "ord-legacy");
  const factureDesign    = await one(ds.factureDesign, "fac-legacy");
  const designs: Partial<Record<DocKind, PageDesign>> = { ...(ds.designs ?? {}) };
  for (const [k, d] of Object.entries(ds.designs ?? {})) designs[k as DocKind] = await one(d, k);
  return changed ? { ...ds, ordonnanceDesign, factureDesign, designs } : null;
}
