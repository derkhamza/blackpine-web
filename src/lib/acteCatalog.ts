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
    ],
  },
  {
    specialty: "Soins courants",
    items: [
      { code: "K",  label: "Injection intramusculaire / sous-cutanée" },
      { code: "K",  label: "Injection intraveineuse / perfusion" },
      { code: "K",  label: "Pansement simple" },
      { code: "K",  label: "Pansement complexe / brûlure" },
      { code: "K",  label: "Suture de plaie" },
      { code: "K",  label: "Ablation de fils / d'agrafes" },
      { code: "K",  label: "Électrocardiogramme (ECG)" },
      { code: "K",  label: "Test de glycémie capillaire" },
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
    specialty: "Imagerie (radiologue)",
    items: [
      { code: "Z", label: "Radiographie standard" },
      { code: "Z", label: "Échographie abdominale" },
      { code: "Z", label: "Écho-Doppler des membres" },
      { code: "Z", label: "Mammographie" },
      { code: "Z", label: "Scanner (TDM)" },
      { code: "Z", label: "IRM" },
    ],
  },
];
