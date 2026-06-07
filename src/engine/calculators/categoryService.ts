import type {
  Category,
  CategoryFamily,
  DeductibilityMatrix,
  DeductibilityStatus,
  Regime,
  Transaction,
  TransactionType,
} from "../types";
import matrix2026 from "../config/deductibility_matrix_2026.json";

const matrices: Record<number, DeductibilityMatrix> = {
  2026: matrix2026 as DeductibilityMatrix,
};

// The latest available matrix year. Used as a fallback for years that don't
// have a dedicated matrix (the Moroccan CGI deductibility categories are
// stable across years, so the 2026 rules apply equally well to 2024/2025).
const LATEST_MATRIX_YEAR = Math.max(...Object.keys(matrices).map(Number));

export function loadCategoryMatrix(year: number): DeductibilityMatrix {
  const m = matrices[year] ?? matrices[LATEST_MATRIX_YEAR];
  if (!m) {
    throw new Error(
      `No deductibility matrix available. Expected at least year ${LATEST_MATRIX_YEAR}.`
    );
  }
  return m;
}

export function getCategoryById(year: number, id: string): Category | undefined {
  return loadCategoryMatrix(year).categories.find((c) => c.id === id);
}
export function getCategoriesByType(year: number, type: string): Category[] {
  const matrix = loadCategoryMatrix(year);
  return matrix.categories.filter((c) => c.type === type);
}
export function getCategoriesByTypeAndSpecialty(
  year: number,
  type: TransactionType,
  specialty?: string
): Category[] {
  const all = getCategoriesByType(year, type);
  if (!specialty) return all;
  return all.filter(
    (c) => !c.specialties || c.specialties.includes("all") || c.specialties.includes(specialty)
  );
}

export function getCategoriesByFamily(
  year: number,
  family: CategoryFamily,
  type?: TransactionType
): Category[] {
  return loadCategoryMatrix(year).categories.filter(
    (c) => c.family === family && (type ? c.type === type : true)
  );
}

/**
 * Given a category ID and the doctor's regime, returns the deductibility
 * status and ratio that should be applied to a transaction. Used when
 * the user picks a category in the UI — the app silently sets these
 * defaults.
 */
export function applyCategoryDefaults(
  categoryId: string,
  regime: Regime,
  year: number
): { deductibilityStatus: DeductibilityStatus; professionalUseRatio: number } {
  const cat = getCategoryById(year, categoryId);
  if (!cat || cat.type === "RECETTE") {
    return { deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1 };
  }

  const rule = regime === "RNR" ? cat.rnr : cat.rns;

  if (rule.needsReview) {
    return { deductibilityStatus: "NEEDS_REVIEW", professionalUseRatio: 0 };
  }
  if (!rule.deductible) {
    return { deductibilityStatus: "NOT_DEDUCTIBLE", professionalUseRatio: 0 };
  }
  if (rule.ratio < 1) {
    return {
      deductibilityStatus: "PARTIALLY_DEDUCTIBLE",
      professionalUseRatio: rule.ratio,
    };
  }
  return { deductibilityStatus: "FULLY_DEDUCTIBLE", professionalUseRatio: 1 };
}

/**
 * Convenience helper: returns categories grouped by family for UI rendering.
 */
export function getGroupedCategories(
  year: number,
  type: TransactionType,
  specialty?: string
): { family: CategoryFamily; familyLabel: string; categories: Category[] }[] {
  const all = specialty
    ? getCategoriesByTypeAndSpecialty(year, type, specialty)
    : getCategoriesByType(year, type);
  const groups = new Map<CategoryFamily, Category[]>();
  for (const c of all) {
    if (!groups.has(c.family)) groups.set(c.family, []);
    groups.get(c.family)!.push(c);
  }

  const familyLabels: Record<CategoryFamily, string> = {
    cabinet_operating: "Cabinet",
    staff: "Personnel",
    medical_equipment: "Matériel médical",
    professional_services: "Services professionnels",
    training: "Formation",
    vehicle: "Véhicule",
    communications: "Communications",
    marketing: "Marketing",
    financial: "Financier",
    taxes: "Taxes et cotisations",
    non_deductible: "Non déductibles",
    income: "Revenus",
  };

  return Array.from(groups.entries()).map(([family, categories]) => ({
    family,
    familyLabel: familyLabels[family],
    categories,
  }));
}