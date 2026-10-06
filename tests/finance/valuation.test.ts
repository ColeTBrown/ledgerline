import { describe, expect, it } from "vitest";
import { afterTaxCostOfDebt, costOfEquityCapm, releverBeta, unleverBeta, wacc } from "@/lib/finance/valuation/wacc";
import { dcfSensitivity, runDcf, type DcfInputs } from "@/lib/finance/valuation/dcf";
import { compsTable, impliedValuation, peerMultiples, safeMultiple, type Peer } from "@/lib/finance/valuation/comps";
import { runLbo, type LboInputs } from "@/lib/finance/valuation/lbo";
import { FinanceInputError } from "@/lib/finance/errors";

describe("WACC", () => {
  it("CAPM cost of equity", () => {
    expect(costOfEquityCapm({ riskFreeRate: 0.04, beta: 1.2, equityRiskPremium: 0.055 })).toBeCloseTo(0.106, 12);
    expect(costOfEquityCapm({ riskFreeRate: 0.04, beta: 1.2, equityRiskPremium: 0.055, sizePremium: 0.01, countryRiskPremium: 0.005 })).toBeCloseTo(0.121, 12);
  });
  it("weights and blends the components", () => {
    const r = wacc({ equityValue: 600, debtValue: 400, costOfEquity: 0.1, preTaxCostOfDebt: 0.06, taxRate: 0.25 });
    expect(r.equityWeight).toBe(0.6);
    expect(r.afterTaxCostOfDebt).toBeCloseTo(0.045, 12);
    expect(r.wacc).toBeCloseTo(0.6 * 0.1 + 0.4 * 0.045, 12);
    expect(afterTaxCostOfDebt(0.08, 0)).toBe(0.08);
  });
  it("includes preferred stock", () => {
    const r = wacc({ equityValue: 500, debtValue: 300, preferredValue: 200, costOfEquity: 0.12, preTaxCostOfDebt: 0.07, taxRate: 0.3, costOfPreferred: 0.08 });
    expect(r.wacc).toBeCloseTo(0.5 * 0.12 + 0.3 * 0.049 + 0.2 * 0.08, 12);
  });
  it("validates tax rate and capital", () => {
    expect(() => wacc({ equityValue: 0, debtValue: 0, costOfEquity: 0.1, preTaxCostOfDebt: 0.05, taxRate: 0.2 })).toThrow(FinanceInputError);
    expect(() => afterTaxCostOfDebt(0.05, 1.2)).toThrow(FinanceInputError);
  });
  it("unlevers and relevers beta (Hamada)", () => {
    const bu = unleverBeta(1.3, 0.5, 0.25);
    expect(bu).toBeCloseTo(1.3 / 1.375, 12);
    expect(releverBeta(bu, 0.5, 0.25)).toBeCloseTo(1.3, 12);
  });
});

describe("DCF", () => {
  const inputs: DcfInputs = {
    baseRevenue: 1000,
    revenueGrowth: [0.1, 0.08, 0.06, 0.05, 0.04],
    ebitMargin: 0.2,
    taxRate: 0.25,
    daPctRevenue: 0.04,
    capexPctRevenue: 0.05,
    nwcPctRevenue: 0.1,
    wacc: 0.09,
    terminal: { method: "gordon", growth: 0.025 },
    netDebt: 500,
    sharesOutstanding: 100,
    currentPrice: 18,
  };
  it("matches an independently computed Gordon-growth valuation", () => {
    const r = runDcf(inputs);
    expect(r.years[0]!.fcf).toBeCloseTo(144, 10);
    expect(r.sumPvFcf).toBeCloseTo(643.688230829, 6);
    expect(r.terminalValue).toBeCloseTo(2952.469140923, 6);
    expect(r.enterpriseValue).toBeCloseTo(2562.590592592, 6);
    expect(r.valuePerShare).toBeCloseTo(20.625905926, 8);
    expect(r.upside).toBeCloseTo(20.625905926 / 18 - 1, 8);
    expect(r.impliedPerpetualGrowth).toBeCloseTo(0.025, 10);
  });
  it("supports exit multiples and the mid-year convention", () => {
    const exit = runDcf({ ...inputs, terminal: { method: "exit-multiple", multiple: 10 } });
    expect(exit.enterpriseValue).toBeCloseTo(2788.670449186, 6);
    expect(exit.impliedExitMultiple).toBeCloseTo(10, 10);
    expect(runDcf({ ...inputs, midYear: true }).enterpriseValue).toBeCloseTo(2590.932604366, 6);
  });
  it("throws when WACC ≤ terminal growth", () => {
    expect(() => runDcf({ ...inputs, terminal: { method: "gordon", growth: 0.09 } })).toThrow(FinanceInputError);
  });
  it("builds a sensitivity grid with null for invalid cells", () => {
    const grid = dcfSensitivity(inputs, [0.08, 0.09, 0.1], [0.02, 0.025, 0.085]);
    expect(grid[1]![1]).toBeCloseTo(20.625905926, 8);
    expect(grid[0]![2]).toBeNull();
    // Higher WACC → lower value; higher growth → higher value.
    expect(grid[0]![0]!).toBeGreaterThan(grid[2]![0]!);
    expect(grid[1]![1]!).toBeGreaterThan(grid[1]![0]!);
  });
});

describe("comparable companies", () => {
  const peers: Peer[] = [
    { ticker: "AAA", price: 50, sharesOutstanding: 100, totalDebt: 1000, cash: 500, revenue: 4000, ebitda: 800, netIncome: 300 },
    { ticker: "BBB", price: 30, sharesOutstanding: 200, totalDebt: 0, cash: 1000, revenue: 3000, ebitda: 500, netIncome: -50 },
    { ticker: "CCC", price: 80, sharesOutstanding: 50, totalDebt: 2000, cash: 0, revenue: 5000, ebitda: 0, netIncome: 400 },
  ];
  it("computes market cap, EV and multiples with NM handling", () => {
    const a = peerMultiples(peers[0]!);
    expect(a.marketCap).toBe(5000);
    expect(a.enterpriseValue).toBe(5500);
    expect(a.evToEbitda).toBeCloseTo(6.875, 12);
    expect(a.priceToEarnings).toBeCloseTo(16.6667, 4);
    expect(peerMultiples(peers[1]!).priceToEarnings).toBeNull();
    expect(peerMultiples(peers[2]!).evToEbitda).toBeNull();
    expect(peerMultiples({ ...peers[0]!, cash: null }).enterpriseValue).toBeNull();
    expect(safeMultiple(10, 0)).toBeNull();
  });
  it("summarizes peers and applies medians to a target", () => {
    const table = compsTable(peers);
    expect(table.stats.evToEbitda.count).toBe(2);
    expect(table.stats.evToEbitda.median).toBeCloseTo((6.875 + 10) / 2, 12);
    const target: Peer = { ticker: "TGT", price: null, sharesOutstanding: 100, totalDebt: 300, cash: 100, revenue: 2000, ebitda: 400, netIncome: 150 };
    const implied = impliedValuation(target, table);
    const ev = implied.find((v) => v.method === "evToEbitda")!;
    expect(ev.enterpriseValue).toBeCloseTo(8.4375 * 400, 10);
    expect(ev.pricePerShare).toBeCloseTo((8.4375 * 400 - 200) / 100, 10);
    expect(implied.find((v) => v.method === "priceToEarnings")).toBeDefined();
  });
});

describe("LBO", () => {
  const base: LboInputs = {
    ltmRevenue: 1000,
    ltmEbitda: 200,
    entryMultiple: 10,
    exitMultiple: 10,
    years: 5,
    revenueGrowth: 0.05,
    ebitdaMargin: 0.2,
    daPctRevenue: 0.03,
    capexPctRevenue: 0.03,
    nwcPctRevenue: 0.05,
    taxRate: 0.25,
    cashSweepPct: 1,
    minimumCash: 20,
    transactionFeePct: 0.02,
    financingFeePct: 0.02,
    tranches: [
      { name: "Term Loan B", ebitdaMultiple: 4, rate: 0.08, amortizationPct: 0.01, sweep: true },
      { name: "Senior Notes", ebitdaMultiple: 2, rate: 0.1, amortizationPct: 0, sweep: false },
    ],
  };
  it("balances sources and uses", () => {
    const r = runLbo(base);
    const su = r.sourcesAndUses;
    expect(su.entryEnterpriseValue).toBe(2000);
    expect(su.totalDebt).toBe(1200);
    expect(su.totalUses).toBeCloseTo(2000 + 40 + 24 + 20, 10);
    expect(su.totalSources).toBeCloseTo(su.totalUses, 10);
    expect(su.sponsorEquity).toBeCloseTo(884, 10);
  });
  it("pays down debt, never below zero, and computes returns", () => {
    const r = runLbo(base);
    for (const y of r.years) {
      for (const b of y.debtBalances) expect(b).toBeGreaterThanOrEqual(0);
      expect(y.cash).toBeGreaterThanOrEqual(base.minimumCash - 1e-9);
    }
    expect(r.years[4]!.debtBalances[1]).toBe(400); // notes do not amortize or sweep
    expect(r.years[4]!.totalDebt).toBeLessThan(1200);
    expect(r.moic).toBeCloseTo(r.exitEquity / r.sourcesAndUses.sponsorEquity, 12);
    expect(r.irr).toBeCloseTo(Math.pow(r.moic, 1 / 5) - 1, 12);
    expect(r.irr!).toBeGreaterThan(0.1);
  });
  it("matches a hand-computed all-equity, no-growth case", () => {
    // No debt, no fees, flat business: equity grows only by retained cash.
    const r = runLbo({
      ...base,
      tranches: [],
      transactionFeePct: 0,
      financingFeePct: 0,
      revenueGrowth: 0,
      minimumCash: 0,
      daPctRevenue: 0,
      capexPctRevenue: 0,
    });
    // Annual FCF = 200 × (1 − 25%) = 150; exit equity = 2000 + 5 × 150.
    expect(r.exitEquity).toBeCloseTo(2750, 8);
    expect(r.moic).toBeCloseTo(1.375, 10);
  });
  it("rejects leverage above total uses", () => {
    expect(() => runLbo({ ...base, tranches: [{ name: "Loan", ebitdaMultiple: 20, rate: 0.08, amortizationPct: 0, sweep: true }] })).toThrow(FinanceInputError);
  });
  it("returns null IRR when equity is wiped out", () => {
    const r = runLbo({ ...base, exitMultiple: 3 });
    expect(r.exitEquity).toBeLessThan(0);
    expect(r.irr).toBeNull();
  });
});
