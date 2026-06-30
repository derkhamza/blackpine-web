import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BlackpineLogo } from "../components/Logo";
import {
  bookingPublicInfo, bookingPublicSlots, bookingPublicCreate,
  type BookingPublicInfo,
} from "../api/client";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BookingPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA" : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const { slug = "" } = useParams<{ slug: string }>();

  const [info,    setInfo]    = useState<BookingPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [date,  setDate]  = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time,  setTime]  = useState<string>("");

  const [name,   setName]   = useState("");
  const [phone,  setPhone]  = useState("");
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [done,   setDone]   = useState<{ date: string; time: string } | null>(null);

  // Load the doctor's public info
  useEffect(() => {
    let cancel = false;
    bookingPublicInfo(slug)
      .then((d) => { if (!cancel) setInfo(d); })
      .catch(() => { if (!cancel) setUnavailable(true); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [slug]);

  // Build the list of selectable days (allowed weekdays within range)
  const days = useMemo(() => {
    if (!info) return [];
    const allowed = new Set(info.days.split(",").map(Number));
    const out: Date[] = [];
    const d = new Date(); d.setHours(12, 0, 0, 0);
    for (let i = 0; i <= info.maxDaysAhead && out.length < 21; i++) {
      const c = new Date(d); c.setDate(d.getDate() + i);
      if (allowed.has(c.getDay())) out.push(c);
    }
    return out;
  }, [info]);

  // Fetch slots when a date is chosen
  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setSlotsLoading(true); setTime("");
    bookingPublicSlots(slug, date)
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [date, slug]);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) { setError(t("booking.errName")); return; }
    if (!/^[\d +().-]{6,20}$/.test(phone.trim())) { setError(t("booking.errPhone")); return; }
    if (!date || !time) { setError(t("booking.errSlot")); return; }
    setBusy(true);
    try {
      await bookingPublicCreate(slug, { date, time, name: name.trim(), phone: phone.trim(), reason: reason.trim() || undefined });
      setDone({ date, time });
    } catch (e) {
      setError((e as Error).message || t("booking.errGeneric"));
      // a 409 means the slot was just taken — refresh slots
      bookingPublicSlots(slug, date).then((d) => setSlots(d.slots)).catch(() => {});
      setTime("");
    } finally {
      setBusy(false);
    }
  };

  const fmtDay = (d: Date) => d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  if (loading) {
    return <div className="booking-root"><div className="booking-card"><div className="booking-loading">{t("common.loading")}…</div></div></div>;
  }
  if (unavailable || !info) {
    return (
      <div className="booking-root">
        <div className="booking-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🗓️</div>
          <h1 className="booking-title">{t("booking.unavailableTitle")}</h1>
          <p className="booking-sub">{t("booking.unavailableSub")}</p>
        </div>
      </div>
    );
  }

  if (done) {
    const d = new Date(done.date + "T12:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    return (
      <div className="booking-root">
        <div className="booking-card" style={{ textAlign: "center" }}>
          <div className="booking-check">✓</div>
          <h1 className="booking-title">{t("booking.confirmedTitle")}</h1>
          <p className="booking-sub">{t("booking.confirmedSub")}</p>
          <div className="booking-confirm-box">
            <div className="booking-confirm-doctor">{info.doctorName || t("booking.doctor")}</div>
            <div className="booking-confirm-when">{d} · {done.time}</div>
          </div>
          <p className="booking-note">{t("booking.confirmedNote")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-root">
      <div className="booking-card">
        <div className="booking-brand">
          <BlackpineLogo size={40} radius={10} />
          <div>
            <div className="booking-doctor">{info.doctorName || t("booking.doctor")}</div>
            {info.specialty && <div className="booking-specialty">{info.specialty}</div>}
          </div>
        </div>
        <h1 className="booking-title">{t("booking.title")}</h1>
        <p className="booking-sub">{t("booking.sub")}</p>

        {/* Day picker */}
        <label className="form-label">{t("booking.chooseDay")}</label>
        <div className="booking-day-row">
          {days.map((d) => {
            const iso = isoDate(d);
            return (
              <button
                key={iso}
                type="button"
                className={`booking-day${date === iso ? " active" : ""}`}
                onClick={() => setDate(iso)}
              >
                {fmtDay(d)}
              </button>
            );
          })}
        </div>

        {/* Slot picker */}
        {date && (
          <>
            <label className="form-label" style={{ marginTop: 14 }}>{t("booking.chooseTime")}</label>
            {slotsLoading ? (
              <div className="booking-loading">{t("common.loading")}…</div>
            ) : slots.length === 0 ? (
              <div className="booking-empty">{t("booking.noSlots")}</div>
            ) : (
              <div className="booking-slot-grid">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`booking-slot${time === s ? " active" : ""}`}
                    onClick={() => setTime(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Patient form */}
        {time && (
          <div className="booking-form">
            <div className="form-group">
              <label className="form-label">{t("booking.name")}</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="form-group">
              <label className="form-label">{t("booking.phone")}</label>
              <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="06XXXXXXXX" autoComplete="tel" />
            </div>
            <div className="form-group">
              <label className="form-label">{t("booking.reason")} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{t("common.optional")}</span></label>
              <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-navy" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={submit} disabled={busy}>
              {busy ? `${t("common.loading")}…` : t("booking.confirm")}
            </button>
          </div>
        )}

        <p className="booking-footer">{t("booking.poweredBy")}</p>
      </div>
    </div>
  );
}
