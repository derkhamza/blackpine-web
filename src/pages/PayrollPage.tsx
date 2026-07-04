import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useCabinet } from "../context/CabinetContext";
import { useApp } from "../context/AppContext";
import type { Employee, EmployeeRole, ContractType } from "../lib/cabinetTypes";
import { EMPLOYEE_ROLE_LABELS, CONTRACT_TYPE_LABELS } from "../lib/cabinetTypes";
import { computePayroll, fmtMAD, printBulletin } from "../lib/payrollCalc";
import { personName, initials as fmtInitials } from "../lib/nameFormat";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })
  );
}

const ROLE_COLORS: Record<EmployeeRole, string> = {
  secretaire:    "var(--blue)",
  infirmier:     "var(--green)",
  aide_soignant: "#9B72D0",
  technicien:    "var(--gold)",
  autre:         "var(--muted)",
};

const ROLES: EmployeeRole[] = ["secretaire", "infirmier", "aide_soignant", "technicien", "autre"];

// ── Employee modal ────────────────────────────────────────────────────────────

const CONTRACTS: ContractType[] = ["cdi", "cdd", "anapec"];

const BLANK: Omit<Employee, "id"> = {
  firstName: "", lastName: "", role: "secretaire",
  baseSalary: 3_000, cnssNumber: "", hireDate: "", dependents: 0, notes: "",
  contractType: "cdi",
};

function EmployeeModal({
  initial, onSave, onClose,
}: {
  initial?: Employee | null;
  onSave: (e: Omit<Employee, "id">) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Omit<Employee, "id">>(initial ? { ...initial } : { ...BLANK });
  // The salary is typed as free text and parsed on the fly: binding the input
  // directly to the parsed number snaps a cleared field back to 0 and fights
  // the user's keystrokes (e.g. impossible to type "2000" comfortably).
  const [salaryStr, setSalaryStr] = useState(String(initial?.baseSalary ?? BLANK.baseSalary));
  const p = computePayroll(draft.baseSalary, draft.dependents ?? 0, draft.contractType ?? "cdi");

  const field = (patch: Partial<Omit<Employee, "id">>) => setDraft(d => ({ ...d, ...patch }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.firstName.trim() || !draft.lastName.trim()) return;
    onSave({ ...draft, firstName: draft.firstName.trim(), lastName: draft.lastName.trim() });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">{initial ? t("payroll.modalTitleEdit") : t("payroll.modalTitleNew")}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("payroll.lastNameLabel")}</label>
                <input className="form-input" value={draft.lastName}
                  onChange={e => field({ lastName: e.target.value })} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{t("payroll.firstNameLabel")}</label>
                <input className="form-input" value={draft.firstName}
                  onChange={e => field({ firstName: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("payroll.roleLabel")}</label>
                <select className="form-select" value={draft.role}
                  onChange={e => field({ role: e.target.value as EmployeeRole })}>
                  {ROLES.map(r => <option key={r} value={r}>{EMPLOYEE_ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t("payroll.salaryLabel")}</label>
                <input className="form-input" type="number" min="0" step="any"
                  value={salaryStr}
                  onChange={e => {
                    setSalaryStr(e.target.value);
                    field({ baseSalary: parseFloat(e.target.value.replace(",", ".")) || 0 });
                  }} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("payroll.contractLabel")}</label>
                <select className="form-select" value={draft.contractType ?? "cdi"}
                  onChange={e => field({ contractType: e.target.value as ContractType })}>
                  {CONTRACTS.map(c => <option key={c} value={c}>{CONTRACT_TYPE_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="form-group" />
            </div>
            {draft.contractType === "anapec" && (
              <div style={{ fontSize: 12, color: "var(--green)", marginTop: -6 }}>
                {t("payroll.anapecHint")}
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t("payroll.dependentsLabel")}</label>
                <input className="form-input" type="number" min="0" max="10"
                  value={draft.dependents ?? 0}
                  disabled={draft.contractType === "anapec"}
                  onChange={e => field({ dependents: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t("payroll.cnssLabel")}</label>
                <input className="form-input" value={draft.cnssNumber ?? ""}
                  onChange={e => field({ cnssNumber: e.target.value })} placeholder={t("payroll.optional")} />
              </div>
              <div className="form-group">
                <label className="form-label">{t("payroll.hireDateLabel")}</label>
                <input className="form-input" type="date" value={draft.hireDate ?? ""}
                  onChange={e => field({ hireDate: e.target.value })} />
              </div>
            </div>

            {/* Live payroll preview */}
            <div className="payroll-preview">
              <div className="payroll-preview-title">{t("payroll.previewTitle")}</div>
              <div className="payroll-preview-rows">
                <div className="payroll-row-item">
                  <span>{t("payroll.previewGross")}</span>
                  <span style={{ fontWeight: 700 }}>{fmtMAD(p.grossSalary)}</span>
                </div>
                <div className="payroll-row-item muted">
                  <span>{t("payroll.previewCnssEmployee")}</span>
                  <span>− {fmtMAD(p.cnssEmployee)}</span>
                </div>
                <div className="payroll-row-item muted">
                  <span>{t("payroll.previewDeduction")}</span>
                  <span>− {fmtMAD(p.deductionPro)}</span>
                </div>
                <div className="payroll-row-item muted">
                  <span>{t("payroll.previewIr")}</span>
                  <span>− {fmtMAD(p.irNet)}</span>
                </div>
                <div className="payroll-divider" />
                <div className="payroll-row-item" style={{ color: "var(--green)" }}>
                  <span style={{ fontWeight: 700 }}>{t("payroll.previewNet")}</span>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{fmtMAD(p.netSalary)}</span>
                </div>
                <div className="payroll-divider" />
                <div className="payroll-row-item muted" style={{ fontSize: 11 }}>
                  <span>{t("payroll.previewCnssEmployer")}</span>
                  <span>+ {fmtMAD(p.cnssEmployer)}</span>
                </div>
                <div className="payroll-row-item" style={{ fontSize: 12, color: "var(--coral)" }}>
                  <span style={{ fontWeight: 600 }}>{t("payroll.previewCostTotal")}</span>
                  <span style={{ fontWeight: 700 }}>{fmtMAD(p.grossSalary + p.cnssEmployer)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("common.save")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────

function EmployeeCard({
  employee, onEdit, onDelete, locale,
}: {
  employee: Employee;
  onEdit: () => void;
  onDelete: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const p     = computePayroll(employee.baseSalary, employee.dependents ?? 0, employee.contractType ?? "cdi");
  const color = ROLE_COLORS[employee.role];

  return (
    <div className="employee-card" onClick={onEdit}>
      <div className="employee-avatar" style={{ background: color + "18", color }}>
        {fmtInitials(employee)}
      </div>
      <div className="employee-info">
        <div className="employee-name">{personName(employee.firstName, employee.lastName)}</div>
        <span className="employee-role-badge" style={{ background: color + "18", color }}>
          {EMPLOYEE_ROLE_LABELS[employee.role]}
        </span>
        {employee.hireDate && (
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
            {t("payroll.employeeSince", {
              date: new Date(employee.hireDate).toLocaleDateString(locale, { month: "short", year: "numeric" })
            })}
          </span>
        )}
      </div>
      <div className="employee-salary">
        <div className="employee-net">{fmtMAD(p.netSalary)}</div>
        <div className="employee-gross">{t("payroll.employeeGross", { amount: fmtMAD(p.grossSalary) })}</div>
      </div>
      <button
        className="tx-delete"
        title={t("payroll.deleteTitle")}
        onClick={e => { e.stopPropagation(); onDelete(); }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3h10M5 3V2h4v1M4 3v9h6V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PayrollPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) === "ar" ? "ar-MA"
               : i18n.language?.slice(0, 2) === "en" ? "en-US" : "fr-FR";

  const { employees, addEmployee, updateEmployee, deleteEmployee, doctorProfile } = useCabinet();
  const { addTransaction } = useApp();

  const monthNames = getMonthNames(locale);

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);   // 1–12
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [modal,    setModal]    = useState<{ employee?: Employee } | null>(null);
  const [postedKey, setPostedKey] = useState<Set<string>>(new Set());

  const showToast = useToast();

  const monthLabel = `${monthNames[selMonth - 1]} ${selYear}`;

  const totals = useMemo(() => {
    let grossSum = 0, netSum = 0, cnssPatTotal = 0;
    for (const e of employees) {
      const p = computePayroll(e.baseSalary, e.dependents ?? 0, e.contractType ?? "cdi");
      grossSum    += p.grossSalary;
      netSum      += p.netSalary;
      cnssPatTotal += p.cnssEmployer;
    }
    return { grossSum, netSum, cnssPatTotal, coutTotal: grossSum + cnssPatTotal };
  }, [employees]);

  // "Enregistrer la paie" — posts two transactions: salaries + CNSS patronal
  const handlePostPayroll = () => {
    if (employees.length === 0) return;
    const isoDate = `${selYear}-${String(selMonth).padStart(2, "0")}-01`;
    const key = `${selYear}-${selMonth}`;
    addTransaction({
      type: "CHARGE",
      category: "salaires_personnel",
      description: `Salaires personnel — ${monthLabel}`,
      amount: totals.grossSum,
      date: isoDate,
      deductibilityStatus: "FULLY_DEDUCTIBLE",
    });
    addTransaction({
      type: "CHARGE",
      category: "salaires_personnel",
      description: `Charges patronales CNSS — ${monthLabel}`,
      amount: totals.cnssPatTotal,
      date: isoDate,
      deductibilityStatus: "FULLY_DEDUCTIBLE",
    });
    setPostedKey(s => new Set(s).add(key));
    showToast(t("payroll.payrollPosted", { month: monthLabel, amount: fmtMAD(totals.coutTotal) }));
  };

  const alreadyPosted = postedKey.has(`${selYear}-${selMonth}`);

  // Payroll year options
  const yearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => yearNow - 2 + i);

  return (
    <Layout
      title={t("payroll.title")}
      subtitle={t("payroll.subtitle", { n: employees.length, s: employees.length !== 1 ? "s" : "", month: monthLabel })}
      actions={
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {t("payroll.addEmployee")}
        </button>
      }
    >
      {/* Month picker */}
      <div className="payroll-month-bar">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{t("payroll.monthLabel")}</span>
          <select
            className="form-select"
            style={{ padding: "5px 10px", fontSize: 13, width: "auto" }}
            value={selMonth}
            onChange={e => setSelMonth(Number(e.target.value))}
          >
            {monthNames.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ padding: "5px 10px", fontSize: 13, width: "auto" }}
            value={selYear}
            onChange={e => setSelYear(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {employees.length > 0 && (
          <button
            className={`btn ${alreadyPosted ? "btn-ghost" : "btn-secondary"}`}
            onClick={handlePostPayroll}
            disabled={alreadyPosted}
            title={alreadyPosted ? t("payroll.postedTitle") : t("payroll.postTitle")}
          >
            {alreadyPosted ? (
              <>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                  <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("payroll.postedBtn")}
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5 }}>
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                {t("payroll.postBtn")}
              </>
            )}
          </button>
        )}
      </div>

      {/* Summary cards */}
      {employees.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">{t("payroll.kpiGross")}</div>
            <div className="stat-value">{fmtMAD(totals.grossSum)}</div>
            <div className="stat-sub">{t("payroll.employeeCount", { n: employees.length, s: employees.length !== 1 ? "s" : "" })}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("payroll.kpiNet")}</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{fmtMAD(totals.netSum)}</div>
            <div className="stat-sub">{t("payroll.kpiNetSub")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("payroll.kpiCnss")}</div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>{fmtMAD(totals.cnssPatTotal)}</div>
            <div className="stat-sub">{t("payroll.kpiCnssSub")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("payroll.kpiTotal")}</div>
            <div className="stat-value" style={{ color: "var(--coral)" }}>{fmtMAD(totals.coutTotal)}</div>
            <div className="stat-sub">{t("payroll.kpiTotalSub")}</div>
          </div>
        </div>
      )}

      {/* Payroll detail table */}
      {employees.length > 0 && (
        <div className="payroll-table-wrap" style={{ marginBottom: 24 }}>
          <div className="payroll-table-title">
            {t("payroll.tableTitle", { month: monthLabel })}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>{t("payroll.colEmployee")}</th>
                  <th>{t("payroll.colGross")}</th>
                  <th>{t("payroll.colCnss")}</th>
                  <th>{t("payroll.colDed")}</th>
                  <th>{t("payroll.colNetTax")}</th>
                  <th>{t("payroll.colIr")}</th>
                  <th style={{ color: "var(--green)" }}>{t("payroll.colNet")}</th>
                  <th style={{ color: "var(--coral)" }}>{t("payroll.colCharge")}</th>
                  <th>{t("payroll.colBulletin")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => {
                  const p     = computePayroll(e.baseSalary, e.dependents ?? 0, e.contractType ?? "cdi");
                  const color = ROLE_COLORS[e.role];
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{personName(e.firstName, e.lastName)}</div>
                        <span style={{
                          fontSize: 11, color,
                          background: color + "15",
                          padding: "1px 6px", borderRadius: 6,
                        }}>
                          {EMPLOYEE_ROLE_LABELS[e.role]}
                        </span>
                      </td>
                      <td>{fmtMAD(p.grossSalary)}</td>
                      <td style={{ color: "var(--coral)" }}>− {fmtMAD(p.cnssEmployee)}</td>
                      <td style={{ color: "var(--muted)" }}>− {fmtMAD(p.deductionPro)}</td>
                      <td>{fmtMAD(p.netImposable)}</td>
                      <td style={{ color: "var(--coral)" }}>− {fmtMAD(p.irNet)}</td>
                      <td style={{ color: "var(--green)", fontWeight: 800 }}>{fmtMAD(p.netSalary)}</td>
                      <td style={{ color: "var(--gold)" }}>{fmtMAD(p.cnssEmployer)}</td>
                      <td>
                        <button
                          className="payroll-print-btn"
                          title={t("payroll.bulletinTitle", { month: monthLabel })}
                          onClick={() => printBulletin(e, selMonth, selYear, doctorProfile)}
                        >
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                            <path d="M4 5V2h6v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <circle cx="11" cy="7.5" r="0.8" fill="currentColor"/>
                          </svg>
                          {t("payroll.bulletinBtn")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t("payroll.colTotal")}</td>
                  <td>{fmtMAD(totals.grossSum)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td style={{ color: "var(--green)" }}>{fmtMAD(totals.netSum)}</td>
                  <td style={{ color: "var(--gold)" }}>{fmtMAD(totals.cnssPatTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Employee cards */}
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {t("payroll.employeesTitle")}
        </h3>
      </div>

      {employees.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("payroll.emptyTitle")}</div>
          <div style={{ marginBottom: 16, color: "var(--muted)" }}>{t("payroll.emptyHint")}</div>
          <button className="btn btn-primary" onClick={() => setModal({})}>{t("payroll.addEmployeeBtn")}</button>
        </div>
      ) : (
        <div className="tx-list">
          {employees.map(e => (
            <EmployeeCard
              key={e.id}
              employee={e}
              locale={locale}
              onEdit={() => setModal({ employee: e })}
              onDelete={() => {
                if (confirm(t("payroll.deleteConfirm", { name: personName(e.firstName, e.lastName) }))) {
                  deleteEmployee(e.id);
                  showToast(t("payroll.deleted"));
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <EmployeeModal
          initial={modal.employee}
          onSave={e => {
            if (modal.employee) updateEmployee({ ...e, id: modal.employee.id });
            else addEmployee(e);
            showToast(modal.employee ? t("payroll.modified") : t("payroll.added"));
          }}
          onClose={() => setModal(null)}
        />
      )}

    </Layout>
  );
}
