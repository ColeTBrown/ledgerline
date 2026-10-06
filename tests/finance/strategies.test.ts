import { describe, expect, it } from "vitest";
import {
  STRATEGY_PRESETS,
  buildPreset,
  netPremium,
  payoffAtExpiry,
  payoffProfile,
  payoffToday,
  strategyGreeks,
  type StrategyLeg,
} from "@/lib/finance/options/strategies";
import { FinanceInputError } from "@/lib/finance/errors";

const leg = (p: Partial<StrategyLeg> & Pick<StrategyLeg, "kind" | "side">): StrategyLeg => ({
  quantity: 1,
  strike: 100,
  premium: 0,
  multiplier: 100,
  ...p,
});

describe("expiry payoffs", () => {
  it("long call", () => {
    const legs = [leg({ kind: "call", side: "long", premium: 5 })];
    expect(payoffAtExpiry(legs, 90)).toBe(-500);
    expect(payoffAtExpiry(legs, 120)).toBe(1500);
    const p = payoffProfile(legs);
    expect(p.breakevens).toEqual([105]);
    expect(p.maxLoss).toBe(-500);
    expect(p.maxProfit).toBe(Infinity);
  });
  it("short put loss is bounded by the strike", () => {
    const p = payoffProfile([leg({ kind: "put", side: "short", premium: 4 })]);
    expect(p.maxProfit).toBe(400);
    expect(p.maxLoss).toBe(-9600);
    expect(p.breakevens).toEqual([96]);
  });
  it("short call has unlimited loss", () => {
    expect(payoffProfile([leg({ kind: "call", side: "short", premium: 3 })]).maxLoss).toBe(-Infinity);
  });
  it("bull call spread", () => {
    const legs = [leg({ kind: "call", side: "long", strike: 100, premium: 6 }), leg({ kind: "call", side: "short", strike: 110, premium: 2 })];
    const p = payoffProfile(legs);
    expect(netPremium(legs)).toBe(400);
    expect(p.maxLoss).toBe(-400);
    expect(p.maxProfit).toBe(600);
    expect(p.breakevens).toEqual([104]);
  });
  it("long straddle has two breakevens", () => {
    const legs = [leg({ kind: "call", side: "long", premium: 5 }), leg({ kind: "put", side: "long", premium: 4 })];
    const p = payoffProfile(legs);
    expect(p.breakevens[0]).toBeCloseTo(91, 10);
    expect(p.breakevens[1]).toBeCloseTo(109, 10);
    expect(p.maxLoss).toBe(-900);
  });
  it("iron condor is bounded both ways", () => {
    const legs = [
      leg({ kind: "put", side: "long", strike: 90, premium: 1 }),
      leg({ kind: "put", side: "short", strike: 95, premium: 2.5 }),
      leg({ kind: "call", side: "short", strike: 105, premium: 2.5 }),
      leg({ kind: "call", side: "long", strike: 110, premium: 1 }),
    ];
    const p = payoffProfile(legs);
    expect(p.maxProfit).toBeCloseTo(300, 10);
    expect(p.maxLoss).toBeCloseTo(-200, 10);
    expect(p.breakevens.map((b) => Number(b.toFixed(6)))).toEqual([92, 108]);
  });
  it("covered call: stock plus short call", () => {
    const legs = [leg({ kind: "stock", side: "long", quantity: 100, premium: 100, multiplier: 1 }), leg({ kind: "call", side: "short", strike: 110, premium: 3 })];
    const p = payoffProfile(legs);
    expect(p.maxProfit).toBeCloseTo(1300, 10);
    expect(p.maxLoss).toBeCloseTo(-9700, 10);
    expect(p.breakevens[0]).toBeCloseTo(97, 10);
  });
  it("validates legs", () => {
    expect(() => payoffAtExpiry([], 100)).toThrow(FinanceInputError);
    expect(() => payoffAtExpiry([leg({ kind: "call", side: "long", quantity: 0 })], 100)).toThrow(FinanceInputError);
  });
});

describe("mark-to-model and Greeks", () => {
  const market = { rate: 0.04 };
  it("today's value converges to expiry payoff when no time remains", () => {
    const legs = buildPreset("bull-call-spread", { spot: 100, width: 5, volatility: 0.25, timeToExpiry: 0.25, rate: 0.04 });
    expect(payoffToday(legs, 112, market, 0.25)).toBeCloseTo(payoffAtExpiry(legs, 112), 8);
  });
  it("priced presets have ~zero P&L at inception", () => {
    for (const { id } of STRATEGY_PRESETS) {
      const legs = buildPreset(id, { spot: 100, width: 5, volatility: 0.3, timeToExpiry: 0.5, rate: 0.04 });
      expect(Math.abs(payoffToday(legs, 100, market))).toBeLessThan(1e-6);
    }
  });
  it("aggregates Greeks: straddle is delta-neutral-ish and long gamma/vega", () => {
    const legs = buildPreset("long-straddle", { spot: 100, width: 5, volatility: 0.3, timeToExpiry: 0.5, rate: 0.0 });
    const g = strategyGreeks(legs, 100, { rate: 0 });
    expect(Math.abs(g.delta)).toBeLessThan(20);
    expect(g.gamma).toBeGreaterThan(0);
    expect(g.vega).toBeGreaterThan(0);
    expect(g.theta).toBeLessThan(0);
    const stockOnly = strategyGreeks([leg({ kind: "stock", side: "long", quantity: 100, premium: 100, multiplier: 1 })], 100, market);
    expect(stockOnly.delta).toBe(100);
  });
  it("butterfly preset uses 2× short body", () => {
    const legs = buildPreset("long-butterfly", { spot: 100, width: 5, volatility: 0.3, timeToExpiry: 0.5, rate: 0.04, contracts: 3 });
    expect(legs.map((l) => l.quantity)).toEqual([3, 6, 3]);
    expect(payoffProfile(legs).maxLoss).toBeGreaterThan(-Infinity);
  });
});
