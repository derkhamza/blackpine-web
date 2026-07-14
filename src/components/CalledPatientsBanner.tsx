import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCabinet } from "../context/CabinetContext";
import { todayIso } from "../lib/format";

// A persistent banner for the SECRETARY (and the doctor's secretary preview): when
// the doctor has called a patient in ("Faire entrer") but the patient hasn't been
// brought to consultation yet, a live toast can be missed — this stays on screen,
// on every page, until the call is acted on. Clears itself when the status changes.
export function CalledPatientsBanner() {
  const { appointments, role, secretaryMode } = useCabinet();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!(role === "secretary" || secretaryMode)) return null;

  const today  = todayIso();
  const called = appointments.filter(a => a.date === today && a.status === "arrived" && a.calledInAt);
  if (called.length === 0) return null;

  return (
    <button className="called-banner" onClick={() => navigate("/salle-attente")}>
      <span className="called-banner-dot" aria-hidden />
      <span className="called-banner-text">
        🔔 {called.length === 1
          ? t("signals.bannerOne", { patient: called[0].patientName, defaultValue: "{{patient}} est appelé·e — faites entrer" })
          : t("signals.bannerMany", { n: called.length, defaultValue: "{{n}} patients appelés — faites entrer" })}
      </span>
    </button>
  );
}
