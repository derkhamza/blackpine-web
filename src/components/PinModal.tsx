/**
 * PinModal — 4-digit PIN entry for exiting secretary mode.
 * Shown when the doctor wants to unlock full access.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onSuccess: () => void;
  onCancel:  () => void;
  verify:    (pin: string) => boolean;
}

export function PinModal({ onSuccess, onCancel, verify }: Props) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error,  setError]  = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError(false);
    if (digit && idx < 3) {
      refs[idx + 1].current?.focus();
    }
    // Auto-submit when all 4 filled
    if (digit && idx === 3) {
      const pin = next.join("");
      if (pin.length === 4) {
        if (verify(pin)) {
          onSuccess();
        } else {
          setError(true);
          setDigits(["", "", "", ""]);
          setTimeout(() => refs[0].current?.focus(), 50);
        }
      }
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
    }
    if (e.key === "Enter") {
      const pin = digits.join("");
      if (pin.length === 4) {
        if (verify(pin)) {
          onSuccess();
        } else {
          setError(true);
          setDigits(["", "", "", ""]);
          setTimeout(() => refs[0].current?.focus(), 50);
        }
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal pin-modal">
        <div className="modal-header">
          <h2 className="modal-title">{t("pin.title")}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, textAlign: "center" }}>
            {t("pin.subtitle")}
          </p>
          <div className="pin-digits">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={refs[i]}
                className={`pin-digit-input${error ? " error" : ""}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoComplete="off"
              />
            ))}
          </div>
          {error && (
            <div className="pin-error">
              {t("pin.wrong")}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>{t("pin.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
