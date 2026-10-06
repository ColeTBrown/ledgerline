import { describe, expect, it } from "vitest";
import { blackScholes, priceBounds } from "@/lib/finance/options/black-scholes";
import { impliedVolatility } from "@/lib/finance/options/implied-vol";
import { binomialPrice } from "@/lib/finance/options/binomial";
import { FinanceInputError } from "@/lib/finance/errors";

// References: Hull, "Options, Futures, and Other Derivatives".
describe("Black–Scholes", () => {
  it("matches Hull's pricing example (S=42, K=40, r=10%, σ=20%, T=0.5)", () => {
    const base = { spot: 42, strike: 40, timeToExpiry: 0.5, rate: 0.1, volatility: 0.2 };
    expect(blackScholes({ ...base, type: "call" }).price).toBeCloseTo(4.7594, 4);
    expect(blackScholes({ ...base, type: "put" }).price).toBeCloseTo(0.8086, 4);
  });

  it("matches Hull's Greeks example (S=49, K=50, r=5%, σ=20%, T=20 weeks)", () => {
    const g = blackScholes({ type: "call", spot: 49, strike: 50, timeToExpiry: 20 / 52, rate: 0.05, volatility: 0.2 });
    expect(g.price).toBeCloseTo(2.4005, 4);
    expect(g.delta).toBeCloseTo(0.5216, 4);
    expect(g.gamma).toBeCloseTo(0.06554, 5);
    expect(g.vega).toBeCloseTo(12.1055, 4);
    expect(g.theta).toBeCloseTo(-4.3053, 4);
    expect(g.rho).toBeCloseTo(8.9070, 4);
    const p = blackScholes({ type: "put", spot: 49, strike: 50, timeToExpiry: 20 / 52, rate: 0.05, volatility: 0.2 });
    expect(p.delta).toBeCloseTo(-0.4784, 4);
    expect(p.theta).toBeCloseTo(-1.8529, 4);
    expect(p.rho).toBeCloseTo(-9.9575, 4);
  });

  it("supports a continuous dividend yield", () => {
    const c = blackScholes({ type: "call", spot: 100, strike: 95, timeToExpiry: 0.75, rate: 0.05, volatility: 0.25, dividendYield: 0.03 });
    expect(c.price).toBeCloseTo(11.672055, 5);
    expect(c.delta).toBeCloseTo(0.646027, 5);
    expect(c.theta).toBeCloseTo(-5.875219, 5);
  });

  it("satisfies put–call parity: C − P = S·e^(−qT) − K·e^(−rT)", () => {
    const base = { spot: 123, strike: 117, timeToExpiry: 1.3, rate: 0.037, volatility: 0.31, dividendYield: 0.012 };
    const c = blackScholes({ ...base, type: "call" }).price;
    const p = blackScholes({ ...base, type: "put" }).price;
    expect(c - p).toBeCloseTo(123 * Math.exp(-0.012 * 1.3) - 117 * Math.exp(-0.037 * 1.3), 10);
  });

  it("Greeks agree with finite differences", () => {
    const base = { type: "put" as const, spot: 100, strike: 105, timeToExpiry: 0.6, rate: 0.04, volatility: 0.3, dividendYield: 0.01 };
    const g = blackScholes(base);
    const h = 1e-4;
    const price = (o: Partial<typeof base>) => blackScholes({ ...base, ...o }).price;
    expect(g.delta).toBeCloseTo((price({ spot: 100 + h }) - price({ spot: 100 - h })) / (2 * h), 6);
    expect(g.gamma).toBeCloseTo((price({ spot: 100 + h }) - 2 * g.price + price({ spot: 100 - h })) / (h * h), 3);
    expect(g.vega).toBeCloseTo((price({ volatility: 0.3 + h }) - price({ volatility: 0.3 - h })) / (2 * h), 5);
    expect(g.rho).toBeCloseTo((price({ rate: 0.04 + h }) - price({ rate: 0.04 - h })) / (2 * h), 5);
    expect(g.theta).toBeCloseTo(-(price({ timeToExpiry: 0.6 + h }) - price({ timeToExpiry: 0.6 - h })) / (2 * h), 5);
  });

  it("degrades to intrinsic value at expiry and with zero volatility", () => {
    const atExpiry = blackScholes({ type: "call", spot: 110, strike: 100, timeToExpiry: 0, rate: 0.05, volatility: 0.2 });
    expect(atExpiry.price).toBe(10);
    expect(atExpiry.delta).toBe(1);
    expect(atExpiry.gamma).toBe(0);
    const zeroVol = blackScholes({ type: "put", spot: 90, strike: 100, timeToExpiry: 1, rate: 0.05, volatility: 0 });
    expect(zeroVol.price).toBeCloseTo(100 * Math.exp(-0.05) - 90, 10);
    expect(Number.isFinite(zeroVol.delta)).toBe(true);
  });

  it("handles negative rates and extreme moneyness without NaN", () => {
    const r = blackScholes({ type: "call", spot: 100, strike: 100, timeToExpiry: 1, rate: -0.005, volatility: 0.2 });
    expect(r.price).toBeGreaterThan(0);
    const deepOtm = blackScholes({ type: "call", spot: 1, strike: 1e6, timeToExpiry: 0.1, rate: 0.05, volatility: 0.2 });
    expect(deepOtm.price).toBe(0);
    expect(Number.isFinite(deepOtm.delta)).toBe(true);
  });

  it("rejects invalid inputs", () => {
    expect(() => blackScholes({ type: "call", spot: -1, strike: 100, timeToExpiry: 1, rate: 0.05, volatility: 0.2 })).toThrow(FinanceInputError);
    expect(() => blackScholes({ type: "call", spot: 100, strike: 100, timeToExpiry: -1, rate: 0.05, volatility: 0.2 })).toThrow(FinanceInputError);
  });
});

describe("implied volatility", () => {
  const base = { type: "call" as const, spot: 49, strike: 50, timeToExpiry: 20 / 52, rate: 0.05 };
  it("recovers the volatility used to price the option", () => {
    for (const sigma of [0.05, 0.2, 0.65, 1.5]) {
      for (const type of ["call", "put"] as const) {
        const price = blackScholes({ ...base, type, volatility: sigma }).price;
        const iv = impliedVolatility({ ...base, type }, price);
        expect(iv?.volatility).toBeCloseTo(sigma, 7);
      }
    }
  });
  it("falls back to bisection for deep out-of-the-money options", () => {
    const o = { type: "call" as const, spot: 100, strike: 200, timeToExpiry: 0.1, rate: 0.01 };
    const price = blackScholes({ ...o, volatility: 0.9 }).price;
    const iv = impliedVolatility(o, price)!;
    expect(iv.volatility).toBeCloseTo(0.9, 6);
  });
  it("returns null outside no-arbitrage bounds", () => {
    // In-the-money call: lower bound S − K·e^(−rT) ≈ 10.96.
    const itm = { ...base, spot: 60 };
    const { lower, upper } = priceBounds(itm);
    expect(lower).toBeGreaterThan(10);
    expect(impliedVolatility(itm, lower - 0.5)).toBeNull();
    expect(impliedVolatility(itm, upper * 1.01)).toBeNull();
    expect(impliedVolatility({ ...base, timeToExpiry: 0 }, 1)).toBeNull();
  });
});

describe("binomial tree", () => {
  const put = { type: "put" as const, spot: 50, strike: 50, timeToExpiry: 5 / 12, rate: 0.1, volatility: 0.4 };
  it("matches Hull's five-step American put (4.49)", () => {
    const r = binomialPrice(put, { steps: 5 });
    expect(r.price).toBeCloseTo(4.488459, 5);
    expect(r.tree).not.toBeNull();
    expect(r.tree![0]![0]!.value).toBeCloseTo(r.price, 10);
    expect(r.tree!.flat().some((n) => n.exercised)).toBe(true);
  });
  it("converges to Black–Scholes for European options", () => {
    const eu = binomialPrice(put, { steps: 2000, style: "european" });
    expect(eu.price).toBeCloseTo(blackScholes(put).price, 2);
    expect(eu.delta).toBeCloseTo(blackScholes(put).delta, 2);
  });
  it("American put ≥ European put; American call = European call without dividends", () => {
    const am = binomialPrice(put, { steps: 500 });
    expect(am.price).toBeCloseTo(4.283021, 5);
    expect(am.earlyExercisePremium).toBeGreaterThan(0);
    const call = { ...put, type: "call" as const };
    expect(binomialPrice(call, { steps: 500 }).price).toBeCloseTo(binomialPrice(call, { steps: 500, style: "european" }).price, 10);
  });
  it("omits the tree for large step counts and validates steps", () => {
    expect(binomialPrice(put, { steps: 100 }).tree).toBeNull();
    expect(() => binomialPrice(put, { steps: 0 })).toThrow(FinanceInputError);
    expect(() => binomialPrice(put, { steps: 10001 })).toThrow(FinanceInputError);
  });
});
