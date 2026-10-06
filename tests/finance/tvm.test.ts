import { describe, expect, it } from "vitest";
import {
  continuousToEffective,
  effectiveAnnualRate,
  fv,
  ipmt,
  nominalRate,
  nper,
  pmt,
  ppmt,
  pv,
  rate,
  solveTvm,
} from "@/lib/finance/tvm";
import { FinanceInputError } from "@/lib/finance/errors";

// Expected values are the documented results of the equivalent Excel functions.
describe("PMT", () => {
  it("matches Excel", () => {
    expect(pmt(0.08 / 12, 10, 10000)).toBeCloseTo(-1037.03, 2);
    expect(pmt(0.08 / 12, 10, 10000, 0, 1)).toBeCloseTo(-1030.16, 2);
    expect(pmt(0.06 / 12, 18 * 12, 0, 50000)).toBeCloseTo(-129.08, 2);
  });
  it("handles a zero rate", () => {
    expect(pmt(0, 10, 1000)).toBeCloseTo(-100, 10);
  });
  it("rejects zero periods", () => {
    expect(() => pmt(0.05, 0, 1000)).toThrow(FinanceInputError);
  });
});

describe("FV", () => {
  it("matches Excel", () => {
    expect(fv(0.06 / 12, 10, -200, -500, 1)).toBeCloseTo(2581.4, 2);
    expect(fv(0.12 / 12, 12, -1000)).toBeCloseTo(12682.5, 2);
    expect(fv(0.11 / 12, 35, -2000, 0, 1)).toBeCloseTo(82846.25, 2);
  });
  it("handles zero and negative rates", () => {
    expect(fv(0, 10, -100, -1000)).toBeCloseTo(2000, 10);
    expect(fv(-0.02, 5, 0, -1000)).toBeCloseTo(1000 * Math.pow(0.98, 5), 8);
  });
  it("rejects rates of -100% or below", () => {
    expect(() => fv(-1, 5, 0, -1000)).toThrow(FinanceInputError);
  });
});

describe("PV", () => {
  it("matches Excel", () => {
    expect(pv(0.08 / 12, 12 * 20, 500)).toBeCloseTo(-59777.15, 2);
  });
  it("is the inverse of FV", () => {
    const value = fv(0.07, 12, -250, -4000, 1);
    expect(pv(0.07, 12, -250, value, 1)).toBeCloseTo(-4000, 8);
  });
});

describe("NPER", () => {
  it("matches Excel", () => {
    expect(nper(0.12 / 12, -100, -1000, 10000, 1)).toBeCloseTo(59.6738657, 6);
    expect(nper(0.12 / 12, -100, -1000, 10000)).toBeCloseTo(60.0821229, 6);
    expect(nper(0.12 / 12, -100, -1000)).toBeCloseTo(-9.57859404, 6);
  });
  it("returns null when the payment never amortizes the balance", () => {
    // Interest on 100,000 at 1%/month is 1,000 — a 500 payment never repays it.
    expect(nper(0.01, -500, 100000)).toBeNull();
  });
  it("handles zero rate and zero payment", () => {
    expect(nper(0, -100, 1000)).toBeCloseTo(10, 10);
    expect(nper(0, 0, 1000)).toBeNull();
  });
});

describe("RATE", () => {
  it("matches Excel", () => {
    expect(rate(4 * 12, -200, 8000)).toBeCloseTo(0.0077014724, 9);
    expect(rate(10, -1000, 7000)).toBeCloseTo(0.0707, 4);
  });
  it("finds negative rates", () => {
    // 1000 grows to 900 over 5 periods.
    expect(rate(5, 0, -1000, 900)).toBeCloseTo(Math.pow(0.9, 1 / 5) - 1, 9);
  });
  it("returns null when no rate exists", () => {
    // Paying out more than you ever receive, with nothing coming back.
    expect(rate(10, -100, -1000, 0)).toBeNull();
  });
});

describe("IPMT / PPMT", () => {
  it("matches Excel", () => {
    expect(ipmt(0.1 / 12, 1, 36, 8000)).toBeCloseTo(-66.67, 2);
    expect(ipmt(0.1, 3, 3, 8000)).toBeCloseTo(-292.45, 2);
    expect(ppmt(0.1 / 12, 1, 24, 2000)).toBeCloseTo(-75.62, 2);
    expect(ppmt(0.08, 10, 10, 200000)).toBeCloseTo(-27598.05, 2);
  });
  it("sums to PMT and has zero first-period interest for annuity due", () => {
    const r = 0.05 / 12;
    for (const per of [1, 7, 60]) {
      expect(ipmt(r, per, 60, 25000) + ppmt(r, per, 60, 25000)).toBeCloseTo(pmt(r, 60, 25000), 10);
    }
    expect(ipmt(r, 1, 60, 25000, 0, 1)).toBe(0);
  });
  it("principal portions repay the loan", () => {
    let total = 0;
    for (let p = 1; p <= 24; p++) total += ppmt(0.01, p, 24, 10000);
    expect(total).toBeCloseTo(-10000, 8);
  });
});

describe("rate conversions", () => {
  it("matches Excel EFFECT / NOMINAL", () => {
    expect(effectiveAnnualRate(0.0525, 4)).toBeCloseTo(0.053542667, 9);
    expect(nominalRate(0.053543, 4)).toBeCloseTo(0.05250032, 8);
  });
  it("converts continuous compounding", () => {
    expect(continuousToEffective(0.05)).toBeCloseTo(Math.exp(0.05) - 1, 12);
  });
});

describe("solveTvm", () => {
  it("round-trips every variable", () => {
    const base = { rate: 0.045 / 12, nper: 360, pv: 400000, fv: 0, type: 0 as const, pmt: 0 };
    const payment = solveTvm("pmt", base)!;
    const inputs = { ...base, pmt: payment };
    expect(solveTvm("pv", inputs)).toBeCloseTo(400000, 6);
    expect(solveTvm("nper", inputs)).toBeCloseTo(360, 6);
    expect(solveTvm("rate", inputs)).toBeCloseTo(0.045 / 12, 10);
    expect(solveTvm("fv", inputs)).toBeCloseTo(0, 4);
  });
  it("is numerically stable for very small rates and very large inputs", () => {
    expect(pmt(1e-12, 360, 400000)).toBeCloseTo(-400000 / 360, 4);
    expect(fv(0.05, 100, 0, -1e12)).toBeCloseTo(1e12 * Math.pow(1.05, 100), -6);
  });
});
