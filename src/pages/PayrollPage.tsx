import { FormEvent, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useCabinet } from "../context/CabinetContext";
import type { Employee, EmployeeRole } from "../lib/cabinetTypes";
import { EMPLOYEE_ROLE_LABELS } from "../lib/cabinetTypes";
import { computePayroll, fmtMAD, currentMonthLabel } from "../lib/payrollCalc";

// ── Role badge colors ─────────────────────────────────────────────────────────

const ROLE_COLORS: Record<EmployeeRole, string> = {
  secretaire:    "var(--blue)",
  infirmier:     "var(--green)",
  aide_soignant: "#9B72D0",
  technicien:    "var(--gold)",
  autre:         "var(--muted)",
};

const ROLES: EmployeeRole[] = ["secretaire", "infirmier", "aide_soignant", "technicien", "autre"];

// ── Employee modal ────────────────────────────────────────────────────────────

const BLANK: Omit<Employee, "id"> = {
  firstName: "", lastName: "", role: "secretaire",
  baseSalary: 3_000, cnssNumber: "", hireDate: "", dependents: 0, notes: "",
};

function EmployeeModal({
  initial, onSave, onClose,
}: {
  initial?: Employee | null;
  onSave: (e: Omit<Employee, "id">) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Omit<Employee, "id">>(initial ? { ...initial } : { ...BLANK });
  const p = computePayroll(draft.baseSalary, draft.dependents ?? 0);

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
          <h2 className="modal-title">{initial ? "Modifier" : "Nouvel"} employé</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input className="form-input" value={draft.firstName}
                  onChange={e => field({ firstName: e.target.value })} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Nom</label>
                <input className="form-input" value={draft.lastName}
                  onChange={e => field({ lastName: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fonction</label>
                <select className="form-select" value={draft.role}
                  onChange={e => field({ role: e.target.value as EmployeeRole })}>
                  {ROLES.map(r => <option key={r} value={r}>{EMPLOYEE_ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Salaire brut (MAD)</label>
                <input className="form-input" type="number" min="1" step="100"
                  value={draft.baseSalary}
                  onChange={e => field({ baseSalary: parseFloat(e.target.value) || 0 })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Personnes à charge</label>
                <input className="form-input" type="number" min="0" max="10"
                  value={draft.dependents ?? 0}
                  onChange={e => field({ dependents: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">N° CNSS</label>
                <input className="form-input" value={draft.cnssNumber ?? ""}
                  onChange={e => field({ cnssNumber: e.target.value })} placeholder="Optionnel" />
              </div>
              <div className="form-group">
                <label className="form-label">Date d'embauche</label>
                <input className="form-input" type="date" value={draft.hireDate ?? ""}
                  onChange={e => field({ hireDate: e.target.value })} />
              </div>
            </div>

            {/* Live payroll preview */}
            <div className="payroll-preview">
              <div className="payroll-preview-title">Calcul de la paie</div>
              <div className="payroll-preview-rows">
                <div className="payroll-row-item">
                  <span>Salaire brut</span>
                  <span style={{ fontWeight: 700 }}>{fmtMAD(p.grossSalary)}</span>
                </div>
                <div className="payroll-row-item muted">
                  <span>CNSS salarié (6.74%)</span>
                  <span>− {fmtMAD(p.cnssEmployee)}</span>
                </div>
                <div className="payroll-row-item muted">
                  <span>IR net mensuel</span>
                  <span>− {fmtMAD(p.irNet)}</span>
                </div>
                <div className="payroll-divider" />
                <div className="payroll-row-item" style={{ color: "var(--green)" }}>
                  <span style={{ fontWeight: 700 }}>Salaire net</span>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{fmtMAD(p.netSalary)}</span>
                </div>
                <div className="payroll-row-item muted" style={{ fontSize: 11 }}>
                  <span>Charge patronale CNSS (~21.09%)</span>
                  <span>{fmtMAD(p.cnssEmployer)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────

function EmployeeCard({
  employee, onEdit, onDelete,
}: {
  employee: Employee;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p     = computePayroll(employee.baseSalary, employee.dependents ?? 0);
  const color = ROLE_COLORS[employee.role];

  return (
    <div className="employee-card" onClick={onEdit}>
      <div className="employee-avatar" style={{ background: color + "18", color }}>
        {`${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase()}
      </div>
      <div className="employee-info">
        <div className="employee-name">{employee.firstName} {employee.lastName}</div>
        <span className="employee-role-badge" style={{ background: color + "18", color }}>
          {EMPLOYEE_ROLE_LABELS[employee.role]}
        </span>
      </div>
      <div className="employee-salary">
        <div className="employee-net">{fmtMAD(p.netSalary)}</div>
        <div className="employee-gross">brut {fmtMAD(p.grossSalary)}</div>
      </div>
      <button
        className="tx-delete"
        title="Supprimer"
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
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useCabinet();
  const [modal, setModal]   = useState<{ employee?: Employee } | null>(null);
  const [toast, setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const totals = useMemo(() => {
    let grossSum = 0, netSum = 0, chargeTotal = 0;
    for (const e of employees) {
      const p = computePayroll(e.baseSalary, e.dependents ?? 0);
      grossSum    += p.grossSalary;
      netSum      += p.netSalary;
      chargeTotal += p.grossSalary + p.cnssEmployer;
    }
    return { grossSum, netSum, chargeTotal };
  }, [employees]);

  return (
    <Layout
      title="Salaires"
      subtitle={`${employees.length} employé${employees.length !== 1 ? "s" : ""} · ${currentMonthLabel()}`}
      actions={
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 6 }}>
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Ajouter un employé
        </button>
      }
    >
      {/* Summary cards */}
      {employees.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Masse salariale brute</div>
            <div className="stat-value">{fmtMAD(totals.grossSum)}</div>
            <div className="stat-sub">{employees.length} employé{employees.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Salaires nets à payer</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{fmtMAD(totals.netSum)}</div>
            <div className="stat-sub">après CNSS et IR</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Coût total employeur</div>
            <div className="stat-value" style={{ color: "var(--coral)" }}>{fmtMAD(totals.chargeTotal)}</div>
            <div className="stat-sub">brut + charges patronales</div>
          </div>
        </div>
      )}

      {/* Employee list */}
      {employees.length === 0 ? (
        <div className="tx-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun employé</div>
          <div style={{ marginBottom: 16 }}>
            Ajoutez vos employés pour calculer automatiquement la paie (CNSS + IR).
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}>Ajouter un employé</button>
        </div>
      ) : (
        <div className="tx-list">
          {employees.map(e => (
            <EmployeeCard
              key={e.id}
              employee={e}
              onEdit={() => setModal({ employee: e })}
              onDelete={() => {
                if (confirm(`Supprimer ${e.firstName} ${e.lastName} ?`)) {
                  deleteEmployee(e.id);
                  showToast("Employé supprimé");
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Payroll breakdown by employee */}
      {employees.length > 0 && (
        <div className="payroll-table-wrap">
          <div className="payroll-table-title">Détail de la paie — {currentMonthLabel()}</div>
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Brut</th>
                <th>CNSS sal.</th>
                <th>Déd. pro.</th>
                <th>Net imposable</th>
                <th>IR net</th>
                <th style={{ color: "var(--green)" }}>Net à payer</th>
                <th style={{ color: "var(--coral)" }}>Charge pat.</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(e => {
                const p = computePayroll(e.baseSalary, e.dependents ?? 0);
                const color = ROLE_COLORS[e.role];
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{e.firstName} {e.lastName}</div>
                      <span style={{ fontSize: 11, color, background: color + "15", padding: "1px 6px", borderRadius: 6 }}>
                        {EMPLOYEE_ROLE_LABELS[e.role]}
                      </span>
                    </td>
                    <td>{fmtMAD(p.grossSalary)}</td>
                    <td style={{ color: "var(--coral)" }}>− {fmtMAD(p.cnssEmployee)}</td>
                    <td style={{ color: "var(--muted)" }}>− {fmtMAD(p.deductionPro)}</td>
                    <td>{fmtMAD(p.netImposable)}</td>
                    <td style={{ color: "var(--coral)" }}>− {fmtMAD(p.irNet)}</td>
                    <td style={{ color: "var(--green)", fontWeight: 800 }}>{fmtMAD(p.netSalary)}</td>
                    <td style={{ color: "var(--coral)" }}>{fmtMAD(p.cnssEmployer)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{fmtMAD(totals.grossSum)}</td>
                <td colSpan={4}></td>
                <td style={{ color: "var(--green)", fontWeight: 800 }}>{fmtMAD(totals.netSum)}</td>
                <td style={{ color: "var(--coral)", fontWeight: 700 }}>{fmtMAD(totals.chargeTotal - totals.grossSum)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <EmployeeModal
          initial={modal.employee}
          onSave={e => {
            if (modal.employee) updateEmployee({ ...e, id: modal.employee.id });
            else addEmployee(e);
            showToast(modal.employee ? "Employé modifié" : "Employé ajouté");
          }}
          onClose={() => setModal(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </Layout>
  );
}
