// ── Keyboard shortcuts help overlay ──────────────────────────────────────────

interface Shortcut {
  keys:        string[];
  description: string;
}

interface Group {
  title:     string;
  shortcuts: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Navigation (appuyez G, puis la lettre)",
    shortcuts: [
      { keys: ["G", "D"], description: "Tableau de bord" },
      { keys: ["G", "A"], description: "Agenda" },
      { keys: ["G", "P"], description: "Patients" },
      { keys: ["G", "W"], description: "Salle d'attente" },
      { keys: ["G", "R"], description: "Rappels & Suivis" },
      { keys: ["G", "F"], description: "Factures" },
      { keys: ["G", "S"], description: "Stocks" },
      { keys: ["G", "M"], description: "Messages WhatsApp" },
      { keys: ["G", "T"], description: "Téléconsultation" },
      { keys: ["G", "N"], description: "Notes & Tâches" },
    ],
  },
  {
    title: "Recherche & Interface",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Palette de commandes (recherche globale)" },
      { keys: ["?"],          description: "Afficher / masquer ce panneau" },
      { keys: ["Échap"],      description: "Fermer le panneau ouvert" },
    ],
  },
];

function Key({ label }: { label: string }) {
  return <kbd className="shortcut-key">{label}</kbd>;
}

interface Props { onClose: () => void; }

export function ShortcutsModal({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shortcuts-modal">
        <div className="shortcuts-header">
          <div className="shortcuts-title">Raccourcis clavier</div>
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
                          <span className="shortcut-then">puis</span>
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
          Appuyez sur <Key label="?" /> n'importe quand pour afficher ce panneau
        </div>
      </div>
    </div>
  );
}
