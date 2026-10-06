import { describe, expect, it } from "vitest";
import { bondEquivalentToContinuous, discountFactor, interpolateYield, tenorToYears } from "@/lib/finance/rates";
import { FinanceInputError } from "@/lib/finance/errors";

const curve = [
  { tenorYears: 10, yield: 0.042 },
  { tenorYears: 0.25, yield: 0.05 },
  { tenorYears: 2, yield: 0.045 },
  { tenorYears: 5, yield: Number.NaN },
];

describe("yield curve", () => {
  it("parses tenors", () => {
    expect(tenorToYears("3M")).toBe(0.25);
    expect(tenorToYears("10Y")).toBe(10);
    expect(() => tenorToYears("10D")).toThrow(FinanceInputError);
  });
  it("interpolates linearly, ignores bad points and extrapolates flat", () => {
    expect(interpolateYield(curve, 2)).toBeCloseTo(0.045, 12);
    expect(interpolateYield(curve, 6)).toBeCloseTo(0.045 + (4 / 8) * (0.042 - 0.045), 12);
    expect(interpolateYield(curve, 0.01)).toBe(0.05);
    expect(interpolateYield(curve, 30)).toBe(0.042);
    expect(interpolateYield([], 5)).toBeNull();
  });
  it("converts compounding conventions", () => {
    expect(bondEquivalentToContinuous(0.05)).toBeCloseTo(2 * Math.log(1.025), 12);
    expect(discountFactor(0.05, 2)).toBeCloseTo(Math.exp(-0.1), 12);
  });
});
