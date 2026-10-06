import { describe, expect, it } from "vitest";
import { bondPrice, bondRisk, currentYield, effectiveRisk, rateShock, yieldToCall, yieldToMaturity } from "@/lib/finance/bonds";
import { FinanceInputError } from "@/lib/finance/errors";

// Textbook references: Fabozzi, "Bond Markets, Analysis and Strategies".
describe("bondPrice", () => {
  it("matches textbook prices on a coupon date", () => {
    expect(bondPrice({ face: 100, couponRate: 0.1, yearsToMaturity: 20 }, 0.11).cleanPrice).toBeCloseTo(91.97694, 5);
    expect(bondPrice({ face: 1000, couponRate: 0.08, yearsToMaturity: 10 }, 0.1).cleanPrice).toBeCloseTo(875.38, 2);
  });
  it("prices at par when coupon equals yield", () => {
    expect(bondPrice({ face: 100, couponRate: 0.05, yearsToMaturity: 7 }, 0.05).cleanPrice).toBeCloseTo(100, 10);
    expect(bondPrice({ face: 100, couponRate: 0.05, yearsToMaturity: 7, frequency: 4 }, 0.05).cleanPrice).toBeCloseTo(100, 10);
  });
  it("prices a zero-coupon bond", () => {
    expect(bondPrice({ face: 100, couponRate: 0, yearsToMaturity: 10 }, 0.04).cleanPrice).toBeCloseTo(100 / Math.pow(1.02, 20), 10);
  });
  it("handles settlement between coupons with accrued interest", () => {
    const p = bondPrice({ face: 100, couponRate: 0.06, yearsToMaturity: 2.25 }, 0.05);
    expect(p.periodsRemaining).toBe(5);
    expect(p.accruedInterest).toBeCloseTo(1.5, 10);
    expect(p.dirtyPrice).toBeCloseTo(103.594055088, 8);
    expect(p.cleanPrice).toBeCloseTo(102.094055088, 8);
  });
  it("validates inputs", () => {
    expect(() => bondPrice({ face: 0, couponRate: 0.05, yearsToMaturity: 5 }, 0.05)).toThrow(FinanceInputError);
    expect(() => bondPrice({ face: 100, couponRate: -0.01, yearsToMaturity: 5 }, 0.05)).toThrow(FinanceInputError);
    expect(() => bondPrice({ face: 100, couponRate: 0.05, yearsToMaturity: 5 }, -2.5)).toThrow(FinanceInputError);
  });
});

describe("yields", () => {
  it("YTM inverts the price function", () => {
    const bond = { face: 100, couponRate: 0.1, yearsToMaturity: 20 } as const;
    expect(yieldToMaturity(bond, 91.977)).toBeCloseTo(0.11, 6);
    expect(yieldToMaturity({ face: 100, couponRate: 0.06, yearsToMaturity: 2.25 }, 102.094055088)).toBeCloseTo(0.05, 8);
  });
  it("solves negative yields", () => {
    const bond = { face: 100, couponRate: 0, yearsToMaturity: 5 } as const;
    const price = bondPrice(bond, -0.005).cleanPrice;
    expect(price).toBeGreaterThan(100);
    expect(yieldToMaturity(bond, price)).toBeCloseTo(-0.005, 8);
  });
  it("computes yield to call and current yield", () => {
    // 10-year 8% bond priced at 110, callable at 104 in 5 years.
    const ytc = yieldToCall({ face: 100, couponRate: 0.08 }, 110, 5, 104)!;
    expect(bondPrice({ face: 100, couponRate: 0.08, yearsToMaturity: 5, redemption: 104 }, ytc).cleanPrice).toBeCloseTo(110, 8);
    expect(ytc).toBeLessThan(yieldToMaturity({ face: 100, couponRate: 0.08, yearsToMaturity: 10 }, 110)!);
    expect(currentYield({ face: 100, couponRate: 0.08 }, 110)).toBeCloseTo(0.0727273, 6);
  });
});

describe("duration and convexity", () => {
  const bond = { face: 100, couponRate: 0.09, yearsToMaturity: 5 } as const;
  it("matches textbook Macaulay and modified duration", () => {
    const r = bondRisk(bond, 0.09);
    expect(r.macaulayDuration).toBeCloseTo(4.1344, 4);
    expect(r.modifiedDuration).toBeCloseTo(3.9564, 4);
    expect(r.convexity).toBeCloseTo(19.4526, 4);
    expect(r.dv01).toBeCloseTo(3.9564 * 100 * 1e-4, 5);
  });
  it("zero-coupon Macaulay duration equals maturity, convexity is closed-form", () => {
    const r = bondRisk({ face: 100, couponRate: 0, yearsToMaturity: 10 }, 0.06);
    expect(r.macaulayDuration).toBeCloseTo(10, 10);
    expect(r.convexity).toBeCloseTo((10 * 10.5) / 1.03 ** 2, 8);
  });
  it("analytic measures agree with effective (bumped) measures", () => {
    const a = bondRisk(bond, 0.07);
    const e = effectiveRisk(bond, 0.07);
    expect(e.duration).toBeCloseTo(a.modifiedDuration, 5);
    expect(e.convexity).toBeCloseTo(a.convexity, 2);
  });
  it("duration + convexity beats duration alone for a rate shock", () => {
    const s = rateShock({ face: 100, couponRate: 0.06, yearsToMaturity: 30 }, 0.06, 0.02);
    expect(s.actualPrice).toBeLessThan(s.basePrice);
    expect(Math.abs(s.estimationError)).toBeLessThan(Math.abs(s.basePrice + s.durationEstimate - s.actualPrice));
  });
});
