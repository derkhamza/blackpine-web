import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useCabinet } from "../context/CabinetContext";
import { formatMAD, formatDateShort } from "../lib/format";
import {
  APPT_TYPE_LABELS, APPT_STATUS_LABELS,
  EXAM_TYPE_LABELS, CERT_TYPE_LABELS,
} from "../lib/cabinetTypes";

// ── Result types ───────────────────────────────────────────────────────────────

type ResultKind = "patient" | "appointment" | "transaction" | "exam" | "prescription" | "certificate" | "note";

interface SearchResult {
  id:       string;
  kind:     ResultKind;
  title:    string;
  subtitle: string;
  path:     string;
  accent:   string;  // colour dot
}

const KIND_ICON: Record<ResultKind, string> = {
  patient:      "👤",
  appointment:  "📅",
  transaction:  "💰",
  exam:         "🔬",
  prescription: "℞",
  certificate:  "📄",
  note:         "📝",
};

const KIND_LABEL: Record<ResultKind, string> = {
  patient:      "Patients",
  appointment:  "Rendez-vous",
  transaction:  "Transactions",
  exam:         "Examens & Bio",
  prescription: "Ordonnances",
  certificate:  "Certificats",
  note:         "Notes & Tâches",
};

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate();
  const { transactions, fiscalYear } = useApp();
  const {
    patients, appointments,
    examResults, prescriptions, certificates, notes,
  } = useCabinet();

  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape (also handled in keydown, but belt-and-suspenders)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Search
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchResult[] = [];

    // ── Patients ─────────────────────────────────────────────────────────
    for (const p of patients) {
      const full = `${p.firstName} ${p.lastName}`.toLowerCase();
      if (
        full.includes(q) ||
        p.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        p.cin?.toLowerCase().includes(q) ||
        p.cnopsNumber?.toLowerCase().includes(q)
      ) {
        const meta = [p.phone, p.dateOfBirth ? `Né(e) le ${formatDateShort(p.dateOfBirth)}` : ""]
          .filter(Boolean).join(" · ");
        out.push({
          id:       p.id,
          kind:     "patient",
          title:    `${p.firstName} ${p.lastName}`,
          subtitle: meta || "Aucune info supplémentaire",
          path:     `/patients/${p.id}`,
          accent:   "var(--blue)",
        });
        if (out.filter(r => r.kind === "patient").length >= 5) break;
      }
    }

    // ── Appointments (last 300, sorted desc) ─────────────────────────────
    const sortedAppts = [...appointments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300);
    for (const a of sortedAppts) {
      if (
        a.patientName.toLowerCase().includes(q) ||
        a.date.includes(q) ||
        a.notes?.toLowerCase().includes(q) ||
        a.consultationNote?.motif?.toLowerCase().includes(q) ||
        a.consultationNote?.diagnosis?.toLowerCase().includes(q)
      ) {
        out.push({
          id:       a.id,
          kind:     "appointment",
          title:    a.patientName,
          subtitle: `${formatDateShort(a.date)} · ${APPT_TYPE_LABELS[a.type]} · ${APPT_STATUS_LABELS[a.status]}`,
          path:     `/agenda/${a.id}`,
          accent:   "var(--gold)",
        });
        if (out.filter(r => r.kind === "appointment").length >= 5) break;
      }
    }

    // ── Transactions (current fiscal year) ───────────────────────────────
    const yearTx = transactions.filter(t => t.date.startsWith(String(fiscalYear)));
    for (const t of yearTx) {
      const desc = (t.description ?? "").toLowerCase();
      const notes = ((t as { notes?: string }).notes ?? "").toLowerCase();
      if (
        desc.includes(q) ||
        notes.includes(q) ||
        t.amount.toString().includes(q) ||
        t.category.toLowerCase().includes(q)
      ) {
        out.push({
          id:       t.id,
          kind:     "transaction",
          title:    t.description ?? (t.type === "RECETTE" ? "Recette" : "Charge"),
          subtitle: `${t.type === "RECETTE" ? "+" : "−"} ${formatMAD(t.amount)} · ${formatDateShort(t.date)}`,
          path:     `/transactions`,
          accent:   t.type === "RECETTE" ? "var(--green)" : "var(--coral)",
        });
        if (out.filter(r => r.kind === "transaction").length >= 5) break;
      }
    }

    // ── Exams ────────────────────────────────────────────────────────────
    for (const e of examResults) {
      if (
        e.title.toLowerCase().includes(q) ||
        e.patientName.toLowerCase().includes(q) ||
        e.labName?.toLowerCase().includes(q) ||
        EXAM_TYPE_LABELS[e.type].toLowerCase().includes(q) ||
        e.values.some(v => v.label.toLowerCase().includes(q))
      ) {
        out.push({
          id:       e.id,
          kind:     "exam",
          title:    e.title,
          subtitle: `${e.patientName} · ${EXAM_TYPE_LABELS[e.type]} · ${formatDateShort(e.date)}${e.labName ? ` · ${e.labName}` : ""}`,
          path:     e.patientId ? `/patients/${e.patientId}` : `/examens`,
          accent:   "#9B72D0",
        });
        if (out.filter(r => r.kind === "exam").length >= 4) break;
      }
    }

    // ── Standalone prescriptions ─────────────────────────────────────────
    for (const p of prescriptions) {
      const drugs = p.lines.map(l => l.drug.toLowerCase()).join(" ");
      if (
        p.patientName.toLowerCase().includes(q) ||
        drugs.includes(q) ||
        p.notes?.toLowerCase().includes(q)
      ) {
        const firstDrug = p.lines[0]?.drug ?? "";
        out.push({
          id:       p.id,
          kind:     "prescription",
          title:    `Ordonnance — ${p.patientName}`,
          subtitle: `${formatDateShort(p.date)}${firstDrug ? ` · ${firstDrug}${p.lines.length > 1 ? ` +${p.lines.length - 1}` : ""}` : ""}`,
          path:     p.patientId ? `/patients/${p.patientId}` : `/documents`,
          accent:   "#15A876",
        });
        if (out.filter(r => r.kind === "prescription").length >= 4) break;
      }
    }

    // ── Standalone certificates ──────────────────────────────────────────
    for (const c of certificates) {
      if (
        c.patientName.toLowerCase().includes(q) ||
        CERT_TYPE_LABELS[c.type].toLowerCase().includes(q) ||
        c.content?.toLowerCase().includes(q) ||
        c.reason?.toLowerCase().includes(q) ||
        c.specialist?.toLowerCase().includes(q)
      ) {
        out.push({
          id:       c.id,
          kind:     "certificate",
          title:    `${CERT_TYPE_LABELS[c.type]} — ${c.patientName}`,
          subtitle: formatDateShort(c.date) + (c.content ? ` · ${c.content.slice(0, 50)}` : c.reason ? ` · ${c.reason.slice(0, 50)}` : ""),
          path:     c.patientId ? `/patients/${c.patientId}` : `/documents`,
          accent:   "#1890C5",
        });
        if (out.filter(r => r.kind === "certificate").length >= 4) break;
      }
    }

    // ── Notes & tasks ────────────────────────────────────────────────────
    for (const n of notes) {
      if (
        n.title.toLowerCase().includes(q) ||
        n.body?.toLowerCase().includes(q)
      ) {
        out.push({
          id:       n.id,
          kind:     "note",
          title:    n.title,
          subtitle: `${n.type === "task" ? "Tâche" : "Note"}${n.isDone ? " · Terminé" : ""}${n.dueDate ? ` · Échéance ${formatDateShort(n.dueDate)}` : ""}`,
          path:     `/notes`,
          accent:   "#D4962A",
        });
        if (out.filter(r => r.kind === "note").length >= 4) break;
      }
    }

    return out;
  }, [query, patients, appointments, transactions, fiscalYear,
      examResults, prescriptions, certificates, notes]);

  // Reset selected when results change
  useEffect(() => { setSelected(0); }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selected]) { navigate(results[selected].path); onClose(); }
    }
  };

  // Group results by kind for headers
  const groups = useMemo(() => {
    const seen = new Set<ResultKind>();
    return results.map((r, i) => {
      const showHeader = !seen.has(r.kind);
      seen.add(r.kind);
      return { result: r, index: i, showHeader };
    });
  }, [results]);

  return (
    <div
      className="cmd-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Recherche rapide"
    >
      <div className="cmd-palette">
        {/* Search input */}
        <div className="cmd-search-row">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="cmd-search-icon">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className="cmd-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher patients, RDV, examens, ordonnances, notes…"
            spellCheck={false}
            autoComplete="off"
          />
          {query && (
            <button className="cmd-clear" onClick={() => setQuery("")} title="Effacer">×</button>
          )}
          <kbd className="cmd-esc" onClick={onClose}>Esc</kbd>
        </div>

        {/* Results */}
        {query.length < 2 ? (
          <div className="cmd-empty">
            <div className="cmd-shortcuts">
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">👤</span> Patients</div>
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">📅</span> Rendez-vous</div>
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">🔬</span> Examens</div>
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">℞</span> Ordonnances</div>
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">📄</span> Certificats</div>
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">📝</span> Notes</div>
              <div className="cmd-shortcut-item"><span className="cmd-shortcut-icon">💰</span> Transactions</div>
            </div>
            <div className="cmd-hint-text">Tapez au moins 2 caractères pour rechercher</div>
          </div>
        ) : groups.length === 0 ? (
          <div className="cmd-empty">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Aucun résultat</div>
            <div className="cmd-hint-text">Aucun résultat pour « {query} »</div>
          </div>
        ) : (
          <div className="cmd-results" role="listbox">
            {groups.map(({ result: r, index: i, showHeader }) => (
              <div key={r.id + r.kind}>
                {showHeader && (
                  <div className="cmd-group-header">{KIND_LABEL[r.kind]}</div>
                )}
                <button
                  className={`cmd-result${i === selected ? " active" : ""}`}
                  onClick={() => { navigate(r.path); onClose(); }}
                  onMouseEnter={() => setSelected(i)}
                  role="option"
                  aria-selected={i === selected}
                >
                  <span className="cmd-result-dot" style={{ background: r.accent }} />
                  <span className="cmd-result-icon">{KIND_ICON[r.kind]}</span>
                  <div className="cmd-result-text">
                    <div className="cmd-result-title">{r.title}</div>
                    <div className="cmd-result-sub">{r.subtitle}</div>
                  </div>
                  {i === selected && (
                    <span className="cmd-result-enter" aria-hidden>↵</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="cmd-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Esc</kbd> fermer</span>
          <span style={{ marginLeft: "auto", opacity: 0.5 }}>
            {results.length > 0 ? `${results.length} résultat${results.length > 1 ? "s" : ""}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
