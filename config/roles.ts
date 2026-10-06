/**
 * Role-based workspaces. A role controls which tools appear in the sidebar,
 * what the default dashboard shows, and a handful of terminology choices.
 */
export const ROLE_IDS = ["analyst", "wealth", "options", "fixed-income", "corpfin"] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export interface RoleTerminology {
  /** What the primary subject of analysis is called. */
  subject: string;
  /** Label for saved work. */
  scenario: string;
  /** Dashboard heading. */
  dashboardTitle: string;
}

export interface RoleConfig {
  id: RoleId;
  label: string;
  shortLabel: string;
  description: string;
  /** Digit used with Cmd/Ctrl to switch to this role. */
  shortcut: string;
  terminology: RoleTerminology;
}

export const ROLES: Record<RoleId, RoleConfig> = {
  analyst: {
    id: "analyst",
    label: "Equity / Financial Analyst",
    shortLabel: "Analyst",
    description: "Intrinsic valuation, comparables, leveraged buyouts and statement analysis.",
    shortcut: "1",
    terminology: { subject: "Company", scenario: "Model", dashboardTitle: "Coverage Desk" },
  },
  wealth: {
    id: "wealth",
    label: "Wealth Manager / Advisor",
    shortLabel: "Wealth",
    description: "Retirement planning, Monte Carlo, portfolio construction and client reporting.",
    shortcut: "2",
    terminology: { subject: "Client", scenario: "Plan", dashboardTitle: "Client Desk" },
  },
  options: {
    id: "options",
    label: "Options / Derivatives",
    shortLabel: "Options",
    description: "Option pricing, Greeks, implied volatility and multi-leg strategy payoffs.",
    shortcut: "3",
    terminology: { subject: "Underlying", scenario: "Position", dashboardTitle: "Derivatives Desk" },
  },
  "fixed-income": {
    id: "fixed-income",
    label: "Fixed Income",
    shortLabel: "Fixed Income",
    description: "Bond pricing, yield measures, duration, convexity and the Treasury curve.",
    shortcut: "4",
    terminology: { subject: "Issue", scenario: "Analysis", dashboardTitle: "Rates Desk" },
  },
  corpfin: {
    id: "corpfin",
    label: "Corporate Finance / FP&A",
    shortLabel: "Corp Fin",
    description: "Capital budgeting, financing schedules, break-even and variance analysis.",
    shortcut: "5",
    terminology: { subject: "Project", scenario: "Case", dashboardTitle: "Planning Desk" },
  },
};

export const DEFAULT_ROLE: RoleId = "analyst";

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && (ROLE_IDS as readonly string[]).includes(value);
}
