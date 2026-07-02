import type { WaTemplateCategory } from "./cabinetTypes";

// ── Patient-message language (independent of the app UI language) ────────────
//
// Doctors often use the app in French/English while many patients read Arabic.
// The WhatsApp picker offers these built-in message bodies per language; the
// doctor's own templates remain available regardless of the selected language.

export type WaMsgLang = "fr" | "ar" | "en";

export const WA_MSG_LANGS: { key: WaMsgLang; label: string }[] = [
  { key: "fr", label: "Français" },
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

export const WA_MSG_LOCALE: Record<WaMsgLang, string> = {
  fr: "fr-FR",
  ar: "ar-MA",
  en: "en-US",
};

export interface BuiltinWaMessage {
  id:       string;
  category: WaTemplateCategory;
  name:     string;
  body:     string;
}

export const BUILTIN_WA_MESSAGES: Record<WaMsgLang, BuiltinWaMessage[]> = {
  fr: [
    {
      id: "b-fr-rappel", category: "rappel", name: "Rappel de rendez-vous",
      body: "Bonjour {patient}, nous vous rappelons votre rendez-vous le {date} à {heure} chez {docteur}. En cas d'empêchement, merci de nous contacter. Merci.",
    },
    {
      id: "b-fr-confirmation", category: "confirmation", name: "Confirmation de rendez-vous",
      body: "Bonjour {patient}, votre rendez-vous du {date} à {heure} est confirmé au {cabinet}. Merci de vous présenter 5 minutes avant. À bientôt !",
    },
    {
      id: "b-fr-suivi", category: "suivi", name: "Suivi post-consultation",
      body: "Bonjour {patient}, suite à votre consultation du {date}, nous espérons que vous allez mieux. N'hésitez pas à nous contacter si vous avez des questions. Cordialement, {cabinet}.",
    },
    {
      id: "b-fr-resultats", category: "resultats", name: "Résultats disponibles",
      body: "Bonjour {patient}, vos résultats d'examens sont disponibles au {cabinet}. Merci de nous contacter ou de passer les récupérer. Cordialement.",
    },
    {
      id: "b-fr-annulation", category: "autre", name: "Annulation de rendez-vous",
      body: "Bonjour {patient}, nous sommes dans l'obligation d'annuler votre rendez-vous du {date} à {heure}. Merci de nous contacter pour reprogrammer. Nous nous excusons pour la gêne occasionnée.",
    },
  ],
  ar: [
    {
      id: "b-ar-rappel", category: "rappel", name: "تذكير بالموعد",
      body: "مرحباً {patient}، نذكّركم بموعدكم يوم {date} على الساعة {heure} عند {docteur}. في حال وجود مانع، المرجو الاتصال بنا. شكراً.",
    },
    {
      id: "b-ar-confirmation", category: "confirmation", name: "تأكيد الموعد",
      body: "مرحباً {patient}، تم تأكيد موعدكم ليوم {date} على الساعة {heure} في {cabinet}. المرجو الحضور قبل الموعد بخمس دقائق. إلى اللقاء!",
    },
    {
      id: "b-ar-suivi", category: "suivi", name: "متابعة بعد الاستشارة",
      body: "مرحباً {patient}، بعد استشارتكم بتاريخ {date}، نتمنى أن تكونوا في تحسن. لا تترددوا في الاتصال بنا إذا كانت لديكم أي أسئلة. مع تحيات {cabinet}.",
    },
    {
      id: "b-ar-resultats", category: "resultats", name: "النتائج جاهزة",
      body: "مرحباً {patient}، نتائج فحوصاتكم جاهزة في {cabinet}. المرجو الاتصال بنا أو المرور لاستلامها. مع التحية.",
    },
    {
      id: "b-ar-annulation", category: "autre", name: "إلغاء الموعد",
      body: "مرحباً {patient}، نعتذر عن اضطرارنا لإلغاء موعدكم ليوم {date} على الساعة {heure}. المرجو الاتصال بنا لتحديد موعد جديد. نعتذر عن الإزعاج.",
    },
  ],
  en: [
    {
      id: "b-en-rappel", category: "rappel", name: "Appointment reminder",
      body: "Hello {patient}, this is a reminder of your appointment on {date} at {heure} with {docteur}. If you cannot attend, please contact us. Thank you.",
    },
    {
      id: "b-en-confirmation", category: "confirmation", name: "Appointment confirmation",
      body: "Hello {patient}, your appointment on {date} at {heure} at {cabinet} is confirmed. Please arrive 5 minutes early. See you soon!",
    },
    {
      id: "b-en-suivi", category: "suivi", name: "Post-consultation follow-up",
      body: "Hello {patient}, following your consultation on {date}, we hope you are feeling better. Do not hesitate to contact us if you have any questions. Kind regards, {cabinet}.",
    },
    {
      id: "b-en-resultats", category: "resultats", name: "Results available",
      body: "Hello {patient}, your test results are available at {cabinet}. Please contact us or come by to collect them. Kind regards.",
    },
    {
      id: "b-en-annulation", category: "autre", name: "Appointment cancellation",
      body: "Hello {patient}, we regret that we must cancel your appointment on {date} at {heure}. Please contact us to reschedule. We apologise for the inconvenience.",
    },
  ],
};
