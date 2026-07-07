// Turn a picked File into the raw payload of an ApptDocument (base64 data URL +
// size + mime), compressing images the same way the appointment uploader does.
//
// Kept framework-free and promise-based so any screen (the consultation
// uploader, the patient bulk importer…) can reuse the exact same pipeline.
// Resolves to null when the file is too large or can't be read — the caller
// decides how to surface that (toast, warning banner…).

export interface DocPayload {
  data:      string;   // "data:…;base64,…"
  sizeBytes: number;
  mimeType:  string;
}

const MB = 1024 * 1024;

export function fileToDocPayload(file: File): Promise<DocPayload | null> {
  return new Promise((resolve) => {
    // Hard ceiling before we even read — a base64 blob is ~1.33× the bytes and
    // must fit comfortably in the synced snapshot.
    if (file.size > 5 * MB) { resolve(null); return; }

    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = (ev) => {
      const original = ev.target?.result as string;
      if (!original) { resolve(null); return; }

      if (file.type.startsWith("image/")) {
        // Compress via canvas; fall back to the original bytes if anything in
        // the decode/encode pipeline fails (HEIC, tainted canvas, huge dims).
        const storeOriginal = () => {
          if (file.size > 3 * MB) { resolve(null); return; }
          resolve({ data: original, sizeBytes: file.size, mimeType: file.type || "image/jpeg" });
        };
        const img = new Image();
        img.onload = () => {
          try {
            const MAX = 1200;
            let w = img.width, h = img.height;
            if (!w || !h) { storeOriginal(); return; }
            if (w > MAX || h > MAX) {
              const ratio = MAX / Math.max(w, h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) { storeOriginal(); return; }
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL("image/jpeg", 0.78);
            if (!compressed || compressed.length < 100) { storeOriginal(); return; }
            resolve({ data: compressed, sizeBytes: Math.round(compressed.length * 0.75), mimeType: "image/jpeg" });
          } catch {
            storeOriginal();
          }
        };
        img.onerror = storeOriginal;
        img.src = original;
      } else {
        // Non-images (PDF, doc) are stored as-is with a tighter cap.
        if (file.size > 2 * MB) { resolve(null); return; }
        resolve({ data: original, sizeBytes: file.size, mimeType: file.type || "application/octet-stream" });
      }
    };
    reader.readAsDataURL(file);
  });
}
