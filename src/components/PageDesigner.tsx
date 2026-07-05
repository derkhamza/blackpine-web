import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentSettings, PageDesign, DocBlockDesign, PaperSize, DocKind } from "../lib/cabinetTypes";
import {
  DOC_DEFAULT_MARGINS, DOC_DEFAULT_SIZE, DOC_BLOCKS, isFlowDoc,
  designForKind, resolveMargins, resolvePageSize,
} from "../lib/docDesign";

// ── Visual page designer for pre-printed paper ────────────────────────────────
//
// The doctor drags each printed block on a scaled A5/A4 preview to line the
// output up with their letterhead paper: margins, block positions (mm from the
// page edge), optional logo. Everything is stored in doctorProfile.
// documentSettings.designs[kind] and applied by the print functions.

const DOC_KINDS: DocKind[] = ["ordonnance", "facture", "certificate", "examRequest", "receipt", "report"];
const PAPER_OPTS: PaperSize[] = ["A5", "A4", "Letter"];

// Natural (flow) positions used only to draw un-pinned blocks on the preview.
const FLOW_Y: Record<DocKind, Record<string, { y: number; h: number }>> = {
  ordonnance: {
    header:    { y: 13,  h: 30 },
    date:      { y: 13,  h: 10 },
    patient:   { y: 48,  h: 9  },
    body:      { y: 62,  h: 95 },
    signature: { y: 162, h: 22 },
    footer:    { y: 196, h: 8  },
  },
  facture: {
    header:    { y: 16,  h: 34 },
    invoice:   { y: 16,  h: 22 },
    parties:   { y: 58,  h: 34 },
    items:     { y: 98,  h: 110 },
    signature: { y: 218, h: 28 },
    footer:    { y: 280, h: 8  },
  },
  certificate: {
    header:    { y: 14,  h: 30 },
    body:      { y: 58,  h: 100 },
    signature: { y: 168, h: 28 },
    footer:    { y: 200, h: 8  },
  },
  examRequest: {
    header:     { y: 13,  h: 28 },
    date:       { y: 13,  h: 10 },
    patient:    { y: 46,  h: 9  },
    indication: { y: 58,  h: 16 },
    body:       { y: 80,  h: 92 },
    signature:  { y: 178, h: 20 },
    footer:     { y: 200, h: 8  },
  },
  receipt: {
    header:    { y: 12,  h: 28 },
    title:     { y: 46,  h: 18 },
    info:      { y: 70,  h: 30 },
    amount:    { y: 106, h: 32 },
    signature: { y: 150, h: 30 },
    footer:    { y: 192, h: 8  },
  },
  report: {
    header:    { y: 14,  h: 26 },
    footer:    { y: 279, h: 10 },
  },
};

// Blocks whose natural flow position is on the right side of the page.
const RIGHT_BLOCKS = new Set(["date", "invoice", "signature"]);

const MAX_LOGO_PX = 320;       // logo is resized before storing (synced field)
const MAX_BG_PX   = 1240;      // full-page background — larger, JPEG to stay small

function resizeImageToDataUrl(
  file: File, cb: (dataUrl: string | null) => void,
  maxPx = MAX_LOGO_PX, mime: "image/png" | "image/jpeg" = "image/png",
) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { cb(null); return; }
      if (mime === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL(mime, mime === "image/jpeg" ? 0.85 : undefined));
    };
    img.onerror = () => cb(null);
    img.src = reader.result as string;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}

export function PageDesigner({
  settings, onChange,
}: {
  settings: DocumentSettings;
  onChange: (s: DocumentSettings) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<DocKind>("ordonnance");
  const [selected, setSelected] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ key: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const design: PageDesign = designForKind(settings, kind) ?? {};
  const defaults = DOC_DEFAULT_MARGINS[kind];
  const margins = resolveMargins(design, defaults);
  const blocks = DOC_BLOCKS[kind];
  const page = resolvePageSize(design, DOC_DEFAULT_SIZE[kind]);
  // Multi-page flowing documents (the patient report) can't have their sections
  // dragged to absolute positions — only shown/hidden — so disable positioning.
  const flow = isFlowDoc(kind);

  // Preview scale: fixed width, px per mm.
  const PREVIEW_W = 300;
  const scale = PREVIEW_W / page.w;

  const setDesign = (patch: Partial<PageDesign>) =>
    onChange({ ...settings, designs: { ...settings.designs, [kind]: { ...design, ...patch } } });

  const setBlock = (key: string, patch: Partial<DocBlockDesign>) =>
    setDesign({ blocks: { ...(design.blocks ?? {}), [key]: { ...(design.blocks?.[key] ?? {}), ...patch } } });

  const blockLabel = (key: string) => t(`settings.pd.block_${key}`);

  // Position of a block on the preview (mm from page edge).
  const blockPos = (key: string) => {
    const b = design.blocks?.[key];
    const flow = FLOW_Y[kind][key];
    const w = RIGHT_BLOCKS.has(key) ? 45 : page.w - margins.left - margins.right;
    const x = b?.x ?? (RIGHT_BLOCKS.has(key) ? page.w - margins.right - w : margins.left);
    const y = b?.y ?? flow.y;
    return { x, y, w: RIGHT_BLOCKS.has(key) ? w : Math.min(w, page.w - x - margins.right), h: flow.h };
  };

  // ── Drag handling (pointer events, mm-precise) ─────────────────────────────
  const onPointerDown = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    setSelected(key);
    // Flow documents can't reposition their sections — selecting toggles the
    // show/hide checkbox reference only. The logo may still be placed freely.
    if (flow && key !== "__logo") return;
    const pos = key === "__logo"
      ? { x: design.logoX ?? margins.left, y: design.logoY ?? margins.top }
      : blockPos(key);
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const nx = Math.max(0, Math.min(page.w - 10, Math.round((d.origX + dx) * 2) / 2));
    const ny = Math.max(0, Math.min(page.h - 5, Math.round((d.origY + dy) * 2) / 2));
    if (d.key === "__logo") setDesign({ logoX: nx, logoY: ny });
    else setBlock(d.key, { x: nx, y: ny });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    resizeImageToDataUrl(file, (dataUrl) => {
      if (!dataUrl) return;
      setDesign({ logo: dataUrl, logoX: design.logoX ?? margins.left, logoY: design.logoY ?? margins.top, logoW: design.logoW ?? 30 });
    });
  };

  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    resizeImageToDataUrl(file, (dataUrl) => { if (dataUrl) setDesign({ background: dataUrl }); }, MAX_BG_PX, "image/jpeg");
  };

  const selBlock: DocBlockDesign | undefined = selected && selected !== "__logo" ? design.blocks?.[selected] : undefined;
  const cur = designForKind(settings, kind);
  const hasCustom = !!cur && Object.keys(cur).length > 0;

  return (
    <div className="pd-wrap">
      {/* Doc selector */}
      <div className="pd-tabs">
        {DOC_KINDS.map(k => (
          <button
            key={k}
            type="button"
            className={`tx-cat-chip${kind === k ? " active" : ""}`}
            onClick={() => { setKind(k); setSelected(null); }}
          >
            {t(`settings.pd.kind_${k}`)}
          </button>
        ))}
        {hasCustom && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--coral)" }}
            onClick={() => {
              if (!window.confirm(t("settings.pd.resetConfirm"))) return;
              const nextDesigns = { ...settings.designs };
              delete nextDesigns[kind];
              const next: DocumentSettings = { ...settings, designs: nextDesigns };
              if (kind === "ordonnance") delete next.ordonnanceDesign;
              if (kind === "facture")    delete next.factureDesign;
              onChange(next);
              setSelected(null);
            }}
          >
            {t("settings.pd.reset")}
          </button>
        )}
      </div>

      <div className="pd-body">
        {/* ── Scaled page preview ── */}
        <div
          ref={pageRef}
          className="pd-page"
          style={{ width: PREVIEW_W, height: Math.round(page.h * scale) }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => { if (e.target === pageRef.current) setSelected(null); }}
        >
          {/* letterhead background reference */}
          {design.background && (
            <img src={design.background} alt="" className="pd-bg" draggable={false} />
          )}
          {/* margin guides */}
          <div
            className="pd-margins"
            style={{
              left: margins.left * scale, top: margins.top * scale,
              right: margins.right * scale, bottom: margins.bottom * scale,
            }}
          />
          {/* blocks */}
          {blocks.map(key => {
            const b = design.blocks?.[key];
            if (b?.show === false) return null;
            const pos = blockPos(key);
            const pinned = b?.x != null || b?.y != null;
            return (
              <div
                key={key}
                className={`pd-block${selected === key ? " selected" : ""}${pinned ? " pinned" : ""}`}
                style={{
                  left: pos.x * scale, top: pos.y * scale,
                  width: pos.w * scale, height: pos.h * scale,
                  cursor: flow ? "default" : undefined,
                }}
                onPointerDown={onPointerDown(key)}
                title={flow ? undefined : t("settings.pd.dragHint")}
              >
                <span className="pd-block-label">{blockLabel(key)}</span>
              </div>
            );
          })}
          {/* logo */}
          {design.logo && (
            <img
              src={design.logo}
              alt="logo"
              className={`pd-logo${selected === "__logo" ? " selected" : ""}`}
              style={{
                left: (design.logoX ?? margins.left) * scale,
                top: (design.logoY ?? margins.top) * scale,
                width: (design.logoW ?? 30) * scale,
              }}
              onPointerDown={onPointerDown("__logo")}
              draggable={false}
            />
          )}
        </div>

        {/* ── Controls ── */}
        <div className="pd-controls">
          <div className="pd-hint">{t(flow ? "settings.pd.flowHint" : "settings.pd.hint")}</div>

          {/* Paper size */}
          <div className="pd-ctl-title">{t("settings.pd.paperSize")}</div>
          <div className="pd-paper-row">
            {PAPER_OPTS.map(sz => (
              <button
                key={sz}
                type="button"
                className={`tx-cat-chip${(design.pageSize ?? DOC_DEFAULT_SIZE[kind]) === sz ? " active" : ""}`}
                onClick={() => setDesign({ pageSize: sz })}
              >
                {sz}
              </button>
            ))}
          </div>

          {/* Margins */}
          <div className="pd-ctl-title">{t("settings.pd.margins")}</div>
          <div className="pd-margin-grid">
            {([["marginTop", "↑"], ["marginBottom", "↓"], ["marginLeft", "←"], ["marginRight", "→"]] as [keyof PageDesign, string][]).map(([k, arrow]) => (
              <label key={k} className="pd-margin-field">
                <span>{arrow}</span>
                <input
                  className="form-input"
                  type="number" min="0" max="60" step="1"
                  value={String((design[k] as number | undefined) ?? (defaults as unknown as Record<string, number>)[
                    k === "marginTop" ? "top" : k === "marginBottom" ? "bottom" : k === "marginLeft" ? "left" : "right"
                  ])}
                  onChange={e => setDesign({ [k]: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
                <span className="pd-mm">mm</span>
              </label>
            ))}
          </div>

          {/* Blocks: show/hide + selected position */}
          <div className="pd-ctl-title">{t("settings.pd.blocks")}</div>
          <div className="pd-block-list">
            {blocks.map(key => {
              const b = design.blocks?.[key];
              const shown = b?.show !== false;
              return (
                <div key={key} className={`pd-block-row${selected === key ? " selected" : ""}`} onClick={() => setSelected(key)}>
                  <input
                    type="checkbox"
                    checked={shown}
                    onChange={e => setBlock(key, { show: e.target.checked })}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="pd-block-row-label">{blockLabel(key)}</span>
                  {(b?.x != null || b?.y != null) && (
                    <button
                      type="button"
                      className="pd-unpin"
                      title={t("settings.pd.unpin")}
                      onClick={(e) => { e.stopPropagation(); setBlock(key, { x: undefined, y: undefined }); }}
                    >
                      ⟲
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected block numeric position */}
          {selected && selected !== "__logo" && !flow && (
            <div className="pd-pos-row">
              <span className="pd-pos-label">{blockLabel(selected)}</span>
              <label>X <input className="form-input" type="number" step="0.5"
                value={selBlock?.x ?? ""} placeholder="auto"
                onChange={e => setBlock(selected, { x: e.target.value === "" ? undefined : parseFloat(e.target.value) })} /> mm</label>
              <label>Y <input className="form-input" type="number" step="0.5"
                value={selBlock?.y ?? ""} placeholder="auto"
                onChange={e => setBlock(selected, { y: e.target.value === "" ? undefined : parseFloat(e.target.value) })} /> mm</label>
            </div>
          )}

          {/* Logo */}
          <div className="pd-ctl-title">{t("settings.pd.logo")}</div>
          <div className="pd-logo-row">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} />
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
              {design.logo ? t("settings.pd.logoReplace") : t("settings.pd.logoAdd")}
            </button>
            {design.logo && (
              <>
                <label className="pd-logo-size">
                  {t("settings.pd.logoWidth")}
                  <input
                    type="range" min="10" max="80" step="1"
                    value={design.logoW ?? 30}
                    onChange={e => setDesign({ logoW: parseInt(e.target.value, 10) })}
                  />
                  <span className="pd-mm">{design.logoW ?? 30} mm</span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: "var(--coral)" }}
                  onClick={() => setDesign({ logo: undefined, logoX: undefined, logoY: undefined, logoW: undefined })}
                >
                  {t("common.delete")}
                </button>
              </>
            )}
          </div>
          <div className="pd-hint" style={{ marginTop: 4 }}>
            {t("settings.pd.letterheadTip")}
          </div>

          {/* Background model (letterhead reference) */}
          <div className="pd-ctl-title">{t("settings.pd.background")}</div>
          <div className="pd-logo-row">
            <input ref={bgFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBgFile} />
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => bgFileRef.current?.click()}>
              {design.background ? t("settings.pd.bgReplace") : t("settings.pd.bgAdd")}
            </button>
            {design.background && (
              <>
                <label className="pd-bg-print">
                  <input
                    type="checkbox"
                    checked={!!design.printBackground}
                    onChange={e => setDesign({ printBackground: e.target.checked })}
                  />
                  {t("settings.pd.printBackground")}
                </label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: "var(--coral)" }}
                  onClick={() => setDesign({ background: undefined, printBackground: undefined })}
                >
                  {t("common.delete")}
                </button>
              </>
            )}
          </div>
          <div className="pd-hint" style={{ marginTop: 4 }}>{t("settings.pd.bgTip")}</div>
        </div>
      </div>
    </div>
  );
}
