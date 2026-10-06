import { describe, expect, it } from "vitest";
import { breakEven } from "@/lib/finance/breakeven";
import { lineVariance, varianceTable } from "@/lib/finance/variance";
import { FinanceInputError } from "@/lib/finance/errors";

describe("breakEven", () => {
  it("computes break-even units, revenue, margin of safety and leverage", () => {
    const r = breakEven({ fixedCosts: 50000, pricePerUnit: 50, variableCostPerUnit: 30, expectedUnits: 4000, targetProfit: 20000 });
    expect(r.contributionMargin).toBe(20);
    expect(r.contributionMarginRatio).toBe(0.4);
    expect(r.breakEvenUnits).toBe(2500);
    expect(r.breakEvenRevenue).toBeCloseTo(125000, 8);
    expect(r.targetUnits).toBe(3500);
    expect(r.expectedProfit).toBe(30000);
    expect(r.marginOfSafety).toBeCloseTo(0.375, 12);
    expect(r.operatingLeverage).toBeCloseTo(80000 / 30000, 12);
  });
  it("returns null leverage at exactly break-even", () => {
    expect(breakEven({ fixedCosts: 100, pricePerUnit: 2, variableCostPerUnit: 1, expectedUnits: 100 }).operatingLeverage).toBeNull();
  });
  it("throws when price does not cover variable cost", () => {
    expect(() => breakEven({ fixedCosts: 100, pricePerUnit: 10, variableCostPerUnit: 10 })).toThrow(FinanceInputError);
  });
});

describe("variance analysis", () => {
  it("flags favorability by line type", () => {
    const rev = lineVariance({ label: "Sales", kind: "revenue", budget: 1000, actual: 1100 });
    expect(rev.variance).toBe(100);
    expect(rev.variancePct).toBeCloseTo(0.1, 12);
    expect(rev.favorable).toBe(true);
    expect(rev.material).toBe(true);
    const exp = lineVariance({ label: "Rent", kind: "expense", budget: 500, actual: 520 });
    expect(exp.favorable).toBe(false);
    expect(exp.material).toBe(false);
  });
  it("handles a zero budget", () => {
    const r = lineVariance({ label: "New", kind: "expense", budget: 0, actual: 50 });
    expect(r.variancePct).toBeNull();
    expect(r.material).toBe(true);
  });
  it("totals revenue, expense and net income", () => {
    const t = varianceTable([
      { label: "Sales", kind: "revenue", budget: 1000, actual: 900 },
      { label: "COGS", kind: "expense", budget: 600, actual: 500 },
      { label: "SG&A", kind: "expense", budget: 200, actual: 250 },
    ]);
    expect(t.totalRevenue).toEqual({ budget: 1000, actual: 900 });
    expect(t.totalExpense).toEqual({ budget: 800, actual: 750 });
    expect(t.net.budget).toBe(200);
    expect(t.net.actual).toBe(150);
    expect(t.net.favorable).toBe(false);
  });
});
