/**
 * Time value of money, following Excel / financial-calculator conventions.
 *
 * All functions satisfy the TVM identity (cash paid out is negative):
 *
 *   PV·(1+r)^n + PMT·(1 + r·type)·((1+r)^n − 1)/r + FV = 0      (r ≠ 0)
 *   PV + PMT·n + FV = 0                                          (r = 0)
 *
 * where `type` = 0 for payments at period end (ordinary annuity) and
 * 1 for payments at period start (annuity due). `rate` is per period.
 */
import { FinanceInputError, assertFinite, assertRate } from "./errors";
import { solveRobust } from "./solvers";

export type PaymentTiming = 0 | 1;

function annuityFactor(rate: number, nper: number): number {
  // ((1+r)^n − 1)/r, computed stably for small r via expm1/log1p.
  return rate === 0 ? nper : Math.expm1(nper * Math.log1p(rate)) / rate;
}

function growth(rate: number, nper: number): number {
  return Math.exp(nper * Math.log1p(rate));
}

/**
 * Future value. Excel: `FV(rate, nper, pmt, [pv], [type])`.
 * FV = −[PV·(1+r)^n + PMT·(1+r·type)·((1+r)^n − 1)/r]
 */
export function fv(rate: number, nper: number, pmt: number, pv = 0, type: PaymentTiming = 0): number {
  assertRate(rate, "rate");
  assertFinite(nper, "nper");
  assertFinite(pmt, "pmt");
  assertFinite(pv, "pv");
  return -(pv * growth(rate, nper) + pmt * (1 + rate * type) * annuityFactor(rate, nper));
}

/**
 * Present value. Excel: `PV(rate, nper, pmt, [fv], [type])`.
 * PV = −[FV + PMT·(1+r·type)·((1+r)^n − 1)/r] / (1+r)^n
 */
export function pv(rate: number, nper: number, pmt: number, fvValue = 0, type: PaymentTiming = 0): number {
  assertRate(rate, "rate");
  assertFinite(nper, "nper");
  assertFinite(pmt, "pmt");
  assertFinite(fvValue, "fv");
  return -(fvValue + pmt * (1 + rate * type) * annuityFactor(rate, nper)) / growth(rate, nper);
}

/**
 * Periodic payment. Excel: `PMT(rate, nper, pv, [fv], [type])`.
 * PMT = −[PV·(1+r)^n + FV] · r / [(1+r·type)·((1+r)^n − 1)]
 */
export function pmt(rate: number, nper: number, pvValue: number, fvValue = 0, type: PaymentTiming = 0): number {
  assertRate(rate, "rate");
  assertFinite(nper, "nper");
  assertFinite(pvValue, "pv");
  assertFinite(fvValue, "fv");
  if (nper === 0) throw new FinanceInputError("Number of periods cannot be zero.", "nper");
  return -(pvValue * growth(rate, nper) + fvValue) / ((1 + rate * type) * annuityFactor(rate, nper));
}

/**
 * Number of periods. Excel: `NPER(rate, pmt, pv, [fv], [type])`.
 * n = ln[(PMT·(1+r·type) − FV·r) / (PMT·(1+r·type) + PV·r)] / ln(1+r)
 * Returns null when no number of periods satisfies the identity
 * (e.g. payments too small to ever repay the loan).
 */
export function nper(rate: number, pmtValue: number, pvValue: number, fvValue = 0, type: PaymentTiming = 0): number | null {
  assertRate(rate, "rate");
  assertFinite(pmtValue, "pmt");
  assertFinite(pvValue, "pv");
  assertFinite(fvValue, "fv");
  if (rate === 0) {
    if (pmtValue === 0) return null;
    return -(pvValue + fvValue) / pmtValue;
  }
  const adj = pmtValue * (1 + rate * type);
  const num = adj - fvValue * rate;
  const den = adj + pvValue * rate;
  if (den === 0 || num / den <= 0) return null;
  const n = Math.log(num / den) / Math.log1p(rate);
  return Number.isFinite(n) ? n : null;
}

/**
 * Interest rate per period. Excel: `RATE(nper, pmt, pv, [fv], [type], [guess])`.
 * Solved numerically (Newton, then Brent over a bracket scan). Returns null
 * when no rate > −100% satisfies the identity.
 */
export function rate(
  nperValue: number,
  pmtValue: number,
  pvValue: number,
  fvValue = 0,
  type: PaymentTiming = 0,
  guess = 0.1,
): number | null {
  assertFinite(nperValue, "nper");
  assertFinite(pmtValue, "pmt");
  assertFinite(pvValue, "pv");
  assertFinite(fvValue, "fv");
  if (nperValue <= 0) throw new FinanceInputError("Number of periods must be greater than zero.", "nper");

  const f = (r: number) => pvValue * growth(r, nperValue) + pmtValue * (1 + r * type) * annuityFactor(r, nperValue) + fvValue;
  const h = 1e-7;
  const df = (r: number) => (f(r + h) - f(r - h)) / (2 * h);
  const grid = [-0.99, -0.9, -0.75, -0.5, -0.25, -0.1, -0.05, -0.01, 0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
  const r = solveRobust(f, df, guess, grid, { tolerance: 1e-9 });
  return r !== null && r > -1 ? r : null;
}

/**
 * Interest portion of payment number `per` (1-based). Excel: `IPMT`.
 * For type 0: IPMT = FV(r, per−1, PMT, PV, 0) · r.
 * For type 1: IPMT = 0 for per = 1, else (FV(r, per−2, PMT, PV, 1) − PMT) · r.
 */
export function ipmt(rateValue: number, per: number, nperValue: number, pvValue: number, fvValue = 0, type: PaymentTiming = 0): number {
  if (per < 1 || per > nperValue) throw new FinanceInputError("Period must be between 1 and the number of periods.", "per");
  const payment = pmt(rateValue, nperValue, pvValue, fvValue, type);
  if (type === 1) {
    if (per === 1) return 0;
    return (fv(rateValue, per - 2, payment, pvValue, 1) - payment) * rateValue;
  }
  return fv(rateValue, per - 1, payment, pvValue, 0) * rateValue;
}

/** Principal portion of payment number `per`. Excel: `PPMT` = PMT − IPMT. */
export function ppmt(rateValue: number, per: number, nperValue: number, pvValue: number, fvValue = 0, type: PaymentTiming = 0): number {
  return pmt(rateValue, nperValue, pvValue, fvValue, type) - ipmt(rateValue, per, nperValue, pvValue, fvValue, type);
}

/** Effective annual rate from a nominal rate compounded m times a year: (1 + i/m)^m − 1. Excel: `EFFECT`. */
export function effectiveAnnualRate(nominal: number, periodsPerYear: number): number {
  assertFinite(nominal, "nominal");
  if (periodsPerYear <= 0) throw new FinanceInputError("Compounding periods must be positive.", "periodsPerYear");
  return Math.expm1(periodsPerYear * Math.log1p(nominal / periodsPerYear));
}

/** Nominal annual rate from an effective rate: m·((1 + EAR)^(1/m) − 1). Excel: `NOMINAL`. */
export function nominalRate(effective: number, periodsPerYear: number): number {
  assertRate(effective, "effective");
  if (periodsPerYear <= 0) throw new FinanceInputError("Compounding periods must be positive.", "periodsPerYear");
  return periodsPerYear * Math.expm1(Math.log1p(effective) / periodsPerYear);
}

/** Effective annual rate under continuous compounding: e^r − 1. */
export function continuousToEffective(r: number): number {
  assertFinite(r, "rate");
  return Math.expm1(r);
}

export type TvmVariable = "pv" | "fv" | "pmt" | "nper" | "rate";

export interface TvmInputs {
  /** Rate per period (decimal). */
  rate: number;
  nper: number;
  pmt: number;
  pv: number;
  fv: number;
  type: PaymentTiming;
}

/**
 * Solve for any one TVM variable given the other four.
 * Returns null when the requested variable has no solution.
 */
export function solveTvm(solveFor: TvmVariable, i: TvmInputs): number | null {
  switch (solveFor) {
    case "pv":
      return pv(i.rate, i.nper, i.pmt, i.fv, i.type);
    case "fv":
      return fv(i.rate, i.nper, i.pmt, i.pv, i.type);
    case "pmt":
      return pmt(i.rate, i.nper, i.pv, i.fv, i.type);
    case "nper":
      return nper(i.rate, i.pmt, i.pv, i.fv, i.type);
    case "rate":
      return rate(i.nper, i.pmt, i.pv, i.fv, i.type);
  }
}
