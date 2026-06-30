import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import type { OrdonnanceLine, Prescription, PrescriptionTemplate } from "../lib/cabinetTypes";
import { todayIso } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function blankLine(): OrdonnanceLine {
  return { drug: "", dosage: "", frequency: "", duration: "", notes: "" };
}

function fmtDateLocale(iso: string, locale: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Print function — intentionally kept in French (official medical document)
function printOrdonnance(
  patientName: string,
  date: string,
  lines: OrdonnanceLine[],
  notes: string | undefined,
  doctor: { fullName: string; specialtyLabel?: string; address?: string; phone?: string; inpe?: string },
) {
  const formatDateFr = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const rows = lines.map((l, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666;font-size:13px;vertical-align:top;width:24px;">${i + 1}.</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top;">
        <div style="font-weight:700;font-size:14px;color:#0A4E7E;">${l.drug}</div>
        ${l.dosage ? `<div style="font-size:12px;color:#444;margin-top:2px;">${l.dosage}</div>` : ""}
        <div style="font-size:12px;color:#555;margin-top:3px;">
          ${l.frequency}${l.duration ? ` — <em>${l.duration}</em>` : ""}
        </div>
        ${l.notes ? `<div style="font-size:11px;color:#888;font-style:italic;margin-top:2px;">⚑ ${l.notes}</div>` : ""}
      </td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Ordonnance — ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #122B42; padding: 32px 36px; max-width: 600px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #0A4E7E; margin-bottom: 22px; }
    .dr-name { font-size: 20px; font-weight: 800; color: #0A4E7E; letter-spacing: -0.3px; }
    .dr-specialty { font-size: 13px; color: #1890C5; font-weight: 600; margin-top: 2px; }
    .dr-meta { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.6; }
    .logo-area { text-align: right; }
    .logo-rx { font-size: 40px; font-weight: 900; color: #0A4E7E; opacity: .12; line-height: 1; }
    .title-bar { text-align: center; letter-spacing: 4px; font-size: 13px; font-weight: 700; color: #0A4E7E; border: 1.5px solid #0A4E7E; padding: 7px 16px; margin-bottom: 18px; text-transform: uppercase; }
    .patient-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }
    .patient-label { font-size: 13px; color: #555; }
    .patient-name { font-size: 15px; font-weight: 700; color: #122B42; }
    .date-val { font-size: 13px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .notes-block { background: #F5F9FC; border-left: 3px solid #1890C5; padding: 10px 14px; font-size: 12px; color: #555; margin-bottom: 20px; }
    .footer { margin-top: 40px; display: flex; justify-content: flex-end; }
    .sig-box { border: 1px solid #ddd; border-radius: 6px; padding: 12px 24px; text-align: center; min-width: 180px; }
    .sig-label { font-size: 11px; color: #888; margin-bottom: 28px; }
    .sig-line { border-top: 1px solid #aaa; padding-top: 6px; font-size: 11px; color: #888; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="dr-name">${doctor.fullName || "Dr. —"}</div>
      ${doctor.specialtyLabel ? `<div class="dr-specialty">${doctor.specialtyLabel}</div>` : ""}
      <div class="dr-meta">
        ${doctor.address ? `${doctor.address}<br/>` : ""}
        ${doctor.phone ? `Tél : ${doctor.phone}<br/>` : ""}
        ${doctor.inpe ? `N° INPE : ${doctor.inpe}` : ""}
      </div>
    </div>
    <div class="logo-area"><div class="logo-rx">℞</div></div>
  </div>
  <div class="title-bar">Ordonnance Médicale</div>
  <div class="patient-row">
    <div>
      <span class="patient-label">Patient(e) : </span>
      <span class="patient-name">${patientName}</span>
    </div>
    <div class="date-val">Le ${formatDateFr(date)}</div>
  </div>
  <table>${rows}</table>
  ${notes ? `<div class="notes-block"><strong>Note :</strong> ${notes}</div>` : ""}
  <div class="footer">
    <div class="sig-box">
      <div class="sig-label">Signature et cachet</div>
      <div class="sig-line">${doctor.fullName || ""}</div>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=680,height=820");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Drug line row ─────────────────────────────────────────────────────────────

interface DrugLineRowProps {
  line:      OrdonnanceLine;
  index:     number;
  onChange:  (i: number, field: keyof OrdonnanceLine, val: string) => void;
  onRemove:  (i: number) => void;
  canRemove: boolean;
}

function DrugLineRow({ line, index, onChange, onRemove, canRemove }: DrugLineRowProps) {
  const { t } = useTranslation();
  return (
    <div className="rx-line-row">
      <div className="rx-line-num">{index + 1}</div>
      <div className="rx-line-fields">
        <input className="rx-input rx-line-drug"
          placeholder={t("ordonnances.drugPlaceholder")}
          value={line.drug} onChange={e => onChange(index, "drug", e.target.value)} />
        <div className="rx-line-row2">
          <input className="rx-input" placeholder={t("ordonnances.dosagePlaceholder")}
            value={line.dosage ?? ""} onChange={e => onChange(index, "dosage", e.target.value)} />
          <input className="rx-input" placeholder={t("ordonnances.freqPlaceholder")}
            value={line.frequency} onChange={e => onChange(index, "frequency", e.target.value)} />
          <input className="rx-input" placeholder={t("ordonnances.durationPlaceholder")}
            value={line.duration} onChange={e => onChange(index, "duration", e.target.value)} />
        </div>
        <input className="rx-input rx-line-note" placeholder={t("ordonnances.instructionsPlaceholder")}
          value={line.notes ?? ""} onChange={e => onChange(index, "notes", e.target.value)} />
      </div>
      {canRemove && (
        <button className="rx-line-remove" onClick={() => onRemove(index)}>×</button>
      )}
    </div>
  );
}

// ── Prescription modal ────────────────────────────────────────────────────────

interface RxModalProps {
  editing?:          Prescription;
  initialTemplate?:  PrescriptionTemplate;
  patients:          { id: string; name: string }[];
  templates:         PrescriptionTemplate[];
  today:             string;
  onSave:            (p: Omit<Prescription, "id" | "createdAt">) => void;
  onClose:           () => void;
}

function RxModal({ editing, initialTemplate, patients, templates, today, onSave, onClose }: RxModalProps) {
  const { t } = useTranslation();
  const [patientName,   setPatientName]   = useState(editing?.patientName ?? "");
  const [date,          setDate]          = useState(editing?.date ?? today);
  const [lines,         setLines]         = useState<OrdonnanceLine[]>(() => {
    if (editing?.lines?.length) return editing.lines.map(l => ({ ...l }));
    if (initialTemplate?.lines?.length) return initialTemplate.lines.map(l => ({ ...l }));
    return [blankLine()];
  });
  const [notes,         setNotes]         = useState(editing?.notes ?? "");
  const [selectedTplId, setTplId]         = useState(initialTemplate?.id ?? "");

  const applyTemplate = useCallback((tplId: string) => {
    const tpl = templates.find(x => x.id === tplId);
    if (!tpl) return;
    setLines(tpl.lines.map(l => ({ ...l })));
    setTplId(tplId);
  }, [templates]);

  const changeLine = useCallback((i: number, field: keyof OrdonnanceLine, val: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }, []);

  const removeLine = useCallback((i: number) => {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleSave = () => {
    if (!patientName.trim()) return;
    if (lines.every(l => !l.drug.trim())) return;
    const cleanLines = lines.filter(l => l.drug.trim());
    onSave({
      patientName: patientName.trim(),
      date,
      lines: cleanLines,
      notes: notes.trim() || undefined,
      source: editing?.source ?? "standalone",
      appointmentId: editing?.appointmentId,
    });
  };

  const patientMatch = patients.find(p => p.name.toLowerCase() === patientName.toLowerCase());

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal rx-modal">
        <div className="modal-header">
          <div className="modal-title">{editing ? t("ordonnances.rxModalEdit") : t("ordonnances.rxModalNew")}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="rx-top-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">{t("ordonnances.patientField")}</label>
              <input className="form-input" placeholder={t("ordonnances.patientPlaceholder")}
                value={patientName} onChange={e => setPatientName(e.target.value)}
                list="rx-patients-list" />
              <datalist id="rx-patients-list">
                {patients.map(p => <option key={p.id} value={p.name} />)}
              </datalist>
              {patientName && !patientMatch && (
                <div className="form-hint" style={{ color: "var(--gold)" }}>
                  {t("ordonnances.patientNotFound")}
                </div>
              )}
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">{t("ordonnances.dateField")}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {templates.length > 0 && (
            <div className="form-group">
              <label className="form-label">{t("ordonnances.templateField")}</label>
              <div className="rx-tpl-chips">
                {templates.map(tpl => (
                  <button key={tpl.id}
                    className={`rx-tpl-chip${selectedTplId === tpl.id ? " active" : ""}`}
                    onClick={() => applyTemplate(tpl.id)} type="button">
                    {tpl.name}
                    <span className="rx-tpl-chip-count">{tpl.lines.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t("ordonnances.drugsLabel")}</label>
            <div className="rx-lines-list">
              {lines.map((l, i) => (
                <DrugLineRow key={i} line={l} index={i}
                  onChange={changeLine} onRemove={removeLine} canRemove={lines.length > 1} />
              ))}
            </div>
            <button className="rx-add-line-btn" type="button"
              onClick={() => setLines(prev => [...prev, blankLine()])}>
              {t("ordonnances.addDrug")}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">{t("ordonnances.notesLabel")}</label>
            <textarea className="form-input" rows={2}
              placeholder={t("ordonnances.notesPlaceholder")}
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary"
            disabled={!patientName.trim() || lines.every(l => !l.drug.trim())}
            onClick={handleSave}>
            {editing ? t("common.save") : t("ordonnances.createBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template modal ────────────────────────────────────────────────────────────

interface TplModalProps {
  editing?: PrescriptionTemplate;
  onSave:   (t: Omit<PrescriptionTemplate, "id"> & { id?: string }) => void;
  onClose:  () => void;
}

function TplModal({ editing, onSave, onClose }: TplModalProps) {
  const { t } = useTranslation();
  const [name,  setName]  = useState(editing?.name ?? "");
  const [lines, setLines] = useState<OrdonnanceLine[]>(
    editing?.lines?.length ? editing.lines.map(l => ({ ...l })) : [blankLine()]
  );

  const changeLine = useCallback((i: number, field: keyof OrdonnanceLine, val: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }, []);

  const removeLine = useCallback((i: number) => {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    const cleanLines = lines.filter(l => l.drug.trim());
    if (!cleanLines.length) return;
    onSave({ ...(editing ? { id: editing.id } : {}), name: name.trim(), lines: cleanLines });
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal rx-modal">
        <div className="modal-header">
          <div className="modal-title">{editing ? t("ordonnances.tplModalEdit") : t("ordonnances.tplModalNew")}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t("ordonnances.tplNameField")}</label>
            <input className="form-input" placeholder={t("ordonnances.tplNamePlaceholder")}
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("ordonnances.tplDrugsLabel")}</label>
            <div className="rx-lines-list">
              {lines.map((l, i) => (
                <DrugLineRow key={i} line={l} index={i}
                  onChange={changeLine} onRemove={removeLine} canRemove={lines.length > 1} />
              ))}
            </div>
            <button className="rx-add-line-btn" type="button"
              onClick={() => setLines(prev => [...prev, blankLine()])}>
              {t("ordonnances.addDrug")}
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary"
            disabled={!name.trim() || lines.every(l => !l.drug.trim())}
            onClick={handleSave}>
            {editing ? t("common.save") : t("ordonnances.createTplBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prescription card ─────────────────────────────────────────────────────────

interface RxCardProps {
  rx:      Prescription;
  locale:  string;
  doctor:  { fullName: string; specialtyLabel?: string; address?: string; phone?: string; inpe?: string };
  onEdit:  () => void;
  onDelete:() => void;
}

function RxCard({ rx, locale, doctor, onEdit, onDelete }: RxCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rx-card">
      <div className="rx-card-accent" />
      <div className="rx-card-body">
        <div className="rx-card-header">
          <div className="rx-card-patient">{rx.patientName}</div>
          <div className="rx-card-date">{fmtDateLocale(rx.date, locale)}</div>
        </div>
        <div className="rx-card-drugs">
          {rx.lines.slice(0, 3).map((l, i) => (
            <div key={i} className="rx-card-drug-chip">
              <span className="rx-drug-num">{i + 1}</span>
              <span className="rx-drug-name">{l.drug}</span>
              {l.duration && <span className="rx-drug-dur">{l.duration}</span>}
            </div>
          ))}
          {rx.lines.length > 3 && (
            <div className="rx-card-more">
              {t("ordonnances.nMore", { n: rx.lines.length - 3, s: rx.lines.length - 3 > 1 ? "s" : "" })}
            </div>
          )}
        </div>
        {rx.notes && <div className="rx-card-notes">{rx.notes}</div>}
        {rx.source === "appointment" && (
          <div className="rx-source-badge">{t("ordonnances.linkedAppt")}</div>
        )}
      </div>
      <div className="rx-card-actions">
        <button className="btn btn-ghost btn-sm"
          onClick={() => printOrdonnance(rx.patientName, rx.date, rx.lines, rx.notes, doctor)}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="5" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("ordonnances.printBtn")}
        </button>
        {rx.source === "standalone" && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>{t("common.edit")}</button>
            <button className="btn btn-ghost btn-sm danger" onClick={onDelete}>{t("common.delete")}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

interface TplCardProps {
  tpl:     PrescriptionTemplate;
  onEdit:  () => void;
  onDelete:() => void;
  onUse:   () => void;
}

function TplCard({ tpl, onEdit, onDelete, onUse }: TplCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rx-tpl-card">
      <div className="rx-tpl-card-top">
        <div className="rx-tpl-card-name">{tpl.name}</div>
        <div className="rx-tpl-drug-count">
          {t("ordonnances.nDrugs", { n: tpl.lines.length, s: tpl.lines.length > 1 ? "s" : "" })}
        </div>
      </div>
      <div className="rx-tpl-drug-list">
        {tpl.lines.map((l, i) => (
          <div key={i} className="rx-tpl-drug-row">
            <span className="rx-tpl-bullet">•</span>
            <span className="rx-tpl-dname">{l.drug}</span>
            {l.duration && <span className="rx-tpl-dur">{l.duration}</span>}
          </div>
        ))}
      </div>
      <div className="rx-tpl-card-actions">
        <button className="btn btn-primary btn-sm" onClick={onUse}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          {t("ordonnances.useTemplate")}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>{t("common.edit")}</button>
        <button className="btn btn-ghost btn-sm danger" onClick={onDelete}>{t("common.delete")}</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function OrdonancesPage({ noLayout = false }: { noLayout?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";
  const today = todayIso();

  const {
    prescriptions, addPrescription, updatePrescription, deletePrescription,
    prescriptionTemplates, addPrescriptionTemplate, updatePrescriptionTemplate, deletePrescriptionTemplate,
    appointments, patients, doctorProfile,
  } = useCabinet();

  const [tab,          setTab]        = useState<"ordonnances" | "modeles">("ordonnances");
  const [search,       setSearch]     = useState("");
  const [showRxModal,  setRxModal]    = useState(false);
  const [showTplModal, setTplModal]   = useState(false);
  const [editingRx,    setEditingRx]  = useState<Prescription | undefined>();
  const [editingTpl,   setEditingTpl] = useState<PrescriptionTemplate | undefined>();
  const [preFillTpl,   setPreFillTpl] = useState<PrescriptionTemplate | undefined>();

  const apptRx: Prescription[] = useMemo(() => {
    const result: Prescription[] = [];
    for (const a of appointments) {
      if (!a.savedOrdonnance?.lines?.length) continue;
      result.push({
        id:            `appt-${a.id}`,
        patientName:   a.patientName,
        patientId:     a.patientId,
        date:          a.date,
        lines:         a.savedOrdonnance.lines,
        source:        "appointment",
        appointmentId: a.id,
        createdAt:     a.savedOrdonnance.printedAt,
      });
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments]);

  const allRx = useMemo(() => {
    const standalone = [...prescriptions].sort((a, b) => b.date.localeCompare(a.date));
    return [...standalone, ...apptRx];
  }, [prescriptions, apptRx]);

  const filteredRx = useMemo(() => {
    if (!search.trim()) return allRx;
    const q = search.toLowerCase();
    return allRx.filter(r => r.patientName.toLowerCase().includes(q));
  }, [allRx, search]);

  const thisMonth = today.slice(0, 7);
  const kpis = useMemo(() => ({
    total:     allRx.length,
    thisMonth: allRx.filter(r => r.date.startsWith(thisMonth)).length,
    templates: prescriptionTemplates.length,
    patients:  new Set(allRx.map(r => r.patientName)).size,
  }), [allRx, thisMonth, prescriptionTemplates]);

  const patientsList = useMemo(() =>
    patients.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() })),
    [patients]);

  const openNewRx = (tpl?: PrescriptionTemplate) => {
    setEditingRx(undefined);
    setPreFillTpl(tpl);
    setRxModal(true);
    if (tpl) setTab("ordonnances");
  };

  const handleSaveRx = (p: Omit<Prescription, "id" | "createdAt">) => {
    if (editingRx) { updatePrescription({ ...p, id: editingRx.id, createdAt: editingRx.createdAt }); }
    else { addPrescription(p); }
    setRxModal(false);
    setEditingRx(undefined);
    setPreFillTpl(undefined);
  };

  const handleSaveTpl = (tplData: Omit<PrescriptionTemplate, "id"> & { id?: string }) => {
    if (tplData.id) { updatePrescriptionTemplate({ id: tplData.id, name: tplData.name, lines: tplData.lines }); }
    else { addPrescriptionTemplate({ name: tplData.name, lines: tplData.lines }); }
    setTplModal(false);
    setEditingTpl(undefined);
  };

  const body = (
    <>
      <div className="stock-kpi-row">
        <div className="stock-kpi-card">
          <div className="stock-kpi-val">{kpis.total}</div>
          <div className="stock-kpi-lbl">{t("ordonnances.kpiTotal")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--blue)" }}>{kpis.thisMonth}</div>
          <div className="stock-kpi-lbl">{t("ordonnances.kpiThisMonth")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--green)" }}>{kpis.patients}</div>
          <div className="stock-kpi-lbl">{t("ordonnances.kpiPatients")}</div>
        </div>
        <div className="stock-kpi-card">
          <div className="stock-kpi-val" style={{ color: "var(--gold)" }}>{kpis.templates}</div>
          <div className="stock-kpi-lbl">{t("ordonnances.kpiTemplates")}</div>
        </div>
      </div>

      <div className="four-tabs" style={{ marginBottom: 16 }}>
        <button className={`four-tab${tab === "ordonnances" ? " active" : ""}`}
          onClick={() => setTab("ordonnances")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 2h6l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M5 8h4M5 10h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("ordonnances.tabOrd")}
          <span className="badge" style={{ marginLeft: 4 }}>{allRx.length}</span>
        </button>
        <button className={`four-tab${tab === "modeles" ? " active" : ""}`}
          onClick={() => setTab("modeles")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 6h6M4 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {t("ordonnances.tabTemplates")}
          <span className="badge" style={{ marginLeft: 4 }}>{prescriptionTemplates.length}</span>
        </button>
      </div>

      {tab === "ordonnances" && (
        <>
          <div className="four-toolbar">
            <input className="search-input" placeholder={t("ordonnances.search")}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, maxWidth: 320 }} />
            <button className="btn btn-primary" onClick={() => openNewRx()}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {t("ordonnances.newOrd")}
            </button>
          </div>

          {filteredRx.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="40" height="40" viewBox="0 0 14 14" fill="none">
                  <path d="M3 2h6l3 3v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                  <path d="M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="empty-title">
                {search ? t("ordonnances.emptySearch") : t("ordonnances.emptyNone")}
              </div>
              <div className="empty-sub">
                {search ? t("ordonnances.emptySearchHint") : t("ordonnances.emptyHint")}
              </div>
              {!search && (
                <button className="btn btn-primary" onClick={() => openNewRx()}>
                  {t("ordonnances.newOrd")}
                </button>
              )}
            </div>
          ) : (
            <div className="rx-list">
              {filteredRx.map(rx => (
                <RxCard key={rx.id} rx={rx} locale={locale} doctor={doctorProfile}
                  onEdit={() => { setEditingRx(rx); setPreFillTpl(undefined); setRxModal(true); }}
                  onDelete={() => deletePrescription(rx.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "modeles" && (
        <>
          <div className="four-toolbar">
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={() => { setEditingTpl(undefined); setTplModal(true); }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {t("ordonnances.newTemplate")}
            </button>
          </div>

          {prescriptionTemplates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">{t("ordonnances.emptyTpl")}</div>
              <div className="empty-sub">{t("ordonnances.emptyTplHint")}</div>
              <button className="btn btn-primary" onClick={() => { setEditingTpl(undefined); setTplModal(true); }}>
                {t("ordonnances.newTemplate")}
              </button>
            </div>
          ) : (
            <div className="rx-tpl-grid">
              {prescriptionTemplates.map(tpl => (
                <TplCard key={tpl.id} tpl={tpl}
                  onEdit={() => { setEditingTpl(tpl); setTplModal(true); }}
                  onDelete={() => deletePrescriptionTemplate(tpl.id)}
                  onUse={() => openNewRx(tpl)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showRxModal && (
        <RxModal editing={editingRx} initialTemplate={preFillTpl}
          patients={patientsList} templates={prescriptionTemplates} today={today}
          onSave={handleSaveRx}
          onClose={() => { setRxModal(false); setEditingRx(undefined); setPreFillTpl(undefined); }}
        />
      )}
      {showTplModal && (
        <TplModal editing={editingTpl}
          onSave={handleSaveTpl}
          onClose={() => { setTplModal(false); setEditingTpl(undefined); }}
        />
      )}
    </>
  );

  if (noLayout) return body;
  return (
    <Layout title={t("ordonnances.title")} subtitle={t("ordonnances.subtitle")}>
      {body}
    </Layout>
  );
}
