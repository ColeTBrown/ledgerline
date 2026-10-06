import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Calculator,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Landmark,
  Layers,
  LineChart,
  Percent,
  PieChart,
  Scale,
  Shuffle,
  Sigma,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
  Waves,
  Wallet,
  FolderOpen,
} from "lucide-react";
import type { RoleId } from "@/config/roles";

export type ToolGroup =
  | "Valuation"
  | "Analysis"
  | "Planning"
  | "Portfolio"
  | "Pricing"
  | "Strategies"
  | "Bonds"
  | "Rates"
  | "Capital Budgeting"
  | "Operations"
  | "Workspace";

export interface ToolMeta {
  /** URL slug under /app. Must be unique. */
  id: string;
  name: string;
  description: string;
  group: ToolGroup;
  /** Roles whose sidebar shows this tool. Empty = shared with all roles. */
  roles: readonly RoleId[];
  icon: LucideIcon;
  /** Extra words for command palette matching. */
  keywords: readonly string[];
  /** Build phase that delivers the working tool. */
  phase: number;
  /** Tool can pre-fill from live market data. */
  live?: boolean;
}

export const TOOLS: readonly ToolMeta[] = [
  // ── Equity / Financial Analyst ──────────────────────────────────────────
  {
    id: "dcf",
    name: "DCF Model",
    description: "Free cash flow projection, terminal value and WACC × growth sensitivity.",
    group: "Valuation",
    roles: ["analyst"],
    icon: TrendingUp,
    keywords: ["discounted cash flow", "intrinsic value", "terminal value", "gordon growth"],
    phase: 5,
    live: true,
  },
  {
    id: "wacc",
    name: "WACC",
    description: "CAPM cost of equity, after-tax cost of debt and capital structure weights.",
    group: "Valuation",
    roles: ["analyst", "corpfin"],
    icon: Percent,
    keywords: ["cost of capital", "capm", "beta", "discount rate"],
    phase: 5,
    live: true,
  },
  {
    id: "comps",
    name: "Comparable Companies",
    description: "Trading multiples across a peer set with median and mean rows.",
    group: "Valuation",
    roles: ["analyst"],
    icon: Table2,
    keywords: ["comps", "multiples", "ev/ebitda", "p/e", "peers"],
    phase: 5,
    live: true,
  },
  {
    id: "lbo",
    name: "LBO Model",
    description: "Sources & uses, debt schedule, sponsor IRR and MOIC.",
    group: "Valuation",
    roles: ["analyst"],
    icon: Layers,
    keywords: ["leveraged buyout", "private equity", "irr", "moic"],
    phase: 5,
  },
  {
    id: "ratios",
    name: "Ratio Analyzer",
    description: "Liquidity, leverage, profitability and efficiency ratios.",
    group: "Analysis",
    roles: ["analyst", "corpfin"],
    icon: Scale,
    keywords: ["financial ratios", "liquidity", "leverage", "roe", "margin"],
    phase: 5,
    live: true,
  },
  // ── Wealth Manager ──────────────────────────────────────────────────────
  {
    id: "retirement",
    name: "Retirement Planner",
    description: "Contributions, growth, inflation and withdrawals with shortfall warning.",
    group: "Planning",
    roles: ["wealth"],
    icon: CalendarClock,
    keywords: ["retirement", "savings", "withdrawal", "nest egg"],
    phase: 6,
  },
  {
    id: "monte-carlo",
    name: "Monte Carlo",
    description: "Thousands of simulated paths, fan chart and probability of success.",
    group: "Planning",
    roles: ["wealth"],
    icon: Shuffle,
    keywords: ["simulation", "probability", "fan chart", "stochastic"],
    phase: 6,
  },
  {
    id: "portfolio",
    name: "Portfolio Builder",
    description: "Holdings with live prices, allocation, risk/return and efficient frontier.",
    group: "Portfolio",
    roles: ["wealth"],
    icon: PieChart,
    keywords: ["allocation", "sharpe", "efficient frontier", "holdings"],
    phase: 6,
    live: true,
  },
  {
    id: "rebalance",
    name: "Rebalancer",
    description: "Current vs. target weights and the trades required at live prices.",
    group: "Portfolio",
    roles: ["wealth"],
    icon: ArrowLeftRight,
    keywords: ["rebalancing", "trades", "target weights", "drift"],
    phase: 6,
    live: true,
  },
  {
    id: "client-report",
    name: "Client Report",
    description: "Meeting-ready PDF summary of plan, portfolio and projections.",
    group: "Portfolio",
    roles: ["wealth"],
    icon: FileText,
    keywords: ["report", "pdf", "client meeting", "summary"],
    phase: 6,
  },
  // ── Options / Derivatives ───────────────────────────────────────────────
  {
    id: "black-scholes",
    name: "Black-Scholes",
    description: "European call/put pricing with delta, gamma, vega, theta and rho.",
    group: "Pricing",
    roles: ["options"],
    icon: Sigma,
    keywords: ["option pricing", "greeks", "bsm", "call", "put"],
    phase: 7,
    live: true,
  },
  {
    id: "implied-vol",
    name: "Implied Volatility",
    description: "Solve for volatility from a market premium (Newton-Raphson + bisection).",
    group: "Pricing",
    roles: ["options"],
    icon: Activity,
    keywords: ["iv", "implied vol", "volatility solver"],
    phase: 7,
    live: true,
  },
  {
    id: "binomial",
    name: "Binomial Tree",
    description: "Cox-Ross-Rubinstein lattice for American and European options.",
    group: "Pricing",
    roles: ["options"],
    icon: GitBranch,
    keywords: ["american option", "crr", "lattice", "early exercise"],
    phase: 7,
    live: true,
  },
  {
    id: "strategy-builder",
    name: "Strategy Builder",
    description: "Multi-leg payoffs at expiry and today: spreads, straddles, condors.",
    group: "Strategies",
    roles: ["options"],
    icon: Sparkles,
    keywords: ["payoff", "iron condor", "straddle", "strangle", "spread", "covered call"],
    phase: 7,
    live: true,
  },
  // ── Fixed Income ────────────────────────────────────────────────────────
  {
    id: "bond-pricer",
    name: "Bond Pricer",
    description: "Price, yield to maturity, yield to call and current yield.",
    group: "Bonds",
    roles: ["fixed-income"],
    icon: Landmark,
    keywords: ["bond", "ytm", "ytc", "coupon", "yield"],
    phase: 7,
  },
  {
    id: "duration",
    name: "Duration & Convexity",
    description: "Macaulay and modified duration, convexity and rate-shock estimates.",
    group: "Bonds",
    roles: ["fixed-income"],
    icon: Waves,
    keywords: ["macaulay", "modified duration", "convexity", "dv01", "rate shock"],
    phase: 7,
  },
  {
    id: "yield-curve",
    name: "Treasury Yield Curve",
    description: "Live U.S. Treasury par yield curve with prior-date comparison.",
    group: "Rates",
    roles: ["fixed-income"],
    icon: LineChart,
    keywords: ["treasury", "yield curve", "rates", "term structure"],
    phase: 7,
    live: true,
  },
  // ── Corporate Finance / FP&A ────────────────────────────────────────────
  {
    id: "capital-budgeting",
    name: "Capital Budgeting",
    description: "NPV, IRR, MIRR, payback, discounted payback and profitability index.",
    group: "Capital Budgeting",
    roles: ["corpfin"],
    icon: Target,
    keywords: ["npv", "irr", "mirr", "payback", "profitability index"],
    phase: 5,
  },
  {
    id: "loan-amortization",
    name: "Loan Amortization",
    description: "Payment schedule with extra payments and interest saved.",
    group: "Operations",
    roles: ["corpfin", "wealth"],
    icon: Wallet,
    keywords: ["loan", "mortgage", "amortization", "schedule", "extra payment"],
    phase: 5,
  },
  {
    id: "break-even",
    name: "Break-even",
    description: "Units and revenue to break even, margin of safety and target profit.",
    group: "Operations",
    roles: ["corpfin"],
    icon: BarChart3,
    keywords: ["break even", "contribution margin", "fixed costs"],
    phase: 5,
  },
  {
    id: "variance",
    name: "Budget vs. Actual",
    description: "Line-item variance table with favorable/unfavorable flags.",
    group: "Operations",
    roles: ["corpfin"],
    icon: FileSpreadsheet,
    keywords: ["variance", "budget", "actual", "fp&a"],
    phase: 5,
  },
  // ── Shared ──────────────────────────────────────────────────────────────
  {
    id: "company",
    name: "Company Snapshot",
    description: "Live quote, market cap, key metrics and recent headlines.",
    group: "Workspace",
    roles: [],
    icon: Building2,
    keywords: ["quote", "profile", "news", "ticker"],
    phase: 3,
    live: true,
  },
  {
    id: "tvm",
    name: "Time Value of Money",
    description: "Solve for PV, FV, PMT, N or rate.",
    group: "Workspace",
    roles: [],
    icon: Calculator,
    keywords: ["tvm", "present value", "future value", "pmt", "annuity"],
    phase: 4,
  },
  {
    id: "spreadsheet",
    name: "Spreadsheet",
    description: "Grid with formulas, CSV/XLSX import and XLSX export.",
    group: "Workspace",
    roles: [],
    icon: FileSpreadsheet,
    keywords: ["grid", "excel", "sheet", "formulas"],
    phase: 4,
  },
  {
    id: "scenarios",
    name: "Saved Scenarios",
    description: "Load, duplicate and manage saved scenarios with input timestamps.",
    group: "Workspace",
    roles: [],
    icon: FolderOpen,
    keywords: ["saved", "scenarios", "models", "load"],
    phase: 4,
  },
];

const byId = new Map(TOOLS.map((t) => [t.id, t]));

export function getTool(id: string): ToolMeta | undefined {
  return byId.get(id);
}

/** Tools for a role: role-specific tools first (in registry order), then shared tools. */
export function toolsForRole(role: RoleId): ToolMeta[] {
  const specific = TOOLS.filter((t) => t.roles.includes(role));
  const shared = TOOLS.filter((t) => t.roles.length === 0);
  return [...specific, ...shared];
}

/** Group tools preserving first-seen group order. */
export function groupTools(tools: readonly ToolMeta[]): Array<{ group: ToolGroup; tools: ToolMeta[] }> {
  const groups = new Map<ToolGroup, ToolMeta[]>();
  for (const tool of tools) {
    const list = groups.get(tool.group) ?? [];
    list.push(tool);
    groups.set(tool.group, list);
  }
  return [...groups.entries()].map(([group, list]) => ({ group, tools: list }));
}
