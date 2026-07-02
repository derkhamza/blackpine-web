import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ACTE_CATALOG, type ActeCatalogItem } from "../lib/acteCatalog";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface Props {
  // Labels already in the doctor's list (lowercased) so we can mark them added.
  existingLabels: Set<string>;
  onAdd:   (item: ActeCatalogItem) => void;
  onClose: () => void;
}

export function ActeCatalogModal({ existingLabels, onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = norm(q.trim());
    if (!needle) return ACTE_CATALOG;
    return ACTE_CATALOG
      .map(g => ({ ...g, items: g.items.filter(it => norm(it.label).includes(needle) || norm(it.code).includes(needle)) }))
      .filter(g => g.items.length > 0);
  }, [q]);

  // Portal to <body>: ancestors with entrance-animation transforms (settings
  // sections) become containing blocks for position:fixed, which would trap
  // the overlay inline inside the section instead of covering the viewport.
  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <h2 className="modal-title">{t("acteCatalog.title")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ overflowY: "auto" }}>
          <div className="acte-cat-hint">{t("acteCatalog.hint")}</div>
          <input
            className="form-input"
            style={{ marginBottom: 12 }}
            placeholder={t("acteCatalog.search")}
            value={q}
            autoFocus
            onChange={e => setQ(e.target.value)}
          />
          {groups.length === 0 && (
            <div className="tx-empty" style={{ padding: 24 }}>{t("acteCatalog.noMatch")}</div>
          )}
          {groups.map(g => (
            <div key={g.specialty} className="acte-cat-group">
              <div className="acte-cat-group-title">{g.specialty}</div>
              {g.items.map((it, i) => {
                const added = existingLabels.has(norm(it.label));
                return (
                  <div className="acte-cat-row" key={`${it.code}-${it.label}-${i}`}>
                    <span className="acte-cat-code">{it.code}</span>
                    <span className="acte-cat-label">{it.label}</span>
                    <button
                      type="button"
                      className="acte-cat-add"
                      disabled={added}
                      onClick={() => onAdd(it)}
                    >
                      {added ? t("acteCatalog.added") : t("common.add")}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>{t("acteCatalog.done")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
