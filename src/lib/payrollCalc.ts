// Moroccan payroll calculation — exact copy of blackpine-app/lib/payrollCalc.ts

export interface PayrollResult {
  grossSalary: number;
  cnssEmployee: number;
  amoEmployee: number;
  deductionPro: number;
  netImposable: number;
  irBrut: number;
  irFamille: number;
  irNet: number;
  netSalary: number;
  cnssEmployer: number;
}

const CNSS_EMPLOYEE_RATE = 0.0674;
const CNSS_SALARY_CAP    = 6_000;
const CNSS_EMPLOYER_RATE = 0.2109;
const DEDUCTION_PRO_RATE = 0.20;
const DEDUCTION_PRO_MAX  = 2_500;

function calcIrMensuel(netImposable: number): number {
  if (netImposable <= 0)       return 0;
  if (netImposable <= 2_500)   return 0;
  if (netImposable <= 5_000)   return netImposable * 0.10 - 250;
  if (netImposable <= 10_000)  return netImposable * 0.20 - 750;
  if (netImposable <= 15_000)  return netImposable * 0.30 - 1_750;
  if (netImposable <= 20_000)  return netImposable * 0.34 - 2_350;
  return netImposable * 0.38 - 3_150;
}

export function computePayroll(grossSalary: number, dependents = 0): PayrollResult {
  const gross = Math.max(0, grossSalary);
  const cotisableCnss = Math.min(gross, CNSS_SALARY_CAP);
  const cnssEmployee  = Math.round(cotisableCnss * CNSS_EMPLOYEE_RATE * 100) / 100;
  const amoEmployee   = Math.round(cotisableCnss * 0.0226 * 100) / 100;
  const deductionPro  = Math.min(gross * DEDUCTION_PRO_RATE, DEDUCTION_PRO_MAX);
  const netImposable  = Math.max(0, gross - cnssEmployee - deductionPro);
  const irBrut        = calcIrMensuel(netImposable);
  const irFamille     = (dependents ?? 0) * 30;
  const irNet         = Math.max(0, Math.round((irBrut - irFamille) * 100) / 100);
  const netSalary     = Math.round((gross - cnssEmployee - irNet) * 100) / 100;
  const cnssEmployer  = Math.round(cotisableCnss * CNSS_EMPLOYER_RATE * 100) / 100;
  return { grossSalary: gross, cnssEmployee, amoEmployee, deductionPro, netImposable, irBrut, irFamille, irNet, netSalary, cnssEmployer };
}

export function fmtMAD(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} MAD`;
}

export function currentMonthLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
