/**
 * Budget-vs-actual variance analysis.
 */
import { assertFinite } from "./errors";

/** Revenue-type lines are favorable when actual > budget; cost-type when actual < budget. */
export type LineKind = "revenue" | "expense";

export interface VarianceLine {
  label: string;
  kind: LineKind;
  budget: number;
  actual: number;
}

export interface VarianceResult extends VarianceLine {
  /** actual − budget. */
  variance: number;
  /** (actual − budget) / |budget|; null when budget is zero. */
  variancePct: number | null;
  favorable: boolean;
  /** True when |variancePct| meets the materiality threshold. */
  material: boolean;
}

/**
 * Compute variance for one line.
 * Favorable = (revenue and actual ≥ budget) or (expense and actual ≤ budget).
 */
export function lineVariance(line: VarianceLine, materialityThreshold = 0.1): VarianceResult {
  assertFinite(line.budget, "budget");
  assertFinite(line.actual, "actual");
  const variance = line.actual - line.budget;
  const variancePct = line.budget === 0 ? null : variance / Math.abs(line.budget);
  const favorable = line.kind === "revenue" ? variance >= 0 : variance <= 0;
  const material = variancePct === null ? variance !== 0 : Math.abs(variancePct) >= materialityThreshold;
  return { ...line, variance, variancePct, favorable, material };
}

export interface VarianceSummary {
  lines: VarianceResult[];
  totalRevenue: { budget: number; actual: number };
  totalExpense: { budget: number; actual: number };
  /** Net income = revenue − expense, budget and actual. */
  net: VarianceResult;
}

/** Variance for a full budget, with revenue, expense and net totals. */
export function varianceTable(lines: readonly VarianceLine[], materialityThreshold = 0.1): VarianceSummary {
  const results = lines.map((l) => lineVariance(l, materialityThreshold));
  const sum = (kind: LineKind, key: "budget" | "actual") =>
    lines.filter((l) => l.kind === kind).reduce((s, l) => s + l[key], 0);
  const totalRevenue = { budget: sum("revenue", "budget"), actual: sum("revenue", "actual") };
  const totalExpense = { budget: sum("expense", "budget"), actual: sum("expense", "actual") };
  const net = lineVariance(
    {
      label: "Net income",
      kind: "revenue",
      budget: totalRevenue.budget - totalExpense.budget,
      actual: totalRevenue.actual - totalExpense.actual,
    },
    materialityThreshold,
  );
  return { lines: results, totalRevenue, totalExpense, net };
}
