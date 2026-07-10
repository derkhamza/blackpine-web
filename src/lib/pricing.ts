// Subscription pricing — single source of truth.
//
// Market scan (Moroccan cabinet-management SaaS, mid-2026):
//   • CABIDOC ............ 200 MAD/mo (cloud, all features)
//   • TabibDoc Pro ....... 200 MAD/mo cloud, 300–350 MAD/mo local/hybrid
//   • MedocApp ........... ~125 MAD/mo equiv. + 2 000 MAD upfront
//   • DoctorManager ...... 1 500 MAD lifetime (one-off)
// The cloud monthly floor sits at ~200 MAD/mo. Blackpine is priced deliberately
// just BELOW that floor while shipping more (trilingual, secretary access,
// bilans, growth curves, téléconsultation, stock, payroll, document designer).
//
// To change the price, edit the numbers here — everything else reads from this.

export interface PlanPrice {
  /** Price charged, in MAD. */
  amount: number;
  /** Billing period. */
  period: "month" | "year";
  /** For annual plans: the equivalent monthly cost (amount / 12), rounded. */
  perMonth?: number;
  /** For annual plans: months effectively free vs. paying monthly. */
  monthsFree?: number;
}

export const PRICING = {
  currency: "MAD",
  monthly: { amount: 199, period: "month" } as PlanPrice,
  // 1 990 MAD/an ≈ 166 MAD/mo — two months free vs. paying monthly (199×12 = 2 388).
  yearly: { amount: 1990, period: "year", perMonth: 166, monthsFree: 2 } as PlanPrice,
  trialDays: 30,
} as const;
