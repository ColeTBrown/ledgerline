/**
 * Loan amortization with optional recurring and one-off extra principal payments.
 */
import { FinanceInputError, assertNonNegative, assertPositive, assertPositiveInteger } from "./errors";
import { pmt } from "./tvm";

export interface AmortizationInputs {
  principal: number;
  /** Nominal annual rate (decimal). */
  annualRate: number;
  /** Number of scheduled payments. */
  numberOfPayments: number;
  /** Payments per year (12 = monthly). */
  periodsPerYear?: number;
  /** Recurring extra principal paid each period from `extraStartPeriod`. */
  extraPayment?: number;
  extraStartPeriod?: number;
  /** One-off extra principal payments. */
  lumpSums?: ReadonlyArray<{ period: number; amount: number }>;
}

export interface AmortizationRow {
  period: number;
  beginningBalance: number;
  /** Scheduled payment actually applied (smaller in the final period). */
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  endingBalance: number;
  cumulativeInterest: number;
}

export interface AmortizationResult {
  /** Level scheduled payment (positive number). */
  scheduledPayment: number;
  rows: AmortizationRow[];
  totalInterest: number;
  totalPaid: number;
  /** Periods until the balance reaches zero. */
  payoffPeriods: number;
  /** Totals without any extra payments, for comparison. */
  baselineTotalInterest: number;
  interestSaved: number;
  periodsSaved: number;
}

/**
 * Build a full amortization schedule. Each period:
 *   interest  = balance · (annualRate / periodsPerYear)
 *   principal = payment − interest
 *   balance  −= principal + extra
 * The final payment is reduced so the balance ends at exactly zero.
 */
export function amortizationSchedule(inputs: AmortizationInputs): AmortizationResult {
  const {
    principal,
    annualRate,
    numberOfPayments,
    periodsPerYear = 12,
    extraPayment = 0,
    extraStartPeriod = 1,
    lumpSums = [],
  } = inputs;
  assertPositive(principal, "principal");
  assertNonNegative(annualRate, "annualRate");
  assertPositiveInteger(numberOfPayments, "numberOfPayments");
  assertPositiveInteger(periodsPerYear, "periodsPerYear");
  assertNonNegative(extraPayment, "extraPayment");
  if (numberOfPayments > 1200) throw new FinanceInputError("Schedules are limited to 1,200 payments.", "numberOfPayments");
  for (const l of lumpSums) assertNonNegative(l.amount, "lumpSums");

  const r = annualRate / periodsPerYear;
  const scheduledPayment = -pmt(r, numberOfPayments, principal);
  const lumpByPeriod = new Map<number, number>();
  for (const l of lumpSums) lumpByPeriod.set(l.period, (lumpByPeriod.get(l.period) ?? 0) + l.amount);

  const rows: AmortizationRow[] = [];
  let balance = principal;
  let cumulativeInterest = 0;
  const epsilon = 1e-9 * principal;

  for (let period = 1; period <= numberOfPayments && balance > epsilon; period++) {
    const interest = balance * r;
    const payment = Math.min(scheduledPayment, balance + interest);
    const principalPart = payment - interest;
    const afterScheduled = balance - principalPart;
    const desiredExtra = (period >= extraStartPeriod ? extraPayment : 0) + (lumpByPeriod.get(period) ?? 0);
    const extra = Math.min(desiredExtra, Math.max(0, afterScheduled));
    const ending = afterScheduled - extra;
    cumulativeInterest += interest;
    rows.push({
      period,
      beginningBalance: balance,
      payment,
      interest,
      principal: principalPart,
      extra,
      endingBalance: Math.abs(ending) < epsilon ? 0 : ending,
      cumulativeInterest,
    });
    balance = ending;
  }

  const totalInterest = cumulativeInterest;
  const totalPaid = rows.reduce((s, row) => s + row.payment + row.extra, 0);
  const baselineTotalInterest = scheduledPayment * numberOfPayments - principal;
  return {
    scheduledPayment,
    rows,
    totalInterest,
    totalPaid,
    payoffPeriods: rows.length,
    baselineTotalInterest,
    interestSaved: baselineTotalInterest - totalInterest,
    periodsSaved: numberOfPayments - rows.length,
  };
}
