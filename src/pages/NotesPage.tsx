import { FormEvent, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";
import type { InternalNote, NoteColor } from "../lib/cabinetTypes";
import { NOTE_COLOR_VALUES } from "../lib/cabinetTypes";

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLORS: NoteColor[] = ["yellow", "blue", "green", "pink"];
const COLOR_LABELS: Record<NoteColor, string> = {
  yellow: "Jaune", blue: "Bleu", green: "Vert", pink: "Rose",
};

function relativeDate(iso: string): string {
  const d  = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff <   60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "Hier";
  if (days  <  7) return `Il y a ${days} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function dueDateLabel(due: string, isDone: boolean): { text: string; color: string } {
  if (isDone) return { text: "Terminée", color: "var(--muted)" };
  const today = todayIso();
  if (due < today)  return { text: `En retard · ${new Date(due + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`, color: "var(--coral)" };
  if (due === today) return { text: "Aujourd'hui", color: "var(--blue)" };
  const diff = Math.ceil((new Date(due + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
  if (diff <= 3) return { text: `Dans ${diff} jour${diff > 1 ? "s" : ""}`, color: "var(--gold)" };
  return { text: new Date(due + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), color: "var(--muted)" };
}

// ── Note form modal ────────────────────────────────────────────────────────────

interface NoteFormProps {
  initial?: Partial<InternalNote>;
  onSave:   (n: Omit<InternalNote, "id" | "createdAt" | "updatedAt">) => void;
  onClose:  () => void;
}

function NoteFormModal({ initial, onSave, onClose }: NoteFormProps) {
  const [type,    setType]    = useState<"note" | "task">(initial?.type    ?? "note");
  const [title,   setTitle]   = useState(initial?.title   ?? "");
  const [body,    setBody]    = useState(initial?.body    ?? "");
  const [color,   setColor]   = useState<NoteColor>(initial?.color ?? "yellow");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [isPinned, setPin]    = useState(initial?.isPinned ?? false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      type,
      title: title.trim(),
      body:    type === "note" ? (body.trim() || undefined) : undefined,
      color,
      isPinned,
      isDone:  initial?.isDone ?? false,
      dueDate: type === "task" && dueDate ? dueDate : undefined,
    });
  };

  const isEdit = !!initial?.id;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? "Modifier" : "Nouvelle"} {type === "task" ? "tâche" : "note"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Type toggle */}
            <div className="note-type-toggle">
              <button
                type="button"
                className={`note-type-btn${type === "note" ? " active" : ""}`}
                onClick={() => setType("note")}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M3.5 5h7M3.5 7.5h7M3.5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Note
              </button>
              <button
                type="button"
                className={`note-type-btn${type === "task" ? " active" : ""}`}
                onClick={() => setType("task")}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4 7l2.5 2.5L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Tâche
              </button>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Titre *</label>
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={type === "task" ? "Ex : Commander des gants…" : "Ex : Rappel important…"}
                autoFocus
                required
              />
            </div>

            {/* Body (notes only) */}
            {type === "note" && (
              <div className="form-group">
                <label className="form-label">Contenu</label>
                <textarea
                  className="form-input"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={5}
                  placeholder="Contenu de la note…"
                />
              </div>
            )}

            {/* Due date (tasks only) */}
            {type === "task" && (
              <div className="form-group">
                <label className="form-label">Date limite</label>
                <input
                  className="form-input"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            )}

            {/* Color + pin */}
            <div className="form-row" style={{ alignItems: "center" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Couleur</label>
                <div className="note-color-picker">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`note-color-swatch${color === c ? " active" : ""}`}
                      style={{
                        background: NOTE_COLOR_VALUES[c].bg,
                        borderColor: NOTE_COLOR_VALUES[c].border,
                      }}
                      title={COLOR_LABELS[c]}
                      onClick={() => setColor(c)}
                    >
                      {color === c && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke={NOTE_COLOR_VALUES[c].text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ flex: "0 0 auto", alignSelf: "flex-end", paddingBottom: 2 }}>
                <label className="note-pin-toggle">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={e => setPin(e.target.checked)}
                  />
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M9 1L5 5l-3 1 6 6 1-3 4-4L9 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M5 9L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Épingler
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: NOTE_COLOR_VALUES[color].border, color: NOTE_COLOR_VALUES[color].text }}
            >
              {isEdit ? "Enregistrer" : type === "task" ? "Créer la tâche" : "Créer la note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Note card ──────────────────────────────────────────────────────────────────

function NoteCard({
  note, onEdit, onDelete, onTogglePin, onToggleDone,
}: {
  note: InternalNote;
  onEdit:       () => void;
  onDelete:     () => void;
  onTogglePin:  () => void;
  onToggleDone: () => void;
}) {
  const cv = NOTE_COLOR_VALUES[note.color];
  const isTask = note.type === "task";
  const dueInfo = note.dueDate ? dueDateLabel(note.dueDate, note.isDone) : null;

  return (
    <div
      className={`note-card${note.isDone ? " note-done" : ""}${note.isPinned ? " note-pinned" : ""}`}
      style={{ background: cv.bg, borderColor: cv.border }}
    >
      {/* Pin indicator */}
      {note.isPinned && (
        <div className="note-pin-flag" style={{ color: cv.text }}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor">
            <path d="M9 1L5 5l-3 1 6 6 1-3 4-4L9 1Z"/>
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="note-card-header">
        {isTask && (
          <button
            className={`note-task-check${note.isDone ? " checked" : ""}`}
            style={{ borderColor: cv.border, background: note.isDone ? cv.border : "transparent" }}
            onClick={onToggleDone}
            title={note.isDone ? "Marquer non terminée" : "Marquer terminée"}
          >
            {note.isDone && (
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
        <div className="note-card-title" style={{ color: cv.text }}>{note.title}</div>
      </div>

      {/* Body */}
      {note.body && (
        <div className="note-card-body" style={{ color: cv.text }}>{note.body}</div>
      )}

      {/* Due date */}
      {dueInfo && (
        <div className="note-due-badge" style={{ color: dueInfo.color }}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7 4.5V7l2 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {dueInfo.text}
        </div>
      )}

      {/* Footer */}
      <div className="note-card-footer" style={{ color: cv.text + "99" }}>
        <span className="note-card-date">{relativeDate(note.updatedAt)}</span>
        <div className="note-card-actions">
          <button
            className="note-action-btn"
            style={{ color: cv.text }}
            title={note.isPinned ? "Désépingler" : "Épingler"}
            onClick={onTogglePin}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill={note.isPinned ? "currentColor" : "none"}>
              <path d="M9 1L5 5l-3 1 6 6 1-3 4-4L9 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M5 9L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className="note-action-btn"
            style={{ color: cv.text }}
            title="Modifier"
            onClick={onEdit}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5a1.5 1.5 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="note-action-btn danger"
            style={{ color: cv.text }}
            title="Supprimer"
            onClick={onDelete}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M4 3V2h4v1M3.5 3v8h5V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type TabView = "all" | "notes" | "tasks" | "pinned";

export function NotesPage() {
  const today = todayIso();
  const { notes, addNote, updateNote, deleteNote, toggleNotePin, toggleNoteDone } = useCabinet();
  const [tab,    setTab]    = useState<TabView>("all");
  const [modal,  setModal]  = useState<{ note?: InternalNote } | null>(null);
  const [search, setSearch] = useState("");
  const [toast,  setToast]  = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const kpi = useMemo(() => ({
    total:    notes.length,
    notesCnt: notes.filter(n => n.type === "note").length,
    tasksCnt: notes.filter(n => n.type === "task").length,
    pinned:   notes.filter(n => n.isPinned).length,
    overdue:  notes.filter(n =>
      n.type === "task" && !n.isDone && n.dueDate && n.dueDate < today
    ).length,
    todayDue: notes.filter(n =>
      n.type === "task" && !n.isDone && n.dueDate === today
    ).length,
  }), [notes, today]);

  const filtered = useMemo(() => {
    let items = notes;
    if (tab === "notes")  items = items.filter(n => n.type === "note");
    if (tab === "tasks")  items = items.filter(n => n.type === "task");
    if (tab === "pinned") items = items.filter(n => n.isPinned);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.body ?? "").toLowerCase().includes(q)
      );
    }
    // Sort: pinned first, then by updatedAt desc
    return [...items].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [notes, tab, search]);

  // Tasks summary: overdue + today
  const urgentTasks = useMemo(() =>
    notes.filter(n =>
      n.type === "task" && !n.isDone &&
      n.dueDate && (n.dueDate <= today)
    ).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [notes, today]);

  return (
    <Layout
      title="Notes & Tâches"
      subtitle={`${kpi.total} élément${kpi.total !== 1 ? "s" : ""}`}
      actions={
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nouveau
        </button>
      }
    >
      {/* ── KPI strip ── */}
      <div className="note-kpi-strip">
        <div className="note-kpi-card">
          <div className="note-kpi-val">{kpi.notesCnt}</div>
          <div className="note-kpi-lbl">Notes</div>
        </div>
        <div className="note-kpi-card">
          <div className="note-kpi-val" style={{ color: "var(--blue)" }}>{kpi.tasksCnt}</div>
          <div className="note-kpi-lbl">Tâches</div>
        </div>
        <div className="note-kpi-card">
          <div className="note-kpi-val" style={{ color: "var(--gold)" }}>{kpi.pinned}</div>
          <div className="note-kpi-lbl">Épinglées</div>
        </div>
        <div className="note-kpi-card">
          <div className="note-kpi-val" style={{ color: kpi.overdue > 0 ? "var(--coral)" : "var(--muted)" }}>
            {kpi.overdue + kpi.todayDue}
          </div>
          <div className="note-kpi-lbl">Urgentes</div>
        </div>
      </div>

      {/* ── Urgent tasks alert ── */}
      {urgentTasks.length > 0 && (
        <div className="note-alert-bar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="var(--coral)" strokeWidth="1.4"/>
            <path d="M7 4v3M7 9.5v.5" stroke="var(--coral)" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>
            {urgentTasks.length} tâche{urgentTasks.length > 1 ? "s" : ""} en retard ou à faire aujourd'hui :
            {" "}
            <strong>{urgentTasks.map(t => t.title).join(" · ")}</strong>
          </span>
        </div>
      )}

      {/* ── Tabs + search ── */}
      <div className="note-toolbar">
        <div className="note-tabs">
          {([
            ["all",    "Tout",    kpi.total],
            ["notes",  "Notes",   kpi.notesCnt],
            ["tasks",  "Tâches",  kpi.tasksCnt],
            ["pinned", "Épinglées", kpi.pinned],
          ] as [TabView, string, number][]).map(([id, label, cnt]) => (
            <button
              key={id}
              className={`note-tab${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
              <span className="stock-pill-count">{cnt}</span>
            </button>
          ))}
        </div>
        <div className="stock-search-wrap">
          <svg className="stock-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="stock-search-input"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Notes grid ── */}
      {filtered.length === 0 ? (
        <div className="agenda-empty" style={{ marginTop: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {notes.length === 0 ? "Aucune note ni tâche" : "Aucun résultat"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            {notes.length === 0
              ? "Créez des notes et des tâches pour votre équipe."
              : "Essayez d'ajuster les filtres."}
          </div>
          {notes.length === 0 && (
            <button className="btn btn-primary" onClick={() => setModal({})}>Créer</button>
          )}
        </div>
      ) : (
        <div className="note-grid">
          {filtered.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => setModal({ note })}
              onDelete={() => {
                if (confirm(`Supprimer "${note.title}" ?`)) {
                  deleteNote(note.id);
                  showToast("Supprimé");
                }
              }}
              onTogglePin={() => {
                toggleNotePin(note.id);
                showToast(note.isPinned ? "Désépinglé" : "Épinglé");
              }}
              onToggleDone={() => toggleNoteDone(note.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal !== null && (
        <NoteFormModal
          initial={modal.note}
          onSave={n => {
            if (modal.note) {
              updateNote({ ...modal.note, ...n });
              showToast("Modifié");
            } else {
              addNote(n);
              showToast(n.type === "task" ? "Tâche créée" : "Note créée");
            }
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
