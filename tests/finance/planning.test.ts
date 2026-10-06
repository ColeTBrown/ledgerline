import { describe, expect, it } from "vitest";
import { projectRetirement, type RetirementInputs } from "@/lib/finance/retirement";
import { lognormalParams, runMonteCarlo, type MonteCarloInputs } from "@/lib/finance/montecarlo";
import { mulberry32, normalGenerator } from "@/lib/finance/rng";
import { mean, stdev } from "@/lib/finance/stats";
import { FinanceInputError } from "@/lib/finance/errors";

describe("retirement projection", () => {
  const small: RetirementInputs = {
    currentAge: 60,
    retirementAge: 62,
    planToAge: 64,
    currentSavings: 100000,
    annualContribution: 10000,
    contributionGrowth: 0,
    preRetirementReturn: 0.05,
    postRetirementReturn: 0.04,
    inflation: 0.02,
    desiredIncome: 30000,
    otherIncome: 10000,
  };
  it("matches a hand-computed schedule", () => {
    const r = projectRetirement(small);
    expect(r.balanceAtRetirement).toBeCloseTo(130750, 8);
    expect(r.requiredAtRetirement).toBeCloseTo(41215.846153846, 6);
    expect(r.years[2]!.endBalance).toBeCloseTo(114339.68, 6);
    expect(r.years[3]!.endBalance).toBeCloseTo(96840.1408, 6);
    expect(r.shortfall).toBe(0);
    expect(r.depletionAge).toBeNull();
    expect(r.firstYearWithdrawal).toBeCloseTo(20000 * 1.02 ** 2, 8);
  });
  it("reports shortfall, depletion age and the savings needed to close the gap", () => {
    const r = projectRetirement({ ...small, desiredIncome: 120000 });
    expect(r.shortfall).toBeGreaterThan(0);
    expect(r.depletionAge).not.toBeNull();
    // Saving the extra amount each year should exactly fund the requirement.
    const fixed = projectRetirement({ ...small, desiredIncome: 120000, annualContribution: 10000 + r.additionalAnnualSavingsNeeded });
    expect(fixed.balanceAtRetirement).toBeCloseTo(r.requiredAtRetirement, 4);
  });
  it("validates ages", () => {
    expect(() => projectRetirement({ ...small, retirementAge: 70, planToAge: 65 })).toThrow(FinanceInputError);
  });
});

describe("seeded RNG", () => {
  it("is deterministic and produces standard normals", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const z = normalGenerator(mulberry32(1));
    const xs = Array.from({ length: 50000 }, z);
    expect(mean(xs)).toBeCloseTo(0, 1);
    expect(stdev(xs)).toBeCloseTo(1, 1);
  });
});

describe("Monte Carlo", () => {
  const base: MonteCarloInputs = {
    initialBalance: 500000,
    annualContribution: 20000,
    contributionGrowth: 0.02,
    yearsToRetirement: 10,
    yearsInRetirement: 25,
    annualWithdrawal: 40000,
    expectedReturn: 0.06,
    volatility: 0.12,
    inflation: 0.025,
    simulations: 2000,
    seed: 123,
  };
  it("lognormal parameters reproduce the arithmetic mean and sd", () => {
    const { mu, sigma } = lognormalParams(0.07, 0.15);
    const m = Math.exp(mu + sigma * sigma / 2) - 1;
    const v = (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma);
    expect(m).toBeCloseTo(0.07, 12);
    expect(Math.sqrt(v)).toBeCloseTo(0.15, 12);
  });
  it("is reproducible for a given seed", () => {
    const a = runMonteCarlo(base);
    const b = runMonteCarlo(base);
    expect(a.successProbability).toBe(b.successProbability);
    expect(a.years[10]!.p50).toBe(b.years[10]!.p50);
  });
  it("produces ordered percentile bands and consistent survival", () => {
    const r = runMonteCarlo(base);
    expect(r.years).toHaveLength(35);
    for (const y of r.years) {
      expect(y.p5).toBeLessThanOrEqual(y.p25);
      expect(y.p25).toBeLessThanOrEqual(y.p50);
      expect(y.p50).toBeLessThanOrEqual(y.p75);
      expect(y.p75).toBeLessThanOrEqual(y.p95);
    }
    expect(r.years[r.years.length - 1]!.survival).toBeCloseTo(r.successProbability, 12);
    expect(r.failuresByYear.reduce((s, x) => s + x, 0)).toBe(Math.round((1 - r.successProbability) * base.simulations));
  });
  it("zero volatility matches the deterministic path", () => {
    const r = runMonteCarlo({ ...base, volatility: 0, simulations: 100 });
    let b = base.initialBalance;
    for (let y = 0; y < 10; y++) b = b * 1.06 + 20000 * 1.02 ** y;
    expect(r.years[9]!.p50).toBeCloseTo(b, 6);
    expect(r.years[9]!.p5).toBeCloseTo(b, 6);
  });
  it("success probability falls as withdrawals rise", () => {
    const low = runMonteCarlo({ ...base, annualWithdrawal: 30000 }).successProbability;
    const high = runMonteCarlo({ ...base, annualWithdrawal: 90000 }).successProbability;
    expect(low).toBeGreaterThan(high);
    expect(runMonteCarlo({ ...base, annualWithdrawal: 0 }).successProbability).toBe(1);
  });
  it("validates the simulation count", () => {
    expect(() => runMonteCarlo({ ...base, simulations: 50 })).toThrow(FinanceInputError);
    expect(() => runMonteCarlo({ ...base, simulations: 20000 })).toThrow(FinanceInputError);
  });
});
