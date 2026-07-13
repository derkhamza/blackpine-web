// Single source of truth for the product-owner / operator accounts. These
// accounts run the SaaS: they are never trial-gated, they see the /admin
// supervision console, and (per product decision) they get a PURE admin
// experience — the clinical app is hidden for them, leaving only admin
// information, controls, overrides and access management.
//
// The backend enforces the real authorization on every /admin endpoint; this
// list only drives the client-side experience (which nav to show, where to land).
export const ADMIN_EMAILS = ["derkhamza@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
