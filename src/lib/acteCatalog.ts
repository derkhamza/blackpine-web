// Curated catalog of medical acts a doctor commonly performs in Morocco,
// grouped by specialty. Codes are the public NGAP "lettre-clé" families
// (C/CS = consultations, V/VS = home visits, K = technical medical acts,
// KC = surgery, Z = imaging/radiology, B = biology). The numeric coefficient
// and the dirham tariff are intentionally NOT shipped — they depend on the
// convention (CNOPS/CNSS) or the doctor's private-sector price, so the doctor
// sets the price when importing an act. Labels are French (the language of
// Moroccan medical paperwork).

export interface ActeCatalogItem {
  code:  string;   // NGAP lettre-clé family — the doctor refines + prices it
  label: string;
}

export interface ActeCatalogGroup {
  specialty: string;
  items:     ActeCatalogItem[];
}

export const ACTE_CATALOG: ActeCatalogGroup[] = [
  {
    specialty: "Consultations",
    items: [
      { code: "C",     label: "Consultation (médecine générale)" },
      { code: "CS",    label: "Consultation spécialisée" },
      { code: "CNPSY", label: "Consultation neuropsychiatrique" },
      { code: "C",     label: "Consultation de contrôle" },
      { code: "V",     label: "Visite à domicile (généraliste)" },
      { code: "VS",    label: "Visite à domicile (spécialiste)" },
      { code: "C",     label: "Téléconsultation" },
      { code: "C",     label: "Consultation d'urgence" },
      { code: "C",     label: "Consultation pré-anesthésique" },
      { code: "C",     label: "Consultation post-opératoire" },
      { code: "C",     label: "Certificat médical / rédaction d'un document" },
    ],
  },
  {
    specialty: "Soins courants",
    items: [
      { code: "K",  label: "Injection intramusculaire / sous-cutanée" },
      { code: "K",  label: "Injection intraveineuse / perfusion" },
      { code: "K",  label: "Pose de voie veineuse périphérique" },
      { code: "K",  label: "Prélèvement sanguin" },
      { code: "K",  label: "Pansement simple" },
      { code: "K",  label: "Pansement complexe / brûlure" },
      { code: "K",  label: "Suture de plaie" },
      { code: "K",  label: "Ablation de fils / d'agrafes" },
      { code: "K",  label: "Électrocardiogramme (ECG)" },
      { code: "K",  label: "Test de glycémie capillaire" },
      { code: "K",  label: "Aérosolthérapie / nébulisation" },
      { code: "K",  label: "Oxygénothérapie" },
      { code: "K",  label: "Sondage urinaire" },
      { code: "K",  label: "Vaccination" },
    ],
  },
  {
    specialty: "Petite chirurgie",
    items: [
      { code: "KC", label: "Incision et drainage d'abcès" },
      { code: "KC", label: "Exérèse de lésion cutanée" },
      { code: "KC", label: "Biopsie cutanée" },
      { code: "KC", label: "Ablation d'ongle (ongle incarné)" },
      { code: "KC", label: "Ablation de kyste / lipome" },
      { code: "K",  label: "Cryothérapie (verrues)" },
      { code: "K",  label: "Électrocoagulation" },
    ],
  },
  {
    specialty: "Cardiologie",
    items: [
      { code: "K", label: "Électrocardiogramme (ECG)" },
      { code: "Z", label: "Échographie cardiaque (échocardiographie)" },
      { code: "Z", label: "Écho-Doppler cardiaque" },
      { code: "K", label: "Épreuve d'effort" },
      { code: "K", label: "Holter ECG (24h)" },
      { code: "K", label: "MAPA (Holter tensionnel)" },
    ],
  },
  {
    specialty: "Gynécologie – Obstétrique",
    items: [
      { code: "K",  label: "Frottis cervico-vaginal" },
      { code: "KC", label: "Pose de dispositif intra-utérin (DIU)" },
      { code: "K",  label: "Retrait de DIU" },
      { code: "KC", label: "Pose / retrait d'implant contraceptif" },
      { code: "Z",  label: "Échographie pelvienne" },
      { code: "Z",  label: "Échographie obstétricale" },
      { code: "K",  label: "Colposcopie" },
      { code: "KC", label: "Biopsie du col / de l'endomètre" },
    ],
  },
  {
    specialty: "Pédiatrie",
    items: [
      { code: "C", label: "Consultation pédiatrique" },
      { code: "C", label: "Suivi du nourrisson / bilan de santé" },
      { code: "K", label: "Vaccination de l'enfant" },
      { code: "K", label: "Test de dépistage néonatal" },
    ],
  },
  {
    specialty: "Dermatologie",
    items: [
      { code: "KC", label: "Exérèse de lésion / naevus" },
      { code: "KC", label: "Biopsie cutanée" },
      { code: "K",  label: "Cryothérapie" },
      { code: "K",  label: "Dermoscopie" },
      { code: "K",  label: "Électrocoagulation de lésions" },
    ],
  },
  {
    specialty: "ORL",
    items: [
      { code: "K", label: "Audiométrie" },
      { code: "K", label: "Tympanométrie / impédancemétrie" },
      { code: "K", label: "Nasofibroscopie" },
      { code: "K", label: "Lavage d'oreille / extraction de bouchon" },
      { code: "K", label: "Méchage / cautérisation nasale (épistaxis)" },
    ],
  },
  {
    specialty: "Ophtalmologie",
    items: [
      { code: "K", label: "Fond d'œil" },
      { code: "K", label: "Tonométrie (mesure de la pression oculaire)" },
      { code: "K", label: "Champ visuel" },
      { code: "K", label: "Réfraction / acuité visuelle" },
      { code: "K", label: "Ablation de corps étranger cornéen" },
    ],
  },
  {
    specialty: "Rhumatologie",
    items: [
      { code: "K", label: "Infiltration articulaire" },
      { code: "K", label: "Infiltration des parties molles" },
      { code: "K", label: "Ponction articulaire" },
      { code: "Z", label: "Échographie articulaire" },
    ],
  },
  {
    specialty: "Gastro-entérologie",
    items: [
      { code: "KC", label: "Fibroscopie œso-gastro-duodénale" },
      { code: "KC", label: "Coloscopie" },
      { code: "KC", label: "Rectoscopie / anuscopie" },
      { code: "KC", label: "Ligature de varices œsophagiennes" },
    ],
  },
  {
    specialty: "Pneumologie",
    items: [
      { code: "K", label: "Spirométrie / EFR" },
      { code: "K", label: "Aérosolthérapie / nébulisation" },
      { code: "K", label: "Test de marche de 6 minutes" },
    ],
  },
  {
    specialty: "Urologie",
    items: [
      { code: "K",  label: "Sondage vésical" },
      { code: "Z",  label: "Échographie réno-vésico-prostatique" },
      { code: "K",  label: "Débitmétrie urinaire" },
      { code: "KC", label: "Circoncision" },
    ],
  },
  {
    specialty: "Endocrinologie – Diabétologie",
    items: [
      { code: "C", label: "Consultation de diabétologie" },
      { code: "C", label: "Éducation thérapeutique du diabétique" },
      { code: "K", label: "Test au monofilament (pied diabétique)" },
      { code: "K", label: "Glycémie capillaire" },
      { code: "K", label: "Pose / lecture de capteur de glycémie (CGM)" },
      { code: "K", label: "Impédancemétrie (composition corporelle)" },
      { code: "K", label: "Bilan podologique du diabétique" },
      { code: "Z", label: "Échographie thyroïdienne" },
      { code: "KC", label: "Cytoponction thyroïdienne (échoguidée)" },
    ],
  },
  {
    specialty: "Neurologie",
    items: [
      { code: "K", label: "Électromyogramme (EMG)" },
      { code: "K", label: "Électroencéphalogramme (EEG)" },
      { code: "K", label: "Potentiels évoqués" },
      { code: "KC", label: "Ponction lombaire" },
      { code: "K", label: "Test de la marche / évaluation neurologique" },
    ],
  },
  {
    specialty: "Néphrologie",
    items: [
      { code: "K",  label: "Séance d'hémodialyse" },
      { code: "KC", label: "Pose de cathéter de dialyse" },
      { code: "C",  label: "Consultation pré-dialyse / MRC" },
      { code: "KC", label: "Ponction-biopsie rénale (échoguidée)" },
    ],
  },
  {
    specialty: "Psychiatrie – Santé mentale",
    items: [
      { code: "CNPSY", label: "Consultation psychiatrique" },
      { code: "CNPSY", label: "Entretien psychothérapeutique" },
      { code: "K",     label: "Évaluation cognitive (MMSE)" },
      { code: "K",     label: "Entretien familial / de soutien" },
    ],
  },
  {
    specialty: "Chirurgie dentaire",
    items: [
      { code: "K",  label: "Détartrage" },
      { code: "KC", label: "Extraction dentaire" },
      { code: "K",  label: "Soin de carie / obturation" },
      { code: "KC", label: "Traitement de canal (dévitalisation)" },
      { code: "KC", label: "Pose de couronne / prothèse" },
      { code: "Z",  label: "Radiographie rétro-alvéolaire" },
      { code: "Z",  label: "Radiographie panoramique dentaire" },
    ],
  },
  {
    specialty: "Kinésithérapie – Rééducation",
    items: [
      { code: "K", label: "Séance de rééducation fonctionnelle" },
      { code: "K", label: "Massage / physiothérapie" },
      { code: "K", label: "Rééducation respiratoire" },
      { code: "K", label: "Rééducation post-opératoire" },
    ],
  },
  {
    specialty: "Imagerie (radiologue)",
    items: [
      { code: "Z", label: "Radiographie standard" },
      { code: "Z", label: "Échographie abdominale" },
      { code: "Z", label: "Écho-Doppler des membres" },
      { code: "Z", label: "Écho-Doppler des troncs supra-aortiques" },
      { code: "Z", label: "Mammographie" },
      { code: "Z", label: "Scanner (TDM)" },
      { code: "Z", label: "IRM" },
      { code: "Z", label: "Ostéodensitométrie (DMO)" },
      { code: "Z", label: "Cone beam (CBCT)" },
    ],
  },
  {
    specialty: "Allergologie",
    items: [
      { code: "K", label: "Tests cutanés allergologiques (prick-tests)" },
      { code: "K", label: "Patch-tests (allergie de contact)" },
      { code: "K", label: "Test de provocation" },
      { code: "K", label: "Immunothérapie / désensibilisation" },
      { code: "K", label: "Spirométrie avec test de réversibilité" },
    ],
  },
  {
    specialty: "Angiologie – Médecine vasculaire",
    items: [
      { code: "Z", label: "Écho-Doppler veineux des membres inférieurs" },
      { code: "Z", label: "Écho-Doppler artériel des membres" },
      { code: "K", label: "Mesure de l'index de pression systolique (IPS)" },
      { code: "K", label: "Sclérothérapie de varices" },
      { code: "K", label: "Capillaroscopie" },
      { code: "K", label: "Contention / bandage veineux" },
    ],
  },
  {
    specialty: "Anesthésie – Réanimation",
    items: [
      { code: "C", label: "Consultation pré-anesthésique" },
      { code: "K", label: "Anesthésie générale" },
      { code: "K", label: "Anesthésie locorégionale / péridurale" },
      { code: "K", label: "Rachianesthésie" },
      { code: "K", label: "Bloc nerveux périphérique" },
      { code: "K", label: "Prise en charge de la douleur (algologie)" },
    ],
  },
  {
    specialty: "Chirurgie générale – Viscérale",
    items: [
      { code: "KC", label: "Cure de hernie (inguinale / ombilicale)" },
      { code: "KC", label: "Cholécystectomie" },
      { code: "KC", label: "Appendicectomie" },
      { code: "KC", label: "Chirurgie de la paroi abdominale (éventration)" },
      { code: "KC", label: "Thyroïdectomie" },
      { code: "KC", label: "Chirurgie du sein" },
    ],
  },
  {
    specialty: "Chirurgie orthopédique – Traumatologie",
    items: [
      { code: "K",  label: "Réduction de fracture + immobilisation plâtrée" },
      { code: "K",  label: "Pose / ablation de plâtre ou résine" },
      { code: "K",  label: "Infiltration articulaire" },
      { code: "K",  label: "Ponction articulaire" },
      { code: "KC", label: "Arthroscopie" },
      { code: "KC", label: "Ostéosynthèse de fracture" },
      { code: "KC", label: "Prothèse articulaire (hanche / genou)" },
    ],
  },
  {
    specialty: "Proctologie",
    items: [
      { code: "K",  label: "Anuscopie" },
      { code: "KC", label: "Ligature élastique d'hémorroïdes" },
      { code: "KC", label: "Traitement de fissure anale" },
      { code: "KC", label: "Cure de fistule anale" },
    ],
  },
  {
    specialty: "Nutrition – Diététique",
    items: [
      { code: "C", label: "Consultation diététique" },
      { code: "K", label: "Bilan nutritionnel / impédancemétrie" },
      { code: "C", label: "Éducation nutritionnelle" },
      { code: "C", label: "Suivi de chirurgie bariatrique" },
    ],
  },
  {
    specialty: "Médecine du travail",
    items: [
      { code: "C", label: "Visite d'embauche" },
      { code: "C", label: "Visite périodique" },
      { code: "C", label: "Visite de reprise" },
      { code: "C", label: "Visite de pré-reprise" },
      { code: "K", label: "Audiométrie professionnelle" },
      { code: "K", label: "Spirométrie professionnelle" },
    ],
  },
  {
    specialty: "Sage-femme – Obstétrique",
    items: [
      { code: "C", label: "Consultation prénatale" },
      { code: "K", label: "Monitoring fœtal (rythme cardiaque fœtal)" },
      { code: "K", label: "Surveillance du travail / accouchement" },
      { code: "K", label: "Rééducation périnéale" },
      { code: "Z", label: "Échographie de datation" },
      { code: "C", label: "Consultation post-natale" },
    ],
  },
  {
    specialty: "Hématologie – Oncologie",
    items: [
      { code: "K",  label: "Séance de chimiothérapie" },
      { code: "KC", label: "Myélogramme / ponction médullaire" },
      { code: "KC", label: "Biopsie ostéo-médullaire" },
      { code: "K",  label: "Transfusion sanguine / surveillance" },
      { code: "K",  label: "Saignée thérapeutique" },
    ],
  },
  {
    specialty: "Médecine esthétique",
    items: [
      { code: "K", label: "Injection de toxine botulique" },
      { code: "K", label: "Injection d'acide hyaluronique (comblement)" },
      { code: "K", label: "Mésothérapie" },
      { code: "K", label: "Peeling chimique" },
      { code: "K", label: "Épilation au laser" },
      { code: "K", label: "Traitement laser vasculaire / pigmentaire" },
    ],
  },
  {
    specialty: "Infectiologie – Vaccination",
    items: [
      { code: "K", label: "Intradermo-réaction à la tuberculine (IDR)" },
      { code: "K", label: "Test antigénique / PCR (dépistage)" },
      { code: "K", label: "Vaccination internationale (fièvre jaune…)" },
      { code: "C", label: "Consultation du voyageur" },
    ],
  },
];
