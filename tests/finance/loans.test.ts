import { describe, expect, it } from "vitest";
import { amortizationSchedule } from "@/lib/finance/loans";
import { FinanceInputError } from "@/lib/finance/errors";

describe("amortizationSchedule", () => {
  it("builds a standard 30-year mortgage schedule", () => {
    const r = amortizationSchedule({ principal: 300000, annualRate: 0.065, numberOfPayments: 360 });
    expect(r.scheduledPayment).toBeCloseTo(1896.2, 2);
    expect(r.rows).toHaveLength(360);
    expect(r.rows[0]!.interest).toBeCloseTo(1625, 6);
    expect(r.rows[359]!.endingBalance).toBe(0);
    expect(r.totalInterest).toBeCloseTo(1896.2041 * 360 - 300000, 0);
    expect(r.interestSaved).toBeCloseTo(0, 4);
    const principalPaid = r.rows.reduce((s, row) => s + row.principal + row.extra, 0);
    expect(principalPaid).toBeCloseTo(300000, 6);
  });
  it("extra payments shorten the loan and save interest", () => {
    const base = { principal: 300000, annualRate: 0.065, numberOfPayments: 360 };
    const r = amortizationSchedule({ ...base, extraPayment: 200, lumpSums: [{ period: 12, amount: 10000 }] });
    expect(r.payoffPeriods).toBeLessThan(360);
    expect(r.periodsSaved).toBe(360 - r.payoffPeriods);
    expect(r.interestSaved).toBeGreaterThan(50000);
    expect(r.rows[11]!.extra).toBeCloseTo(10200, 6);
    expect(r.rows[r.rows.length - 1]!.endingBalance).toBe(0);
    for (const row of r.rows) expect(row.endingBalance).toBeGreaterThanOrEqual(0);
  });
  it("extra payments start at the configured period", () => {
    const r = amortizationSchedule({ principal: 10000, annualRate: 0.05, numberOfPayments: 24, extraPayment: 100, extraStartPeriod: 6 });
    expect(r.rows[4]!.extra).toBe(0);
    expect(r.rows[5]!.extra).toBe(100);
  });
  it("handles zero interest", () => {
    const r = amortizationSchedule({ principal: 1200, annualRate: 0, numberOfPayments: 12 });
    expect(r.scheduledPayment).toBeCloseTo(100, 10);
    expect(r.totalInterest).toBe(0);
  });
  it("validates inputs", () => {
    expect(() => amortizationSchedule({ principal: -1, annualRate: 0.05, numberOfPayments: 12 })).toThrow(FinanceInputError);
    expect(() => amortizationSchedule({ principal: 1000, annualRate: 0.05, numberOfPayments: 12.5 })).toThrow(FinanceInputError);
  });
});
