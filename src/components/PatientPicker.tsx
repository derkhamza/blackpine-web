import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { fullName } from "../lib/nameFormat";

// A patient name field that disambiguates between several patients who share
// the same name. When the typed name matches exactly one patient it links
// silently; when it matches two or more, it asks which one (showing each
// patient's date of birth / phone / CIN so they can be told apart) and stores
// the chosen patient's id. The printed/displayed name stays identical — only
// the underlying patientId differs.

export interface PickerPatient {
  id:           string;
  firstName:    string;
  lastName:     string;
  dateOfBirth?: string;
  phone?:       string;
  city?:        string;
  cin?:         string;
}

export function pickerName(p: PickerPatient): string {
  return fullName(p);
}

function distinguisher(p: PickerPatient): string {
  const parts: string[] = [];
  if (p.dateOfBirth) parts.push(p.dateOfBirth);
  if (p.phone)       parts.push(p.phone);
  else if (p.cin)    parts.push(p.cin);
  else if (p.city)   parts.push(p.city);
  return parts.join("  ·  ");
}

interface Props {
  value:       string;
  patientId?:  string;
  patients:    PickerPatient[];
  label?:      string;
  placeholder?: string;
  listId:      string;
  required?:   boolean;
  autoFocus?:  boolean;
  onChange:    (name: string, patientId: string | undefined) => void;
}

export function PatientPicker({
  value, patientId, patients, label, placeholder, listId, required, autoFocus, onChange,
}: Props) {
  const { t } = useTranslation();

  const matches = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (!v) return [];
    return patients.filter(p => pickerName(p).toLowerCase() === v);
  }, [value, patients]);

  const handleText = (val: string) => {
    const v = val.trim().toLowerCase();
    const m = patients.filter(p => pickerName(p).toLowerCase() === v);
    // exactly one match → link it; zero or ambiguous → no id (resolve below)
    onChange(val, m.length === 1 ? m[0].id : undefined);
  };

  const ambiguous = matches.length >= 2 && !patientId;
  const selected  = patientId ? patients.find(p => p.id === patientId) : undefined;
  const unknown   = value.trim().length > 0 && matches.length === 0;

  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input
        className="form-input"
        placeholder={placeholder}
        value={value}
        required={required}
        autoFocus={autoFocus}
        onChange={e => handleText(e.target.value)}
        list={listId}
      />
      <datalist id={listId}>
        {patients.map(p => <option key={p.id} value={pickerName(p)} />)}
      </datalist>

      {ambiguous && (
        <div className="patient-picker-ambig">
          <div className="patient-picker-ambig-title">{t("patientPicker.ambiguous")}</div>
          {matches.map(p => (
            <button
              type="button"
              key={p.id}
              className="patient-picker-choice rv-press"
              onClick={() => onChange(pickerName(p), p.id)}
            >
              <span className="patient-picker-choice-name">{pickerName(p)}</span>
              <span className="patient-picker-choice-meta">
                {distinguisher(p) || t("patientPicker.noInfo")}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && matches.length >= 2 && (
        <div className="patient-picker-selected">
          <span className="patient-picker-selected-tick">✓</span>
          <span>{distinguisher(selected) || pickerName(selected)}</span>
          <button
            type="button"
            className="patient-picker-change"
            onClick={() => onChange(value, undefined)}
          >
            {t("patientPicker.change")}
          </button>
        </div>
      )}

      {unknown && (
        <div className="form-hint" style={{ color: "var(--gold)" }}>
          {t("patientPicker.unknown")}
        </div>
      )}
    </div>
  );
}
