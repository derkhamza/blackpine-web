// Demonstration dataset generator.
//
// Produces a rich, realistic Moroccan endocrinology cabinet so every feature can
// be shown to prospective users on a shared demo account. Deterministic (seeded)
// so "reload demo data" always yields the same tidy dataset. Returns two JSON
// strings compatible with CabinetContext.importCabinetJSON and
// AppContext.importFinancesJSON — nothing here writes to the DB directly; the
// normal sync carries it up (and handles encryption) once loaded in the app.

// ── Seeded RNG (mulberry32) — reproducible variety, no Math.random ────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Accounts allowed to load/clear demonstration data. Gated so a real doctor can
// never accidentally overwrite their cabinet with demo data.
export const DEMO_EMAILS = ["demo@blackpinecap.com"];
export function isDemoAccount(email?: string | null): boolean {
  return !!email && DEMO_EMAILS.includes(email.toLowerCase().trim());
}

// Empty payloads used by the "clear demo data" action.
export const EMPTY_CABINET_JSON = JSON.stringify({
  version: 2, appointments: [], patients: [], employees: [], prescriptions: [],
  examRequests: [], certificates: [], examResults: [], teleSessions: [],
  waTemplates: [], notes: [], stockItems: [], suppliers: [], purchaseOrders: [], invoices: [],
});
export const EMPTY_FINANCES_JSON = JSON.stringify({ version: 1, transactions: [], assets: [], recurringRules: [] });

export interface DemoBundle { cabinetJSON: string; financesJSON: string; summary: string; }

export function generateDemoData(now: Date = new Date()): DemoBundle {
  const rng = mulberry32(20260711);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const int = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const chance = (p: number) => rng() < p;
  const uid = (p: string, n: number) => `demo-${p}-${n}`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOffset = (days: number) => { const d = new Date(today); d.setDate(d.getDate() + days); return d; };
  const isoAt = (days: number, hh: number, mm: number) => `${ymd(dayOffset(days))}T${pad(hh)}:${pad(mm)}:00.000Z`;

  // ── Doctor identity + cabinet config ──────────────────────────────────────
  const doctorProfile = {
    fullName: "Dr. Amina El Fassi",
    arabicFullName: "د. أمينة الفاسي",
    specialtyLabel: "Endocrinologie – Diabétologie",
    inpe: "12/45678",
    ordre: "CO-2419",
    ice: "001827364000072",
    rib: "011 780 0000123456789012 34",
    address: "12, avenue Hassan II, Résidence Al Andalous, Casablanca",
    phone: "05 22 27 41 90",
    whatsApp: "06 61 23 45 67",
    accountantPhone: "06 70 11 22 33",
    locations: [
      { id: "loc-main", name: "Cabinet principal", address: "12 av. Hassan II, Casablanca", color: "#2563EB" },
      { id: "loc-anfa", name: "Clinique Anfa (mardi)", address: "Bd d'Anfa, Casablanca", color: "#8B5CF6" },
    ],
    appointmentPrices: { consultation: 300, controle: 200, suivi: 250, procedure: 500, urgence: 400, autre: 250, teleconsult: 250 },
    customApptTypes: [{ id: "teleconsult", label: "Téléconsultation", color: "#0EA5E9" }],
    apptLabels: [
      { id: "lbl-first", label: "Première visite", color: "#10B981" },
      { id: "lbl-urgent", label: "Urgent", color: "#EF4444" },
      { id: "lbl-amo", label: "Dossier AMO", color: "#F59E0B" },
    ],
    acteCodes: [
      { id: "act-c", code: "C", label: "Consultation spécialisée", price: 300 },
      { id: "act-imp", code: "IMP", label: "Impédancemétrie", price: 150 },
      { id: "act-eco", code: "ECHO", label: "Échographie thyroïdienne", price: 400 },
      { id: "act-hgpo", code: "HGPO", label: "Épreuve HGPO", price: 250 },
    ],
    secretaryPermissions: {
      viewClinical: false, handleBilling: true, viewFinances: false, managePayroll: false,
      useCommunication: true, manageStock: true, useNotes: true, useCalculators: false,
      recordVitals: true, editPatientContact: true,
    },
  };

  // ── Patients ──────────────────────────────────────────────────────────────
  const male = ["Mohammed", "Youssef", "Omar", "Karim", "Rachid", "Hamza", "Anas", "Bilal", "Mehdi", "Reda", "Said", "Nabil"];
  const female = ["Fatima", "Khadija", "Salma", "Imane", "Nadia", "Sara", "Meryem", "Hafsa", "Zineb", "Aicha", "Lamia", "Houda"];
  const last = ["Alaoui", "Bennani", "Cherkaoui", "El Idrissi", "Tazi", "Berrada", "Fassi", "Benjelloun", "Amrani", "Sqalli", "Lahlou", "Kettani", "Bouzoubaa", "Naciri"];
  const cities = ["Casablanca", "Rabat", "Mohammedia", "Salé", "Marrakech", "Kénitra"];
  const mutuelles = ["CNOPS", "CNSS", "RMA", "Saham", "AXA", "Aucune"];
  const bloods = ["A+", "O+", "B+", "AB+", "A-", "O-"];
  const allergyOpts = ["", "", "", "Pénicilline", "Iode", "Aspirine", "Sulfamides"];
  const anteced = ["", "Diabète type 2", "Hypertension artérielle", "Dyslipidémie", "Hypothyroïdie", "Obésité", "Antécédents familiaux de diabète", "Tabagisme sevré"];
  const meds = ["", "Metformine 850mg x2/j", "Levothyrox 75µg", "Amlodipine 5mg", "Atorvastatine 20mg", "Insuline Lantus 20UI"];

  const patients: any[] = [];
  const N_PATIENTS = 40;
  const patientNotes = [
    "Patient observant, bon suivi.", "À recontrôler dans 3 mois.",
    "Sensibiliser sur l'observance thérapeutique.", "Antécédents familiaux de diabète type 2.",
    "Éducation diététique en cours.", "Surveillance rapprochée du poids.",
    "Bonne évolution sous traitement.", "Adresser au diététicien.",
  ];
  for (let i = 0; i < N_PATIENTS; i++) {
    const isChild = i < 3;                       // first 3 are children (growth curves)
    const gender = chance(0.5) ? "M" : "F";
    const first = gender === "M" ? pick(male) : pick(female);
    const age = isChild ? int(3, 14) : int(19, 78);
    const dob = dayOffset(-age * 365 - int(0, 300));
    patients.push({
      id: uid("pat", i),
      firstName: first,
      lastName: pick(last),
      gender,
      dateOfBirth: ymd(dob),
      phone: `06 ${int(10, 79)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)}`,
      cin: `${pick(["A", "B", "BE", "BK", "BH"])}${int(100000, 999999)}`,
      cnopsNumber: chance(0.5) ? String(int(1000000, 9999999)) : "",
      mutuelle: pick(mutuelles),
      city: pick(cities),
      bloodType: chance(0.7) ? pick(bloods) : "",
      allergies: isChild ? "" : pick(allergyOpts),
      antecedents: isChild ? pick(["", "Asthme", "Terrain atopique"]) : pick(anteced),
      currentMedications: isChild ? "" : pick(meds),
      createdAt: isoAt(-int(30, 720), 9, 0),
      notes: !isChild && chance(0.45) ? pick(patientNotes) : "",
    });
  }

  // ── Clinical helpers ──────────────────────────────────────────────────────
  const motifs = ["Suivi diabète", "Bilan thyroïdien", "Contrôle HbA1c", "Prise de poids", "Fatigue / asthénie", "Découverte hyperglycémie", "Suivi hypothyroïdie", "Adaptation traitement", "Bilan pré-thérapeutique"];
  const diags = ["Diabète type 2 équilibré", "Hypothyroïdie substituée", "Dyslipidémie mixte", "Surpoids / obésité", "Diabète déséquilibré", "Thyroïdite d'Hashimoto", "Syndrome métabolique"];
  const treatments = ["Metformine 850mg 1cp x2/j, règles hygiéno-diététiques", "Levothyrox 75µg 1cp/j à jeun", "Atorvastatine 20mg le soir", "Optimisation insuline, éducation thérapeutique", "Régime hypocalorique + activité physique"];
  const examTxt = ["Auscultation normale, pas d'œdème. Thyroïde souple.", "Bon état général. TA correcte.", "Surcharge pondérale abdominale.", "Examen sans particularité."];

  function vitals(child: boolean) {
    const w = child ? int(15, 55) : int(58, 105);
    const h = child ? int(100, 165) : int(150, 190);
    return { bpSys: int(110, 155), bpDia: int(65, 95), hr: int(58, 92), temp: 36 + rng() * 1.6, spo2: int(95, 99), weight: w, height: h };
  }
  function bilan() {
    const f: Record<string, string> = {};
    if (chance(0.8)) f.bl_hba1c = (5.4 + rng() * 3.5).toFixed(1);
    if (chance(0.8)) f.bl_glycemie = (0.8 + rng() * 1.6).toFixed(2);
    if (chance(0.5)) f.bl_chol_t = (1.5 + rng() * 1).toFixed(2);
    if (chance(0.4)) f.bl_hdl = (0.35 + rng() * 0.3).toFixed(2);
    if (chance(0.4)) f.bl_tg = (0.8 + rng() * 1.5).toFixed(2);
    if (chance(0.4)) f.bl_ren_creat = String(int(6, 12));   // → auto eGFR
    if (chance(0.3)) f.tsh = (0.4 + rng() * 4).toFixed(2);
    return f;
  }

  const ordTemplates = [
    [{ drug: "Metformine cp 850mg", dosage: "1 comprimé", frequency: "2 fois par jour", duration: "3 mois", notes: "pendant les repas" }],
    [{ drug: "Levothyrox 75µg", dosage: "1 comprimé", frequency: "le matin à jeun", duration: "3 mois", notes: "" }],
    [{ drug: "Atorvastatine cp 20mg", dosage: "1 comprimé", frequency: "le soir", duration: "3 mois", notes: "" },
     { drug: "Vitamine D 100 000 UI", dosage: "1 ampoule", frequency: "1 fois par mois", duration: "3 mois", notes: "" }],
  ];

  // ── Appointments ──────────────────────────────────────────────────────────
  const appts: any[] = [];
  let invSeq = 1;
  let apptSeq = 0;
  // Past ~150 days (mostly completed) + next ~21 days (scheduled).
  for (let day = -150; day <= 21; day++) {
    const d = dayOffset(day);
    const wd = d.getDay();
    if (wd === 0) continue;                        // closed Sunday
    if (day < 0 && chance(0.20)) continue;          // not every past day is full
    const count = day > 0 ? int(1, 3) : int(2, 5);
    for (let k = 0; k < count; k++) {
      const p = pick(patients);
      const child = patients.indexOf(p) < 3;
      const type = child ? "controle" : pick(["consultation", "controle", "suivi", "suivi", "procedure", "urgence", "teleconsult", "controle"]);
      const past = day < 0;
      const hh = 9 + k * 2 + int(0, 1);
      const status = day > 0 ? "scheduled"
        : day === 0 ? pick(["scheduled", "arrived", "completed"])
        : chance(0.08) ? pick(["cancelled", "no_show"]) : "completed";
      const n = apptSeq++;
      const a: any = {
        id: uid("appt", n),
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        date: ymd(d),
        startTime: `${pad(hh)}:${pad(pick([0, 30]))}`,
        endTime: `${pad(hh)}:${pad(pick([30, 45]))}`,
        type,
        status,
        locationId: wd === 2 ? "loc-anfa" : "loc-main",
      };
      if (chance(0.4)) a.labelId = pick(["lbl-first", "lbl-urgent", "lbl-amo"]);
      if (chance(0.15)) a.bookingSource = "online";
      if (past && status === "completed") {
        a.consultationNote = {
          motif: pick(motifs),
          examination: pick(examTxt),
          diagnosis: pick(diags),
          treatment: pick(treatments),
          extraFields: bilan(),
        };
        a.vitalSigns = vitals(child);
        if (chance(0.55)) {
          const lines = pick(ordTemplates);
          a.savedOrdonnance = { lines, printedAt: a.date + "T10:00:00.000Z" };
        }
        if (chance(0.12)) {
          a.savedCertificates = [{ id: uid("cert", n), type: "medical", issuedAt: a.date + "T10:10:00.000Z", content: "Repos de 3 jours pour raison médicale." }];
        }
        if (chance(0.3)) a.followUpDate = ymd(dayOffset(day + int(30, 90)));
        // Billing — completed visits are billed; mix of paid / partial / deferred.
        const base = doctorProfile.appointmentPrices[type as keyof typeof doctorProfile.appointmentPrices] ?? 300;
        const items: any[] = [{ label: "Consultation", qty: 1, unitPrice: base }];
        if (type === "procedure" || chance(0.25)) items.push({ label: pick(["Impédancemétrie", "Échographie thyroïdienne", "HGPO"]), qty: 1, unitPrice: pick([150, 250, 400]) });
        if (chance(0.15)) items[0].remise = pick([10, 20]), items[0].remiseType = "pct";
        const gross = items.reduce((s, l) => s + l.qty * l.unitPrice * (l.remiseType === "pct" ? (1 - (l.remise || 0) / 100) : 1) - (l.remiseType === "mad" ? (l.remise || 0) : 0), 0);
        const net = Math.round(gross);
        a.billedAt = a.date + "T10:30:00.000Z";
        a.billedItems = items;
        a.billedAmount = net;
        const payMode = rng();
        a.paidAmount = payMode < 0.7 ? net : payMode < 0.9 ? Math.round(net / 2) : 0;
        a.payments = a.paidAmount > 0 ? [{ amount: a.paidAmount, method: pick(["cash", "card", "cheque", "transfer"]), date: a.billedAt }] : [];
        if (chance(0.4)) { a.invoiceNumber = `FAC-${today.getFullYear()}-${String(invSeq++).padStart(4, "0")}`; a.invoiceIssuedAt = a.billedAt; }
        if (a.mutuelle !== "Aucune" && chance(0.3)) { a.mutuellePapersFilled = true; a.mutuellePapersDate = a.date; }
      }
      appts.push(a);
    }
  }

  // A couple of upcoming online bookings (unlinked, as a real booking would be).
  appts.push({ id: uid("appt", apptSeq++), patientName: "Nouveau patient (en ligne)", date: ymd(dayOffset(3)), startTime: "11:00", endTime: "11:30", type: "consultation", status: "scheduled", bookingSource: "online", bookingPhone: "0662030405", labelId: "lbl-first" });

  // ── Stock, suppliers, purchase orders ─────────────────────────────────────
  const stockItems = [
    { id: uid("stk", 1), name: "Bandelettes glycémie (x50)", quantity: 8, minThreshold:5, unit: "boîte", category: "consommable", updatedAt: isoAt(-5, 9, 0) },
    { id: uid("stk", 2), name: "Aiguilles stylo insuline", quantity: 3, minThreshold:6, unit: "boîte", category: "consommable", updatedAt: isoAt(-2, 9, 0) },
    { id: uid("stk", 3), name: "Gel échographie", quantity: 4, minThreshold:2, unit: "flacon", category: "consommable", updatedAt: isoAt(-12, 9, 0) },
    { id: uid("stk", 4), name: "Gants latex (M)", quantity: 12, minThreshold:4, unit: "boîte", category: "consommable", updatedAt: isoAt(-1, 9, 0) },
    { id: uid("stk", 5), name: "Levothyrox 75µg (échantillon)", quantity: 2, minThreshold:3, unit: "boîte", category: "medicament", updatedAt: isoAt(-8, 9, 0) },
  ];
  const suppliers = [
    { id: uid("sup", 1), name: "MediSupply Maroc", phone: "0522334455", email: "contact@medisupply.ma", products: "Consommables, bandelettes, aiguilles", createdAt: isoAt(-200, 9, 0) },
    { id: uid("sup", 2), name: "Pharma Distribution Casa", phone: "0522667788", email: "ventes@pharmadist.ma", products: "Médicaments, échantillons", createdAt: isoAt(-150, 9, 0) },
  ];
  const purchaseOrders = [
    { id: uid("po", 1), supplierId: uid("sup", 1), supplierName: "MediSupply Maroc", status: "received", orderedAt: ymd(dayOffset(-25)), receivedAt: ymd(dayOffset(-20)), createdAt: isoAt(-25, 9, 0), lines: [{ itemName: "Bandelettes glycémie (x50)", quantity: 5, unitPrice: 120, receivedQty: 5 }] },
    { id: uid("po", 2), supplierId: uid("sup", 2), supplierName: "Pharma Distribution Casa", status: "ordered", orderedAt: ymd(dayOffset(-3)), expectedAt: ymd(dayOffset(4)), createdAt: isoAt(-3, 9, 0), lines: [{ itemName: "Aiguilles stylo insuline", quantity: 10, unitPrice: 45 }] },
  ];

  // ── Exam results & requests, standalone prescriptions, notes ──────────────
  const examResults = patients.slice(0, 18).map((p, i) => {
    const d = ymd(dayOffset(-int(5, 60)));
    const hba1c = 5.5 + rng() * 3;
    return {
      id: uid("exr", i), patientId: p.id, patientName: `${p.firstName} ${p.lastName}`,
      type: pick(["biologie", "biologie", "imagerie", "ecg"]),
      title: pick(["Bilan thyroïdien", "HbA1c + glycémie", "Bilan lipidique", "Fonction rénale"]),
      date: d, labName: pick(["Labo Anfa", "Biolab Casa", "Institut Pasteur"]),
      values: [
        { label: "TSH", value: (0.5 + rng() * 4).toFixed(2), unit: "mUI/L", refMin: 0.4, refMax: 4 },
        { label: "HbA1c", value: hba1c.toFixed(1), unit: "%", refMin: 4, refMax: 6, isAbnormal: hba1c > 6 },
      ],
      notes: "", createdAt: d + "T09:00:00.000Z",
    };
  });
  const examRequests = patients.slice(0, 12).map((p, i) => {
    const d = ymd(dayOffset(-int(1, 20)));
    return {
      id: uid("exq", i), patientId: p.id, patientName: `${p.firstName} ${p.lastName}`,
      date: d, source: "standalone", indication: "Bilan de suivi diabéto-endocrinien",
      lines: [
        { category: "biologie", label: "TSH, T4 libre" },
        { category: "biologie", label: "Glycémie à jeun, HbA1c", detail: "à jeun" },
        { category: "echographie", label: "Échographie thyroïdienne" },
      ],
      createdAt: d + "T09:00:00.000Z",
    };
  });
  const prescriptions = patients.slice(4, 8).map((p, i) => {
    const d = ymd(dayOffset(-int(1, 30)));
    return {
      id: uid("rx", i), patientId: p.id, patientName: `${p.firstName} ${p.lastName}`,
      date: d, source: "standalone", lines: pick(ordTemplates), notes: "",
      createdAt: d + "T09:00:00.000Z",
    };
  });
  const notes = [
    { id: uid("note", 1), type: "task", title: "Rappeler le labo pour les résultats de Mme Bennani", color: "yellow", isPinned: true, isDone: false, dueDate: ymd(dayOffset(1)), createdAt: isoAt(-1, 9, 0), updatedAt: isoAt(-1, 9, 0) },
    { id: uid("note", 2), type: "task", title: "Commander des bandelettes de glycémie", color: "pink", isPinned: false, isDone: false, dueDate: ymd(dayOffset(2)), createdAt: isoAt(-2, 9, 0), updatedAt: isoAt(-2, 9, 0) },
    { id: uid("note", 3), type: "task", title: "Confirmer le RDV avec le cardiologue référent", color: "blue", isPinned: false, isDone: true, createdAt: isoAt(-4, 9, 0), updatedAt: isoAt(-3, 9, 0) },
    { id: uid("note", 4), type: "note", title: "Protocole HGPO 75 g", body: "Nouveau protocole mis à jour — glycémie à T0, T60 et T120. Voir le classeur du bureau.", color: "green", isPinned: true, isDone: false, createdAt: isoAt(-10, 9, 0), updatedAt: isoAt(-10, 9, 0) },
  ];
  const employees = [
    { id: uid("emp", 1), firstName: "Salma", lastName: "Ouazzani", role: "secretaire", baseSalary: 4500, cnssNumber: "123456789", hireDate: "2023-02-01", dependents: 1, contractType: "cdi" },
    { id: uid("emp", 2), firstName: "Nadia", lastName: "Rifai", role: "infirmier", baseSalary: 6000, cnssNumber: "987654321", hireDate: "2022-09-15", dependents: 2, contractType: "cdi" },
    { id: uid("emp", 3), firstName: "Youssef", lastName: "Ait Ali", role: "aide_soignant", baseSalary: 3500, cnssNumber: "456789123", hireDate: "2024-01-10", dependents: 0, contractType: "anapec" },
  ];
  const invoices = appts.filter(a => a.invoiceNumber).slice(0, 16).map((a, i) => ({
    id: uid("inv", i), appointmentId: a.id, patientId: a.patientId, patientName: a.patientName,
    amount: a.billedAmount, actLabel: "Consultation médicale", invoiceNumber: a.invoiceNumber,
    issuedAt: a.invoiceIssuedAt,
  }));

  // ── Communication models (WhatsApp) — French + Arabic, ready to send ────────
  const waTemplates = [
    // French
    { id: "demo-wa-1", name: "Rappel de rendez-vous", category: "rappel",
      body: "Bonjour {patient}, nous vous rappelons votre rendez-vous le {date} à {heure} chez {docteur}. En cas d'empêchement, merci de nous prévenir. Cordialement, {cabinet}." },
    { id: "demo-wa-2", name: "Confirmation de rendez-vous", category: "confirmation",
      body: "Bonjour {patient}, votre rendez-vous du {date} à {heure} est bien confirmé au {cabinet}. Merci de vous présenter 5 minutes à l'avance. À bientôt !" },
    { id: "demo-wa-3", name: "Préparation bilan (à jeun)", category: "autre",
      body: "Bonjour {patient}, pour votre bilan du {date}, merci de vous présenter à jeun (8 à 12 h sans manger, eau autorisée) et d'apporter vos derniers résultats. Cordialement, {cabinet}." },
    { id: "demo-wa-4", name: "Résultats disponibles", category: "resultats",
      body: "Bonjour {patient}, vos résultats d'analyses sont disponibles au {cabinet}. Vous pouvez passer les récupérer ou nous contacter pour en discuter. Cordialement." },
    { id: "demo-wa-5", name: "Suivi post-consultation", category: "suivi",
      body: "Bonjour {patient}, suite à votre consultation du {date}, nous espérons que votre traitement se passe bien. N'hésitez pas à nous contacter au moindre doute. Cordialement, {docteur}." },
    { id: "demo-wa-6", name: "Renouvellement d'ordonnance", category: "suivi",
      body: "Bonjour {patient}, votre traitement arrive bientôt à terme. Pensez à prendre rendez-vous pour le renouvellement de votre ordonnance. Cordialement, {cabinet}." },
    // Arabic (العربية)
    { id: "demo-wa-7", name: "تذكير بالموعد (Rappel AR)", category: "rappel",
      body: "مرحباً {patient}، نذكّركم بموعدكم يوم {date} على الساعة {heure} عند {docteur}. في حال وجود مانع، المرجو إخبارنا. مع تحيات {cabinet}." },
    { id: "demo-wa-8", name: "تأكيد الموعد (Confirmation AR)", category: "confirmation",
      body: "مرحباً {patient}، تم تأكيد موعدكم ليوم {date} على الساعة {heure} في {cabinet}. المرجو الحضور قبل الموعد بخمس دقائق. إلى اللقاء!" },
    { id: "demo-wa-9", name: "التحضير للتحاليل (à jeun AR)", category: "autre",
      body: "مرحباً {patient}، بالنسبة لتحاليلكم يوم {date}، المرجو الحضور على الريق (من 8 إلى 12 ساعة دون أكل، الماء مسموح) وإحضار آخر نتائجكم. مع التحية، {cabinet}." },
    { id: "demo-wa-10", name: "النتائج جاهزة (Résultats AR)", category: "resultats",
      body: "مرحباً {patient}، نتائج تحاليلكم جاهزة في {cabinet}. يمكنكم المرور لاستلامها أو الاتصال بنا لمناقشتها. مع التحية." },
  ];

  const cabinet = {
    version: 2, exportedAt: now.toISOString(),
    appointments: appts, patients, employees, doctorProfile,
    prescriptions, examRequests, certificates: [],
    examResults, teleSessions: [], waTemplates, notes,
    stockItems, suppliers, purchaseOrders, invoices,
  };

  // ── Finances (transactions, tax profile) ──────────────────────────────────
  const tx: any[] = [];
  let txn = 0;
  // Realistic ledger spanning the full previous calendar year plus the current
  // year to date. Consultation income follows a seasonal curve (quiet summer,
  // busy rentrée) with modest year-on-year growth; charges mirror a real
  // Casablanca practice. Category codes match the fiscal deductibility matrix
  // (loyer_cabinet, salaires_personnel, internet_telephone…) so Comptabilité
  // classifies every line correctly.
  const SEASON = [1.05, 1.0, 1.06, 1.0, 1.05, 0.94, 0.8, 0.58, 1.12, 1.12, 1.05, 0.96]; // Jan…Dec
  const curY = today.getFullYear();
  const curMo = today.getMonth();
  const round100 = (n: number) => Math.round(n / 100) * 100;
  for (let i = curMo + 12; i >= 0; i--) {
    const d = new Date(curY, curMo - i, 1);
    const yy = d.getFullYear(), mm = d.getMonth();
    const growth = yy < curY ? 0.9 : 1;                        // ~10% year-on-year growth
    const s = SEASON[mm];
    const monthLabel = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    // Recettes
    tx.push({ id: uid("tx", txn++), type: "RECETTE", amount: round100(44000 * s * growth + int(-2500, 2500)), date: ymd(new Date(yy, mm, 15)), category: "consultation", description: `Recettes consultations — ${monthLabel}`, source: "CABINET" });
    if (chance(0.8)) tx.push({ id: uid("tx", txn++), type: "RECETTE", amount: round100(int(3500, 8500) * growth), date: ymd(new Date(yy, mm, 22)), category: "acte_chirurgical", description: "Actes techniques (échographie, infiltrations)", source: "CABINET" });
    // Charges
    const chg = (cat: string, amount: number, desc: string, ratio = 1) => tx.push({
      id: uid("tx", txn++), type: "CHARGE", amount, date: ymd(new Date(yy, mm, int(2, 26))),
      category: cat, description: desc,
      deductibilityStatus: ratio >= 1 ? "FULLY_DEDUCTIBLE" : "PARTIALLY_DEDUCTIBLE", professionalUseRatio: ratio,
    });
    chg("loyer_cabinet", 6500, "Loyer du cabinet");
    chg("salaires_personnel", 10500, "Salaires du personnel");
    chg("cotisations_cnss_employeur", 1800, "CNSS employeur");
    chg("electricite_eau", int(700, 1200) + (s < 0.85 ? 400 : 0), "Électricité & eau");
    chg("internet_telephone", int(450, 650), "Téléphone & internet", 0.9);
    chg("logiciel_informatique", int(250, 400), "Logiciels & abonnements");
    if (chance(0.85)) chg("consommables_medicaux", int(1200, 3500), "Consommables médicaux");
    if (chance(0.6))  chg("fournitures_bureau", int(300, 900), "Fournitures de bureau");
    chg("carburant", int(600, 1200), "Carburant", 0.5);
    chg("frais_bancaires", int(150, 300), "Frais bancaires");
    chg("entretien_nettoyage", 800, "Entretien & ménage");
    if (mm % 3 === 0) chg("honoraires_comptable", 1500, "Honoraires comptable (trimestre)");
    if (mm === 0)     chg("rc_pro", 4200, "Assurance RC professionnelle (annuelle)");
  }
  // One-off continuing-education expense (current year). The impédancemétrie
  // device is capitalised as a fixed asset (below), NOT expensed here.
  tx.push({ id: uid("tx", txn++), type: "CHARGE", amount: 3200, date: ymd(dayOffset(-40)), category: "congres_formation", description: "Congrès SFE Diabétologie", deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1 });

  const financesProfile = {
    id: "web", legalForm: "PERSONNE_PHYSIQUE", practiceType: "CABINET_ONLY",
    activityStartDate: "2019-09-01", commune: "Casablanca", communeType: "URBAN",
    maritalStatus: "MARRIED", dependentsCount: 2, tpRegistered: true,
  };

  // Fixed assets (immobilisations) — power the Comptabilité amortisation table.
  const assets = [
    { id: uid("ast", 1), label: "Appareil d'impédancemétrie", category: "immobilisation_corporelle", subcategory: "materiel_outillage", acquisitionDate: ymd(dayOffset(-70)), acquisitionAmount: 24000, amortizationRate: 0.20, amortizationMethod: "linear" },
    { id: uid("ast", 2), label: "Échographe thyroïdien", category: "immobilisation_corporelle", subcategory: "materiel_outillage", acquisitionDate: "2021-09-01", acquisitionAmount: 180000, amortizationRate: 0.20, amortizationMethod: "linear" },
    { id: uid("ast", 3), label: "Mobilier de bureau", category: "immobilisation_corporelle", subcategory: "mobilier_bureau", acquisitionDate: "2022-03-01", acquisitionAmount: 35000, amortizationRate: 0.10, amortizationMethod: "linear" },
    { id: uid("ast", 4), label: "Ordinateur + imprimante", category: "immobilisation_corporelle", subcategory: "informatique", acquisitionDate: "2024-01-15", acquisitionAmount: 12000, amortizationRate: 0.25, amortizationMethod: "linear" },
  ];

  // Recurring charges (charges récurrentes) — power the Comptabilité recurring tab.
  const rec = (n: number, label: string, amount: number, category: string, frequency: string, dayOfMonth: number, ratio = 1) => ({
    id: uid("rec", n), label, frequency, dayOfMonth, startDate: "2024-01-01", active: true,
    templateTransaction: {
      type: "CHARGE", amount, category, description: label, source: "CABINET",
      deductibilityStatus: ratio >= 1 ? "FULLY_DEDUCTIBLE" : "PARTIALLY_DEDUCTIBLE", professionalUseRatio: ratio,
    },
  });
  const recurringRules = [
    rec(1, "Loyer du cabinet", 6500, "loyer_cabinet", "monthly", 5),
    rec(2, "Salaires du personnel", 10500, "salaires_personnel", "monthly", 28),
    rec(3, "CNSS employeur", 1800, "cotisations_cnss_employeur", "monthly", 28),
    rec(4, "Électricité & eau", 900, "electricite_eau", "monthly", 15),
    rec(5, "Téléphone & internet", 500, "internet_telephone", "monthly", 10, 0.9),
    rec(6, "Entretien & ménage", 800, "entretien_nettoyage", "monthly", 1),
    rec(7, "Assurance RC professionnelle", 4200, "rc_pro", "yearly", 15),
  ];

  const finances = { version: 1, exportedAt: now.toISOString(), transactions: tx, assets, recurringRules, profile: financesProfile };

  const summary = `${patients.length} patients · ${appts.length} rendez-vous · ${tx.length} opérations financières · ${stockItems.length} articles de stock`;
  return { cabinetJSON: JSON.stringify(cabinet), financesJSON: JSON.stringify(finances), summary };
}
