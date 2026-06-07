import type { FiscalYearConfig } from "../types";
import config2015 from "./fiscal_year_2015.json";
import config2016 from "./fiscal_year_2016.json";
import config2017 from "./fiscal_year_2017.json";
import config2018 from "./fiscal_year_2018.json";
import config2019 from "./fiscal_year_2019.json";
import config2020 from "./fiscal_year_2020.json";
import config2021 from "./fiscal_year_2021.json";
import config2022 from "./fiscal_year_2022.json";
import config2023 from "./fiscal_year_2023.json";
import config2024 from "./fiscal_year_2024.json";
import config2025 from "./fiscal_year_2025.json";
import config2026 from "./fiscal_year_2026.json";
import config2027 from "./fiscal_year_2027.json";
import config2028 from "./fiscal_year_2028.json";
import config2029 from "./fiscal_year_2029.json";
import config2030 from "./fiscal_year_2030.json";

const configs: Record<number, FiscalYearConfig> = {
  2015: config2015 as FiscalYearConfig,
  2016: config2016 as FiscalYearConfig,
  2017: config2017 as FiscalYearConfig,
  2018: config2018 as FiscalYearConfig,
  2019: config2019 as FiscalYearConfig,
  2020: config2020 as FiscalYearConfig,
  2021: config2021 as FiscalYearConfig,
  2022: config2022 as FiscalYearConfig,
  2023: config2023 as FiscalYearConfig,
  2024: config2024 as FiscalYearConfig,
  2025: config2025 as FiscalYearConfig,
  2026: config2026 as FiscalYearConfig,
  2027: config2027 as FiscalYearConfig,
  2028: config2028 as FiscalYearConfig,
  2029: config2029 as FiscalYearConfig,
  2030: config2030 as FiscalYearConfig,
};

export function loadFiscalYearConfig(year: number): FiscalYearConfig {
  const config = configs[year];
  if (!config) {
    throw new Error(
      `No fiscal year config available for ${year}. Available: ${Object.keys(configs).join(", ")}`
    );
  }
  return config;
}

export function getAvailableFiscalYears(): number[] {
  return Object.keys(configs).map(Number).sort();
}
