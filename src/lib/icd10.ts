// ── CIM-10 / ICD-10 — curated French subset for general practice ──────────────
// ~280 codes covering the diagnoses most commonly encountered in Moroccan GP.
// Format: [code, description, chapter]

export type Icd10Chapter =
  | "resp" | "cardio" | "digest" | "endoc" | "neuro"
  | "osteo" | "uro" | "derm" | "infect" | "mental" | "sympt" | "autre";

export interface Icd10Entry {
  code:    string;
  desc:    string;
  chapter: Icd10Chapter;
}

export const ICD10_CHAPTERS: Record<Icd10Chapter, string> = {
  resp:    "Respiratoire",
  cardio:  "Cardiovasc.",
  digest:  "Digestif",
  endoc:   "Endocrinol.",
  neuro:   "Neurologie",
  osteo:   "Ostéo-articulaire",
  uro:     "Uro-génital",
  derm:    "Dermatologie",
  infect:  "Infectieux",
  mental:  "Santé mentale",
  sympt:   "Symptômes",
  autre:   "Autre",
};

export const CHAPTER_COLORS: Record<Icd10Chapter, string> = {
  resp:   "#3B82F6",
  cardio: "#EF4444",
  digest: "#F97316",
  endoc:  "#8B5CF6",
  neuro:  "#0EA5E9",
  osteo:  "#92400E",
  uro:    "#D97706",
  derm:   "#EC4899",
  infect: "#10B981",
  mental: "#6366F1",
  sympt:  "#6B7280",
  autre:  "#9CA3AF",
};

export const ICD10: Icd10Entry[] = [
  // ── Infectieux ───────────────────────────────────────────────────────────
  { code: "A09",   desc: "Gastro-entérite et colite d'origine infectieuse",          chapter: "infect" },
  { code: "A08.4", desc: "Entérite virale, sans précision",                           chapter: "infect" },
  { code: "A15.0", desc: "Tuberculose pulmonaire à bacilloscopie positive",           chapter: "infect" },
  { code: "A37.9", desc: "Coqueluche, sans précision",                                chapter: "infect" },
  { code: "A41.9", desc: "Septicémie, sans précision",                                chapter: "infect" },
  { code: "A49.9", desc: "Infection bactérienne, sans précision",                     chapter: "infect" },
  { code: "B00.9", desc: "Infection à herpès virus, sans précision",                  chapter: "infect" },
  { code: "B02.9", desc: "Zona sans complication",                                    chapter: "infect" },
  { code: "B34.9", desc: "Infection virale, sans précision",                          chapter: "infect" },
  { code: "B99",   desc: "Autres maladies infectieuses, sans précision",              chapter: "infect" },

  // ── Respiratoire ─────────────────────────────────────────────────────────
  { code: "J00",   desc: "Rhinopharyngite aiguë (rhume commun)",                      chapter: "resp" },
  { code: "J02.0", desc: "Pharyngite streptococcique",                                chapter: "resp" },
  { code: "J02.9", desc: "Pharyngite aiguë, sans précision",                          chapter: "resp" },
  { code: "J03.0", desc: "Amygdalite streptococcique",                                chapter: "resp" },
  { code: "J03.9", desc: "Amygdalite aiguë, sans précision",                          chapter: "resp" },
  { code: "J04.0", desc: "Laryngite aiguë",                                           chapter: "resp" },
  { code: "J06.9", desc: "Infection aiguë des voies respiratoires supérieures",       chapter: "resp" },
  { code: "J10.1", desc: "Grippe avec pneumonie, virus identifié",                    chapter: "resp" },
  { code: "J11.1", desc: "Grippe avec pneumonie, virus non identifié",                chapter: "resp" },
  { code: "J11.8", desc: "Grippe avec autres manifestations, virus non identifié",    chapter: "resp" },
  { code: "J18.9", desc: "Pneumonie, sans précision",                                 chapter: "resp" },
  { code: "J20.9", desc: "Bronchite aiguë, sans précision",                           chapter: "resp" },
  { code: "J22",   desc: "Infection aiguë des voies respiratoires inférieures",       chapter: "resp" },
  { code: "J30.1", desc: "Rhinite allergique due au pollen",                          chapter: "resp" },
  { code: "J30.4", desc: "Rhinite allergique chronique, sans précision",               chapter: "resp" },
  { code: "J32.9", desc: "Sinusite chronique, sans précision",                        chapter: "resp" },
  { code: "J35.0", desc: "Amygdalite chronique",                                      chapter: "resp" },
  { code: "J40",   desc: "Bronchite, non précisée comme aiguë ou chronique",          chapter: "resp" },
  { code: "J41.0", desc: "Bronchite chronique simple",                                chapter: "resp" },
  { code: "J44.1", desc: "BPCO avec exacerbation aiguë",                              chapter: "resp" },
  { code: "J44.9", desc: "Broncho-pneumopathie chronique obstructive (BPCO), sans précision", chapter: "resp" },
  { code: "J45.0", desc: "Asthme à prédominance allergique",                          chapter: "resp" },
  { code: "J45.9", desc: "Asthme, sans précision",                                    chapter: "resp" },
  { code: "J96.0", desc: "Insuffisance respiratoire aiguë",                           chapter: "resp" },

  // ── Cardiovasculaire ─────────────────────────────────────────────────────
  { code: "I10",   desc: "Hypertension artérielle essentielle (primitive)",           chapter: "cardio" },
  { code: "I11.9", desc: "Cardiopathie hypertensive sans insuffisance cardiaque",     chapter: "cardio" },
  { code: "I13.9", desc: "Cardiorénopathie hypertensive, sans précision",             chapter: "cardio" },
  { code: "I20.0", desc: "Angor instable",                                            chapter: "cardio" },
  { code: "I20.9", desc: "Angine de poitrine, sans précision",                        chapter: "cardio" },
  { code: "I21.9", desc: "Infarctus aigu du myocarde, sans précision",                chapter: "cardio" },
  { code: "I25.1", desc: "Cardiopathie athéroscléreuse",                              chapter: "cardio" },
  { code: "I48",   desc: "Fibrillation et flutter auriculaires",                      chapter: "cardio" },
  { code: "I49.9", desc: "Trouble du rythme cardiaque, sans précision",               chapter: "cardio" },
  { code: "I50.0", desc: "Insuffisance cardiaque congestive",                         chapter: "cardio" },
  { code: "I50.9", desc: "Insuffisance cardiaque, sans précision",                    chapter: "cardio" },
  { code: "I63.9", desc: "Infarctus cérébral, sans précision",                        chapter: "cardio" },
  { code: "I64",   desc: "Accident vasculaire cérébral, non précisé",                 chapter: "cardio" },
  { code: "I70.0", desc: "Athérosclérose de l'aorte",                                 chapter: "cardio" },
  { code: "I70.2", desc: "Athérosclérose des artères des membres",                    chapter: "cardio" },
  { code: "I73.9", desc: "Maladie vasculaire périphérique, sans précision",           chapter: "cardio" },
  { code: "I83.9", desc: "Varices des membres inférieurs, sans précision",            chapter: "cardio" },
  { code: "I87.2", desc: "Insuffisance veineuse (chronique) (périphérique)",          chapter: "cardio" },

  // ── Digestif ─────────────────────────────────────────────────────────────
  { code: "K21.0", desc: "RGO avec œsophagite",                                      chapter: "digest" },
  { code: "K21.9", desc: "RGO sans œsophagite",                                      chapter: "digest" },
  { code: "K25.9", desc: "Ulcère gastrique, sans précision",                          chapter: "digest" },
  { code: "K26.9", desc: "Ulcère duodénal, sans précision",                           chapter: "digest" },
  { code: "K29.5", desc: "Gastrite chronique, sans précision",                        chapter: "digest" },
  { code: "K29.7", desc: "Gastrite, sans précision",                                  chapter: "digest" },
  { code: "K37",   desc: "Appendicite, sans précision",                               chapter: "digest" },
  { code: "K52.9", desc: "Colite et gastroentérite non infectieuse, sans précision",  chapter: "digest" },
  { code: "K57.9", desc: "Diverticulose intestinale, sans précision",                 chapter: "digest" },
  { code: "K58.9", desc: "Syndrome du côlon irritable, sans précision",               chapter: "digest" },
  { code: "K59.0", desc: "Constipation",                                              chapter: "digest" },
  { code: "K70.3", desc: "Cirrhose alcoolique du foie",                               chapter: "digest" },
  { code: "K74.6", desc: "Cirrhose hépatique, sans précision",                        chapter: "digest" },
  { code: "K76.0", desc: "Stéatose hépatique, sans précision",                        chapter: "digest" },
  { code: "K80.2", desc: "Calculs de la vésicule biliaire sans cholécystite",         chapter: "digest" },
  { code: "K81.0", desc: "Cholécystite aiguë",                                        chapter: "digest" },
  { code: "K85.9", desc: "Pancréatite aiguë, sans précision",                         chapter: "digest" },
  { code: "K92.1", desc: "Méléna",                                                    chapter: "digest" },

  // ── Endocrinologie / Métabolisme ─────────────────────────────────────────
  { code: "E03.9", desc: "Hypothyroïdie, sans précision",                             chapter: "endoc" },
  { code: "E05.9", desc: "Thyrotoxicose (hyperthyroïdie), sans précision",            chapter: "endoc" },
  { code: "E06.3", desc: "Thyroïdite auto-immune (de Hashimoto)",                     chapter: "endoc" },
  { code: "E11.0", desc: "Diabète de type 2 avec coma",                              chapter: "endoc" },
  { code: "E11.6", desc: "Diabète de type 2 avec autres complications précisées",    chapter: "endoc" },
  { code: "E11.9", desc: "Diabète de type 2 sans complication",                      chapter: "endoc" },
  { code: "E14.9", desc: "Diabète sucré, sans précision, sans complication",         chapter: "endoc" },
  { code: "E66.0", desc: "Obésité due à un excès calorique",                         chapter: "endoc" },
  { code: "E66.9", desc: "Obésité, sans précision",                                   chapter: "endoc" },
  { code: "E78.0", desc: "Hypercholestérolémie pure",                                 chapter: "endoc" },
  { code: "E78.1", desc: "Hypertriglycéridémie pure",                                 chapter: "endoc" },
  { code: "E78.5", desc: "Hyperlipidémie, sans précision",                            chapter: "endoc" },
  { code: "E87.1", desc: "Hyponatrémie",                                              chapter: "endoc" },
  { code: "E87.5", desc: "Hyperkaliémie",                                             chapter: "endoc" },
  { code: "E87.6", desc: "Hypokaliémie",                                              chapter: "endoc" },

  // ── Neurologie ───────────────────────────────────────────────────────────
  { code: "G20",   desc: "Maladie de Parkinson",                                      chapter: "neuro" },
  { code: "G35",   desc: "Sclérose en plaques",                                       chapter: "neuro" },
  { code: "G40.9", desc: "Épilepsie, sans précision",                                 chapter: "neuro" },
  { code: "G43.0", desc: "Migraine sans aura",                                        chapter: "neuro" },
  { code: "G43.1", desc: "Migraine avec aura",                                        chapter: "neuro" },
  { code: "G43.9", desc: "Migraine, sans précision",                                  chapter: "neuro" },
  { code: "G44.2", desc: "Céphalée de tension",                                       chapter: "neuro" },
  { code: "G54.2", desc: "Lésions des racines cervicales",                            chapter: "neuro" },
  { code: "G54.4", desc: "Lésions de racines lombosacrées (sciatalgie)",              chapter: "neuro" },
  { code: "G58.0", desc: "Syndrome du canal carpien",                                 chapter: "neuro" },
  { code: "G93.3", desc: "Fatigue post-virale",                                       chapter: "neuro" },

  // ── Ostéo-articulaire ────────────────────────────────────────────────────
  { code: "M05.9", desc: "Polyarthrite rhumatoïde séropositive, sans précision",      chapter: "osteo" },
  { code: "M06.9", desc: "Polyarthrite rhumatoïde, sans précision",                   chapter: "osteo" },
  { code: "M10.9", desc: "Goutte, sans précision",                                    chapter: "osteo" },
  { code: "M16.9", desc: "Coxarthrose (artrose de la hanche), sans précision",        chapter: "osteo" },
  { code: "M17.9", desc: "Gonarthrose (artrose du genou), sans précision",            chapter: "osteo" },
  { code: "M25.5", desc: "Douleur articulaire",                                       chapter: "osteo" },
  { code: "M47.9", desc: "Spondylose, sans précision",                                chapter: "osteo" },
  { code: "M48.0", desc: "Sténose du canal vertébral",                                chapter: "osteo" },
  { code: "M54.1", desc: "Radiculopathie",                                            chapter: "osteo" },
  { code: "M54.3", desc: "Sciatalgie",                                                chapter: "osteo" },
  { code: "M54.4", desc: "Lumbago avec sciatique",                                    chapter: "osteo" },
  { code: "M54.5", desc: "Lombalgie",                                                 chapter: "osteo" },
  { code: "M65.9", desc: "Synovite et ténosynovite, sans précision",                  chapter: "osteo" },
  { code: "M75.1", desc: "Syndrome de la coiffe des rotateurs (épaule)",             chapter: "osteo" },
  { code: "M79.7", desc: "Fibromyalgie",                                              chapter: "osteo" },
  { code: "M81.9", desc: "Ostéoporose, sans précision",                               chapter: "osteo" },

  // ── Uro-génital ──────────────────────────────────────────────────────────
  { code: "N18.9", desc: "Maladie rénale chronique, sans précision",                  chapter: "uro" },
  { code: "N20.0", desc: "Calcul du rein (lithiase rénale)",                          chapter: "uro" },
  { code: "N20.1", desc: "Calcul de l'uretère",                                       chapter: "uro" },
  { code: "N23",   desc: "Colique néphrétique, sans précision",                       chapter: "uro" },
  { code: "N30.0", desc: "Cystite aiguë",                                             chapter: "uro" },
  { code: "N30.9", desc: "Cystite, sans précision",                                   chapter: "uro" },
  { code: "N39.0", desc: "Infection des voies urinaires, siège non précisé",          chapter: "uro" },
  { code: "N40",   desc: "Hyperplasie bénigne de la prostate (adénome)",              chapter: "uro" },
  { code: "N41.0", desc: "Prostatite aiguë",                                          chapter: "uro" },
  { code: "N41.1", desc: "Prostatite chronique",                                      chapter: "uro" },
  { code: "N92.0", desc: "Menstruations abondantes et fréquentes, cycle régulier",    chapter: "uro" },
  { code: "N94.6", desc: "Dysménorrhée, sans précision",                              chapter: "uro" },
  { code: "N95.1", desc: "Ménopause et états ménopausiques chez la femme",            chapter: "uro" },

  // ── Dermatologie ─────────────────────────────────────────────────────────
  { code: "L20.9", desc: "Dermatite atopique, sans précision (eczéma)",               chapter: "derm" },
  { code: "L23.9", desc: "Dermatite de contact allergique, sans précision",           chapter: "derm" },
  { code: "L25.9", desc: "Dermatite de contact, sans précision",                      chapter: "derm" },
  { code: "L30.9", desc: "Dermatite, sans précision",                                 chapter: "derm" },
  { code: "L40.0", desc: "Psoriasis en plaques",                                      chapter: "derm" },
  { code: "L40.9", desc: "Psoriasis, sans précision",                                 chapter: "derm" },
  { code: "L50.0", desc: "Urticaire allergique",                                      chapter: "derm" },
  { code: "L50.9", desc: "Urticaire, sans précision",                                 chapter: "derm" },
  { code: "L60.0", desc: "Ongle incarné",                                             chapter: "derm" },
  { code: "L70.0", desc: "Acné vulgaire",                                             chapter: "derm" },
  { code: "L89.9", desc: "Escarres, sans précision",                                  chapter: "derm" },

  // ── Santé mentale ────────────────────────────────────────────────────────
  { code: "F10.1", desc: "Troubles psychiques et comportementaux liés à l'alcool",    chapter: "mental" },
  { code: "F32.0", desc: "Épisode dépressif léger",                                   chapter: "mental" },
  { code: "F32.1", desc: "Épisode dépressif moyen",                                   chapter: "mental" },
  { code: "F32.9", desc: "Épisode dépressif, sans précision",                         chapter: "mental" },
  { code: "F33.9", desc: "Trouble dépressif récurrent, sans précision",               chapter: "mental" },
  { code: "F41.0", desc: "Trouble panique (anxiété paroxystique épisodique)",         chapter: "mental" },
  { code: "F41.1", desc: "Anxiété généralisée",                                       chapter: "mental" },
  { code: "F41.9", desc: "Troubles anxieux, sans précision",                          chapter: "mental" },
  { code: "F43.1", desc: "État de stress post-traumatique",                           chapter: "mental" },
  { code: "F51.0", desc: "Insomnie non organique",                                    chapter: "mental" },
  { code: "G47.0", desc: "Troubles de l'endormissement et du maintien du sommeil",    chapter: "mental" },

  // ── ORL / Ophtalmologie ──────────────────────────────────────────────────
  { code: "H10.9", desc: "Conjonctivite, sans précision",                             chapter: "autre" },
  { code: "H26.9", desc: "Cataracte, sans précision",                                 chapter: "autre" },
  { code: "H35.3", desc: "Dégénérescence maculaire liée à l'âge (DMLA)",             chapter: "autre" },
  { code: "H40.9", desc: "Glaucome, sans précision",                                  chapter: "autre" },
  { code: "H52.1", desc: "Myopie",                                                    chapter: "autre" },
  { code: "H52.2", desc: "Astigmatisme",                                              chapter: "autre" },
  { code: "H52.4", desc: "Presbytie",                                                 chapter: "autre" },
  { code: "H61.2", desc: "Bouchon de cérumen",                                        chapter: "autre" },
  { code: "H65.9", desc: "Otite moyenne non suppurée, sans précision",                chapter: "autre" },
  { code: "H66.0", desc: "Otite moyenne suppurée aiguë",                              chapter: "autre" },
  { code: "H66.9", desc: "Otite moyenne, sans précision",                             chapter: "autre" },

  // ── Symptômes / Signes ───────────────────────────────────────────────────
  { code: "R00.0", desc: "Tachycardie, sans précision",                               chapter: "sympt" },
  { code: "R00.1", desc: "Bradycardie, sans précision",                               chapter: "sympt" },
  { code: "R04.2", desc: "Hémoptysie",                                                chapter: "sympt" },
  { code: "R05",   desc: "Toux",                                                      chapter: "sympt" },
  { code: "R06.0", desc: "Dyspnée",                                                   chapter: "sympt" },
  { code: "R07.0", desc: "Douleur à la respiration",                                  chapter: "sympt" },
  { code: "R07.4", desc: "Douleur thoracique, sans précision",                        chapter: "sympt" },
  { code: "R10.4", desc: "Autres douleurs abdominales et non précisées",              chapter: "sympt" },
  { code: "R11",   desc: "Nausées et vomissements",                                   chapter: "sympt" },
  { code: "R19.7", desc: "Diarrhée, sans précision",                                  chapter: "sympt" },
  { code: "R50.9", desc: "Fièvre, sans précision",                                    chapter: "sympt" },
  { code: "R51",   desc: "Céphalée",                                                  chapter: "sympt" },
  { code: "R52.9", desc: "Douleur, sans précision",                                   chapter: "sympt" },
  { code: "R53",   desc: "Malaise et fatigue",                                        chapter: "sympt" },
  { code: "R55",   desc: "Syncope et collapsus",                                      chapter: "sympt" },
  { code: "R60.0", desc: "Œdème localisé",                                            chapter: "sympt" },
  { code: "R60.9", desc: "Œdème, sans précision",                                     chapter: "sympt" },
  { code: "R63.0", desc: "Anorexie",                                                  chapter: "sympt" },
  { code: "R63.4", desc: "Amaigrissement anormal",                                    chapter: "sympt" },
  { code: "R73.0", desc: "Anomalie de la tolérance au glucose",                       chapter: "sympt" },
  { code: "R73.9", desc: "Hyperglycémie, sans précision",                             chapter: "sympt" },

  // ── Traumatismes fréquents ───────────────────────────────────────────────
  { code: "S06.0", desc: "Commotion cérébrale",                                       chapter: "autre" },
  { code: "S09.9", desc: "Traumatisme de la tête, sans précision",                    chapter: "autre" },
  { code: "S13.4", desc: "Entorse cervicale (coup du lapin)",                         chapter: "autre" },
  { code: "S33.5", desc: "Entorse et foulure des ligaments lombaires",                chapter: "autre" },
  { code: "S52.5", desc: "Fracture de l'extrémité inférieure du radius",              chapter: "autre" },
  { code: "S82.9", desc: "Fracture de la jambe, sans précision",                      chapter: "autre" },
  { code: "S93.4", desc: "Entorse et foulure de la cheville",                         chapter: "autre" },
  { code: "T14.9", desc: "Lésion traumatique, sans précision",                        chapter: "autre" },
  { code: "T78.1", desc: "Autre réaction anaphylactique",                             chapter: "autre" },
  { code: "T78.4", desc: "Allergie, sans précision",                                  chapter: "autre" },
];

// ── Search ────────────────────────────────────────────────────────────────────

export function searchIcd10(query: string, chapter?: Icd10Chapter): Icd10Entry[] {
  const q = query.trim().toLowerCase();
  const pool = chapter ? ICD10.filter((e) => e.chapter === chapter) : ICD10;
  if (!q) return pool;
  const tokens = q.split(/\s+/).filter(Boolean);
  return pool.filter((entry) => {
    const target = (entry.code + " " + entry.desc).toLowerCase();
    return tokens.every((tok) => target.includes(tok));
  });
}
