/**
 * Financial ratio analysis. Every input is nullable because filings
 * (especially SEC XBRL data) often omit fields; a ratio whose inputs are
 * missing, or whose denominator is zero, is null rather than 0 or NaN.
 */

export interface FinancialStatement {
  revenue?: number | null;
  costOfRevenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  /** Depreciation & amortization, used to derive EBITDA when not given. */
  depreciationAmortization?: number | null;
  ebitda?: number | null;
  interestExpense?: number | null;
  incomeTaxExpense?: number | null;
  pretaxIncome?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  cash?: number | null;
  shortTermInvestments?: number | null;
  receivables?: number | null;
  inventory?: number | null;
  payables?: number | null;
  totalDebt?: number | null;
  operatingCashFlow?: number | null;
  capitalExpenditure?: number | null;
}

type N = number | null | undefined;

function ok(v: N): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** a / b, or null when either is missing or b is zero. */
export function safeDiv(a: N, b: N): number | null {
  if (!ok(a) || !ok(b) || b === 0) return null;
  return a / b;
}

/** Average of current and prior balance when a prior is available, else current. */
function avg(current: N, prior: N): number | null {
  if (!ok(current)) return null;
  return ok(prior) ? (current + prior) / 2 : current;
}

/** Gross profit, derived from revenue − cost of revenue when not reported. */
export function grossProfitOf(s: FinancialStatement): number | null {
  if (ok(s.grossProfit)) return s.grossProfit;
  return ok(s.revenue) && ok(s.costOfRevenue) ? s.revenue - s.costOfRevenue : null;
}

/** EBITDA, derived as operating income + D&A when not reported. */
export function ebitdaOf(s: FinancialStatement): number | null {
  if (ok(s.ebitda)) return s.ebitda;
  return ok(s.operatingIncome) && ok(s.depreciationAmortization) ? s.operatingIncome + s.depreciationAmortization : null;
}

export type RatioCategory = "Liquidity" | "Leverage" | "Profitability" | "Efficiency";
export type RatioFormat = "multiple" | "percent" | "days";

export interface RatioDefinition {
  id: string;
  label: string;
  category: RatioCategory;
  format: RatioFormat;
  formula: string;
  /** When true, a higher value is generally healthier (for color cues). */
  higherIsBetter: boolean;
  compute: (s: FinancialStatement, prior?: FinancialStatement) => number | null;
}

export const RATIOS: readonly RatioDefinition[] = [
  // Liquidity
  { id: "current", label: "Current ratio", category: "Liquidity", format: "multiple", formula: "Current assets / Current liabilities", higherIsBetter: true,
    compute: (s) => safeDiv(s.currentAssets, s.currentLiabilities) },
  { id: "quick", label: "Quick ratio", category: "Liquidity", format: "multiple", formula: "(Current assets − Inventory) / Current liabilities", higherIsBetter: true,
    compute: (s) => (ok(s.currentAssets) ? safeDiv(s.currentAssets - (ok(s.inventory) ? s.inventory : 0), s.currentLiabilities) : null) },
  { id: "cash", label: "Cash ratio", category: "Liquidity", format: "multiple", formula: "(Cash + Short-term investments) / Current liabilities", higherIsBetter: true,
    compute: (s) => (ok(s.cash) ? safeDiv(s.cash + (ok(s.shortTermInvestments) ? s.shortTermInvestments : 0), s.currentLiabilities) : null) },
  // Leverage
  { id: "debt-equity", label: "Debt / Equity", category: "Leverage", format: "multiple", formula: "Total debt / Total equity", higherIsBetter: false,
    compute: (s) => (ok(s.totalEquity) && s.totalEquity > 0 ? safeDiv(s.totalDebt, s.totalEquity) : null) },
  { id: "debt-assets", label: "Debt / Assets", category: "Leverage", format: "percent", formula: "Total debt / Total assets", higherIsBetter: false,
    compute: (s) => safeDiv(s.totalDebt, s.totalAssets) },
  { id: "net-debt-ebitda", label: "Net debt / EBITDA", category: "Leverage", format: "multiple", formula: "(Total debt − Cash) / EBITDA", higherIsBetter: false,
    compute: (s) => {
      const e = ebitdaOf(s);
      return ok(s.totalDebt) && ok(s.cash) && e !== null && e > 0 ? (s.totalDebt - s.cash) / e : null;
    } },
  { id: "interest-coverage", label: "Interest coverage", category: "Leverage", format: "multiple", formula: "Operating income / Interest expense", higherIsBetter: true,
    compute: (s) => (ok(s.interestExpense) ? safeDiv(s.operatingIncome, Math.abs(s.interestExpense)) : null) },
  { id: "equity-multiplier", label: "Equity multiplier", category: "Leverage", format: "multiple", formula: "Total assets / Total equity", higherIsBetter: false,
    compute: (s) => (ok(s.totalEquity) && s.totalEquity > 0 ? safeDiv(s.totalAssets, s.totalEquity) : null) },
  // Profitability
  { id: "gross-margin", label: "Gross margin", category: "Profitability", format: "percent", formula: "Gross profit / Revenue", higherIsBetter: true,
    compute: (s) => safeDiv(grossProfitOf(s), s.revenue) },
  { id: "operating-margin", label: "Operating margin", category: "Profitability", format: "percent", formula: "Operating income / Revenue", higherIsBetter: true,
    compute: (s) => safeDiv(s.operatingIncome, s.revenue) },
  { id: "ebitda-margin", label: "EBITDA margin", category: "Profitability", format: "percent", formula: "EBITDA / Revenue", higherIsBetter: true,
    compute: (s) => safeDiv(ebitdaOf(s), s.revenue) },
  { id: "net-margin", label: "Net margin", category: "Profitability", format: "percent", formula: "Net income / Revenue", higherIsBetter: true,
    compute: (s) => safeDiv(s.netIncome, s.revenue) },
  { id: "roa", label: "Return on assets", category: "Profitability", format: "percent", formula: "Net income / Average total assets", higherIsBetter: true,
    compute: (s, p) => safeDiv(s.netIncome, avg(s.totalAssets, p?.totalAssets)) },
  { id: "roe", label: "Return on equity", category: "Profitability", format: "percent", formula: "Net income / Average total equity", higherIsBetter: true,
    compute: (s, p) => {
      const e = avg(s.totalEquity, p?.totalEquity);
      return e !== null && e > 0 ? safeDiv(s.netIncome, e) : null;
    } },
  { id: "roic", label: "Return on invested capital", category: "Profitability", format: "percent", formula: "Operating income × (1 − tax rate) / (Debt + Equity − Cash)", higherIsBetter: true,
    compute: (s) => {
      if (!ok(s.operatingIncome) || !ok(s.totalDebt) || !ok(s.totalEquity) || !ok(s.cash)) return null;
      const taxRate = safeDiv(s.incomeTaxExpense, s.pretaxIncome);
      const t = taxRate !== null && taxRate >= 0 && taxRate < 1 ? taxRate : 0.21;
      const invested = s.totalDebt + s.totalEquity - s.cash;
      return invested > 0 ? (s.operatingIncome * (1 - t)) / invested : null;
    } },
  { id: "fcf-margin", label: "Free cash flow margin", category: "Profitability", format: "percent", formula: "(Operating cash flow − CapEx) / Revenue", higherIsBetter: true,
    compute: (s) => (ok(s.operatingCashFlow) && ok(s.capitalExpenditure) ? safeDiv(s.operatingCashFlow - Math.abs(s.capitalExpenditure), s.revenue) : null) },
  // Efficiency
  { id: "asset-turnover", label: "Asset turnover", category: "Efficiency", format: "multiple", formula: "Revenue / Average total assets", higherIsBetter: true,
    compute: (s, p) => safeDiv(s.revenue, avg(s.totalAssets, p?.totalAssets)) },
  { id: "inventory-turnover", label: "Inventory turnover", category: "Efficiency", format: "multiple", formula: "Cost of revenue / Average inventory", higherIsBetter: true,
    compute: (s, p) => safeDiv(s.costOfRevenue, avg(s.inventory, p?.inventory)) },
  { id: "dso", label: "Days sales outstanding", category: "Efficiency", format: "days", formula: "Average receivables / Revenue × 365", higherIsBetter: false,
    compute: (s, p) => {
      const r = safeDiv(avg(s.receivables, p?.receivables), s.revenue);
      return r === null ? null : r * 365;
    } },
  { id: "dio", label: "Days inventory outstanding", category: "Efficiency", format: "days", formula: "Average inventory / Cost of revenue × 365", higherIsBetter: false,
    compute: (s, p) => {
      const r = safeDiv(avg(s.inventory, p?.inventory), s.costOfRevenue);
      return r === null ? null : r * 365;
    } },
  { id: "dpo", label: "Days payables outstanding", category: "Efficiency", format: "days", formula: "Average payables / Cost of revenue × 365", higherIsBetter: true,
    compute: (s, p) => {
      const r = safeDiv(avg(s.payables, p?.payables), s.costOfRevenue);
      return r === null ? null : r * 365;
    } },
  { id: "ccc", label: "Cash conversion cycle", category: "Efficiency", format: "days", formula: "DSO + DIO − DPO", higherIsBetter: false,
    compute: (s, p) => {
      const get = (id: string) => RATIOS.find((r) => r.id === id)!.compute(s, p);
      const dso = get("dso");
      const dio = get("dio");
      const dpo = get("dpo");
      return dso !== null && dio !== null && dpo !== null ? dso + dio - dpo : null;
    } },
];

export interface RatioValue {
  id: string;
  label: string;
  category: RatioCategory;
  format: RatioFormat;
  formula: string;
  higherIsBetter: boolean;
  value: number | null;
}

/** Compute every ratio. `prior` (previous period) enables average-balance ratios. */
export function analyzeRatios(statement: FinancialStatement, prior?: FinancialStatement): RatioValue[] {
  return RATIOS.map(({ compute, ...meta }) => ({ ...meta, value: compute(statement, prior) }));
}
