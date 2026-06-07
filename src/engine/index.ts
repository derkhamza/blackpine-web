// Public API of the Blackpine tax engine.
// Consumers (the mobile app, tests, CLI) import everything from here.

export * from "./types";
export { calculateIR } from "./calculators/irCalculator";
export { calculateCM } from "./calculators/cmCalculator";
export { calculateTax } from "./calculators/taxOrchestrator";
export { calculateResultatFiscal } from "./calculators/resultatFiscalCalculator";
export { computeTaxFromTransactions } from "./calculators/taxEngine";
export type { FullTaxComputation } from "./calculators/taxEngine";
export { loadFiscalYearConfig, getAvailableFiscalYears } from "./config/configLoader";

export {
  loadCategoryMatrix,
  getCategoryById,
  getCategoriesByType,
  getCategoriesByTypeAndSpecialty,
  getCategoriesByFamily,
  getGroupedCategories,
  applyCategoryDefaults,
} from "./calculators/categoryService";
export { calculateAmortization, calculateTotalDotation } from "./calculators/amortizationCalculator";