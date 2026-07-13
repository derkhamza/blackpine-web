import type { ExamRequestCategory, ExamRequestLine } from "./cabinetTypes";

// Category labels are localised at render time via i18n; these are the French
// defaults used by the printed document (which is always French in Morocco).
export const EXAM_REQ_CATEGORY_LABELS: Record<ExamRequestCategory, string> = {
  biologie:    "Biologie",
  radiologie:  "Radiologie",
  echographie: "Échographie",
  scanner:     "Scanner (TDM)",
  irm:         "IRM",
  autre:       "Autre",
};

export const EXAM_REQ_CATEGORY_COLORS: Record<ExamRequestCategory, string> = {
  biologie:    "#E85B5B",
  radiologie:  "#1890C5",
  echographie: "#15A876",
  scanner:     "#9B72D0",
  irm:         "#D4962A",
  autre:       "#6B7280",
};

export const EXAM_REQ_CATEGORIES: ExamRequestCategory[] =
  ["biologie", "radiologie", "echographie", "scanner", "irm", "autre"];

// Common exams per category — used as datalist suggestions so the doctor types
// fast. Not exhaustive; the field is free text.
export const EXAM_CATALOG: Record<ExamRequestCategory, string[]> = {
  biologie: [
    "NFS (Numération Formule Sanguine)",
    "Glycémie à jeun",
    "Hémoglobine glyquée (HbA1c)",
    "Créatininémie",
    "Urée sanguine",
    "Ionogramme sanguin",
    "Bilan lipidique (Cholestérol, Triglycérides)",
    "Bilan hépatique (ASAT, ALAT, GGT, PAL)",
    "TSH",
    "T4 libre",
    "CRP (Protéine C-réactive)",
    "Vitesse de sédimentation (VS)",
    "TP / INR",
    "TCA",
    "Ferritinémie",
    "Fer sérique",
    "Calcémie",
    "Phosphorémie",
    "Magnésémie",
    "Acide urique (Uricémie)",
    "Vitamine D (25-OH)",
    "Vitamine B12",
    "Albuminémie / Protidémie",
    "Bilan martial",
    "Amylasémie / Lipasémie",
    "CPK",
    "Troponine",
    "BNP / NT-proBNP",
    "Groupe sanguin / Rhésus",
    "Sérologie hépatite B (Ag HBs)",
    "Sérologie hépatite C",
    "Sérologie VIH",
    "Bêta-HCG plasmatique",
    "PSA (Antigène prostatique)",
    "ECBU (Examen cytobactériologique des urines)",
    "Protéinurie de 24h",
    "Microalbuminurie",
    "Coproculture",
    "Prélèvement vaginal",
  ],
  radiologie: [
    "Radiographie thoracique (face)",
    "Radiographie thoracique (face + profil)",
    "Radiographie de l'abdomen sans préparation (ASP)",
    "Radiographie du rachis cervical",
    "Radiographie du rachis lombaire (face + profil)",
    "Radiographie du bassin",
    "Radiographie du genou",
    "Radiographie de l'épaule",
    "Radiographie de la cheville",
    "Radiographie du poignet / main",
    "Radiographie des sinus",
    "Panoramique dentaire",
    "Mammographie",
  ],
  echographie: [
    "Échographie abdominale",
    "Échographie abdomino-pelvienne",
    "Échographie pelvienne",
    "Échographie rénale / voies urinaires",
    "Échographie thyroïdienne",
    "Échographie mammaire",
    "Échographie des parties molles",
    "Échographie testiculaire",
    "Échographie cardiaque (échocardiographie)",
    "Écho-Doppler des membres inférieurs (veineux)",
    "Écho-Doppler des membres inférieurs (artériel)",
    "Écho-Doppler des troncs supra-aortiques",
    "Échographie obstétricale",
  ],
  scanner: [
    "TDM cérébrale (sans injection)",
    "TDM cérébrale (avec injection)",
    "TDM thoracique",
    "TDM abdomino-pelvienne",
    "TDM du rachis lombaire",
    "Angio-TDM thoracique",
    "Uro-scanner",
    "TDM des sinus",
  ],
  irm: [
    "IRM cérébrale",
    "IRM médullaire (rachis cervical)",
    "IRM médullaire (rachis lombaire)",
    "IRM du genou",
    "IRM de l'épaule",
    "IRM abdominale",
    "IRM pelvienne",
    "Angio-IRM cérébrale",
  ],
  autre: [
    "Électrocardiogramme (ECG)",
    "Épreuve d'effort",
    "Holter ECG (24h)",
    "Holter tensionnel (MAPA)",
    "Spirométrie / EFR",
    "Électroencéphalogramme (EEG)",
    "Électromyogramme (EMG)",
    "Fibroscopie digestive haute",
    "Coloscopie",
    "Fond d'œil",
  ],
};

// ── Built-in exam-request models ──────────────────────────────────────────────
// Ready-made bundles of frequently-prescribed exams the doctor can drop into a
// demande d'examens in one click, then adjust. The doctor can also save their own
// (stored on doctorProfile.examRequestTemplates). Labels match EXAM_CATALOG so the
// datalists still recognise them.
export interface ExamRequestModel { name: string; lines: ExamRequestLine[]; indication?: string; }

export const EXAM_REQUEST_MODELS: ExamRequestModel[] = [
  {
    name: "Bilan standard / systématique",
    lines: [
      { category: "biologie", label: "NFS (Numération Formule Sanguine)" },
      { category: "biologie", label: "Glycémie à jeun" },
      { category: "biologie", label: "Créatininémie" },
      { category: "biologie", label: "Bilan lipidique (Cholestérol, Triglycérides)" },
      { category: "biologie", label: "Bilan hépatique (ASAT, ALAT, GGT, PAL)" },
    ],
  },
  {
    name: "Bilan diabète (suivi)",
    lines: [
      { category: "biologie", label: "Hémoglobine glyquée (HbA1c)" },
      { category: "biologie", label: "Glycémie à jeun" },
      { category: "biologie", label: "Créatininémie" },
      { category: "biologie", label: "Bilan lipidique (Cholestérol, Triglycérides)" },
      { category: "biologie", label: "Microalbuminurie" },
    ],
    indication: "Suivi du diabète.",
  },
  {
    name: "Bilan pré-opératoire",
    lines: [
      { category: "biologie", label: "NFS (Numération Formule Sanguine)" },
      { category: "biologie", label: "Groupe sanguin / Rhésus" },
      { category: "biologie", label: "TP / INR" },
      { category: "biologie", label: "TCA" },
      { category: "biologie", label: "Ionogramme sanguin" },
      { category: "biologie", label: "Créatininémie" },
      { category: "radiologie", label: "Radiographie thoracique (face)" },
      { category: "autre", label: "Électrocardiogramme (ECG)" },
    ],
    indication: "Bilan pré-opératoire.",
  },
  {
    name: "Bilan thyroïdien",
    lines: [
      { category: "biologie", label: "TSH" },
      { category: "biologie", label: "T4 libre" },
      { category: "echographie", label: "Échographie thyroïdienne" },
    ],
  },
  {
    name: "Bilan hypertension (HTA)",
    lines: [
      { category: "biologie", label: "Ionogramme sanguin" },
      { category: "biologie", label: "Créatininémie" },
      { category: "biologie", label: "Glycémie à jeun" },
      { category: "biologie", label: "Bilan lipidique (Cholestérol, Triglycérides)" },
      { category: "autre", label: "Électrocardiogramme (ECG)" },
      { category: "autre", label: "Holter tensionnel (MAPA)" },
    ],
    indication: "Bilan initial d'hypertension artérielle.",
  },
  {
    name: "Bilan infectieux / fièvre",
    lines: [
      { category: "biologie", label: "NFS (Numération Formule Sanguine)" },
      { category: "biologie", label: "CRP (Protéine C-réactive)" },
      { category: "biologie", label: "Vitesse de sédimentation (VS)" },
      { category: "biologie", label: "ECBU (Examen cytobactériologique des urines)" },
    ],
  },
  {
    name: "Bilan anémie",
    lines: [
      { category: "biologie", label: "NFS (Numération Formule Sanguine)" },
      { category: "biologie", label: "Ferritinémie" },
      { category: "biologie", label: "Fer sérique" },
      { category: "biologie", label: "Bilan martial" },
      { category: "biologie", label: "Vitamine B12" },
    ],
  },
  {
    name: "Suivi grossesse (1er trimestre)",
    lines: [
      { category: "biologie", label: "NFS (Numération Formule Sanguine)" },
      { category: "biologie", label: "Groupe sanguin / Rhésus" },
      { category: "biologie", label: "Glycémie à jeun" },
      { category: "biologie", label: "Sérologie hépatite B (Ag HBs)" },
      { category: "biologie", label: "Sérologie VIH" },
      { category: "biologie", label: "ECBU (Examen cytobactériologique des urines)" },
      { category: "echographie", label: "Échographie obstétricale" },
    ],
    indication: "Suivi de grossesse — premier trimestre.",
  },
  {
    name: "Douleur abdominale",
    lines: [
      { category: "biologie", label: "NFS (Numération Formule Sanguine)" },
      { category: "biologie", label: "CRP (Protéine C-réactive)" },
      { category: "biologie", label: "Amylasémie / Lipasémie" },
      { category: "biologie", label: "ECBU (Examen cytobactériologique des urines)" },
      { category: "echographie", label: "Échographie abdominale" },
    ],
  },
];
