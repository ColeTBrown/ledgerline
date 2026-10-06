/**
 * Single source of truth for product branding.
 * To rename the product, change the values here — nothing else in the
 * codebase hard-codes the product name.
 */
export const brand = {
  name: "Ledgerline",
  /** Short mark used in tight spaces (sidebar collapsed, favicon text). */
  shortName: "LL",
  tagline: "The analytical workstation for modern finance teams.",
  description:
    "Valuation, portfolio, derivatives, fixed income and FP&A tools in one high-density workstation — with live market data and audit-ready exports.",
  company: "Ledgerline, Inc.",
  contactEmail: "sales@example.com",
  /** Shown in the footer and on every export. */
  disclaimer:
    "For informational purposes only. Not investment, tax, or legal advice. Market data provided by third parties and may be delayed.",
} as const;

export type Brand = typeof brand;
