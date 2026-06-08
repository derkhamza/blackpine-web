import { useEffect, useRef, useState } from "react";
import { ICD10, ICD10_CHAPTERS, CHAPTER_COLORS, searchIcd10 } from "../lib/icd10";
import type { Icd10Chapter, Icd10Entry } from "../lib/icd10";

interface Props {
  onSelect: (entry: Icd10Entry) => void;
  onClose:  () => void;
}

export function Icd10Picker({ onSelect, onClose }: Props) {
  const [query,   setQuery]   = useState("");
  const [chapter, setChapter] = useState<Icd10Chapter | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const results = searchIcd10(query, chapter).slice(0, 80);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal icd10-modal">
        <div className="modal-header">
          <h2 className="modal-title">🔬 CIM-10 — Sélectionner un diagnostic</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="icd10-search-row">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: "var(--muted)" }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className="icd10-search-input"
            type="text"
            placeholder="Rechercher par code ou description… (ex: J45, asthme, K21)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="icd10-clear-btn" onClick={() => setQuery("")}>×</button>
          )}
        </div>

        {/* Chapter filter */}
        <div className="icd10-chapter-row">
          <button
            className={`icd10-chapter-btn${!chapter ? " active" : ""}`}
            onClick={() => setChapter(undefined)}
          >
            Tous
          </button>
          {(Object.keys(ICD10_CHAPTERS) as Icd10Chapter[]).map((ch) => (
            <button
              key={ch}
              className={`icd10-chapter-btn${chapter === ch ? " active" : ""}`}
              style={chapter === ch ? { background: CHAPTER_COLORS[ch] + "22", borderColor: CHAPTER_COLORS[ch], color: CHAPTER_COLORS[ch] } : {}}
              onClick={() => setChapter(prev => prev === ch ? undefined : ch)}
            >
              {ICD10_CHAPTERS[ch]}
            </button>
          ))}
        </div>

        {/* Results list */}
        <div className="icd10-results">
          {results.length === 0 ? (
            <div className="icd10-empty">
              Aucun code trouvé pour « {query} »
            </div>
          ) : (
            results.map((entry) => (
              <button
                key={entry.code}
                className="icd10-result-row"
                onClick={() => { onSelect(entry); onClose(); }}
              >
                <span
                  className="icd10-code"
                  style={{ color: CHAPTER_COLORS[entry.chapter] }}
                >
                  {entry.code}
                </span>
                <span className="icd10-desc">{entry.desc}</span>
                <span
                  className="icd10-chapter-badge"
                  style={{ background: CHAPTER_COLORS[entry.chapter] + "18", color: CHAPTER_COLORS[entry.chapter] }}
                >
                  {ICD10_CHAPTERS[entry.chapter]}
                </span>
              </button>
            ))
          )}
          {results.length === 80 && (
            <div className="icd10-truncate-hint">
              Affichage limité à 80 résultats — affinez votre recherche.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
