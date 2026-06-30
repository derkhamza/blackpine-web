import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import type { WaTemplate, WaTemplateCategory } from "../lib/cabinetTypes";
import {
  WA_TEMPLATE_CATEGORY_LABELS,
  WA_TEMPLATE_CATEGORY_COLORS,
} from "../lib/cabinetTypes";

// ── Variable chips ─────────────────────────────────────────────────────────────

const CATS: WaTemplateCategory[] = ["rappel", "confirmation", "suivi", "resultats", "autre"];

// Sample values for live preview
function renderPreview(body: string): string {
  return body
    .replace(/\{patient\}/g, "Mme Fatima Benali")
    .replace(/\{date\}/g,    "lundi 15 janvier")
    .replace(/\{heure\}/g,   "10:30")
    .replace(/\{docteur\}/g, "Dr. Hassan Alami")
    .replace(/\{cabinet\}/g, "Cabinet Dr. Alami");
}

// ── Template form ──────────────────────────────────────────────────────────────

interface TplFormProps {
  initial?: Partial<WaTemplate>;
  onSave:   (tpl: Omit<WaTemplate, "id">) => void;
  onCancel: () => void;
}

function TplForm({ initial, onSave, onCancel }: TplFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name     ?? "");
  const [cat,  setCat]  = useState<WaTemplateCategory>(initial?.category ?? "rappel");
  const [body, setBody] = useState(initial?.body     ?? "");
  const [ta,   setTa]   = useState<HTMLTextAreaElement | null>(null);

  const VARS = [
    { key: "{patient}", label: t("messages.varPatientLabel"), desc: t("messages.varPatientDesc") },
    { key: "{date}",    label: t("messages.varDateLabel"),    desc: t("messages.varDateDesc")    },
    { key: "{heure}",   label: t("messages.varHeureLabel"),   desc: t("messages.varHeureDesc")   },
    { key: "{docteur}", label: t("messages.varDocteurLabel"), desc: t("messages.varDocteurDesc") },
    { key: "{cabinet}", label: t("messages.varCabinetLabel"), desc: t("messages.varCabinetDesc") },
  ];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    onSave({ name: name.trim(), category: cat, body: body.trim() });
  };

  const insertVar = (v: string) => {
    if (!ta) {
      setBody(prev => prev + v);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end   = ta.selectionEnd   ?? body.length;
    const next  = body.slice(0, start) + v + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + v.length, start + v.length);
    });
  };

  const catColor = WA_TEMPLATE_CATEGORY_COLORS[cat];

  return (
    <form className="msg-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">{t("messages.nameLabel")}</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t("messages.namePlaceholder")}
            required
          />
        </div>
        <div className="form-group" style={{ flex: "0 0 190px" }}>
          <label className="form-label">{t("messages.catLabel")}</label>
          <select
            className="form-input"
            value={cat}
            onChange={e => setCat(e.target.value as WaTemplateCategory)}
          >
            {CATS.map(c => (
              <option key={c} value={c}>{WA_TEMPLATE_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t("messages.bodyLabel")}</label>
        <div className="msg-var-chips">
          {VARS.map(v => (
            <button
              key={v.key}
              type="button"
              className="msg-var-chip"
              onClick={() => insertVar(v.key)}
              title={v.desc}
            >
              {v.label}
            </button>
          ))}
        </div>
        <textarea
          ref={node => setTa(node)}
          className="form-input msg-textarea"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={t("messages.bodyPlaceholder")}
          rows={6}
          required
        />
      </div>

      {body.trim() && (
        <div className="msg-preview-box">
          <div className="msg-preview-label">{t("messages.previewLabel")}</div>
          <div className="msg-preview-bubble">
            <svg width="16" height="16" viewBox="0 0 24 24" fill={catColor} style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
            <span>{renderPreview(body)}</span>
          </div>
        </div>
      )}

      <div className="modal-footer" style={{ padding: 0, marginTop: 20 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className="btn btn-primary">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function MessagesPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t } = useTranslation();
  const { waTemplates, addWaTemplate, updateWaTemplate, deleteWaTemplate } = useCabinet();

  const [activeCat, setActiveCat] = useState<WaTemplateCategory | "all">("all");
  const [editId,    setEditId]    = useState<string | "new" | null>(null);
  const [search,    setSearch]    = useState("");

  const filtered = waTemplates.filter(tpl =>
    (activeCat === "all" || tpl.category === activeCat) &&
    (search === "" ||
      tpl.name.toLowerCase().includes(search.toLowerCase()) ||
      tpl.body.toLowerCase().includes(search.toLowerCase()))
  );

  const editing = editId && editId !== "new"
    ? waTemplates.find(tpl => tpl.id === editId)
    : undefined;

  const catCounts = CATS.reduce((acc, c) => {
    acc[c] = waTemplates.filter(tpl => tpl.category === c).length;
    return acc;
  }, {} as Record<WaTemplateCategory, number>);

  const msgActions = (
    <button className="btn btn-primary" onClick={() => setEditId("new")}>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      {t("messages.newTpl")}
    </button>
  );

  const body = (
    <>
      {noLayout && <div className="inline-actions">{msgActions}</div>}
      <div className="msg-page">

        {/* ── Left: list ── */}
        <div className="msg-sidebar">

          {/* Search */}
          <div className="stock-search-wrap" style={{ marginBottom: 10 }}>
            <svg className="stock-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              className="stock-search-input"
              placeholder={t("messages.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
          <div className="msg-cat-pills">
            <button
              className={`msg-cat-pill${activeCat === "all" ? " active" : ""}`}
              onClick={() => setActiveCat("all")}
            >
              {t("messages.catAll")}
              <span className="stock-pill-count">{waTemplates.length}</span>
            </button>
            {CATS.map(c => {
              if (!catCounts[c]) return null;
              return (
                <button
                  key={c}
                  className={`msg-cat-pill${activeCat === c ? " active" : ""}`}
                  onClick={() => setActiveCat(c)}
                  style={activeCat === c ? { borderColor: WA_TEMPLATE_CATEGORY_COLORS[c], color: WA_TEMPLATE_CATEGORY_COLORS[c] } : {}}
                >
                  {WA_TEMPLATE_CATEGORY_LABELS[c]}
                  <span className="stock-pill-count">{catCounts[c]}</span>
                </button>
              );
            })}
          </div>

          {/* Template list */}
          <div className="msg-tpl-list">
            {filtered.length === 0 ? (
              <div className="msg-tpl-empty">
                {search ? t("messages.emptySearch") : t("messages.emptyList")}
              </div>
            ) : (
              filtered.map(tpl => (
                <div
                  key={tpl.id}
                  className={`msg-tpl-row${editId === tpl.id ? " active" : ""}`}
                  onClick={() => setEditId(tpl.id)}
                >
                  <div
                    className="msg-tpl-accent"
                    style={{ background: WA_TEMPLATE_CATEGORY_COLORS[tpl.category] }}
                  />
                  <div className="msg-tpl-content">
                    <div className="msg-tpl-header">
                      <span className="msg-tpl-name">{tpl.name}</span>
                      <span
                        className="msg-tpl-cat"
                        style={{
                          background: WA_TEMPLATE_CATEGORY_COLORS[tpl.category] + "22",
                          color: WA_TEMPLATE_CATEGORY_COLORS[tpl.category],
                        }}
                      >
                        {WA_TEMPLATE_CATEGORY_LABELS[tpl.category]}
                      </span>
                    </div>
                    <div className="msg-tpl-body">{tpl.body}</div>
                  </div>
                  <div className="msg-tpl-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="msg-tpl-btn"
                      title={t("messages.editTitle")}
                      onClick={() => setEditId(tpl.id)}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className="msg-tpl-btn danger"
                      title={t("messages.deleteTitle")}
                      onClick={() => {
                        if (confirm(t("messages.deleteConfirm", { name: tpl.name }))) {
                          deleteWaTemplate(tpl.id);
                          if (editId === tpl.id) setEditId(null);
                        }
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: editor ── */}
        <div className="msg-editor">
          {editId === "new" ? (
            <>
              <div className="msg-editor-title">{t("messages.editorNew")}</div>
              <TplForm
                onSave={tpl => { addWaTemplate(tpl); setEditId(null); }}
                onCancel={() => setEditId(null)}
              />
            </>
          ) : editId && editing ? (
            <>
              <div className="msg-editor-title">{t("messages.editorEdit")}</div>
              <TplForm
                key={editId}
                initial={editing}
                onSave={tpl => { updateWaTemplate({ ...editing, ...tpl }); setEditId(null); }}
                onCancel={() => setEditId(null)}
              />
            </>
          ) : (
            <div className="msg-editor-empty">
              <div className="msg-editor-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" fill="currentColor" opacity="0.12"/>
                </svg>
              </div>
              <div className="msg-editor-empty-title">{t("messages.emptyEditorTitle")}</div>
              <div className="msg-editor-empty-sub">
                {t("messages.emptyEditorSub")}<br/>
                <code className="msg-var-code">{"{patient}"}</code>&nbsp;
                <code className="msg-var-code">{"{date}"}</code>&nbsp;
                <code className="msg-var-code">{"{heure}"}</code>&nbsp;
                <code className="msg-var-code">{"{docteur}"}</code>&nbsp;
                <code className="msg-var-code">{"{cabinet}"}</code>
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 20 }}
                onClick={() => setEditId("new")}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                {t("messages.createFirst")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
  if (noLayout) return body;
  return (
    <Layout
      title={t("messages.title")}
      subtitle={t("messages.subtitle", { n: waTemplates.length, s: waTemplates.length !== 1 ? "s" : "" })}
      actions={msgActions}
    >
      {body}
    </Layout>
  );
}
