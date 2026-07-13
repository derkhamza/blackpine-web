// Subscription pricing — single source of truth.
//
// Market scan (Moroccan cabinet-management SaaS, mid-2026):
//   • CABIDOC ............ 200 MAD/mo (cloud, all features)
//   • TabibDoc Pro ....... 200 MAD/mo cloud, 300–350 MAD/mo local/hybrid
//   • MedocApp ........... ~125 MAD/mo equiv. + 2 000 MAD upfront
//   • DoctorManager ...... 1 500 MAD lifetime (one-off)
// The cloud monthly floor sits at ~200 MAD/mo. Blackpine is priced as a premium
// tier just above that floor, justified by shipping materially more (trilingual,
// secretary access, bilans, growth curves, téléconsultation, stock, payroll,
// document designer, comptabilité/fiscal).
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
  monthly: { amount: 299, period: "month" } as PlanPrice,
  // 2 990 MAD/an ≈ 249 MAD/mo — two months free vs. paying monthly (299×12 = 3 588).
  yearly: { amount: 2990, period: "year", perMonth: 249, monthsFree: 2 } as PlanPrice,
  trialDays: 30,
} as const;
