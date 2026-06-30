import { useTranslation } from "react-i18next";

// ── Keyboard shortcuts help overlay ──────────────────────────────────────────

function Key({ label }: { label: string }) {
  return <kbd className="shortcut-key">{label}</kbd>;
}

interface Props { onClose: () => void; }

export function ShortcutsModal({ onClose }: Props) {
  const { t } = useTranslation();

  const GROUPS = [
    {
      title: t("shortcuts.navGroupTitle"),
      shortcuts: [
        { keys: ["G", "D"], description: t("shortcuts.navDashboard") },
        { keys: ["G", "A"], description: t("shortcuts.navAgenda") },
        { keys: ["G", "P"], description: t("shortcuts.navPatients") },
        { keys: ["G", "W"], description: t("shortcuts.navWaiting") },
        { keys: ["G", "R"], description: t("shortcuts.navFollowups") },
        { keys: ["G", "F"], description: t("shortcuts.navFactures") },
        { keys: ["G", "S"], description: t("shortcuts.navStock") },
        { keys: ["G", "M"], description: t("shortcuts.navMessages") },
        { keys: ["G", "T"], description: t("shortcuts.navTeleconsult") },
        { keys: ["G", "N"], description: t("shortcuts.navNotes") },
        { keys: ["G", "V"], description: t("shortcuts.navFournisseurs") },
        { keys: ["G", "E"], description: t("shortcuts.navExamens") },
        { keys: ["G", "O"], description: t("shortcuts.navOrdonnances") },
        { keys: ["G", "C"], description: t("shortcuts.navCertificats") },
      ],
    },
    {
      title: t("shortcuts.uiGroupTitle"),
      shortcuts: [
        { keys: ["Ctrl", "K"], description: t("shortcuts.cmdPalette") },
        { keys: ["?"],         description: t("shortcuts.showHide") },
        { keys: ["Esc"],       description: t("shortcuts.closePanel") },
      ],
    },
  ];

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shortcuts-modal">
        <div className="shortcuts-header">
          <div className="shortcuts-title">{t("shortcuts.title")}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="shortcuts-body">
          {GROUPS.map(group => (
            <div key={group.title} className="shortcuts-group">
              <div className="shortcuts-group-title">{group.title}</div>
              {group.shortcuts.map(({ keys, description }) => (
                <div key={description} className="shortcut-row">
                  <div className="shortcut-keys">
                    {keys.map((k, i) => (
                      <span key={k}>
                        <Key label={k} />
                        {i < keys.length - 1 && (
                          <span className="shortcut-then">{t("shortcuts.then")}</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="shortcut-desc">{description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          {(() => {
            const parts = t("shortcuts.footer", { key: "§§§" }).split("§§§");
            return <>{parts[0]}<Key label="?" />{parts[1]}</>;
          })()}
        </div>
      </div>
    </div>
  );
}
