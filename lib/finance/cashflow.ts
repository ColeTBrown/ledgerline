/**
 * Discounted cash flow measures for capital budgeting.
 *
 * Timing conventions are explicit in each function name:
 * - {@link npv} follows Excel: the FIRST cash flow is discounted one period.
 * - {@link npvT0} treats the first cash flow as occurring today (t = 0),
 *   which is the textbook capital-budgeting convention.
 */
import { FinanceInputError, assertFiniteArray, assertRate } from "./errors";
import { brent, findBrackets, newton, solveRobust } from "./solvers";

/** IRR search grid: dense near zero, sparse at extremes. */
const IRR_GRID: readonly number[] = (() => {
  const g: number[] = [];
  for (let r = -0.99; r < -0.5; r += 0.05) g.push(r);
  for (let r = -0.5; r < 1; r += 0.01) g.push(Number(r.toFixed(4)));
  for (let r = 1; r <= 10; r += 0.25) g.push(r);
  return g;
})();

/**
 * Net present value with the first flow at t = 1 (Excel `NPV`).
 * NPV = Σ CF_t / (1 + r)^t, t = 1…n
 */
export function npv(rate: number, cashflows: readonly number[]): number {
  assertRate(rate, "rate");
  assertFiniteArray(cashflows, "cashflows");
  let total = 0;
  let df = 1;
  for (const cf of cashflows) {
    df /= 1 + rate;
    total += cf * df;
  }
  return total;
}

/**
 * Net present value with the first flow at t = 0 (undiscounted).
 * NPV = CF_0 + Σ CF_t / (1 + r)^t, t = 1…n
 */
export function npvT0(rate: number, cashflows: readonly number[]): number {
  assertFiniteArray(cashflows, "cashflows");
  const [first, ...rest] = cashflows;
  return first! + (rest.length ? npv(rate, rest) : 0);
}

function hasSignChange(values: readonly number[]): boolean {
  let pos = false;
  let neg = false;
  for (const v of values) {
    if (v > 0) pos = true;
    if (v < 0) neg = true;
  }
  return pos && neg;
}

/** d/dr of npvT0, used by Newton's method. */
function dNpvT0(rate: number, cashflows: readonly number[]): number {
  let total = 0;
  for (let t = 1; t < cashflows.length; t++) total -= (t * cashflows[t]!) / Math.pow(1 + rate, t + 1);
  return total;
}

/**
 * Internal rate of return (Excel `IRR`): the rate r with
 * Σ CF_t / (1 + r)^t = 0, t = 0…n.
 * Newton–Raphson from `guess`, falling back to Brent over a bracket scan.
 * Returns null when the flows have no sign change or no root exists in
 * (−99%, 1000%].
 */
export function irr(cashflows: readonly number[], guess = 0.1): number | null {
  assertFiniteArray(cashflows, "cashflows");
  if (!hasSignChange(cashflows)) return null;
  const f = (r: number) => (r <= -1 ? Number.NaN : npvT0(r, cashflows));
  const df = (r: number) => dNpvT0(r, cashflows);
  const r = solveRobust(f, df, guess, IRR_GRID, { tolerance: 1e-9 });
  return r !== null && r > -1 ? r : null;
}

/**
 * All IRRs found on (−99%, 1000%]. Non-conventional cash flows (more than
 * one sign change) can have several; the UI should warn when length > 1.
 */
export function irrAll(cashflows: readonly number[]): number[] {
  assertFiniteArray(cashflows, "cashflows");
  if (!hasSignChange(cashflows)) return [];
  const f = (r: number) => npvT0(r, cashflows);
  const roots: number[] = [];
  for (const [lo, hi] of findBrackets(f, IRR_GRID)) {
    const r = brent(f, lo, hi, { tolerance: 1e-9 });
    if (r !== null && !roots.some((x) => Math.abs(x - r) < 1e-6)) roots.push(r);
  }
  return roots;
}

/**
 * Modified IRR (Excel `MIRR`). Negative flows are discounted to t = 0 at the
 * finance rate; positive flows are compounded to t = n at the reinvestment rate:
 * MIRR = (FV_positive / −PV_negative)^(1/n) − 1, n = number of periods.
 * Returns null when there are no positive or no negative flows.
 */
export function mirr(cashflows: readonly number[], financeRate: number, reinvestRate: number): number | null {
  assertFiniteArray(cashflows, "cashflows");
  assertRate(financeRate, "financeRate");
  assertRate(reinvestRate, "reinvestRate");
  const n = cashflows.length - 1;
  if (n < 1) throw new FinanceInputError("MIRR needs at least two cash flows.", "cashflows");
  let pvNeg = 0;
  let fvPos = 0;
  cashflows.forEach((cf, t) => {
    if (cf < 0) pvNeg += cf / Math.pow(1 + financeRate, t);
    else fvPos += cf * Math.pow(1 + reinvestRate, n - t);
  });
  if (pvNeg === 0 || fvPos === 0) return null;
  return Math.pow(fvPos / -pvNeg, 1 / n) - 1;
}

const MS_PER_DAY = 86_400_000;

function toUtcDays(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  const t = date.getTime();
  if (Number.isNaN(t)) throw new FinanceInputError("Invalid date.", "dates");
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY);
}

/**
 * NPV for irregularly dated flows (Excel `XNPV`), Actual/365:
 * XNPV = Σ CF_i / (1 + r)^((d_i − d_0)/365)
 */
export function xnpv(rate: number, cashflows: readonly number[], dates: ReadonlyArray<Date | string>): number {
  assertRate(rate, "rate");
  assertFiniteArray(cashflows, "cashflows");
  if (dates.length !== cashflows.length) throw new FinanceInputError("Each cash flow needs a date.", "dates");
  const days = dates.map(toUtcDays);
  const d0 = days[0]!;
  return cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, (days[i]! - d0) / 365), 0);
}

/**
 * IRR for irregularly dated flows (Excel `XIRR`): r with XNPV(r) = 0.
 * Returns null when no solution exists.
 */
export function xirr(cashflows: readonly number[], dates: ReadonlyArray<Date | string>, guess = 0.1): number | null {
  assertFiniteArray(cashflows, "cashflows");
  if (!hasSignChange(cashflows)) return null;
  const f = (r: number) => (r <= -1 ? Number.NaN : xnpv(r, cashflows, dates));
  const h = 1e-7;
  const df = (r: number) => (f(r + h) - f(r - h)) / (2 * h);
  const r = newton(f, df, guess, { tolerance: 1e-9 }) ?? solveRobust(f, null, guess, IRR_GRID, { tolerance: 1e-9 });
  return r !== null && r > -1 ? r : null;
}

/**
 * Simple payback period in periods, interpolating linearly within the
 * recovery period: (k − 1) + (−cumulative_{k−1} / CF_k).
 * Assumes CF_0 at t = 0. Returns null if cumulative flows never turn ≥ 0.
 */
export function paybackPeriod(cashflows: readonly number[]): number | null {
  assertFiniteArray(cashflows, "cashflows");
  return paybackOf(cashflows);
}

/**
 * Discounted payback: payback computed on CF_t / (1 + r)^t.
 * Returns null if discounted flows never recover the investment.
 */
export function discountedPaybackPeriod(rate: number, cashflows: readonly number[]): number | null {
  assertRate(rate, "rate");
  assertFiniteArray(cashflows, "cashflows");
  return paybackOf(cashflows.map((cf, t) => cf / Math.pow(1 + rate, t)));
}

function paybackOf(flows: readonly number[]): number | null {
  let cumulative = flows[0]!;
  if (cumulative >= 0) return 0;
  for (let t = 1; t < flows.length; t++) {
    const cf = flows[t]!;
    const next = cumulative + cf;
    if (next >= 0 && cf > 0) return t - 1 + -cumulative / cf;
    cumulative = next;
  }
  return null;
}

/**
 * Profitability index: PV of future flows / initial outlay,
 * PI = [Σ CF_t / (1+r)^t, t ≥ 1] / −CF_0. Requires CF_0 < 0.
 */
export function profitabilityIndex(rate: number, cashflows: readonly number[]): number {
  assertFiniteArray(cashflows, "cashflows");
  const outlay = cashflows[0]!;
  if (outlay >= 0) throw new FinanceInputError("The initial cash flow must be a negative investment.", "cashflows");
  const rest = cashflows.slice(1);
  return (rest.length ? npv(rate, rest) : 0) / -outlay;
}

/** Equivalent annual annuity: NPV converted to a level per-period amount, NPV·r / (1 − (1+r)^−n). */
export function equivalentAnnualAnnuity(rate: number, cashflows: readonly number[]): number {
  const n = cashflows.length - 1;
  if (n < 1) throw new FinanceInputError("Needs at least two cash flows.", "cashflows");
  const value = npvT0(rate, cashflows);
  return rate === 0 ? value / n : (value * rate) / (1 - Math.pow(1 + rate, -n));
}
