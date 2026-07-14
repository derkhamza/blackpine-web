import type { OrdonnanceLine, CabinetDoctorProfile } from "./cabinetTypes";
import { DEFAULT_DOCUMENT_SETTINGS } from "./cabinetTypes";
import {
  ORDONNANCE_DEFAULT_MARGINS, resolveMargins, pageRule, resolvePageSize, backgroundHtml,
  blockStyle, blockHidden, logoHtml, designForKind,
  typographyCss, brandFooterHtml,
} from "./docDesign";

// ── Common drug suggestions (datalist) ───────────────────────────────────────
//
// Comprehensive formulary of medications routinely prescribed in Morocco,
// listed by DCI (Dénomination Commune Internationale) + galenic form + strength
// — the form Moroccan prescribing law encourages. This is a curated common-use
// list (≈ several hundred molecules), not the full national branded registry;
// doctors can add their own products via the custom-drugs setting.

export const COMMON_DRUGS: string[] = [
  // ── Antalgiques / Antipyrétiques ──────────────────────────────────────────
  "Paracétamol cp 500 mg",
  "Paracétamol cp 1 g",
  "Paracétamol sirop 120 mg/5 ml",
  "Paracétamol suppositoire 150 mg",
  "Paracétamol + Caféine cp",
  "Paracétamol + Codéine cp",
  "Aspirine cp 500 mg",
  "Tramadol gél 50 mg",
  "Tramadol cp LP 100 mg",
  "Tramadol + Paracétamol cp",
  "Néfopam cp 30 mg",
  "Codéine + Paracétamol cp",
  "Morphine cp LP 10 mg",

  // ── Anti-inflammatoires non stéroïdiens (AINS) ────────────────────────────
  "Ibuprofène cp 200 mg",
  "Ibuprofène cp 400 mg",
  "Ibuprofène sirop 100 mg/5 ml",
  "Diclofénac cp 50 mg",
  "Diclofénac cp LP 75 mg",
  "Diclofénac cp LP 100 mg",
  "Kétoprofène cp 100 mg",
  "Kétoprofène cp LP 200 mg",
  "Naproxène cp 500 mg",
  "Méloxicam cp 7,5 mg",
  "Méloxicam cp 15 mg",
  "Piroxicam cp 20 mg",
  "Célécoxib gél 200 mg",
  "Étoricoxib cp 90 mg",
  "Acide méfénamique cp 500 mg",
  "Acide niflumique gél 250 mg",
  "Indométacine gél 25 mg",

  // ── Antibiotiques — Pénicillines ──────────────────────────────────────────
  "Amoxicilline cp 500 mg",
  "Amoxicilline cp 1 g",
  "Amoxicilline susp 250 mg/5 ml",
  "Amoxicilline + Acide clavulanique cp 1 g",
  "Amoxicilline + Acide clavulanique susp 100 mg/ml",
  "Ampicilline gél 500 mg",
  "Cloxacilline gél 500 mg",
  "Benzathine benzylpénicilline inj 1,2 MUI",

  // ── Antibiotiques — Céphalosporines ───────────────────────────────────────
  "Céfalexine gél 500 mg",
  "Céfadroxil gél 500 mg",
  "Céfuroxime cp 250 mg",
  "Céfuroxime cp 500 mg",
  "Céfixime cp 200 mg",
  "Cefpodoxime cp 100 mg",
  "Ceftriaxone inj 1 g",
  "Céfotaxime inj 1 g",

  // ── Antibiotiques — Macrolides & apparentés ───────────────────────────────
  "Azithromycine cp 250 mg",
  "Azithromycine cp 500 mg",
  "Clarithromycine cp 500 mg",
  "Érythromycine cp 500 mg",
  "Spiramycine cp 3 MUI",
  "Josamycine cp 500 mg",
  "Clindamycine gél 300 mg",

  // ── Antibiotiques — Fluoroquinolones ──────────────────────────────────────
  "Ciprofloxacine cp 500 mg",
  "Lévofloxacine cp 500 mg",
  "Ofloxacine cp 200 mg",
  "Norfloxacine cp 400 mg",
  "Moxifloxacine cp 400 mg",

  // ── Antibiotiques — Cyclines & divers ─────────────────────────────────────
  "Doxycycline cp 100 mg",
  "Minocycline gél 100 mg",
  "Métronidazole cp 500 mg",
  "Métronidazole sol inj 500 mg",
  "Cotrimoxazole (Sulfaméthoxazole + Triméthoprime) cp 800/160 mg",
  "Fosfomycine sachet 3 g",
  "Nitrofurantoïne gél 50 mg",
  "Acide fusidique cp 250 mg",
  "Rifampicine gél 300 mg",
  "Gentamicine inj 80 mg",

  // ── Antifongiques ─────────────────────────────────────────────────────────
  "Fluconazole gél 150 mg",
  "Fluconazole gél 50 mg",
  "Itraconazole gél 100 mg",
  "Kétoconazole cp 200 mg",
  "Terbinafine cp 250 mg",
  "Griséofulvine cp 500 mg",
  "Nystatine susp 100 000 UI/ml",
  "Miconazole gel buccal 2 %",

  // ── Antiviraux ────────────────────────────────────────────────────────────
  "Aciclovir cp 200 mg",
  "Aciclovir cp 800 mg",
  "Valaciclovir cp 500 mg",
  "Oseltamivir gél 75 mg",

  // ── Antiparasitaires ──────────────────────────────────────────────────────
  "Albendazole cp 400 mg",
  "Mébendazole cp 100 mg",
  "Flubendazole cp 100 mg",
  "Tinidazole cp 500 mg",
  "Ivermectine cp 3 mg",

  // ── Gastro-entérologie ────────────────────────────────────────────────────
  "Oméprazole gél 20 mg",
  "Ésoméprazole cp 20 mg",
  "Ésoméprazole cp 40 mg",
  "Pantoprazole cp 40 mg",
  "Lansoprazole gél 30 mg",
  "Rabéprazole cp 20 mg",
  "Ranitidine cp 150 mg",
  "Dompéridone cp 10 mg",
  "Métoclopramide cp 10 mg",
  "Métopimazine cp 10 mg",
  "Ondansétron cp 4 mg",
  "Phloroglucinol cp 80 mg",
  "Trimébutine cp 100 mg",
  "Mébévérine cp 200 mg",
  "Hydroxyde d'aluminium + magnésium susp",
  "Diosmectite sachet 3 g",
  "Racécadotril gél 100 mg",
  "Lopéramide gél 2 mg",
  "Lactulose sirop",
  "Macrogol sachet",
  "Bisacodyl cp 5 mg",
  "Ursodésoxycholique acide cp 250 mg",
  "Mésalazine cp 500 mg",
  "Sels de réhydratation orale (SRO) sachet",

  // ── Allergologie — Antihistaminiques ──────────────────────────────────────
  "Loratadine cp 10 mg",
  "Desloratadine cp 5 mg",
  "Cétirizine cp 10 mg",
  "Lévocétirizine cp 5 mg",
  "Fexofénadine cp 180 mg",
  "Ébastine cp 10 mg",
  "Bilastine cp 20 mg",
  "Méquitazine cp 5 mg",
  "Hydroxyzine cp 25 mg",
  "Dexchlorphéniramine cp 2 mg",
  "Kétotifène cp 1 mg",

  // ── Corticoïdes (voie générale) ───────────────────────────────────────────
  "Prednisone cp 5 mg",
  "Prednisone cp 20 mg",
  "Prednisolone cp 5 mg",
  "Prednisolone cp 20 mg",
  "Méthylprednisolone cp 4 mg",
  "Bétaméthasone cp 0,5 mg",
  "Dexaméthasone cp 0,5 mg",
  "Hydrocortisone cp 10 mg",

  // ── Pneumologie / Respiratoire ────────────────────────────────────────────
  "Salbutamol inhalateur 100 µg",
  "Salbutamol sol nébulisation 5 mg/ml",
  "Terbutaline inhalateur",
  "Budésonide inhalateur",
  "Béclométasone inhalateur",
  "Fluticasone inhalateur",
  "Salmétérol + Fluticasone inhalateur",
  "Formotérol + Budésonide inhalateur",
  "Ipratropium bromure inhalateur",
  "Tiotropium inhalateur",
  "Montélukast cp 10 mg",
  "Montélukast cp à croquer 5 mg",
  "Théophylline cp LP 200 mg",
  "Acétylcystéine sachet 200 mg",
  "Carbocistéine sirop 5 %",
  "Ambroxol sirop 30 mg/5 ml",
  "Bromhexine sirop",
  "Oxomémazine sirop",
  "Dextrométhorphane sirop",

  // ── Cardiologie — Antihypertenseurs (IEC) ─────────────────────────────────
  "Énalapril cp 20 mg",
  "Lisinopril cp 10 mg",
  "Ramipril cp 5 mg",
  "Ramipril cp 10 mg",
  "Périndopril cp 5 mg",
  "Périndopril cp 10 mg",
  "Captopril cp 25 mg",
  "Bénazépril cp 10 mg",

  // ── Cardiologie — Antihypertenseurs (ARA II) ──────────────────────────────
  "Losartan cp 50 mg",
  "Valsartan cp 80 mg",
  "Valsartan cp 160 mg",
  "Candésartan cp 8 mg",
  "Irbésartan cp 150 mg",
  "Irbésartan cp 300 mg",
  "Telmisartan cp 40 mg",
  "Olmésartan cp 20 mg",

  // ── Cardiologie — Inhibiteurs calciques ───────────────────────────────────
  "Amlodipine cp 5 mg",
  "Amlodipine cp 10 mg",
  "Nifédipine cp LP 30 mg",
  "Lercanidipine cp 10 mg",
  "Vérapamil cp 120 mg",
  "Diltiazem cp LP 120 mg",

  // ── Cardiologie — Bêtabloquants ───────────────────────────────────────────
  "Aténolol cp 50 mg",
  "Aténolol cp 100 mg",
  "Bisoprolol cp 5 mg",
  "Bisoprolol cp 10 mg",
  "Métoprolol cp 100 mg",
  "Nébivolol cp 5 mg",
  "Carvédilol cp 6,25 mg",
  "Propranolol cp 40 mg",
  "Acébutolol cp 200 mg",

  // ── Cardiologie — Diurétiques ─────────────────────────────────────────────
  "Hydrochlorothiazide cp 25 mg",
  "Furosémide cp 40 mg",
  "Indapamide cp LP 1,5 mg",
  "Spironolactone cp 25 mg",
  "Spironolactone cp 50 mg",

  // ── Cardiologie — Divers ──────────────────────────────────────────────────
  "Trinitrine spray sublingual",
  "Isosorbide mononitrate cp LP 20 mg",
  "Trimétazidine cp LP 35 mg",
  "Ivabradine cp 5 mg",
  "Amiodarone cp 200 mg",
  "Digoxine cp 0,25 mg",
  "Méthyldopa cp 250 mg",

  // ── Hypolipémiants ────────────────────────────────────────────────────────
  "Atorvastatine cp 10 mg",
  "Atorvastatine cp 20 mg",
  "Atorvastatine cp 40 mg",
  "Simvastatine cp 20 mg",
  "Rosuvastatine cp 10 mg",
  "Rosuvastatine cp 20 mg",
  "Pravastatine cp 40 mg",
  "Ézétimibe cp 10 mg",
  "Fénofibrate gél 200 mg",

  // ── Antiagrégants / Anticoagulants ────────────────────────────────────────
  "Acide acétylsalicylique cp 75 mg",
  "Acide acétylsalicylique cp 100 mg",
  "Clopidogrel cp 75 mg",
  "Acénocoumarol cp 4 mg",
  "Warfarine cp 5 mg",
  "Énoxaparine inj 4000 UI",
  "Rivaroxaban cp 20 mg",
  "Apixaban cp 5 mg",
  "Diosmine + Hespéridine cp 500 mg",

  // ── Diabétologie / Endocrinologie ─────────────────────────────────────────
  "Metformine cp 500 mg",
  "Metformine cp 850 mg",
  "Metformine cp 1000 mg",
  "Glibenclamide cp 5 mg",
  "Gliclazide cp LM 30 mg",
  "Gliclazide cp LM 60 mg",
  "Glimépiride cp 2 mg",
  "Glimépiride cp 4 mg",
  "Sitagliptine cp 100 mg",
  "Vildagliptine cp 50 mg",
  "Metformine + Vildagliptine cp 1000/50 mg",
  "Empagliflozine cp 10 mg",
  "Dapagliflozine cp 10 mg",
  "Pioglitazone cp 30 mg",
  "Repaglinide cp 1 mg",
  "Acarbose cp 100 mg",
  "Insuline rapide inj",
  "Insuline NPH inj",
  "Insuline glargine inj",
  "Lévothyroxine cp 50 µg",
  "Lévothyroxine cp 100 µg",
  "Carbimazole cp 5 mg",

  // ── Neurologie / Psychiatrie — Antiépileptiques ───────────────────────────
  "Carbamazépine cp 200 mg",
  "Valproate de sodium cp 500 mg",
  "Lévétiracétam cp 500 mg",
  "Lamotrigine cp 50 mg",
  "Phénobarbital cp 100 mg",
  "Gabapentine gél 300 mg",
  "Prégabaline gél 75 mg",
  "Prégabaline gél 150 mg",
  "Clonazépam cp 2 mg",

  // ── Neurologie / Psychiatrie — Antidépresseurs ────────────────────────────
  "Amitriptyline cp 25 mg",
  "Fluoxétine gél 20 mg",
  "Paroxétine cp 20 mg",
  "Sertraline cp 50 mg",
  "Escitalopram cp 10 mg",
  "Citalopram cp 20 mg",
  "Venlafaxine gél LP 75 mg",
  "Duloxétine gél 30 mg",
  "Mirtazapine cp 30 mg",
  "Clomipramine cp 25 mg",

  // ── Neurologie / Psychiatrie — Anxiolytiques & hypnotiques ────────────────
  "Bromazépam cp 6 mg",
  "Alprazolam cp 0,25 mg",
  "Alprazolam cp 0,5 mg",
  "Lorazépam cp 2,5 mg",
  "Diazépam cp 5 mg",
  "Clobazam cp 10 mg",
  "Zolpidem cp 10 mg",
  "Zopiclone cp 7,5 mg",
  "Buspirone cp 10 mg",

  // ── Neurologie / Psychiatrie — Antipsychotiques & divers ──────────────────
  "Halopéridol cp 5 mg",
  "Rispéridone cp 2 mg",
  "Olanzapine cp 10 mg",
  "Quétiapine cp LP 200 mg",
  "Amisulpride cp 200 mg",
  "Sulpiride cp 50 mg",
  "Lévodopa + Bensérazide cp 250 mg",
  "Trihexyphénidyle cp 2 mg",
  "Bétahistine cp 24 mg",
  "Flunarizine gél 10 mg",
  "Sumatriptan cp 50 mg",

  // ── Rhumatologie / Goutte ─────────────────────────────────────────────────
  "Allopurinol cp 100 mg",
  "Allopurinol cp 300 mg",
  "Fébuxostat cp 80 mg",
  "Colchicine cp 1 mg",
  "Méthotrexate cp 2,5 mg",
  "Calcium + Vitamine D3 cp à sucer",
  "Alendronate cp 70 mg",

  // ── Urologie ──────────────────────────────────────────────────────────────
  "Tamsulosine gél LP 0,4 mg",
  "Alfuzosine cp LP 10 mg",
  "Finastéride cp 5 mg",
  "Solifénacine cp 5 mg",
  "Oxybutynine cp 5 mg",
  "Sildénafil cp 50 mg",
  "Tadalafil cp 20 mg",

  // ── Gynécologie / Obstétrique ─────────────────────────────────────────────
  "Acide folique cp 5 mg",
  "Acide folique cp 0,4 mg",
  "Fer (sulfate ferreux) cp 80 mg",
  "Fer + Acide folique cp",
  "Progestérone gél 200 mg",
  "Dydrogestérone cp 10 mg",
  "Acide tranexamique cp 500 mg",
  "Métronidazole ovule 500 mg",
  "Miconazole ovule 400 mg",
  "Méthylergométrine cp",

  // ── Dermatologie (voie locale) ────────────────────────────────────────────
  "Bétaméthasone crème 0,05 %",
  "Hydrocortisone crème 1 %",
  "Mométasone crème 0,1 %",
  "Clotrimazole crème 1 %",
  "Kétoconazole crème 2 %",
  "Terbinafine crème 1 %",
  "Acide fusidique crème 2 %",
  "Mupirocine pommade 2 %",
  "Métronidazole gel 0,75 %",
  "Adapalène gel 0,1 %",
  "Peroxyde de benzoyle gel 5 %",
  "Perméthrine crème 5 %",
  "Benzoate de benzyle lotion",
  "Isotrétinoïne gél 20 mg",

  // ── Ophtalmologie (collyres) ──────────────────────────────────────────────
  "Tobramycine collyre 0,3 %",
  "Ciprofloxacine collyre 0,3 %",
  "Acide fusidique collyre 1 %",
  "Timolol collyre 0,5 %",
  "Latanoprost collyre 0,005 %",
  "Dexaméthasone collyre",
  "Larmes artificielles collyre",

  // ── ORL (voie nasale / locale) ────────────────────────────────────────────
  "Sérum physiologique 0,9 % dosette",
  "Oxymétazoline spray nasal",
  "Mométasone spray nasal 50 µg",
  "Fluticasone spray nasal",
  "Gouttes auriculaires antibiotiques",

  // ── Vitamines & suppléments ───────────────────────────────────────────────
  "Vitamine D3 (cholécalciférol) sol buv",
  "Vitamine C cp 500 mg",
  "Vitamine B12 (cyanocobalamine) cp",
  "Vitamine B6 cp",
  "Complexe vitamines B cp",
  "Calcium + Vitamine D3 sachet",
  "Magnésium cp",
  "Zinc cp",
  "Oméga 3 gél",

  // ── Antispasmodiques ──────────────────────────────────────────────────────
  "Tiémonium cp 50 mg",
  "N-butylbromure de scopolamine cp 10 mg",
  "Alvérine + Siméticone gél",

  // ── Myorelaxants ──────────────────────────────────────────────────────────
  "Thiocolchicoside cp 4 mg",
  "Thiocolchicoside inj 4 mg",
  "Méthocarbamol cp 500 mg",
  "Baclofène cp 10 mg",

  // ── Contraceptifs & hormonothérapie ───────────────────────────────────────
  "Éthinylestradiol + Lévonorgestrel cp",
  "Éthinylestradiol + Désogestrel cp",
  "Désogestrel cp 75 µg",
  "Lévonorgestrel cp 1,5 mg (contraception d'urgence)",
  "Estradiol gel transdermique",
  "Tibolone cp 2,5 mg",

  // ── Ostéoporose ───────────────────────────────────────────────────────────
  "Risédronate cp 35 mg",
  "Acide zolédronique perf 5 mg",
  "Raloxifène cp 60 mg",

  // ── Anesthésiques locaux ──────────────────────────────────────────────────
  "Lidocaïne gel 2 %",
  "Lidocaïne + Prilocaïne crème 5 %",
  "Lidocaïne inj 1 %",

  // ── Antiseptiques & soins locaux ──────────────────────────────────────────
  "Povidone iodée solution 10 %",
  "Chlorhexidine solution 0,5 %",
  "Éosine aqueuse 2 %",
  "Alcool modifié 70°",
  "Peroxyde d'hydrogène (eau oxygénée) 10 vol",

  // ── Veinotoniques & antihémorroïdaires ────────────────────────────────────
  "Troxérutine cp 300 mg",
  "Diosmine + Hespéridine cp 600 mg",
  "Trinitrine pommade rectale 0,4 %",
  "Suppositoire antihémorroïdaire",
];

// ── Common frequencies ────────────────────────────────────────────────────────
export const COMMON_FREQUENCIES: string[] = [
  "1 fois par jour",
  "2 fois par jour",
  "3 fois par jour",
  "4 fois par jour",
  "Matin et soir",
  "Matin, midi et soir",
  "Le soir au coucher",
  "Le matin à jeun",
  "Au besoin (max 3/jour)",
  "Toutes les 8 heures",
  "Toutes les 6 heures",
  "Toutes les 4 heures",
];

// ── Common durations ──────────────────────────────────────────────────────────
export const COMMON_DURATIONS: string[] = [
  "3 jours",
  "5 jours",
  "7 jours",
  "10 jours",
  "14 jours",
  "21 jours",
  "1 mois",
  "2 mois",
  "3 mois",
  "6 mois",
  "À vie",
  "Si besoin",
];

// ── Print ordonnance ──────────────────────────────────────────────────────────

export function printOrdonnance(opts: {
  lines:        OrdonnanceLine[];
  patientName:  string;
  date:         string;           // ISO "YYYY-MM-DD"
  doctorProfile: CabinetDoctorProfile;
}): void {
  const { lines, patientName, date, doctorProfile } = opts;
  // Escape free-text before interpolating into the print HTML. Patient/secretary
  // -supplied values (names, drugs, dosages) would otherwise inject script into
  // the same-origin print window and steal the session token.
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (m) =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<string, string>)[m]);
  const eName  = esc(patientName);
  const eFull  = esc(doctorProfile.fullName);
  const eSpec  = esc(doctorProfile.specialtyLabel);
  const eAddr  = esc(doctorProfile.address);
  const ePhone = esc(doctorProfile.phone);
  const eOrdre = esc(doctorProfile.ordre);
  const eInpe  = esc(doctorProfile.inpe);
  const eIce   = esc(doctorProfile.ice);
  const ds = { ...DEFAULT_DOCUMENT_SETTINGS, ...(doctorProfile.documentSettings ?? {}) };
  const eHeaderNote = esc(ds.headerNote);
  const eFooterNote = esc(ds.footerNote);
  const letterhead = ds.layout === "letterhead";   // pre-printed paper: skip identity block
  const compact    = ds.layout === "compact";
  // Advanced page design (margins / block positions / logo / letterhead
  // background) — read via designForKind (the page designer saves under
  // designs.ordonnance; falls back to the legacy ordonnanceDesign field).
  const design  = designForKind(ds, "ordonnance");
  const margins = resolveMargins(design, ORDONNANCE_DEFAULT_MARGINS);
  const bs = (key: string) => blockStyle(design, key, margins);

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const cityPart = esc(doctorProfile.address
    ? doctorProfile.address.split(",").pop()?.trim() ?? ""
    : "");

  const lineHtml = lines.map((l, i) => {
    const doseStr  = l.dosage    ? ` — ${esc(l.dosage)}`  : "";
    const notesStr = l.notes     ? `<div class="rx-notes">${esc(l.notes)}</div>` : "";
    return `
    <div class="rx-item">
      <div class="rx-num">${i + 1}.</div>
      <div class="rx-body">
        <div class="rx-drug">${esc(l.drug)}${doseStr}</div>
        <div class="rx-posol">Prendre ${esc(l.frequency)} pendant ${esc(l.duration)}.</div>
        ${notesStr}
      </div>
    </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Ordonnance — ${eName}</title>
  <style>
    ${pageRule(resolvePageSize(design, "A5").css, margins)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; background: #fff; position: relative; }

    /* Header */
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; border-bottom: 2px solid var(--doc-accent,#0A4E7E); margin-bottom: 12px;
    }
    .doc-name  { font-size: 13.5pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); margin-bottom: 3px; }
    .doc-meta  { font-size: 8.5pt; color: #444; line-height: 1.7; }
    .date-bloc { text-align: right; font-size: 9pt; color: #333; line-height: 1.7; }

    /* Patient */
    .patient-line {
      margin-bottom: 12px; font-size: 10pt;
      border-left: 3px solid var(--doc-accent,#0A4E7E); padding-left: 8px;
    }

    /* Medication items */
    .rx-list { display: flex; flex-direction: column; gap: 10px; min-height: 90mm; }
    .rx-item { display: flex; gap: 8px; break-inside: avoid; page-break-inside: avoid; }
    .rx-num  { font-size: 10pt; font-weight: bold; color: var(--doc-accent,#0A4E7E); width: 18px; flex-shrink: 0; padding-top: 1px; }
    .rx-body { flex: 1; }
    .rx-drug { font-size: 11pt; font-weight: bold; text-transform: uppercase; }
    .rx-posol { font-size: 9.5pt; color: #333; margin-top: 2px; font-style: italic; }
    .rx-notes { font-size: 8.5pt; color: #666; margin-top: 1px; }

    /* Signature */
    .sig-area {
      margin-top: 14px; text-align: right;
      padding-top: 10px; border-top: 1px solid #ddd;
    }
    .sig-label { font-size: 9pt; color: #555; margin-bottom: 30px; }
    .sig-line  { border-top: 1px solid #999; width: 120px; margin-left: auto; padding-top: 3px; font-size: 8pt; color: #888; }

    /* Footer */
    .footer { margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 6px;
              font-size: 7.5pt; color: #999; text-align: center; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  ${typographyCss(ds)}</style>
</head>
<body>
  ${backgroundHtml(design)}
  ${logoHtml(design, margins)}
  <div class="header" style="${letterhead ? "border:none;padding-top:28mm;" : ""}${compact ? "padding-bottom:6px;margin-bottom:7px;" : ""}${blockHidden(design, "header") && blockHidden(design, "date") ? "display:none;" : ""}">
    ${letterhead || blockHidden(design, "header") ? `<div></div>` : `<div style="${bs("header")}">
      <div class="doc-name">${eFull || "Dr."}</div>
      <div class="doc-meta">
        ${eSpec  ? eSpec  + "<br/>" : ""}
        ${eAddr  ? eAddr  + "<br/>" : ""}
        ${ePhone ? "Tél : " + ePhone + "<br/>" : ""}
        ${eOrdre ? "N° Ordre : " + eOrdre + "<br/>" : ""}
        ${ds.showInpe && eInpe ? "INPE : " + eInpe + "<br/>" : ""}
        ${ds.showIce  && eIce  ? "ICE : "  + eIce  : ""}
        ${eHeaderNote ? `<div style="margin-top:3px;font-style:italic;">${eHeaderNote}</div>` : ""}
      </div>
    </div>`}
    ${cityPart ? `<div class="date-bloc" style="${bs("city")}">${cityPart}</div>` : ""}
    <div class="date-bloc" style="${bs("date")}">Le ${dateLabel}</div>
  </div>

  <div class="patient-line" style="${bs("patient")}">
    <strong>${eName}</strong>
  </div>

  <div class="rx-list" style="${bs("body")}">
    ${lines.length > 0 ? lineHtml : '<div style="color:#aaa;font-style:italic">(aucune prescription)</div>'}
  </div>

  <div class="sig-area" style="${bs("signature")}">
    <div class="sig-label">Signature et cachet du médecin :</div>
    <div class="sig-line">${eFull}</div>
  </div>

  <div class="footer" style="${bs("footer")}">
    ${eFooterNote ? eFooterNote : "Ordonnance médicale · Document confidentiel"}
  </div>

  <script>window.onload = function(){ window.print(); };<\/script>
${brandFooterHtml()}</body>
</html>`;

  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) { alert("Veuillez autoriser les fenêtres pop-up pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
}
