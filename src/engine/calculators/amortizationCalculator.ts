import type { FixedAsset, AmortizationLine, AmortizationSchedule } from "../types";

/**
 * Calculate linear amortization schedule for a fixed asset.
 * Applies prorata temporis for first and last year.
 * Vehicle amortization capped at 300,000 MAD (400,000 for electric) per Art. 10-II CGI.
 */
export function calculateAmortization(
  asset: FixedAsset,
  upToYear: number
): AmortizationSchedule {
  const lines: AmortizationLine[] = [];
  const startDate = new Date(asset.acquisitionDate);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-indexed

  // Apply vehicle ceiling (Art. 10-II CGI)
  let depreciableAmount = asset.acquisitionAmount;
  if (asset.subcategory === "materiel_transport") {
    depreciableAmount = Math.min(depreciableAmount, 300000);
  }

  const annualDotation = depreciableAmount * asset.amortizationRate;
  const durationYears = Math.ceil(1 / asset.amortizationRate);
  const endYear = asset.disposalDate
    ? new Date(asset.disposalDate).getFullYear()
    : startYear + durationYears;

  let cumulativeAmort = 0;
  let vnc = depreciableAmount;

  for (let year = startYear; year <= Math.min(upToYear, endYear); year++) {
    if (vnc <= 0) break;

    // Check if asset was disposed this year
    if (asset.disposalDate) {
      const disposalYear = new Date(asset.disposalDate).getFullYear();
      if (year > disposalYear) break;
    }

    let dotation: number;
    let isProrata = false;

    if (year === startYear) {
      // Prorata temporis: count months from acquisition to Dec 31
      const monthsRemaining = 12 - startMonth;
      dotation = (annualDotation * monthsRemaining) / 12;
      isProrata = monthsRemaining < 12;
    } else if (asset.disposalDate && year === new Date(asset.disposalDate).getFullYear()) {
      // Prorata for disposal year
      const disposalMonth = new Date(asset.disposalDate).getMonth() + 1;
      dotation = (annualDotation * disposalMonth) / 12;
      isProrata = true;
    } else {
      dotation = annualDotation;
    }

    // Don't amortize below zero
    dotation = Math.min(dotation, vnc);
    dotation = Math.round(dotation * 100) / 100;

    const openingValue = vnc;
    cumulativeAmort += dotation;
    vnc = Math.round((depreciableAmount - cumulativeAmort) * 100) / 100;

    lines.push({
      assetId: asset.id,
      year,
      openingValue,
      dotation,
      closingValue: vnc,
      cumulativeAmortization: Math.round(cumulativeAmort * 100) / 100,
      isProrata,
    });
  }

  const currentYearLine = lines.find(l => l.year === upToYear);

  return {
    asset,
    lines,
    totalAmortized: Math.round(cumulativeAmort * 100) / 100,
    currentYearDotation: currentYearLine?.dotation ?? 0,
    netBookValue: vnc,
  };
}

/**
 * Calculate total dotation for a given year across all assets.
 */
export function calculateTotalDotation(
  assets: FixedAsset[],
  year: number
): { totalDotation: number; schedules: AmortizationSchedule[] } {
  const activeAssets = assets.filter(a => {
    const startYear = new Date(a.acquisitionDate).getFullYear();
    if (startYear > year) return false;
    if (a.disposalDate && new Date(a.disposalDate).getFullYear() < year) return false;
    return true;
  });

  const schedules = activeAssets.map(a => calculateAmortization(a, year));
  const totalDotation = schedules.reduce((sum, s) => sum + s.currentYearDotation, 0);

  return { totalDotation: Math.round(totalDotation * 100) / 100, schedules };
}