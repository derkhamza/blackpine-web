import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { ExamRequestModal } from "../components/ExamRequestModal";
import { printExamRequest } from "../lib/examRequestPrinter";
import { EXAM_REQ_CATEGORY_COLORS } from "../lib/examCatalog";
import type { ExamRequest } from "../lib/cabinetTypes";
import type { PickerPatient } from "../components/PatientPicker";
import { useTranslation } from "react-i18next";
import { todayIso } from "../lib/format";

export function ExamRequestsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const {
    examRequests, addExamRequest, deleteExamRequest,
    patients, doctorProfile, role,
  } = useCabinet();
  const readOnly = role === "secretary";

  const [params] = useSearchParams();
  const focusId = params.get("focus");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const patientsList = useMemo<PickerPatient[]>(
    () => patients.map(p => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName,
      dateOfBirth: p.dateOfBirth, phone: p.phone, city: p.city, cin: p.cin,
    })),
    [patients],
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...examRequests]
      .filter(r => !q || r.patientName.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [examRequests, search]);

  const fmtDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  const reprint = (r: ExamRequest) =>
    printExamRequest({ lines: r.lines, indication: r.indication, patientName: r.patientName, date: r.date, doctorProfile });

  const content = (
    <>
      <div className="fac-filter-bar" style={{ marginBottom: 16 }}>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + {t("examReq.newRequest")}
          </button>
        )}
        <div className="rmb-search-wrap" style={{ marginLeft: "auto" }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input className="rmb-search" placeholder={t("examReq.searchPlaceholder")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("examReq.emptyTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("examReq.emptyHint")}</div>
        </div>
      ) : (
        <div className="exr-cards">
          {list.map(r => (
            <div key={r.id} className={`exr-card${focusId === r.id ? " exr-card-focus" : ""}`}>
              <div className="exr-card-head">
                <div className="exr-card-patient">{r.patientName}</div>
                <div className="exr-card-date">{fmtDate(r.date)}</div>
              </div>
              <div className="exr-card-chips">
                {r.lines.map((l, i) => (
                  <span key={i} className="exr-chip" style={{ borderColor: EXAM_REQ_CATEGORY_COLORS[l.category] }}>
                    {l.label}{l.detail ? ` (${l.detail})` : ""}
                  </span>
                ))}
              </div>
              {r.indication && <div className="exr-card-indication">{r.indication}</div>}
              <div className="exr-card-actions">
                <button className="fac-reprint-btn" onClick={() => reprint(r)}>{t("examReq.print")}</button>
                {!readOnly && (
                  <button className="exr-del-link" onClick={() => {
                    if (window.confirm(t("examReq.deleteConfirm"))) deleteExamRequest(r.id);
                  }}>{t("common.delete")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <ExamRequestModal
          patientName=""
          date={todayIso()}
          doctorProfile={doctorProfile}
          patients={patientsList}
          onSave={({ lines, indication, patientName, patientId }) => {
            addExamRequest({
              patientId, patientName, date: todayIso(),
              lines, indication, source: "standalone",
            });
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  );

  if (noLayout) return content;
  return <Layout title={t("examReq.pageTitle")} subtitle={t("examReq.pageSubtitle")}>{content}</Layout>;
}
