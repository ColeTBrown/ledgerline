import { describe, expect, it } from "vitest";
import {
  discountedPaybackPeriod,
  equivalentAnnualAnnuity,
  irr,
  irrAll,
  mirr,
  npv,
  npvT0,
  paybackPeriod,
  profitabilityIndex,
  xirr,
  xnpv,
} from "@/lib/finance/cashflow";
import { FinanceInputError } from "@/lib/finance/errors";

// Expected values are the documented results of the equivalent Excel functions.
describe("NPV (Excel convention, first flow at t=1)", () => {
  it("matches Excel", () => {
    expect(npv(0.1, [-10000, 3000, 4200, 6800])).toBeCloseTo(1188.44, 2);
    expect(npv(0.08, [8000, 9200, 10000, 12000, 14500]) - 40000).toBeCloseTo(1922.06, 2);
    expect(npv(0.08, [8000, 9200, 10000, 12000, 14500, -9000]) - 40000).toBeCloseTo(-3749.47, 2);
  });
  it("handles zero rate and rejects empty input", () => {
    expect(npv(0, [1, 2, 3])).toBe(6);
    expect(() => npv(0.1, [])).toThrow(FinanceInputError);
    expect(() => npv(0.1, [1, Number.NaN])).toThrow(FinanceInputError);
  });
});

describe("npvT0", () => {
  it("does not discount the first flow", () => {
    expect(npvT0(0.1, [-1000, 1100])).toBeCloseTo(0, 10);
    expect(npvT0(0.1, [-1000])).toBe(-1000);
  });
});

describe("IRR", () => {
  const flows = [-70000, 12000, 15000, 18000, 21000, 26000];
  it("matches Excel", () => {
    expect(irr(flows.slice(0, 5))).toBeCloseTo(-0.021245, 5);
    expect(irr(flows)).toBeCloseTo(0.086631, 5);
    expect(irr(flows.slice(0, 3), -0.1)).toBeCloseTo(-0.443507, 5);
  });
  it("returns null when there is no sign change", () => {
    expect(irr([100, 200, 300])).toBeNull();
    expect(irr([-100, -200])).toBeNull();
  });
  it("returns null when no real root exists", () => {
    // NPV(r) = -100 + 50/(1+r) - 100/(1+r)^2 < 0 for every r > -1.
    expect(irr([-100, 50, -100])).toBeNull();
  });
  it("finds every root of non-conventional flows", () => {
    // Roots at 10% and 20%: -1 + 2.3/(1+r) - 1.32/(1+r)^2 = 0.
    const roots = irrAll([-1, 2.3, -1.32]);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(0.1, 8);
    expect(roots[1]).toBeCloseTo(0.2, 8);
  });
  it("handles very high returns", () => {
    expect(irr([-1, 5])).toBeCloseTo(4, 8);
  });
});

describe("MIRR", () => {
  const flows = [-120000, 39000, 30000, 21000, 37000, 46000];
  it("matches Excel", () => {
    expect(mirr(flows, 0.1, 0.12)).toBeCloseTo(0.126094, 6);
    expect(mirr(flows.slice(0, 4), 0.1, 0.12)).toBeCloseTo(-0.048045, 5);
    expect(mirr(flows, 0.1, 0.14)).toBeCloseTo(0.13476, 5);
  });
  it("returns null without both positive and negative flows", () => {
    expect(mirr([100, 200], 0.1, 0.1)).toBeNull();
  });
});

describe("XNPV / XIRR", () => {
  const values = [-10000, 2750, 4250, 3250, 2750];
  const dates = ["2008-01-01", "2008-03-01", "2008-10-30", "2009-02-15", "2009-04-01"];
  it("matches Excel", () => {
    expect(xnpv(0.09, values, dates)).toBeCloseTo(2086.647602, 5);
    expect(xirr(values, dates)).toBeCloseTo(0.373362535, 8);
  });
  it("validates dates", () => {
    expect(() => xnpv(0.1, values, dates.slice(1))).toThrow(FinanceInputError);
    expect(() => xnpv(0.1, [1, 2], ["2020-01-01", "nope"])).toThrow(FinanceInputError);
  });
});

describe("payback", () => {
  it("interpolates within the recovery year", () => {
    expect(paybackPeriod([-1000, 300, 400, 500])).toBeCloseTo(2.6, 10);
    expect(paybackPeriod([-1000, 1000])).toBe(1);
  });
  it("returns null if never recovered", () => {
    expect(paybackPeriod([-1000, 100, 100])).toBeNull();
  });
  it("discounted payback is longer than simple payback", () => {
    const flows = [-1000, 500, 500, 500];
    // Discounted at 10%: 454.55 + 413.22 leaves 132.23 to recover from 375.66 in year 3.
    const dpb = discountedPaybackPeriod(0.1, flows)!;
    expect(dpb).toBeCloseTo(2 + (1000 - 500 / 1.1 - 500 / 1.21) / (500 / 1.331), 10);
    expect(dpb).toBeGreaterThan(paybackPeriod(flows)!);
  });
  it("discounted payback is null when discounting prevents recovery", () => {
    // Simple payback is 2.6 years, but discounted flows sum to only 978.97.
    expect(discountedPaybackPeriod(0.1, [-1000, 300, 400, 500])).toBeNull();
  });
});

describe("profitability index & EAA", () => {
  it("computes PI = PV(future flows) / outlay", () => {
    expect(profitabilityIndex(0.1, [-1000, 1100])).toBeCloseTo(1, 10);
    expect(profitabilityIndex(0.1, [-10000, 3000, 4200, 6800])).toBeCloseTo((npv(0.1, [3000, 4200, 6800])) / 10000, 10);
    expect(() => profitabilityIndex(0.1, [1000, 100])).toThrow(FinanceInputError);
  });
  it("converts NPV to a level annuity", () => {
    const flows = [-1000, 600, 600];
    const eaa = equivalentAnnualAnnuity(0.1, flows);
    expect(npvT0(0.1, [0, eaa, eaa])).toBeCloseTo(npvT0(0.1, flows), 10);
  });
});
