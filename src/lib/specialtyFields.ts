// Specialty-specific clinical fields for the consultation note
// Keyed by SPECIALTIES[].id from cabinetTypes.ts

export interface SpecialtyField {
  key:          string;
  label:        string;
  placeholder?: string;
  type:         "text" | "number" | "select" | "textarea";
  unit?:        string;
  options?:     string[];
  rows?:        number;
}

export interface SpecialtyGroup {
  title:  string;
  fields: SpecialtyField[];
}

export type SpecialtyFieldMap = Record<string, SpecialtyGroup[]>;

export const SPECIALTY_FIELD_MAP: SpecialtyFieldMap = {

  // ── Médecin généraliste ────────────────────────────────────────────────────
  medecin_generaliste: [
    {
      title: "Revue des appareils",
      fields: [
        { key: "cardio_resp",   label: "Cardio-respiratoire", type: "text", placeholder: "Normal — pas de dyspnée, pas de douleur thoracique" },
        { key: "digestif",      label: "Digestif",            type: "text", placeholder: "Pas de nausée, transit normal" },
        { key: "neuropsychique",label: "Neuropsychique",       type: "text", placeholder: "Pas de céphalées, pas de vertige" },
        { key: "locomoteur",    label: "Locomoteur",           type: "text", placeholder: "Pas de douleur articulaire ni musculaire" },
        { key: "urogenital",    label: "Uro-génital",          type: "text", placeholder: "Miction normale, pas de brûlure" },
      ],
    },
  ],

  // ── Cardiologie ────────────────────────────────────────────────────────────
  cardiologie: [
    {
      title: "Examen cardio-vasculaire",
      fields: [
        {
          key: "nyha",    label: "Classe NYHA",   type: "select",
          options: ["I – Asymptomatique", "II – Gêne à l'effort intense", "III – Gêne à l'effort modéré", "IV – Gêne au repos"],
        },
        { key: "auscultation", label: "Auscultation cardiaque", type: "text", placeholder: "Rythme régulier, B1 B2 normaux, pas de souffle" },
        { key: "pouls",        label: "Pouls périphériques",    type: "text", placeholder: "Présents et symétriques aux 4 membres" },
        { key: "oedemes",      label: "Œdèmes membres inf.",    type: "select", options: ["Absents", "Discrets", "Modérés", "Importants"] },
      ],
    },
    {
      title: "ECG",
      fields: [
        { key: "ecg_rythme",  label: "Rythme",        type: "select", options: ["Sinusal", "Fibrillation auriculaire", "Flutter", "Tachycardie", "Bradycardie", "Bloc"] },
        { key: "ecg_fc",      label: "FC (ECG)",       type: "number", unit: "bpm",   placeholder: "72" },
        { key: "ecg_pr",      label: "PR",             type: "number", unit: "ms",    placeholder: "180" },
        { key: "ecg_qrs",     label: "QRS",            type: "number", unit: "ms",    placeholder: "90" },
        { key: "ecg_qt",      label: "QTc",            type: "number", unit: "ms",    placeholder: "420" },
        { key: "ecg_remarks", label: "Anomalies ECG",  type: "text",   placeholder: "Pas d'anomalie de repolarisation" },
      ],
    },
    {
      title: "Échocardiographie",
      fields: [
        { key: "fe",           label: "Fraction d'éjection (FE)", type: "number", unit: "%",   placeholder: "60" },
        { key: "vg",           label: "Dilatation VG",            type: "select", options: ["Non", "Minime", "Modérée", "Sévère"] },
        { key: "valvulopathie",label: "Valvulopathie",            type: "text",   placeholder: "Insuffisance mitrale minime" },
      ],
    },
  ],

  // ── Dermatologie ──────────────────────────────────────────────────────────
  dermatologie: [
    {
      title: "Description des lésions",
      fields: [
        {
          key: "lesion_type", label: "Lésion élémentaire", type: "select",
          options: ["Macule", "Papule", "Vésicule", "Pustule", "Nodule", "Plaque", "Squame", "Croûte", "Érosion", "Ulcère", "Atrophie"],
        },
        { key: "lesion_loc",    label: "Localisation",   type: "text",   placeholder: "Visage, avant-bras droit…" },
        { key: "lesion_size",   label: "Taille",         type: "text",   unit: "cm",  placeholder: "1,5 × 2 cm" },
        { key: "lesion_color",  label: "Couleur",        type: "text",   placeholder: "Érythémateux, pigmenté…" },
        { key: "lesion_contour",label: "Contours",       type: "select", options: ["Nets", "Irréguliers", "Flous", "Polycycliques"] },
        { key: "koebner",       label: "Signe de Koebner", type: "select", options: ["Absent", "Présent"] },
      ],
    },
    {
      title: "Critères ABCDE (mélanome)",
      fields: [
        { key: "abcde_a", label: "A — Asymétrie",    type: "select", options: ["Non", "Oui"] },
        { key: "abcde_b", label: "B — Bords",        type: "select", options: ["Réguliers", "Irréguliers / dentelés"] },
        { key: "abcde_c", label: "C — Couleur",      type: "select", options: ["Homogène", "Hétérogène / multiple"] },
        { key: "abcde_d", label: "D — Diamètre",     type: "number", unit: "mm",  placeholder: "6" },
        { key: "abcde_e", label: "E — Évolution",    type: "select", options: ["Stable", "En augmentation", "Saignement", "Ulcération"] },
      ],
    },
  ],

  // ── Gynécologie ───────────────────────────────────────────────────────────
  gynecologie: [
    {
      title: "Anamnèse gynécologique",
      fields: [
        { key: "ddr",            label: "DDR (dernières règles)", type: "text",   placeholder: "JJ/MM/AAAA" },
        { key: "cycles",         label: "Cycles",                 type: "select", options: ["Réguliers", "Irréguliers", "Aménorrhée", "Ménopause"] },
        { key: "gestite",        label: "Geste",                  type: "number", placeholder: "2" },
        { key: "parite",         label: "Parité",                 type: "number", placeholder: "2" },
        { key: "contraception",  label: "Contraception",          type: "text",   placeholder: "Pilule, DIU, préservatif, aucune…" },
        { key: "grossesse",      label: "Test de grossesse",      type: "select", options: ["Non fait", "Négatif", "Positif"] },
      ],
    },
    {
      title: "Examen gynécologique",
      fields: [
        { key: "seins",      label: "Seins",          type: "text",   placeholder: "Pas de masse, pas d'écoulement mamelonnaire" },
        { key: "col",        label: "Col utérin",     type: "select", options: ["Normal", "Polype", "Érosion / ectropion", "Sténose", "Lésion suspecte"] },
        { key: "uterus",     label: "Utérus",         type: "select", options: ["Normal", "Augmenté de volume", "Rétroversé", "Fibromes", "Non accessible"] },
        { key: "annexes",    label: "Annexes",        type: "text",   placeholder: "Libres et indolores" },
        { key: "frottis",    label: "Frottis cervico-vaginal", type: "select", options: ["Non réalisé", "À jour", "En attente de résultat", "Anormal"] },
      ],
    },
  ],

  gynecologie_med: [
    {
      title: "Anamnèse gynécologique",
      fields: [
        { key: "ddr",           label: "DDR",                type: "text",   placeholder: "JJ/MM/AAAA" },
        { key: "cycles",        label: "Cycles",             type: "select", options: ["Réguliers", "Irréguliers", "Aménorrhée", "Ménopause"] },
        { key: "gestite",       label: "Geste",              type: "number", placeholder: "0" },
        { key: "parite",        label: "Parité",             type: "number", placeholder: "0" },
        { key: "contraception", label: "Contraception",      type: "text",   placeholder: "Pilule, DIU…" },
      ],
    },
  ],

  // ── Pédiatrie ─────────────────────────────────────────────────────────────
  pediatrie: [
    {
      title: "Courbes de croissance",
      fields: [
        { key: "poids_perc",  label: "Poids — percentile",      type: "select", options: ["<3e", "3e–10e", "10e–25e", "25e–50e", "50e–75e", "75e–90e", "90e–97e", ">97e"] },
        { key: "taille_perc", label: "Taille — percentile",     type: "select", options: ["<3e", "3e–10e", "10e–25e", "25e–50e", "50e–75e", "75e–90e", "90e–97e", ">97e"] },
        { key: "pc",          label: "Périmètre crânien",        type: "number", unit: "cm", placeholder: "46" },
        { key: "pc_perc",     label: "PC — percentile",          type: "select", options: ["<3e", "10e–25e", "25e–75e", "75e–90e", ">97e"] },
      ],
    },
    {
      title: "Développement",
      fields: [
        { key: "developpement", label: "Développement psychomoteur", type: "select", options: ["Normal pour l'âge", "Retard moteur", "Retard langage", "Retard global", "À surveiller"] },
        { key: "vaccins",       label: "Vaccinations",               type: "select", options: ["À jour", "Retard vaccinal", "Refus parental", "À vérifier"] },
        { key: "alimentation",  label: "Alimentation",               type: "text",   placeholder: "Allaitement maternel, diversifié…" },
        { key: "sommeil",       label: "Sommeil",                    type: "text",   placeholder: "Normal, __ heures/nuit" },
      ],
    },
  ],

  // ── ORL ───────────────────────────────────────────────────────────────────
  orl: [
    {
      title: "Examen ORL",
      fields: [
        { key: "tympans",      label: "Tympans",             type: "select", options: ["Normaux (OD + OG)", "Épanchement OD", "Épanchement OG", "Épanchement bilatéral", "Perforation OD", "Perforation OG", "Rétraction"] },
        { key: "rhinoscopie",  label: "Rhinoscopie",         type: "select", options: ["Normal", "Hypertrophie cornets", "Déviation septale", "Polypes", "Rhinorrhée purulente"] },
        { key: "amygdales",    label: "Amygdales — grade",   type: "select", options: ["Grade I (non visibles)", "Grade II (dans les piliers)", "Grade III (dépassant les piliers)", "Grade IV (touchant la luette)"] },
        { key: "pharynx",      label: "Pharynx",             type: "select", options: ["Normal", "Érythème", "Exsudat", "Granulations"] },
        { key: "larynx",       label: "Larynx / voix",       type: "text",   placeholder: "Voix normale, pas de dysphonie" },
        { key: "audition",     label: "Audition",            type: "select", options: ["Normale (clinique)", "Hypoacousie de perception", "Hypoacousie de transmission", "À tester (audiogramme)"] },
        { key: "vertiges",     label: "Vertiges",            type: "select", options: ["Absents", "VPPB", "Maladie de Ménière", "Névrite vestibulaire", "Central"] },
      ],
    },
  ],

  // ── Pneumologie ───────────────────────────────────────────────────────────
  pneumologie: [
    {
      title: "EFR (spirométrie)",
      fields: [
        { key: "vems",      label: "VEMS",         type: "number", unit: "L",   placeholder: "2.8" },
        { key: "cvf",       label: "CVF",          type: "number", unit: "L",   placeholder: "3.5" },
        { key: "ratio",     label: "VEMS/CVF",     type: "number", unit: "%",   placeholder: "80" },
        { key: "trouble",   label: "Type de trouble", type: "select", options: ["Normal", "Obstructif", "Restrictif", "Mixte"] },
        { key: "tiffeneau", label: "Tiffeneau",    type: "number", unit: "%",   placeholder: "70" },
      ],
    },
    {
      title: "Clinique",
      fields: [
        { key: "dyspnee_mmrc", label: "Dyspnée (mMRC)", type: "select", options: ["0 — Seulement effort intense", "1 — Montée en côte ou escaliers", "2 — Marche lente sur plat", "3 — 100 m sur terrain plat", "4 — Au repos / habillage"] },
        { key: "auscultation", label: "Auscultation",   type: "text",   placeholder: "Murmure vésiculaire bilatéral, pas de sibilances" },
        { key: "sats_repos",   label: "SpO₂ repos",     type: "number", unit: "%",   placeholder: "97" },
        { key: "sats_effort",  label: "SpO₂ effort",    type: "number", unit: "%",   placeholder: "92" },
      ],
    },
  ],

  // ── Neurologie ────────────────────────────────────────────────────────────
  neurologie: [
    {
      title: "Examen neurologique",
      fields: [
        { key: "gcs",         label: "Score de Glasgow (GCS)", type: "number",  unit: "/15", placeholder: "15" },
        { key: "mmse",        label: "MMSE",                   type: "number",  unit: "/30", placeholder: "28" },
        { key: "rot",         label: "ROT",                    type: "select",  options: ["Normaux et symétriques", "Vifs", "Abolis", "Asymétriques"] },
        { key: "babinski",    label: "Signe de Babinski",      type: "select",  options: ["Absent (flexion)", "Présent OD", "Présent OG", "Présent bilatéral"] },
        { key: "coordination",label: "Coordination",           type: "select",  options: ["Normale", "Ataxie cérébelleuse", "Ataxie sensitive", "Dysmétrie"] },
        { key: "nerfs_craniens", label: "Nerfs crâniens",      type: "text",    placeholder: "Normaux — pas de déficit" },
        { key: "sensibilite", label: "Sensibilité",            type: "text",    placeholder: "Conservée aux 4 membres" },
        { key: "motricite",   label: "Motricité",              type: "text",    placeholder: "Force 5/5 aux 4 membres" },
      ],
    },
  ],

  // ── Psychiatrie ───────────────────────────────────────────────────────────
  psychiatrie: [
    {
      title: "Évaluation psychiatrique",
      fields: [
        { key: "phq9",         label: "Score PHQ-9",           type: "number",  unit: "/27", placeholder: "3" },
        { key: "had_anxiete",  label: "HAD — Anxiété",         type: "number",  unit: "/21", placeholder: "5" },
        { key: "had_depres",   label: "HAD — Dépression",      type: "number",  unit: "/21", placeholder: "4" },
        { key: "sommeil",      label: "Sommeil",               type: "select",  options: ["Normal", "Insomnie d'endormissement", "Insomnie de maintien", "Hypersomnie", "Troubles mixtes"] },
        { key: "appetit",      label: "Appétit",               type: "select",  options: ["Conservé", "Diminué", "Augmenté", "Anorexie"] },
        { key: "ideation_sui", label: "Idéation suicidaire",   type: "select",  options: ["Absente", "Idées passives", "Idées actives sans plan", "Plan élaboré — urgence"] },
        { key: "contact",      label: "Contact / affect",      type: "text",    placeholder: "Bon contact, humeur euthymique" },
        { key: "insight",      label: "Insight",               type: "select",  options: ["Présent", "Partiel", "Absent"] },
      ],
    },
  ],

  // ── Ophtalmologie ─────────────────────────────────────────────────────────
  ophtalmologie: [
    {
      title: "Acuité visuelle",
      fields: [
        { key: "av_od_sc", label: "AV OD sans correction", type: "text", placeholder: "10/10" },
        { key: "av_og_sc", label: "AV OG sans correction", type: "text", placeholder: "10/10" },
        { key: "av_od_ac", label: "AV OD avec correction", type: "text", placeholder: "10/10" },
        { key: "av_og_ac", label: "AV OG avec correction", type: "text", placeholder: "10/10" },
      ],
    },
    {
      title: "Tonométrie & fond d'œil",
      fields: [
        { key: "pio_od",    label: "PIO OD",        type: "number", unit: "mmHg", placeholder: "14" },
        { key: "pio_og",    label: "PIO OG",        type: "number", unit: "mmHg", placeholder: "14" },
        { key: "fdo_od",    label: "Fond d'œil OD", type: "text",   placeholder: "Papille normale, rétine normale" },
        { key: "fdo_og",    label: "Fond d'œil OG", type: "text",   placeholder: "Papille normale, rétine normale" },
        { key: "cornee",    label: "Cornée",        type: "text",   placeholder: "Claire, pas d'opacité" },
        { key: "cristallin", label: "Cristallin",   type: "select", options: ["Clair", "Cataracte débutante", "Cataracte évoluée", "Pseudophaque"] },
      ],
    },
  ],

  // ── Gastro-entérologie ────────────────────────────────────────────────────
  gastroenterologie: [
    {
      title: "Examen digestif",
      fields: [
        { key: "douleur_loc",   label: "Douleur — localisation", type: "select", options: ["Absente", "Épigastre", "FID", "FIG", "Hypochondre droit", "Hypochondre gauche", "Péri-ombilicale", "Diffuse"] },
        { key: "transit",       label: "Transit",               type: "select", options: ["Normal", "Constipation", "Diarrhée", "Alternance", "Incontinence"] },
        { key: "selles",        label: "Selles",                type: "select", options: ["Normales", "Méléna", "Rectorragie", "Grasses (stéatorrhée)", "Mucus"] },
        { key: "nausees",       label: "Nausées / vomissements", type: "select", options: ["Absent", "Nausées isolées", "Vomissements occasionnels", "Vomissements répétés"] },
        { key: "palpation",     label: "Palpation abdominale",  type: "text",   placeholder: "Abdomen souple, pas de défense, pas de masse" },
        { key: "hepato",        label: "Hépato-splénomégalie",  type: "select", options: ["Absente", "Hépatomégalie", "Splénomégalie", "Hépato-splénomégalie"] },
      ],
    },
  ],

  // ── Endocrinologie ────────────────────────────────────────────────────────
  endocrinologie: [
    {
      title: "Bilan métabolique",
      fields: [
        { key: "hba1c",      label: "HbA1c",                  type: "number", unit: "%",     placeholder: "6.5" },
        { key: "glycemie",   label: "Glycémie à jeun",        type: "number", unit: "g/L",   placeholder: "1.0" },
        { key: "tsh",        label: "TSH",                    type: "number", unit: "mUI/L", placeholder: "2.0" },
        { key: "t4l",        label: "T4 libre",               type: "number", unit: "pmol/L",placeholder: "16" },
        { key: "tour_taille",label: "Tour de taille",         type: "number", unit: "cm",    placeholder: "88" },
      ],
    },
    {
      title: "Examen clinique endocrinien",
      fields: [
        { key: "thyroide",    label: "Thyroïde",          type: "text",   placeholder: "Pas de goitre, pas de nodule" },
        { key: "peau_ongles", label: "Peau / ongles",     type: "text",   placeholder: "Normal" },
        { key: "gyneco_mast", label: "Gynécomastie",      type: "select", options: ["Absente", "Présente"] },
        { key: "pilosite",    label: "Pilosité",          type: "text",   placeholder: "Normale" },
      ],
    },
  ],

  // ── Rhumatologie ─────────────────────────────────────────────────────────
  rhumatologie: [
    {
      title: "Bilan articulaire",
      fields: [
        { key: "das28",       label: "DAS28",                   type: "number",  unit: "/10",  placeholder: "3.2" },
        { key: "raideur",     label: "Raideur matinale",        type: "number",  unit: "min",  placeholder: "30" },
        { key: "art_doul",    label: "Articulations douloureuses", type: "number", unit: "/28", placeholder: "4" },
        { key: "art_gonflee", label: "Articulations gonflées",  type: "number",  unit: "/28",  placeholder: "2" },
        { key: "eva",         label: "EVA douleur",             type: "number",  unit: "/10",  placeholder: "4" },
      ],
    },
    {
      title: "Examen clinique",
      fields: [
        { key: "articulations", label: "Articulations examinées", type: "textarea", rows: 2, placeholder: "Poignets bilatéraux : douleur à la flexion…" },
        { key: "signes_inflam", label: "Signes inflammatoires",  type: "text",     placeholder: "Rougeur, chaleur, épanchement" },
      ],
    },
  ],

  // ── Kinésithérapie ────────────────────────────────────────────────────────
  kinesitherapeute: [
    {
      title: "Bilan kinésithérapique",
      fields: [
        { key: "zones",       label: "Zones traitées",          type: "text",   placeholder: "Rachis lombaire, épaule droite…" },
        { key: "eva_debut",   label: "EVA douleur (début)",     type: "number", unit: "/10", placeholder: "6" },
        { key: "eva_fin",     label: "EVA douleur (fin)",       type: "number", unit: "/10", placeholder: "3" },
        { key: "techniques",  label: "Techniques utilisées",    type: "text",   placeholder: "Massage, étirements, TENS, ultrason…" },
        { key: "mobilite",    label: "Mobilité",                type: "text",   placeholder: "Flexion rachis améliorée, -10° → +20°" },
        { key: "objectifs",   label: "Objectifs séance",        type: "textarea",rows: 2, placeholder: "Réduire la douleur, améliorer la mobilité en flexion lombaire" },
      ],
    },
  ],

  // ── Chirurgien-dentiste ───────────────────────────────────────────────────
  dentiste: [
    {
      title: "Examen bucco-dentaire",
      fields: [
        { key: "dents_exam",   label: "Dents examinées (numéros)", type: "text",   placeholder: "16, 26, 36, 46…" },
        { key: "caries",       label: "Caries",                    type: "text",   placeholder: "Carie disto-proximale 16" },
        { key: "gencives",     label: "Gencives",                  type: "select", options: ["Saines", "Gingivite légère", "Gingivite modérée", "Parodontite"] },
        { key: "occlusion",    label: "Occlusion",                 type: "select", options: ["Classe I", "Classe II div 1", "Classe II div 2", "Classe III"] },
        { key: "tartre",       label: "Tartre",                    type: "select", options: ["Absent", "Discret", "Modéré", "Important"] },
        { key: "prothese",     label: "Prothèse existante",        type: "text",   placeholder: "Couronne métal-céramique 26" },
        { key: "acte",         label: "Acte réalisé",              type: "text",   placeholder: "Détartrage, soin canalaire 16…" },
      ],
    },
  ],

  // ── Infectiologie ─────────────────────────────────────────────────────────
  infectiologie: [
    {
      title: "Bilan infectieux",
      fields: [
        { key: "foyer",       label: "Foyer infectieux",           type: "text",   placeholder: "Pulmonaire, urinaire, cutané…" },
        { key: "crp",         label: "CRP",                        type: "number", unit: "mg/L", placeholder: "45" },
        { key: "pct",         label: "Procalcitonine",             type: "number", unit: "ng/mL",placeholder: "0.5" },
        { key: "nfs_pnn",     label: "PNN",                        type: "number", unit: "G/L",  placeholder: "8.5" },
        { key: "antibiogramme", label: "Antibiogramme / germe",    type: "text",   placeholder: "E.coli BLSE — sensible à imipenem" },
        { key: "duree_atb",   label: "Durée ATB prévue",           type: "text",   placeholder: "7 jours" },
      ],
    },
  ],

  // ── Néphrologie ───────────────────────────────────────────────────────────
  nephrologie: [
    {
      title: "Bilan rénal",
      fields: [
        { key: "creatinine",  label: "Créatininémie",              type: "number", unit: "mg/L",   placeholder: "8" },
        { key: "dfg",         label: "DFGe (CKD-EPI)",            type: "number", unit: "mL/min/1.73m²", placeholder: "75" },
        {
          key: "stade_ckd", label: "Stade MRC (CKD)", type: "select",
          options: ["G1 ≥ 90", "G2 — 60–89", "G3a — 45–59", "G3b — 30–44", "G4 — 15–29", "G5 < 15 / dialyse"],
        },
        { key: "proteinurie", label: "Protéinurie",                type: "number", unit: "g/24h",  placeholder: "0.3" },
        { key: "hematurie",   label: "Hématurie",                  type: "select", options: ["Absente", "Microscopique", "Macroscopique"] },
        { key: "diurese",     label: "Diurèse",                    type: "number", unit: "mL/24h", placeholder: "1800" },
      ],
    },
  ],
};

// ── Extra bilan groups the doctor can enable (any specialty) ─────────────────
// "Bilan clinique spécialisé" is not one-size-fits-all: a doctor can add the
// bilan types they actually practise (métabolique, radiologique, …). The keys
// are stored on doctorProfile.extraBilans; field keys are prefixed to avoid
// colliding with specialty-field keys in consultationNote.extraFields.

export interface BilanGroup extends SpecialtyGroup { key: string; }

export const BILAN_CATALOG: BilanGroup[] = [
  {
    key: "metabolique",
    title: "Bilan métabolique",
    fields: [
      { key: "bl_hba1c",     label: "HbA1c",           type: "number", unit: "%",     placeholder: "6.5" },
      { key: "bl_glycemie",  label: "Glycémie à jeun", type: "number", unit: "g/L",   placeholder: "1.0" },
      { key: "bl_chol_t",    label: "Cholestérol total", type: "number", unit: "g/L", placeholder: "1.9" },
      { key: "bl_ldl",       label: "LDL",             type: "number", unit: "g/L",   placeholder: "1.1" },
      { key: "bl_hdl",       label: "HDL",             type: "number", unit: "g/L",   placeholder: "0.5" },
      { key: "bl_tg",        label: "Triglycérides",   type: "number", unit: "g/L",   placeholder: "1.2" },
      { key: "bl_uricemie",  label: "Uricémie",        type: "number", unit: "mg/L",  placeholder: "55" },
    ],
  },
  {
    // Point-of-care measurements typically taken at the desk (endocrinology /
    // diabetology): capillary glucose + urine dipstick. Secretary-fillable.
    key: "capillaire_urinaire",
    title: "Glycémie capillaire & bandelette urinaire",
    fields: [
      { key: "bl_gly_cap",   label: "Glycémie capillaire", type: "number", unit: "g/L", placeholder: "1.10" },
      { key: "bl_bu_glyco",  label: "Glycosurie",          type: "select", options: ["Négatif", "Traces", "+", "++", "+++", "++++"] },
      { key: "bl_bu_aceto",  label: "Acétonurie (cétones)", type: "select", options: ["Négatif", "Traces", "+", "++", "+++", "++++"] },
      { key: "bl_bu_prot",   label: "Protéinurie",         type: "select", options: ["Négatif", "Traces", "+", "++", "+++", "++++"] },
      { key: "bl_bu_ph",     label: "pH urinaire",         type: "number", placeholder: "6.0" },
      { key: "bl_bu_autres", label: "BU — autres (sang, nitrites, leucocytes…)", type: "text", placeholder: "Sang négatif, nitrites négatifs, leucocytes négatifs" },
    ],
  },
  {
    // Screening for end-organ damage in diabetes (bilan de retentissement /
    // dégénératif). Ordered periodically to detect micro- and macro-vascular
    // complications.
    key: "degeneratif_diabete",
    title: "Bilan dégénératif du diabète",
    fields: [
      { key: "bl_diab_cardio",      label: "Évaluation cardiaque",                          type: "text", placeholder: "ECG, épreuve d'effort, échocardiographie…" },
      { key: "bl_diab_fo",          label: "Fond d'œil",                                    type: "text", placeholder: "Pas de rétinopathie / rétinopathie non proliférante…" },
      { key: "bl_diab_microalb",    label: "Microalbuminurie / Créatininurie (échantillon)", type: "text", placeholder: "Rapport A/C mg/g" },
      { key: "bl_diab_prot24",      label: "Protéinurie de 24h",                            type: "number", unit: "g/24h", placeholder: "0.1" },
      { key: "bl_diab_doppler_tsa", label: "Écho-Doppler des troncs supra-aortiques",       type: "text", placeholder: "Compte rendu" },
      { key: "bl_diab_doppler_mi",  label: "Écho-Doppler des membres inférieurs",           type: "text", placeholder: "Compte rendu" },
      { key: "bl_diab_monofilament", label: "Test au monofilament — score DN4",             type: "text", placeholder: "Monofilament perçu / DN4 __ /10" },
    ],
  },
  {
    key: "biologique",
    title: "Bilan biologique",
    fields: [
      { key: "bl_nfs",        label: "NFS",             type: "text",   placeholder: "Hb 13,5 g/dL, GB 7 G/L, plaquettes 250 G/L" },
      { key: "bl_crp",        label: "CRP",             type: "number", unit: "mg/L", placeholder: "5" },
      { key: "bl_creat",      label: "Créatininémie",   type: "number", unit: "mg/L", placeholder: "9" },
      { key: "bl_iono",       label: "Ionogramme",      type: "text",   placeholder: "Na 140, K 4,1" },
      { key: "bl_transam",    label: "Transaminases",   type: "text",   placeholder: "ASAT 25, ALAT 30 UI/L" },
      { key: "bl_tsh_bio",    label: "TSH",             type: "number", unit: "mUI/L", placeholder: "2.0" },
      { key: "bl_bio_autres", label: "Autres résultats", type: "textarea", rows: 2, placeholder: "Ferritine, vitamine D…" },
    ],
  },
  {
    key: "radiologique",
    title: "Bilan radiologique",
    fields: [
      { key: "bl_rx_type",       label: "Type d'imagerie", type: "select", options: ["Radiographie", "Échographie", "Scanner (TDM)", "IRM", "Mammographie", "Autre"] },
      { key: "bl_rx_region",     label: "Région explorée", type: "text",   placeholder: "Thorax, abdomen, rachis lombaire…" },
      { key: "bl_rx_resultat",   label: "Résultat",        type: "textarea", rows: 3, placeholder: "Description des images…" },
      { key: "bl_rx_conclusion", label: "Conclusion",      type: "text",   placeholder: "Pas d'anomalie décelable" },
    ],
  },
  {
    key: "cardiaque",
    title: "Bilan cardiaque",
    fields: [
      { key: "bl_ecg_rythme", label: "ECG — rythme",   type: "select", options: ["Sinusal", "Fibrillation auriculaire", "Flutter", "Tachycardie", "Bradycardie", "Bloc"] },
      { key: "bl_ecg_fc",     label: "FC (ECG)",        type: "number", unit: "bpm", placeholder: "72" },
      { key: "bl_ecg_anom",   label: "Anomalies ECG",   type: "text",   placeholder: "Pas d'anomalie de repolarisation" },
      { key: "bl_echo_coeur", label: "Échocardiographie", type: "text", placeholder: "FE 60 %, pas de valvulopathie" },
    ],
  },
  {
    key: "hepatique",
    title: "Bilan hépatique",
    fields: [
      { key: "bl_hep_asat",   label: "ASAT (TGO)",       type: "number", unit: "UI/L",  placeholder: "25" },
      { key: "bl_hep_alat",   label: "ALAT (TGP)",       type: "number", unit: "UI/L",  placeholder: "30" },
      { key: "bl_hep_ggt",    label: "GGT",              type: "number", unit: "UI/L",  placeholder: "35" },
      { key: "bl_hep_pal",    label: "Phosphatases alcalines", type: "number", unit: "UI/L", placeholder: "80" },
      { key: "bl_hep_bili_t", label: "Bilirubine totale", type: "number", unit: "mg/L", placeholder: "8" },
      { key: "bl_hep_bili_d", label: "Bilirubine conjuguée", type: "number", unit: "mg/L", placeholder: "3" },
      { key: "bl_hep_alb",    label: "Albumine",         type: "number", unit: "g/L",   placeholder: "42" },
      { key: "bl_hep_tp",     label: "TP",               type: "number", unit: "%",     placeholder: "95" },
    ],
  },
  {
    key: "renal",
    title: "Bilan rénal",
    fields: [
      { key: "bl_ren_uree",   label: "Urée",            type: "number", unit: "g/L",   placeholder: "0.35" },
      { key: "bl_ren_creat",  label: "Créatininémie",   type: "number", unit: "mg/L",  placeholder: "9" },
      { key: "bl_ren_dfg",    label: "DFGe (CKD-EPI)",  type: "number", unit: "mL/min/1.73m²", placeholder: "90" },
      { key: "bl_ren_na",     label: "Natrémie (Na⁺)",  type: "number", unit: "mmol/L", placeholder: "140" },
      { key: "bl_ren_k",      label: "Kaliémie (K⁺)",   type: "number", unit: "mmol/L", placeholder: "4.1" },
      { key: "bl_ren_cl",     label: "Chlorémie (Cl⁻)", type: "number", unit: "mmol/L", placeholder: "103" },
      { key: "bl_ren_prot",   label: "Protéinurie 24h", type: "number", unit: "g/24h", placeholder: "0.1" },
    ],
  },
  {
    key: "lipidique",
    title: "Bilan lipidique",
    fields: [
      { key: "bl_lip_ct",   label: "Cholestérol total", type: "number", unit: "g/L", placeholder: "1.9" },
      { key: "bl_lip_ldl",  label: "LDL-cholestérol",   type: "number", unit: "g/L", placeholder: "1.1" },
      { key: "bl_lip_hdl",  label: "HDL-cholestérol",   type: "number", unit: "g/L", placeholder: "0.5" },
      { key: "bl_lip_tg",   label: "Triglycérides",     type: "number", unit: "g/L", placeholder: "1.2" },
      { key: "bl_lip_nonhdl", label: "Non-HDL",         type: "number", unit: "g/L", placeholder: "1.4" },
    ],
  },
  {
    key: "thyroidien",
    title: "Bilan thyroïdien",
    fields: [
      { key: "bl_thy_tsh",  label: "TSH",   type: "number", unit: "mUI/L", placeholder: "2.0" },
      { key: "bl_thy_t4l",  label: "T4 libre", type: "number", unit: "pmol/L", placeholder: "16" },
      { key: "bl_thy_t3l",  label: "T3 libre", type: "number", unit: "pmol/L", placeholder: "5" },
      { key: "bl_thy_tpo",  label: "Anticorps anti-TPO", type: "text", placeholder: "Négatif / titre" },
      { key: "bl_thy_trak", label: "Ac anti récepteurs de la TSH (TRAK)", type: "text", placeholder: "Négatif / titre" },
      { key: "bl_thy_tg",   label: "Ac Anti Thyroglobuline (Ac anti Tg)", type: "text", placeholder: "Négatif / titre" },
      { key: "bl_thy_calcitonine", label: "Calcitonine", type: "number", unit: "pg/mL", placeholder: "" },
      { key: "bl_thy_echo", label: "Échographie cervicale", type: "text", placeholder: "Compte rendu" },
      { key: "bl_thy_scinti", label: "Scintigraphie", type: "text", placeholder: "Compte rendu" },
    ],
  },
  {
    key: "inflammatoire",
    title: "Bilan inflammatoire",
    fields: [
      { key: "bl_inf_crp",  label: "CRP",           type: "number", unit: "mg/L", placeholder: "5" },
      { key: "bl_inf_vs",   label: "VS (1re heure)", type: "number", unit: "mm",  placeholder: "10" },
      { key: "bl_inf_fib",  label: "Fibrinogène",   type: "number", unit: "g/L",  placeholder: "3.5" },
      { key: "bl_inf_pct",  label: "Procalcitonine", type: "number", unit: "ng/mL", placeholder: "0.1" },
    ],
  },
  {
    key: "hemostase",
    title: "Bilan d'hémostase",
    fields: [
      { key: "bl_hem_tp",   label: "TP",          type: "number", unit: "%",  placeholder: "100" },
      { key: "bl_hem_inr",  label: "INR",         type: "number", placeholder: "1.0" },
      { key: "bl_hem_tca",  label: "TCA (ratio)", type: "number", placeholder: "1.1" },
      { key: "bl_hem_plq",  label: "Plaquettes",  type: "number", unit: "G/L", placeholder: "250" },
      { key: "bl_hem_fib",  label: "Fibrinogène", type: "number", unit: "g/L", placeholder: "3.0" },
    ],
  },
  {
    key: "martial",
    title: "Bilan martial (fer)",
    fields: [
      { key: "bl_mar_fer",   label: "Fer sérique",       type: "number", unit: "µmol/L", placeholder: "15" },
      { key: "bl_mar_ferr",  label: "Ferritine",         type: "number", unit: "µg/L",   placeholder: "80" },
      { key: "bl_mar_cst",   label: "Coefficient de saturation", type: "number", unit: "%", placeholder: "30" },
      { key: "bl_mar_trf",   label: "Transferrine",      type: "number", unit: "g/L",    placeholder: "2.5" },
    ],
  },
  {
    key: "hemogramme",
    title: "Hémogramme (NFS)",
    fields: [
      { key: "bl_nfs_hb",   label: "Hémoglobine", type: "number", unit: "g/dL", placeholder: "13.5" },
      { key: "bl_nfs_ht",   label: "Hématocrite", type: "number", unit: "%",    placeholder: "40" },
      { key: "bl_nfs_vgm",  label: "VGM",         type: "number", unit: "fL",   placeholder: "88" },
      { key: "bl_nfs_gb",   label: "Globules blancs", type: "number", unit: "G/L", placeholder: "7" },
      { key: "bl_nfs_pnn",  label: "PNN",         type: "number", unit: "G/L",  placeholder: "4" },
      { key: "bl_nfs_lymph", label: "Lymphocytes", type: "number", unit: "G/L", placeholder: "2.5" },
      { key: "bl_nfs_plq",  label: "Plaquettes",  type: "number", unit: "G/L",  placeholder: "250" },
    ],
  },
  {
    key: "urinaire",
    title: "Bilan urinaire (ECBU)",
    fields: [
      { key: "bl_ecbu_leuco",  label: "Leucocytes",  type: "text", placeholder: "< 10⁴/mL" },
      { key: "bl_ecbu_hematies", label: "Hématies",  type: "text", placeholder: "< 10⁴/mL" },
      { key: "bl_ecbu_germe",  label: "Germe / culture", type: "text", placeholder: "Stérile / E. coli 10⁵…" },
      { key: "bl_ecbu_atb",    label: "Antibiogramme", type: "text", placeholder: "Sensible à…" },
      { key: "bl_ecbu_prot",   label: "Protéinurie", type: "select", options: ["Négatif", "Traces", "+", "++", "+++"] },
    ],
  },
  {
    key: "gazometrie",
    title: "Gazométrie artérielle",
    fields: [
      { key: "bl_gaz_ph",    label: "pH",     type: "number", placeholder: "7.40" },
      { key: "bl_gaz_pao2",  label: "PaO₂",   type: "number", unit: "mmHg", placeholder: "95" },
      { key: "bl_gaz_paco2", label: "PaCO₂",  type: "number", unit: "mmHg", placeholder: "40" },
      { key: "bl_gaz_hco3",  label: "HCO₃⁻",  type: "number", unit: "mmol/L", placeholder: "24" },
      { key: "bl_gaz_sao2",  label: "SaO₂",   type: "number", unit: "%", placeholder: "97" },
      { key: "bl_gaz_lactate", label: "Lactates", type: "number", unit: "mmol/L", placeholder: "1.2" },
    ],
  },
  {
    key: "vitaminique",
    title: "Bilan vitaminique & nutritionnel",
    fields: [
      { key: "bl_vit_d",    label: "Vitamine D (25-OH)", type: "number", unit: "ng/mL", placeholder: "30" },
      { key: "bl_vit_b12",  label: "Vitamine B12", type: "number", unit: "pg/mL", placeholder: "400" },
      { key: "bl_vit_fol",  label: "Folates (B9)", type: "number", unit: "ng/mL", placeholder: "8" },
      { key: "bl_vit_alb",  label: "Albumine",     type: "number", unit: "g/L",   placeholder: "42" },
      { key: "bl_vit_ca",   label: "Calcémie",     type: "number", unit: "mg/L",  placeholder: "95" },
    ],
  },
  {
    key: "preop",
    title: "Bilan préopératoire",
    fields: [
      { key: "bl_pre_groupe", label: "Groupe sanguin / Rh", type: "text", placeholder: "O Rh+" },
      { key: "bl_pre_nfs",    label: "NFS",       type: "text", placeholder: "Hb 13,5 · plaquettes 250 G/L" },
      { key: "bl_pre_tp",     label: "TP / INR",  type: "text", placeholder: "TP 100 % · INR 1,0" },
      { key: "bl_pre_tca",    label: "TCA",       type: "text", placeholder: "Ratio 1,1" },
      { key: "bl_pre_iono",   label: "Ionogramme", type: "text", placeholder: "Na 140 · K 4,1" },
      { key: "bl_pre_ecg",    label: "ECG",       type: "text", placeholder: "RSR, pas d'anomalie" },
      { key: "bl_pre_rx",     label: "RX thorax", type: "text", placeholder: "Sans particularité" },
      { key: "bl_pre_consult", label: "Consultation pré-anesthésique", type: "select", options: ["Non faite", "Faite — ASA I", "Faite — ASA II", "Faite — ASA III", "Faite — ASA IV"] },
    ],
  },
  {
    key: "specialise",
    title: "Bilan spécialisé",
    fields: [
      { key: "bl_spec_titre",    label: "Intitulé du bilan", type: "text", placeholder: "Bilan allergologique, sérologies…" },
      { key: "bl_spec_resultat", label: "Résultats",         type: "textarea", rows: 3, placeholder: "Résultats détaillés…" },
      { key: "bl_spec_conclusion", label: "Conclusion",      type: "text", placeholder: "" },
    ],
  },
];

// Specialties that share the same field config
SPECIALTY_FIELD_MAP["medecine_interne"] = SPECIALTY_FIELD_MAP["medecin_generaliste"];
SPECIALTY_FIELD_MAP["medecine_urgence"] = SPECIALTY_FIELD_MAP["medecin_generaliste"];
SPECIALTY_FIELD_MAP["geriatrie"]        = SPECIALTY_FIELD_MAP["medecin_generaliste"];
SPECIALTY_FIELD_MAP["chirurgie_generale"] = SPECIALTY_FIELD_MAP["medecin_generaliste"];

/** Resolve the internal specialty id from a free-text label. */
export function specialtyIdFromLabel(specialtyLabel?: string): string | null {
  if (!specialtyLabel) return null;
  const LABEL_TO_ID: Record<string, string> = {
    "généraliste":     "medecin_generaliste",
    "interne":         "medecine_interne",
    "urgence":         "medecine_urgence",
    "Gériatrie":       "geriatrie",
    "Cardiologie":     "cardiologie",
    "Dermatologie":    "dermatologie",
    "Gynécologie":     "gynecologie",
    "gynécologique":   "gynecologie_med",
    "Pédiatrie":       "pediatrie",
    "ORL":             "orl",
    "Pneumologie":     "pneumologie",
    "Neurologie":      "neurologie",
    "Neurochirurgie":  "neurologie",
    "Psychiatrie":     "psychiatrie",
    "Ophtalmologie":   "ophtalmologie",
    "Gastro":          "gastroenterologie",
    "Endocrinologie":  "endocrinologie",
    "Rhumatologie":    "rhumatologie",
    "Kinési":          "kinesitherapeute",
    "dentiste":        "dentiste",
    "Infectiologie":   "infectiologie",
    "Néphrologie":     "nephrologie",
    "Chirurgie générale": "chirurgie_generale",
  };
  for (const [keyword, id] of Object.entries(LABEL_TO_ID)) {
    if (specialtyLabel.includes(keyword)) return id;
  }
  return null;
}

/** Look up the specialty exam-field groups from a label string. */
export function getSpecialtyGroups(specialtyLabel?: string): SpecialtyGroup[] {
  const id = specialtyIdFromLabel(specialtyLabel);
  return (id && SPECIALTY_FIELD_MAP[id]) || [];
}

// ── Default bilans per specialty ──────────────────────────────────────────────
// The bilans a doctor of each specialty most commonly orders. Shown by default
// (until the doctor saves their own preferred set). Biology + radiology are in
// every list so the "bilans biologique et radiologique" section is never empty.
export const DEFAULT_BILANS = ["biologique", "radiologique"];

export const SPECIALTY_BILANS: Record<string, string[]> = {
  medecin_generaliste: ["biologique", "radiologique", "hemogramme", "inflammatoire"],
  medecine_interne:    ["biologique", "radiologique", "hemogramme", "inflammatoire", "hepatique", "renal"],
  medecine_urgence:    ["biologique", "radiologique", "hemogramme", "gazometrie", "inflammatoire"],
  geriatrie:           ["biologique", "radiologique", "hemogramme", "renal", "vitaminique"],
  cardiologie:         ["biologique", "radiologique", "cardiaque", "lipidique"],
  endocrinologie:      ["biologique", "radiologique", "metabolique", "thyroidien", "lipidique", "capillaire_urinaire", "degeneratif_diabete"],
  nephrologie:         ["biologique", "radiologique", "renal", "hemogramme", "urinaire"],
  gastroenterologie:   ["biologique", "radiologique", "hepatique", "inflammatoire"],
  pneumologie:         ["biologique", "radiologique", "gazometrie", "inflammatoire"],
  infectiologie:       ["biologique", "radiologique", "inflammatoire", "hemogramme", "urinaire"],
  rhumatologie:        ["biologique", "radiologique", "inflammatoire", "hemogramme"],
  gynecologie:         ["biologique", "radiologique", "hemogramme", "martial"],
  gynecologie_med:     ["biologique", "radiologique", "hemogramme", "martial"],
  pediatrie:           ["biologique", "radiologique", "hemogramme", "capillaire_urinaire"],
  neurologie:          ["biologique", "radiologique"],
  dermatologie:        ["biologique", "radiologique"],
  orl:                 ["biologique", "radiologique"],
  ophtalmologie:       ["biologique", "radiologique"],
  psychiatrie:         ["biologique", "thyroidien"],
  dentiste:            ["radiologique"],
  kinesitherapeute:    ["radiologique"],
  chirurgie_generale:  ["biologique", "radiologique", "hemogramme", "hemostase", "preop"],
};

/** The default set of bilan keys for a doctor's specialty. */
export function getSpecialtyBilans(specialtyLabel?: string): string[] {
  const id = specialtyIdFromLabel(specialtyLabel);
  return (id && SPECIALTY_BILANS[id]) || DEFAULT_BILANS;
}
