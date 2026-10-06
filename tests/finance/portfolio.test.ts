import { describe, expect, it } from "vitest";
import {
  constantCorrelation,
  covarianceMatrix,
  efficientFrontier,
  maxSharpePortfolio,
  minimumVariancePortfolio,
  portfolioReturn,
  portfolioVolatility,
  projectToSimplex,
  sharpeRatio,
  weightsFromValues,
} from "@/lib/finance/portfolio";
import { rebalance } from "@/lib/finance/rebalance";
import { FinanceInputError } from "@/lib/finance/errors";

describe("portfolio statistics", () => {
  const vols = [0.2, 0.1];
  const cov = covarianceMatrix(vols, [[1, 0.3], [0.3, 1]]);
  it("builds Σ and computes return, volatility and Sharpe", () => {
    expect(cov[0]![1]).toBeCloseTo(0.006, 12);
    const w = [0.6, 0.4];
    expect(portfolioReturn(w, [0.1, 0.05])).toBeCloseTo(0.08, 12);
    const v = Math.sqrt(0.36 * 0.04 + 0.16 * 0.01 + 2 * 0.24 * 0.006);
    expect(portfolioVolatility(w, cov)).toBeCloseTo(v, 12);
    expect(sharpeRatio(0.08, v, 0.03)).toBeCloseTo(0.05 / v, 12);
    expect(sharpeRatio(0.08, 0, 0.03)).toBeNull();
    expect(weightsFromValues([30, 70])).toEqual([0.3, 0.7]);
  });
  it("validates the correlation matrix", () => {
    expect(() => covarianceMatrix([0.1, 0.2], [[1, 1.2], [1.2, 1]])).toThrow(FinanceInputError);
    expect(() => covarianceMatrix([0.1, 0.2], [[1, 0.2], [0.3, 1]])).toThrow(FinanceInputError);
    expect(() => covarianceMatrix([0.1, 0.2], [[0.9, 0.2], [0.2, 1]])).toThrow(FinanceInputError);
  });
  it("projects onto the simplex", () => {
    expect(projectToSimplex([0.5, 0.5])).toEqual([0.5, 0.5]);
    const p = projectToSimplex([2, -1, 0.5]);
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    expect(p.every((x) => x >= 0)).toBe(true);
    expect(p).toEqual([1, 0, 0]);
  });
  it("minimum-variance portfolio matches the two-asset closed form", () => {
    // w₁ = (σ₂² − ρσ₁σ₂) / (σ₁² + σ₂² − 2ρσ₁σ₂)
    const w1 = (0.01 - 0.006) / (0.04 + 0.01 - 2 * 0.006);
    const mv = minimumVariancePortfolio([0.1, 0.05], cov, 0.03);
    expect(mv.weights[0]).toBeCloseTo(w1, 6);
  });
  it("frontier is long-only, sorted and increasing in return", () => {
    const mu = [0.08, 0.06, 0.11, 0.03];
    const c = covarianceMatrix([0.16, 0.12, 0.22, 0.05], constantCorrelation(4, 0.25));
    const f = efficientFrontier(mu, c, 0.03, 25);
    expect(f.length).toBeGreaterThan(5);
    for (let i = 1; i < f.length; i++) {
      expect(f[i]!.volatility).toBeGreaterThanOrEqual(f[i - 1]!.volatility - 1e-9);
      expect(f[i]!.expectedReturn).toBeGreaterThan(f[i - 1]!.expectedReturn);
    }
    for (const p of f) {
      expect(p.weights.every((w) => w >= -1e-12)).toBe(true);
      expect(p.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 9);
    }
    expect(f[f.length - 1]!.expectedReturn).toBeCloseTo(0.11, 3);
    const ms = maxSharpePortfolio(mu, c, 0.03);
    for (const p of f) expect(ms.sharpe!).toBeGreaterThanOrEqual(p.sharpe! - 1e-4);
  });
});

describe("rebalance", () => {
  const holdings = [
    { symbol: "VTI", shares: 100, price: 250, targetWeight: 0.6 },
    { symbol: "BND", shares: 200, price: 75, targetWeight: 0.4 },
  ];
  it("computes trades to target weights with whole shares", () => {
    // Total = 25,000 + 15,000 + 5,000 cash = 45,000 → targets 27,000 / 18,000.
    const r = rebalance(holdings, 5000);
    expect(r.totalValue).toBe(45000);
    expect(r.rows[0]!.tradeShares).toBe(8);
    expect(r.rows[1]!.tradeShares).toBe(40);
    expect(r.cashAfter).toBe(5000 - 2000 - 3000);
    expect(r.rows[0]!.drift).toBeCloseTo(25000 / 45000 - 0.6, 12);
    expect(r.targetCashWeight).toBeCloseTo(0, 12);
  });
  it("supports fractional shares, minimum trade size and sells", () => {
    const r = rebalance([{ symbol: "A", shares: 10, price: 33, targetWeight: 0.5 }, { symbol: "B", shares: 0, price: 7, targetWeight: 0.5 }], 0, { fractional: true });
    expect(r.rows[0]!.tradeShares).toBeCloseTo(-5, 12);
    expect(r.rows[1]!.postWeight).toBeCloseTo(0.5, 12);
    const skip = rebalance(holdings, 5000, { minTradeValue: 2500 });
    expect(skip.rows[0]!.tradeShares).toBe(0);
  });
  it("never needs more cash than available with whole shares", () => {
    const r = rebalance([{ symbol: "X", shares: 0, price: 333.33, targetWeight: 1 }], 1000);
    expect(r.rows[0]!.tradeShares).toBe(3);
    expect(r.cashAfter).toBeGreaterThanOrEqual(0);
  });
  it("validates weights", () => {
    expect(() => rebalance([{ symbol: "X", shares: 1, price: 10, targetWeight: 1.2 }])).toThrow(FinanceInputError);
    expect(() => rebalance([])).toThrow(FinanceInputError);
  });
});
