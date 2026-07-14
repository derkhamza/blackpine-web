import { confirmDialog } from "../lib/confirm";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import { MedicalReportModal } from "../components/MedicalReportModal";
import { printMedicalReport, reportTitle } from "../lib/medicalReportPrinter";
import { IMAGING_MODALITY_LABELS } from "../lib/cabinetTypes";
import type { MedicalReport } from "../lib/cabinetTypes";
import type { PickerPatient } from "../components/PatientPicker";
import { useTranslation } from "react-i18next";
import { todayIso } from "../lib/format";

export function MedicalReportsPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const {
    medicalReports, addMedicalReport, updateMedicalReport, deleteMedicalReport,
    patients, doctorProfile, role,
  } = useCabinet();
  const readOnly = role === "secretary";

  const [params] = useSearchParams();
  const focusId = params.get("focus");
  const [search, setSearch] = useState("");
  // null = closed; { } = new; { editId } = editing an existing report
  const [modal, setModal] = useState<null | { editId?: string }>(null);

  const patientsList = useMemo<PickerPatient[]>(
    () => patients.map(p => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName,
      dateOfBirth: p.dateOfBirth, phone: p.phone, city: p.city, cin: p.cin,
    })),
    [patients],
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...medicalReports]
      .filter(r => !q || r.patientName.toLowerCase().includes(q) || reportTitle(r).toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [medicalReports, search]);

  const fmtDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  const editing = modal?.editId ? medicalReports.find(r => r.id === modal.editId) : undefined;

  const content = (
    <>
      <div className="fac-filter-bar" style={{ marginBottom: 16 }}>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => setModal({})}>
            + {t("medReport.newReport")}
          </button>
        )}
        <div className="rmb-search-wrap" style={{ marginLeft: "auto" }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input className="rmb-search" placeholder={t("medReport.searchPlaceholder")}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("medReport.emptyTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("medReport.emptyHint")}</div>
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
                <span className="exr-chip" style={{ borderColor: r.kind === "imaging" ? "#8B5CF6" : "#0EA5E9" }}>
                  {r.kind === "imaging"
                    ? (r.modality ? IMAGING_MODALITY_LABELS[r.modality] : t("medReport.kind_imaging"))
                    : t("medReport.kind_report")}
                </span>
                <span className="exr-chip" style={{ borderColor: "var(--border)" }}>{reportTitle(r)}</span>
              </div>
              {(r.conclusion || r.body || r.findings) && (
                <div className="exr-card-indication">{(r.conclusion || r.body || r.findings || "").slice(0, 160)}</div>
              )}
              <div className="exr-card-actions">
                <button className="fac-reprint-btn" onClick={() => printMedicalReport({ report: r, doctorProfile })}>{t("medReport.print")}</button>
                {!readOnly && (
                  <button className="exr-del-link" onClick={() => setModal({ editId: r.id })}>{t("common.edit")}</button>
                )}
                {!readOnly && (
                  <button className="exr-del-link" onClick={async () => {
                    if (await confirmDialog(t("medReport.deleteConfirm"))) deleteMedicalReport(r.id);
                  }}>{t("common.delete")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <MedicalReportModal
          patientName={editing?.patientName ?? ""}
          date={editing?.date ?? todayIso()}
          doctorProfile={doctorProfile}
          patients={patientsList}
          initial={editing}
          source="standalone"
          onSave={(data) => {
            if (modal.editId && editing) {
              updateMedicalReport({ ...editing, ...data });
            } else {
              const created = addMedicalReport(data);
              setModal({ editId: created.id });
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );

  if (noLayout) return content;
  return <Layout title={t("medReport.pageTitle")} subtitle={t("medReport.pageSubtitle")}>{content}</Layout>;
}
