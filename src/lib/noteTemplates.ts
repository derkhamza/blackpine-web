// Clinical note templates — ported from blackpine-app/lib/noteTemplates.ts

export interface NoteTemplate {
  id:           string;
  label:        string;
  category:     string;
  motif?:       string;
  examination?:  string;
  diagnosis?:    string;
  treatment?:    string;
}

export const TEMPLATE_CATEGORIES = [
  "Général", "Cardio / HTA", "Diabète", "Respiratoire",
  "Digestif", "Rhumatologie", "Neurologie", "Infectieux",
  "Gynéco", "Pédiatrie",
] as const;

export const NOTE_TEMPLATES: NoteTemplate[] = [
  // ── Général ──────────────────────────────────────────────────────────────
  {
    id: "gen_soap", label: "Trame SOAP vierge", category: "Général",
    motif: "",
    examination: "Examen général : bon état général, conscient, orienté.\nConstantes : TA _/_ mmHg, FC _ bpm, T° _°C, SpO₂ _%, poids _ kg.",
    diagnosis: "",
    treatment: "",
  },
  {
    id: "gen_normal", label: "Examen général normal", category: "Général",
    motif: "Consultation de routine.",
    examination: "Bon état général. Patient eupnéique, apyrétique.\nTA _/_ mmHg. Auscultation cardio-pulmonaire normale. Abdomen souple, indolore.",
    diagnosis: "Examen clinique dans les limites de la normale.",
    treatment: "Pas de modification thérapeutique. Prochain contrôle dans _ mois.",
  },
  {
    id: "gen_prevention", label: "Consultation préventive", category: "Général",
    motif: "Bilan de santé / consultation préventive annuelle.",
    examination: "Examen clinique complet sans anomalie notable.\nTA _/_ mmHg, FC _ bpm, IMC : _.",
    diagnosis: "Bilan de santé satisfaisant.",
    treatment: "Conseils hygiéno-diététiques.\nMise à jour du carnet vaccinal.\nBilan biologique de contrôle annuel prescrit.",
  },
  {
    id: "gen_preop", label: "Bilan pré-opératoire", category: "Général",
    motif: "Consultation pré-opératoire pour _.",
    examination: "Examen clinique sans contre-indication anesthésique apparente.\nTA _/_ mmHg, FC _ bpm. Auscultation cardio-pulmonaire normale.",
    diagnosis: "Aptitude à l'anesthésie générale / locorégionale.",
    treatment: "NFS, coagulation, groupe sanguin, ionogramme, ECG, Rx thorax prescrits.\nAvis anesthésiste si nécessaire.",
  },

  // ── Cardio / HTA ──────────────────────────────────────────────────────────
  {
    id: "cv_hta_decouverte", label: "HTA découverte", category: "Cardio / HTA",
    motif: "Découverte d'une hypertension artérielle lors d'un bilan de santé.",
    examination: "TA _ /_ mmHg (mesure répétée). FC _ bpm. Auscultation cardiaque normale. Pas de souffle vasculaire. Pas d'œdème.",
    diagnosis: "Hypertension artérielle de grade _ (ESC/ESH).",
    treatment: "Règles hygiéno-diététiques : restriction sodée, activité physique, sevrage tabagique si applicable.\nBilan initial prescrit : ionogramme, créatinine, glycémie, ECG, fond d'œil.\nRéévaluation dans 4 semaines.\nInitiation thérapeutique si persistance.",
  },
  {
    id: "cv_hta_suivi", label: "Suivi HTA équilibrée", category: "Cardio / HTA",
    motif: "Suivi hypertension artérielle.",
    examination: "TA _ /_ mmHg. FC _ bpm. Bien toléré. Pas d'effet secondaire signalé. Pas de signe d'atteinte d'organe cible.",
    diagnosis: "HTA équilibrée sous traitement actuel.",
    treatment: "Renouvellement du traitement antihypertenseur actuel.\nConseils de mesure tensionnelle à domicile.\nProchaine consultation dans _ mois.",
  },
  {
    id: "cv_douleur_thoracique", label: "Douleur thoracique", category: "Cardio / HTA",
    motif: "Douleur thoracique.",
    examination: "Douleur décrite comme _ d'intensité _ /10. TA _ /_ mmHg. FC _ bpm. Auscultation cardio-pulmonaire normale. ECG : _.",
    diagnosis: "À préciser après bilan.",
    treatment: "ECG réalisé. Troponines prescrites. Orientation vers les urgences si douleur d'allure coronarienne.",
  },

  // ── Diabète ──────────────────────────────────────────────────────────────
  {
    id: "diab_suivi", label: "Suivi diabète type 2", category: "Diabète",
    motif: "Suivi diabète de type 2.",
    examination: "Poids _ kg (variation _). TA _ /_ mmHg. Examen des pieds : _. Pas de signe de neuropathie périphérique.",
    diagnosis: "Diabète de type 2 équilibré / déséquilibré (HbA1c _%).",
    treatment: "Renouvellement du traitement antidiabétique.\nHbA1c, bilan rénal, lipidique prescrits.\nFond d'œil à planifier.\nConseils diététiques renforcés.",
  },
  {
    id: "diab_decouverte", label: "Diabète découverte", category: "Diabète",
    motif: "Hyperglycémie découverte fortuitement / glycémie à jeun élevée.",
    examination: "Poids _ kg, IMC _. TA _ /_ mmHg. Examen clinique sans anomalie spécifique.",
    diagnosis: "Diabète de type 2 nouvellement diagnostiqué (glycémie à jeun _ g/L, HbA1c _%).",
    treatment: "Éducation thérapeutique initiale. Conseils diététiques.\nMétformine initiée si pas de contre-indication.\nBilan cardiovasculaire prescrit. Consultation ophtalmologique et néphrologue prévue.",
  },

  // ── Respiratoire ─────────────────────────────────────────────────────────
  {
    id: "resp_ivab", label: "Infection voies aériennes basses", category: "Respiratoire",
    motif: "Toux, fièvre, dyspnée.",
    examination: "T° _°C. SpO₂ _%. Auscultation pulmonaire : _. Fréquence respiratoire _ /min.",
    diagnosis: "Infection des voies aériennes basses (bronchite / pneumopathie).",
    treatment: "Repos, hydratation. Antipyrétique.\nAntibiothérapie si signe de gravité ou pneumopathie confirmée.\nRadiographie thoracique si doute diagnostique.",
  },
  {
    id: "resp_asthme", label: "Asthme — suivi", category: "Respiratoire",
    motif: "Suivi asthme / évaluation du contrôle.",
    examination: "Pas de dyspnée au repos. Auscultation : _ (sibilants / murmure vésiculaire normal). DEP : _.",
    diagnosis: "Asthme _ (contrôlé / partiellement contrôlé / non contrôlé).",
    treatment: "Renouvellement du traitement de fond.\nRéévaluation du score de contrôle (ACT).\nTechnique d'inhalation vérifiée.",
  },

  // ── Digestif ─────────────────────────────────────────────────────────────
  {
    id: "dig_gastrite", label: "Gastrite / Dyspepsie", category: "Digestif",
    motif: "Douleurs épigastriques, brûlures, nausées.",
    examination: "Abdomen souple. Douleur à la palpation épigastrique. Pas de défense ni de contracture. Transit normal.",
    diagnosis: "Gastrite / dyspepsie fonctionnelle.",
    treatment: "IPP prescrit pour _ semaines. Règles hygiéno-diététiques. Recherche H. pylori si récidivant.",
  },
  {
    id: "dig_colon", label: "Côlon irritable", category: "Digestif",
    motif: "Douleurs abdominales, troubles du transit.",
    examination: "Abdomen souple, sensible sans localisation précise. Pas de masse palpable. TR : normal.",
    diagnosis: "Syndrome de l'intestin irritable (Rome IV).",
    treatment: "Régime pauvre en FODMAPs. Antispasmodique si besoin. Gestion du stress. Réévaluation dans 4 semaines.",
  },

  // ── Rhumatologie ─────────────────────────────────────────────────────────
  {
    id: "rhumato_lombalgie", label: "Lombalgie commune", category: "Rhumatologie",
    motif: "Douleurs lombaires.",
    examination: "Contracture paravertébrale lombaire. Lasègue : _. Pas de déficit neurologique. Pas de syndrome de la queue de cheval.",
    diagnosis: "Lombalgie commune non spécifique.",
    treatment: "Antalgiques / AINS si toléré. Myorelaxant si contracture. Kinésithérapie prescrite. Maintien d'une activité modérée. Éviter l'alitement prolongé.",
  },
  {
    id: "rhumato_gonarthrose", label: "Gonarthrose", category: "Rhumatologie",
    motif: "Douleurs du genou, enraidissement.",
    examination: "Crépitements à la mobilisation du genou. Épanchement articulaire : _. Mobilité : _ / _ degrés. Pas de dérobement.",
    diagnosis: "Gonarthrose stade _ (Kellgren-Lawrence).",
    treatment: "Antalgiques palier 1 / AINS local. Infiltration si épanchement important. Kinésithérapie. Contrôle pondéral.",
  },

  // ── Neurologie ───────────────────────────────────────────────────────────
  {
    id: "neuro_migraine", label: "Migraine", category: "Neurologie",
    motif: "Céphalées.",
    examination: "Examen neurologique normal. Pas de raideur méningée. Fond d'œil non réalisé (examen normal).",
    diagnosis: "Migraine _ (avec / sans aura) selon critères ICHD-3.",
    treatment: "Traitement de crise : triptans / AINS. Traitement de fond si > 2 crises/mois. Agenda des céphalées remis.",
  },

  // ── Infectieux ────────────────────────────────────────────────────────────
  {
    id: "inf_rhume", label: "Rhinopharyngite / Rhume", category: "Infectieux",
    motif: "Rhinorrhée, éternuements, légère fièvre.",
    examination: "T° _°C. Pharynx légèrement érythémateux. Pas d'angine. Auscultation pulmonaire normale.",
    diagnosis: "Rhinopharyngite virale aiguë.",
    treatment: "Traitement symptomatique : antipyrétique, désobstruction nasale.\nPas d'antibiotiques (origine virale).\nMesures barrière. Hydratation.",
  },
  {
    id: "inf_angine", label: "Angine", category: "Infectieux",
    motif: "Maux de gorge, fièvre.",
    examination: "T° _°C. Amygdales _. TDR streptocoque : _.",
    diagnosis: "Angine _ (virale / bactérienne à streptocoque A).",
    treatment: "Si TDR positif : amoxicilline _ g/j x 6 jours.\nSi TDR négatif : traitement symptomatique uniquement.",
  },

  // ── Gynéco ────────────────────────────────────────────────────────────────
  {
    id: "gyneco_suivi", label: "Suivi gynécologique", category: "Gynéco",
    motif: "Consultation gynécologique de suivi.",
    examination: "Examen pelvien : _. Col : _. Pas de leucorrhée pathologique. Seins : _.",
    diagnosis: "Examen gynécologique normal / à préciser.",
    treatment: "Frottis cervico-vaginal si délai dépassé.\nContraception actuelle : _. Renouvellement / adaptation.",
  },

  // ── Pédiatrie ─────────────────────────────────────────────────────────────
  {
    id: "ped_consultation", label: "Consultation pédiatrique", category: "Pédiatrie",
    motif: "Consultation pédiatrique.",
    examination: "Poids _ kg (P_). Taille _ cm (T_). PC _ cm. Examen général : bon état général, bonne tonicité.\nAuscultation normale. Abdomen souple.",
    diagnosis: "",
    treatment: "Carnet vaccinal vérifié et mis à jour.\nConseils parentaux.",
  },
];
