import { confirmDialog } from "../lib/confirm";
import { useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentSettings, PageDesign, DocBlockDesign, PaperSize, DocKind } from "../lib/cabinetTypes";
import {
  DOC_DEFAULT_MARGINS, DOC_DEFAULT_SIZE, DOC_BLOCKS, isFlowDoc,
  designForKind, docModeForKind, resolveMargins, resolvePageSize,
} from "../lib/docDesign";
import { resolveDocImage, offloadDocImage, warmDocImages } from "../lib/docImages";

// ── Visual page designer for pre-printed paper ────────────────────────────────
//
// The doctor lines the output up with their letterhead by DRAGGING directly on a
// scaled, to-example preview: drag the margin guides to set margins, drag a block
// to move it, and drag its edges/corner to resize it. Each block shows realistic
// sample content so the preview looks like the real printed document. Everything
// is stored in doctorProfile.documentSettings.designs[kind] and applied by the
// print functions.

const DOC_KINDS: DocKind[] = ["ordonnance", "facture", "certificate", "examRequest", "receipt", "report", "payroll", "compteRendu", "rapportMedical"];
const PAPER_OPTS: PaperSize[] = ["A5", "A4", "Letter"];

// Natural (flow) positions used to draw un-pinned blocks on the preview.
const FLOW_Y: Record<DocKind, Record<string, { y: number; h: number }>> = {
  ordonnance: {
    header:    { y: 13,  h: 30 },
    city:      { y: 13,  h: 6  },
    date:      { y: 20,  h: 8  },
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
    city:       { y: 13,  h: 6  },
    date:       { y: 20,  h: 8  },
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
  compteRendu: {
    header:    { y: 14,  h: 26 },
    footer:    { y: 279, h: 10 },
  },
  rapportMedical: {
    header:    { y: 16,  h: 26 },
    footer:    { y: 279, h: 10 },
  },
  payroll: {
    header:    { y: 14,  h: 30 },
    title:     { y: 50,  h: 20 },
    info:      { y: 76,  h: 34 },
    body:      { y: 116, h: 90 },
    amount:    { y: 210, h: 40 },
    signature: { y: 256, h: 26 },
    footer:    { y: 282, h: 8  },
  },
};

// Blocks whose natural flow position is on the right side of the page.
const RIGHT_BLOCKS = new Set(["city", "date", "invoice", "signature"]);

const MAX_LOGO_PX = 320;       // logo is resized before storing (synced field)
const MAX_BG_PX   = 1240;      // full-page background — larger, JPEG to stay small

// ── Example content ───────────────────────────────────────────────────────────
// Realistic sample lines per block so the preview reads like the real document.
type SampleLine = { text: string; size: number; bold?: boolean; align?: "left" | "right" | "center"; muted?: boolean };

function sampleLines(kind: DocKind, key: string): SampleLine[] {
  const H = (t: string): SampleLine => ({ text: t, size: 4.4, bold: true });
  switch (key) {
    case "header":
      return [
        { text: "Dr. Amina El Fassi", size: 4.6, bold: true },
        { text: "Endocrinologie · Diabétologie", size: 3.2, muted: true },
        { text: "12 av. Hassan II, Casablanca · 05 22 00 00 00", size: 2.8, muted: true },
      ];
    case "city":
      return [{ text: "Casablanca", size: 3, align: "right", muted: true }];
    case "date":
      return [{ text: "le 11/07/2026", size: 3, align: "right", muted: true }];
    case "invoice":
      return [
        { text: "FACTURE", size: 5, bold: true, align: "right" },
        { text: "N° FAC-2026-0042", size: 3, align: "right", muted: true },
        { text: "Date : 11/07/2026", size: 3, align: "right", muted: true },
      ];
    case "patient":
      return [{ text: "Mohammed Alaoui · 34 ans", size: 3.2 }];
    case "parties":
      return [
        { text: "Facturé à : Mohammed Alaoui", size: 3.2, bold: true },
        { text: "CIN : AB123456", size: 2.9, muted: true },
        { text: "ICE : 001234567000089", size: 2.9, muted: true },
      ];
    case "indication":
      return [
        { text: "Indication clinique", size: 3, bold: true },
        { text: "Bilan thyroïdien de contrôle", size: 3, muted: true },
      ];
    case "title":
      return [{ text: kind === "receipt" ? "REÇU DE PAIEMENT" : "BULLETIN DE PAIE", size: 5, bold: true, align: "center" }];
    case "info":
      return [
        { text: "Reçu de : Mohammed Alaoui", size: 3.2 },
        { text: "Motif : Consultation", size: 3, muted: true },
        { text: "Mode : Espèces", size: 3, muted: true },
      ];
    case "amount":
      return [
        { text: "Total", size: 3.2, muted: true },
        { text: "300,00 MAD", size: 6.5, bold: true },
      ];
    case "signature":
      return [{ text: "Signature et cachet", size: 3, align: "right", muted: true }];
    case "footer":
      return [{ text: "INPE 00/00000 · Ordre 12345 · ICE 001234567000089", size: 2.6, align: "center", muted: true }];
    case "items":
      return [H("Désignation")];
    case "body":
      if (kind === "ordonnance")
        return [
          H("Ordonnance"),
          { text: "1. Metformine 850 mg — 1 cp x2/j", size: 3.1 },
          { text: "2. Levothyrox 75 µg — 1 cp le matin", size: 3.1 },
          { text: "3. Vitamine D 100 000 UI — 1 amp/mois", size: 3.1 },
        ];
      if (kind === "certificate")
        return [
          { text: "Je soussignée, Dr. Amina El Fassi, certifie que", size: 3.1 },
          { text: "le patient nommé ci-dessus a été examiné ce jour", size: 3.1 },
          { text: "et nécessite un repos de 3 jours.", size: 3.1 },
        ];
      if (kind === "examRequest")
        return [
          H("Examens demandés"),
          { text: "☐ TSH, T4 libre", size: 3.1 },
          { text: "☐ Glycémie à jeun · HbA1c", size: 3.1 },
          { text: "☐ Bilan lipidique complet", size: 3.1 },
        ];
      if (kind === "payroll")
        return [
          { text: "Salaire de base ............ 5 000,00", size: 3.1 },
          { text: "Prime ..................... 500,00", size: 3.1 },
          { text: "Cotisations .............. − 750,00", size: 3.1 },
        ];
      return [{ text: "Contenu du document…", size: 3.1, muted: true }];
    default:
      return [{ text: key, size: 3, muted: true }];
  }
}

// The invoice line-items table gets a small rendered table rather than lines.
function isItemsTable(kind: DocKind, key: string) {
  return key === "items" && kind === "facture";
}

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

// What the current pointer gesture is manipulating.
type DragMode =
  | { t: "move"; key: string; sx: number; sy: number; ox: number; oy: number }
  | { t: "resize"; key: string; edge: "r" | "b" | "br"; sx: number; sy: number; ow: number; oh: number; x: number; y: number }
  | { t: "logo-move"; sx: number; sy: number; ox: number; oy: number }
  | { t: "logo-resize"; sx: number; ow: number }
  | { t: "margin"; edge: "top" | "right" | "bottom" | "left"; sx: number; sy: number; ov: number };

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
  const dragRef = useRef<DragMode | null>(null);

  // Only documents in "advanced" mode are editable here. Simple-mode documents
  // still render an EXACT, to-scale, read-only preview (the same canvas) so the
  // doctor sees precise size + text positions before choosing to customise.
  const editable = docModeForKind(settings, kind) === "advanced";
  const setDocMode = (m: "simple" | "advanced") =>
    onChange({ ...settings, docMode: { ...settings.docMode, [kind]: m } });
  const design: PageDesign = designForKind(settings, kind) ?? {};
  const defaults = DOC_DEFAULT_MARGINS[kind];
  // Letterhead/logo may be a blob: marker — resolve to a data URL for the preview.
  // Warm the cache on load and force a re-render once resolved (the cache is not
  // React state). data: URLs resolve to themselves, so nothing else changes.
  const [, forceRerender] = useReducer(x => x + 1, 0);
  useEffect(() => { void warmDocImages(settings).then(forceRerender); }, [settings]);
  const bgSrc   = resolveDocImage(design.background);
  const logoSrc = resolveDocImage(design.logo);
  const margins = resolveMargins(design, defaults);
  const blocks = DOC_BLOCKS[kind];
  const page = resolvePageSize(design, DOC_DEFAULT_SIZE[kind]);
  // Multi-page flowing documents (the patient report) can't have their sections
  // dragged to absolute positions — only shown/hidden + width — so disable moving.
  const flow = isFlowDoc(kind);

  // Preview scale: fixed width, px per mm.
  const PREVIEW_W = 340;
  const scale = PREVIEW_W / page.w;
  const px = (mm: number) => mm * scale;      // mm → preview px

  const setDesign = (patch: Partial<PageDesign>) =>
    onChange({ ...settings, designs: { ...settings.designs, [kind]: { ...design, ...patch } } });

  const setBlock = (key: string, patch: Partial<DocBlockDesign>) =>
    setDesign({ blocks: { ...(design.blocks ?? {}), [key]: { ...(design.blocks?.[key] ?? {}), ...patch } } });

  // Two document modes: "blank" prints everything; "pre-printed" hides the
  // letterhead blocks (header + footer, already on the paper) and keeps only the
  // content. Selecting a mode presets those blocks' visibility.
  const LETTERHEAD_BLOCKS = ["header", "footer"];
  const setMode = (preprinted: boolean) => {
    const nextBlocks = { ...(design.blocks ?? {}) };
    for (const k of LETTERHEAD_BLOCKS) {
      if (blocks.includes(k)) nextBlocks[k] = { ...(nextBlocks[k] ?? {}), show: !preprinted };
    }
    setDesign({ preprinted, blocks: nextBlocks });
  };

  const blockLabel = (key: string) => t(`settings.pd.block_${key}`);

  // Position + size of a block on the preview (mm from page edge).
  const blockPos = (key: string) => {
    const b = design.blocks?.[key];
    const flowPos = FLOW_Y[kind][key];
    const defW = RIGHT_BLOCKS.has(key) ? 45 : page.w - margins.left - margins.right;
    const x = b?.x ?? (RIGHT_BLOCKS.has(key) ? page.w - margins.right - defW : margins.left);
    const y = b?.y ?? flowPos.y;
    const w = b?.w ?? (RIGHT_BLOCKS.has(key) ? defW : Math.min(defW, page.w - x - margins.right));
    const h = b?.h ?? flowPos.h;
    return { x, y, w, h };
  };

  const snap = (mm: number) => Math.round(mm * 2) / 2;   // 0.5mm grid

  // ── Drag handling (pointer events, mm-precise) ─────────────────────────────
  const startBlockMove = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(key);
    if (flow) return;   // flow docs: no repositioning (selecting is enough)
    const pos = blockPos(key);
    dragRef.current = { t: "move", key, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startBlockResize = (key: string, edge: "r" | "b" | "br") => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(key);
    const pos = blockPos(key);
    dragRef.current = { t: "resize", key, edge, sx: e.clientX, sy: e.clientY, ow: pos.w, oh: pos.h, x: pos.x, y: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startLogoMove = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelected("__logo");
    dragRef.current = { t: "logo-move", sx: e.clientX, sy: e.clientY, ox: design.logoX ?? margins.left, oy: design.logoY ?? margins.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startLogoResize = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { t: "logo-resize", sx: e.clientX, ow: design.logoW ?? 30 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const startMargin = (edge: "top" | "right" | "bottom" | "left") => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(null);
    dragRef.current = { t: "margin", edge, sx: e.clientX, sy: e.clientY, ov: margins[edge] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - (d as any).sx) / scale;
    const dy = (e.clientY - (d as any).sy) / scale;
    if (d.t === "move") {
      const nx = Math.max(0, Math.min(page.w - 10, snap(d.ox + dx)));
      const ny = Math.max(0, Math.min(page.h - 5, snap(d.oy + dy)));
      setBlock(d.key, { x: nx, y: ny });
    } else if (d.t === "resize") {
      if (d.edge === "r" || d.edge === "br") {
        const nw = Math.max(10, Math.min(page.w - d.x, snap(d.ow + dx)));
        setBlock(d.key, { w: nw });
      }
      if (d.edge === "b" || d.edge === "br") {
        const nh = Math.max(5, Math.min(page.h - d.y, snap(d.oh + dy)));
        setBlock(d.key, { h: nh });
      }
    } else if (d.t === "logo-move") {
      setDesign({ logoX: Math.max(0, snap(d.ox + dx)), logoY: Math.max(0, snap(d.oy + dy)) });
    } else if (d.t === "logo-resize") {
      setDesign({ logoW: Math.max(8, Math.min(90, Math.round(d.ow + dx))) });
    } else if (d.t === "margin") {
      const half = (d.edge === "top" || d.edge === "bottom") ? page.h / 2 : page.w / 2;
      // top/left grow with the pointer; right/bottom shrink as the pointer moves in.
      const delta = (d.edge === "top" || d.edge === "bottom") ? dy : dx;
      const signed = (d.edge === "bottom" || d.edge === "right") ? -delta : delta;
      const nv = Math.max(0, Math.min(half, snap(d.ov + signed)));
      const field = d.edge === "top" ? "marginTop" : d.edge === "bottom" ? "marginBottom" : d.edge === "left" ? "marginLeft" : "marginRight";
      setDesign({ [field]: nv });
    }
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    resizeImageToDataUrl(file, (dataUrl) => {
      if (!dataUrl) return;
      // Offload to blob first (falls back to the inline data URL on failure), then
      // store the resulting marker in one setDesign — avoids a second stale write.
      void offloadDocImage(`${kind}-logo`, dataUrl).then(stored =>
        setDesign({ logo: stored, logoX: design.logoX ?? margins.left, logoY: design.logoY ?? margins.top, logoW: design.logoW ?? 30 }));
    });
  };

  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    resizeImageToDataUrl(file, (dataUrl) => {
      if (!dataUrl) return;
      void offloadDocImage(`${kind}-bg`, dataUrl).then(stored => setDesign({ background: stored, printBackground: true }));
    }, MAX_BG_PX, "image/jpeg");
  };

  const cur = designForKind(settings, kind);
  const hasCustom = !!cur && Object.keys(cur).length > 0;

  // Render one block's sample content, styled proportionally to the preview.
  const renderExample = (key: string, w: number) => {
    if (isItemsTable(kind, key)) {
      const cellFs = Math.max(4, px(2.8));
      return (
        <table className="pd-ex-table" style={{ fontSize: cellFs }}>
          <thead>
            <tr><th style={{ textAlign: "left" }}>Désignation</th><th>Qté</th><th style={{ textAlign: "right" }}>Montant</th></tr>
          </thead>
          <tbody>
            <tr><td>Consultation</td><td style={{ textAlign: "center" }}>1</td><td style={{ textAlign: "right" }}>300,00</td></tr>
            <tr><td>Impédancemétrie</td><td style={{ textAlign: "center" }}>1</td><td style={{ textAlign: "right" }}>150,00</td></tr>
            <tr className="pd-ex-total"><td colSpan={2}>Total</td><td style={{ textAlign: "right" }}>450,00 MAD</td></tr>
          </tbody>
        </table>
      );
    }
    return sampleLines(kind, key).map((ln, i) => (
      <div
        key={i}
        style={{
          fontSize: Math.max(4, px(ln.size)),
          fontWeight: ln.bold ? 700 : 400,
          textAlign: ln.align ?? "left",
          // Preview paper is always white, so use fixed ink colours (not theme vars).
          color: ln.muted ? "#7a8896" : "#1a2733",
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: px(w) - 6,
        }}
      >
        {ln.text}
      </div>
    ));
  };

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
        {editable && hasCustom && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginLeft: "auto", fontSize: 11, color: "var(--coral)" }}
            onClick={async () => {
              if (!await confirmDialog(t("settings.pd.resetConfirm"))) return;
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
        {/* ── Scaled, to-example page preview ── */}
        <div
          ref={pageRef}
          className="pd-page"
          style={{ width: PREVIEW_W, height: Math.round(page.h * scale) }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={(e) => { if (e.target === pageRef.current) setSelected(null); }}
        >
          {/* letterhead background reference */}
          {bgSrc && (
            <img src={bgSrc} alt="" className="pd-bg" draggable={false} />
          )}

          {/* margin guides + draggable edges */}
          <div
            className="pd-margins"
            style={{ left: px(margins.left), top: px(margins.top), right: px(margins.right), bottom: px(margins.bottom) }}
          />
          {editable && <>
          <div className="pd-margin-handle pd-mh-top"    style={{ top: px(margins.top) }}                 onPointerDown={startMargin("top")}    title={`${t("settings.pd.margins")} ↑ ${margins.top}mm`} />
          <div className="pd-margin-handle pd-mh-bottom" style={{ top: px(page.h - margins.bottom) }}      onPointerDown={startMargin("bottom")} title={`${t("settings.pd.margins")} ↓ ${margins.bottom}mm`} />
          <div className="pd-margin-handle pd-mh-left"   style={{ left: px(margins.left) }}                onPointerDown={startMargin("left")}   title={`${t("settings.pd.margins")} ← ${margins.left}mm`} />
          <div className="pd-margin-handle pd-mh-right"  style={{ left: px(page.w - margins.right) }}      onPointerDown={startMargin("right")}  title={`${t("settings.pd.margins")} → ${margins.right}mm`} />
          </>}

          {/* blocks with example content */}
          {blocks.map(key => {
            const b = design.blocks?.[key];
            if (b?.show === false) return null;
            const pos = blockPos(key);
            const pinned = b?.x != null || b?.y != null;
            const isSel = selected === key;
            return (
              <div
                key={key}
                className={`pd-block${isSel ? " selected" : ""}${pinned ? " pinned" : ""}`}
                style={{
                  left: px(pos.x), top: px(pos.y),
                  width: px(pos.w), height: px(pos.h),
                  cursor: editable ? (flow ? "pointer" : "grab") : "default",
                }}
                onPointerDown={editable ? startBlockMove(key) : undefined}
                title={editable ? (flow ? blockLabel(key) : t("settings.pd.dragHint")) : blockLabel(key)}
              >
                <span className="pd-block-tag">{blockLabel(key)}</span>
                <div className="pd-block-ex">{renderExample(key, pos.w)}</div>
                {editable && isSel && (
                  <>
                    {/* right (width) + bottom (height) + corner resize handles */}
                    <span className="pd-resize pd-resize-r"  onPointerDown={startBlockResize(key, "r")} />
                    {!flow && <span className="pd-resize pd-resize-b"  onPointerDown={startBlockResize(key, "b")} />}
                    {!flow && <span className="pd-resize pd-resize-br" onPointerDown={startBlockResize(key, "br")} />}
                  </>
                )}
              </div>
            );
          })}

          {/* logo */}
          {logoSrc && (
            <div
              className={`pd-logo-wrap${selected === "__logo" ? " selected" : ""}`}
              style={{ left: px(design.logoX ?? margins.left), top: px(design.logoY ?? margins.top), width: px(design.logoW ?? 30) }}
              onPointerDown={editable ? startLogoMove : undefined}
            >
              <img src={logoSrc} alt="logo" className="pd-logo-img" draggable={false} />
              {editable && selected === "__logo" && <span className="pd-resize pd-resize-br" onPointerDown={startLogoResize} />}
            </div>
          )}
        </div>

        {/* ── Controls (drag on the preview; these are helpers only) ── */}
        <div className="pd-controls">
          {!editable ? (
            <div className="pd-simple-note">
              <div className="pd-hint">{t("settings.pd.simpleNote")}</div>
              <button type="button" className="btn btn-primary" style={{ fontSize: 12, marginTop: 10 }}
                onClick={() => setDocMode("advanced")}>
                {t("settings.pd.customize")}
              </button>
            </div>
          ) : (<>
          <div className="pd-hint">{t(flow ? "settings.pd.flowHint" : "settings.pd.dragAllHint")}</div>

          {/* Document mode: blank paper vs pre-printed letterhead */}
          <div className="pd-ctl-title">{t("settings.pd.mode")}</div>
          <div className="pd-mode-row">
            <button type="button" className={`pd-mode-btn${!design.preprinted ? " active" : ""}`} onClick={() => setMode(false)}>
              <span className="pd-mode-name">{t("settings.pd.modeBlank")}</span>
              <span className="pd-mode-desc">{t("settings.pd.modeBlankHint")}</span>
            </button>
            <button type="button" className={`pd-mode-btn${design.preprinted ? " active" : ""}`} onClick={() => setMode(true)}>
              <span className="pd-mode-name">{t("settings.pd.modePreprinted")}</span>
              <span className="pd-mode-desc">{t("settings.pd.modePreprintedHint")}</span>
            </button>
          </div>

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

          {/* Margin readout (set by dragging the guides) */}
          <div className="pd-ctl-title">{t("settings.pd.margins")}</div>
          <div className="pd-margin-readout">
            <span>↑ {margins.top}mm</span>
            <span>↓ {margins.bottom}mm</span>
            <span>← {margins.left}mm</span>
            <span>→ {margins.right}mm</span>
          </div>
          <div className="pd-hint">{t("settings.pd.marginDragHint")}</div>

          {/* Blocks: show/hide + selection */}
          <div className="pd-ctl-title">{t("settings.pd.blocks")}</div>
          <div className="pd-block-list">
            {blocks.map(key => {
              const b = design.blocks?.[key];
              const shown = b?.show !== false;
              const resized = b?.x != null || b?.y != null || b?.w != null || b?.h != null;
              return (
                <div key={key} className={`pd-block-row${selected === key ? " selected" : ""}`} onClick={() => setSelected(key)}>
                  <input
                    type="checkbox"
                    checked={shown}
                    onChange={e => setBlock(key, { show: e.target.checked })}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="pd-block-row-label">{blockLabel(key)}</span>
                  {resized && (
                    <button
                      type="button"
                      className="pd-unpin"
                      title={t("settings.pd.unpin")}
                      onClick={(e) => { e.stopPropagation(); setBlock(key, { x: undefined, y: undefined, w: undefined, h: undefined }); }}
                    >
                      ⟲
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {selected && selected !== "__logo" && (
            <div className="pd-hint">{t("settings.pd.resizeHint", { block: blockLabel(selected) })}</div>
          )}

          {/* Logo */}
          <div className="pd-ctl-title">{t("settings.pd.logo")}</div>
          <div className="pd-logo-row">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} />
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>
              {design.logo ? t("settings.pd.logoReplace") : t("settings.pd.logoAdd")}
            </button>
            {design.logo && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12, color: "var(--coral)" }}
                onClick={() => setDesign({ logo: undefined, logoX: undefined, logoY: undefined, logoW: undefined })}
              >
                {t("common.delete")}
              </button>
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
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 10 }}
            onClick={() => setDocMode("simple")}>
            {t("settings.pd.backToSimple")}
          </button>
          </>)}
        </div>
      </div>
    </div>
  );
}
