import { describe, expect, it } from "vitest";
import { analyzeRatios, ebitdaOf, grossProfitOf, safeDiv, type FinancialStatement } from "@/lib/finance/ratios";

const fs: FinancialStatement = {
  revenue: 1000,
  costOfRevenue: 600,
  operatingIncome: 150,
  netIncome: 100,
  depreciationAmortization: 50,
  interestExpense: 30,
  incomeTaxExpense: 30,
  pretaxIncome: 130,
  totalAssets: 2000,
  totalEquity: 800,
  currentAssets: 500,
  currentLiabilities: 250,
  cash: 100,
  receivables: 150,
  inventory: 120,
  payables: 90,
  totalDebt: 600,
  operatingCashFlow: 180,
  capitalExpenditure: -70,
};

const byId = (s: FinancialStatement, prior?: FinancialStatement) =>
  Object.fromEntries(analyzeRatios(s, prior).map((r) => [r.id, r.value]));

describe("ratio analyzer", () => {
  it("computes liquidity, leverage, profitability and efficiency ratios", () => {
    const r = byId(fs);
    expect(r["current"]).toBe(2);
    expect(r["quick"]).toBeCloseTo(1.52, 12);
    expect(r["cash"]).toBeCloseTo(0.4, 12);
    expect(r["debt-equity"]).toBe(0.75);
    expect(r["net-debt-ebitda"]).toBeCloseTo(2.5, 12);
    expect(r["interest-coverage"]).toBe(5);
    expect(r["gross-margin"]).toBe(0.4);
    expect(r["ebitda-margin"]).toBe(0.2);
    expect(r["net-margin"]).toBe(0.1);
    expect(r["roe"]).toBe(0.125);
    expect(r["fcf-margin"]).toBeCloseTo(0.11, 12);
    expect(r["dso"]).toBeCloseTo(54.75, 10);
    expect(r["dio"]).toBeCloseTo(73, 10);
    expect(r["dpo"]).toBeCloseTo(54.75, 10);
    expect(r["ccc"]).toBeCloseTo(73, 10);
    // ROIC = 150 × (1 − 30/130) / (600 + 800 − 100)
    expect(r["roic"]).toBeCloseTo((150 * (1 - 30 / 130)) / 1300, 12);
  });
  it("uses average balances when a prior period is supplied", () => {
    const r = byId(fs, { totalAssets: 1800, totalEquity: 700, inventory: 80 });
    expect(r["roa"]).toBeCloseTo(100 / 1900, 12);
    expect(r["roe"]).toBeCloseTo(100 / 750, 12);
    expect(r["inventory-turnover"]).toBeCloseTo(6, 12);
  });
  it("returns null instead of 0/NaN for missing data, zero denominators and negative equity", () => {
    const r = byId({ revenue: 0, netIncome: 10, totalEquity: -50, totalDebt: 100 });
    expect(r["net-margin"]).toBeNull();
    expect(r["debt-equity"]).toBeNull();
    expect(r["current"]).toBeNull();
    expect(Object.values(byId({})).every((v) => v === null)).toBe(true);
    expect(safeDiv(1, 0)).toBeNull();
  });
  it("derives gross profit and EBITDA when not reported", () => {
    expect(grossProfitOf({ revenue: 10, costOfRevenue: 4 })).toBe(6);
    expect(grossProfitOf({ grossProfit: 7, revenue: 10, costOfRevenue: 4 })).toBe(7);
    expect(ebitdaOf({ operatingIncome: 5, depreciationAmortization: 2 })).toBe(7);
    expect(ebitdaOf({ operatingIncome: 5 })).toBeNull();
  });
});
