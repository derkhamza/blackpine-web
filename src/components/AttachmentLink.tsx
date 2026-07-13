import { useEffect, useState, type ReactNode } from "react";
import { fetchAttachment } from "../api/client";

// An attachment's `data` is either an inline base64 data URL ("data:…") or a tiny
// object-storage marker ("blob:<url>"). This resolves a marker to a usable data
// URL by fetching + decrypting it through the backend (cached module-wide so the
// same file resolves once across renders and multiple links).

const cache = new Map<string, string>();

export function useAttachmentUrl(data: string): { url: string | null; loading: boolean } {
  const isBlob = data.startsWith("blob:");
  const [url, setUrl] = useState<string | null>(isBlob ? (cache.get(data) ?? null) : data);
  const [loading, setLoading] = useState(isBlob && !cache.has(data));
  useEffect(() => {
    if (!isBlob) { setUrl(data); setLoading(false); return; }
    if (cache.has(data)) { setUrl(cache.get(data)!); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetchAttachment(data.slice(5)).then(d => {
      if (!alive) return;
      if (d) { cache.set(data, d); setUrl(d); }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [data, isBlob]);
  return { url, loading };
}

// Link (<a>) to an attachment, transparently handling inline vs blob-stored data.
export function AttachmentLink({ doc, download, className, children }: {
  doc: { data: string; filename: string };
  download?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { url, loading } = useAttachmentUrl(doc.data);
  if (loading || !url) {
    return <span className={className} style={{ opacity: 0.55, cursor: "default" }}>{children}</span>;
  }
  return download
    ? <a href={url} download={doc.filename} className={className}>{children}</a>
    : <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}
