import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Web Speech API — Chrome/Edge expose it as webkitSpeechRecognition. We degrade
// gracefully (render nothing) where it's unavailable (e.g. Firefox, some WebViews).
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export function dictationSupported(): boolean {
  const w = window as SpeechWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * A small mic button that dictates one spoken phrase (single utterance) into a
 * field. `lang` is a BCP-47 tag (e.g. "fr-FR", "ar-MA", "en-US"); `onText`
 * receives the recognized phrase to append.
 */
export function DictationButton({
  lang, onText, disabled,
}: {
  lang: string;
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  if (!dictationSupported()) return null;

  const toggle = () => {
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } return; }
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.continuous = false;     // one utterance per click — keeps state updates simple
    rec.interimResults = false;
    rec.onresult = (e) => {
      let phrase = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) phrase += e.results[i][0].transcript;
      }
      const clean = phrase.trim();
      if (clean) onText(clean);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  return (
    <button
      type="button"
      className={`dictation-btn${listening ? " listening" : ""}`}
      onClick={toggle}
      disabled={disabled}
      title={listening ? t("dictation.stop") : t("dictation.start")}
      aria-label={listening ? t("dictation.stop") : t("dictation.start")}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <rect x="5" y="1.3" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 6.5a4 4 0 0 0 8 0M7 10.5v2M5 12.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
