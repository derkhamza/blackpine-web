// In-app changelog / release notes. Each end-of-day deploy adds an entry here so
// the update is visible to users inside the app (a "Nouveautés" panel shows the
// latest entry once after an update, and the sidebar version chip reopens it).
//
// Entries are written in French — the working language of the practice, matching
// the always-French printed documents. Keep each entry SHORT and focused on
// selling points / high-value gains only — the few things a doctor or secretary
// actually cares about, in plain language. Not an exhaustive or technical list:
// aim for 3–5 punchy bullets, drop fixes and internal changes. Newest FIRST.

export interface Release {
  version: string;   // matches package.json / __APP_VERSION__
  date:    string;   // YYYY-MM-DD
  title:   string;   // one-line headline
  items:   string[]; // plain-language bullet points
}

export const CHANGELOG: Release[] = [
  {
    version: "1.18.0",
    date:    "2026-07-13",
    title:   "Renouvellement d'ordonnance en un clic",
    items: [
      "Patient qui revient pour renouveler ? L'app propose sa dernière ordonnance — un clic sur « Renouveler » la reprend, depuis la consultation comme depuis Documents.",
      "La dernière ordonnance est retrouvée où qu'elle ait été créée (consultation ou ordonnance directe).",
    ],
  },
  {
    version: "1.17.0",
    date:    "2026-07-13",
    title:   "Salle d'attente plus juste & aperçu exact des documents",
    items: [
      "Salle d'attente : les absents et les terminés sont désormais comptés séparément.",
      "Les téléconsultations n'encombrent plus la salle d'attente — elles apparaissent à part (elles ne se font pas au cabinet).",
      "Format des documents : le style simple affiche maintenant un aperçu à taille réelle, avec la position exacte du texte, comme la mise en page avancée.",
    ],
  },
  {
    version: "1.16.0",
    date:    "2026-07-13",
    title:   "Espace secrétaire enrichi, format des documents plus clair & confort",
    items: [
      "Secrétaire : un vrai tableau de bord d'accueil, plus l'accès à la langue, au mode sombre, à l'aide et aux raccourcis — la déconnexion est désormais dans le menu.",
      "Format des documents : choisissez pour chaque document le style simple ou une mise en page avancée, dans une page réorganisée et plus claire.",
      "Un rappel s'affiche quand votre essai gratuit approche de sa fin.",
      "Corrections : le sélecteur de calculateurs ne bouge plus, la carte de rendez-vous ne se chevauche plus sur petit écran, et le message « stockage plein » ne s'affiche plus à tort sur un compte vide.",
    ],
  },
  {
    version: "1.15.0",
    date:    "2026-07-13",
    title:   "Comptes rendus d'imagerie, agenda intelligent & agenda plus rapide",
    items: [
      "Nouveau : rédigez et imprimez un compte rendu d'échographie/radio/IRM ou un rapport médical, avec votre en-tête — depuis la consultation ou l'onglet Documents.",
      "Agenda intelligent : jours fériés marocains et jours de congé du cabinet grisés automatiquement (à régler dans Paramètres).",
      "Changez le type d'un rendez-vous d'un clic droit directement sur l'agenda.",
      "À la fin de la consultation, l'agenda vous indique combien de rendez-vous sont déjà prévus le jour choisi.",
    ],
  },
  {
    version: "1.14.0",
    date:    "2026-07-13",
    title:   "Salle d'attente fluide, nouveaux calculateurs & réglages plus clairs",
    items: [
      "Salle d'attente : appelez le patient d'un geste (la secrétaire est prévenue), puis démarrez la consultation quand il entre — l'appel reste annulable.",
      "Nouveaux calculateurs : HbA1c → glycémie moyenne, clairance de la créatinine (Cockcroft-Gault) et surface corporelle.",
      "Agenda : renommez et recolorez vos types de rendez-vous directement depuis la légende.",
      "Réglages réorganisés en catégories claires, et meilleure lisibilité sur petit écran (dossier patient, tableaux, messagerie).",
    ],
  },
  {
    version: "1.13.0",
    date:    "2026-07-13",
    title:   "Agenda plus lisible, aide réorganisée & confort d'usage",
    items: [
      "Agenda hebdomadaire : la semaine s'affiche entièrement, sans défilement (heures ajustées à vos rendez-vous).",
      "Un type de rendez-vous masqué disparaît totalement de l'agenda.",
      "Toutes les notifications peuvent être fermées d'un clic.",
      "Aide : navigation par sections et guide des fonctionnalités repliable, plus facile à parcourir.",
      "Aperçu secrétaire accessible depuis une petite icône 👁️ dans le menu.",
    ],
  },
  {
    version: "1.12.0",
    date:    "2026-07-12",
    title:   "Documents plus clairs & corrections d'affichage",
    items: [
      "Format des documents réorganisé : « Aperçu », « Style rapide » et « Mise en page avancée » — plus de confusion.",
      "Ville et date sont désormais deux champs distincts, positionnables séparément.",
      "Documents imprimés : les mots « Patient », « Date »… ne sont plus imprimés (seules les valeurs le sont).",
      "Fenêtre étroite : les boutons du format de document et le tableau de facturation restent entièrement visibles.",
      "Un type de rendez-vous masqué n'apparaît plus dans la programmation du prochain RDV.",
    ],
  },
  {
    version: "1.11.0",
    date:    "2026-07-12",
    title:   "Salle d'attente, couleurs d'agenda, papier des documents & corrections",
    items: [
      "Salle d'attente : « Faire entrer » place le patient « En salle » — la consultation ne démarre pas automatiquement (le minuteur reste séparé).",
      "Agenda : palette de couleurs harmonisée et limitée pour les types et les étiquettes.",
      "Documents : choix du type de papier — « vierge » (tout est imprimé) ou « pré-imprimé » (en-tête et pied masqués).",
      "Messagerie : correction de l'affichage de l'expéditeur des messages.",
      "L'aperçu secrétaire est désormais dans Paramètres → Secrétariat (retiré du menu latéral).",
    ],
  },
  {
    version: "1.10.0",
    date:    "2026-07-12",
    title:   "Modèles d'examens, dossier plus clair & console d'administration",
    items: [
      "Demande d'examens : modèles prêts à l'emploi (bilan pré-op, diabète, thyroïdien…) en un clic, et possibilité d'enregistrer vos propres modèles.",
      "Consultation : le poids et la taille sont désormais séparés des signes vitaux (Anthropométrie).",
      "Mesures & bilan : un bouton enregistre les mesures saisies directement dans Examens & Bio (plus de double saisie).",
      "Icônes redessinées dans les calculateurs, l'agenda et le dossier patient.",
      "Nouveautés : cet écran s'affiche à chaque mise à jour ; la version est visible en bas du menu.",
    ],
  },
  {
    version: "1.9.0",
    date:    "2026-07-12",
    title:   "Dossier médical, facturation précise & catalogues enrichis",
    items: [
      "Écran de consultation : un bandeau médical permanent affiche l'âge, le groupe sanguin, les allergies (en rouge), les antécédents et le traitement de fond — visible sur tous les onglets.",
      "Facturation : le détail d'une facture affiche désormais la remise par acte et se totalise correctement (montants réconciliés).",
      "Comptabilité : le taux d'amortissement est proposé automatiquement selon le type de bien (taux usuels admis fiscalement).",
      "Ordonnances : nouveaux médicaments (myorelaxants, contraceptifs, antiseptiques, anesthésiques locaux…).",
      "Actes & bilans : nombreuses spécialités et analyses ajoutées (allergologie, angiologie, chirurgie, spermogramme, électrophorèses…).",
      "Messagerie cabinet : notification (son + alerte) à la réception d'un message.",
      "Agenda : légende plus lisible et icônes redessinées.",
    ],
  },
  {
    version: "1.8.0",
    date:    "2026-07-12",
    title:   "Messagerie médecin ↔ secrétaire",
    items: [
      "Nouveau canal de discussion 💬 entre le médecin et la secrétaire, avec notifications.",
      "Correction de l'enregistrement de la spécialité dans l'identité du médecin.",
      "Parcours de démarrage simplifié : l'identité du médecin d'abord, moins de champs obligatoires.",
      "Historique du patient et onglet mesures & bilan plus clairs.",
    ],
  },
];

// Resolved current version — the build injects __APP_VERSION__ from package.json.
export const CURRENT_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : (CHANGELOG[0]?.version ?? "");

// The releases newer than a previously-seen version (for the "what's new" panel).
export function releasesSince(seen: string | null): Release[] {
  if (!seen) return [];
  const idx = CHANGELOG.findIndex(r => r.version === seen);
  // Everything above the seen entry is new. If the seen version isn't in the list
  // (older than we track), show just the latest entry.
  if (idx === -1) return CHANGELOG.slice(0, 1);
  return CHANGELOG.slice(0, idx);
}
