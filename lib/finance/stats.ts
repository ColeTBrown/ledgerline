/**
 * Descriptive statistics. Functions ignore nothing implicitly: callers pass
 * clean numeric arrays (use {@link finiteOnly} to drop missing values).
 */
import { FinanceInputError } from "./errors";

/** Keep only finite numbers (drops null, undefined, NaN, ±Infinity). */
export function finiteOnly(values: ReadonlyArray<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function requireNonEmpty(values: readonly number[], field = "values"): void {
  if (values.length === 0) throw new FinanceInputError(`${field} must not be empty.`, field);
}

/** Arithmetic mean: Σx / n. */
export function mean(values: readonly number[]): number {
  requireNonEmpty(values);
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Median (average of the two middle values for even n). */
export function median(values: readonly number[]): number {
  requireNonEmpty(values);
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Variance. Sample (n − 1 denominator, Excel `VAR.S`) by default;
 * population (n, Excel `VAR.P`) when `sample` is false.
 */
export function variance(values: readonly number[], sample = true): number {
  requireNonEmpty(values);
  if (sample && values.length < 2) throw new FinanceInputError("Sample variance needs at least two values.", "values");
  const m = mean(values);
  const ss = values.reduce((s, v) => s + (v - m) ** 2, 0);
  return ss / (values.length - (sample ? 1 : 0));
}

/** Standard deviation: √variance. Excel `STDEV.S` / `STDEV.P`. */
export function stdev(values: readonly number[], sample = true): number {
  return Math.sqrt(variance(values, sample));
}

/** Sample covariance (n − 1). Excel `COVARIANCE.S`. */
export function covariance(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length < 2) throw new FinanceInputError("Series must have equal length ≥ 2.", "values");
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i]! - mx) * (y[i]! - my);
  return s / (x.length - 1);
}

/** Pearson correlation. Excel `CORREL`. Returns NaN-free 0 when a series is constant. */
export function correlation(x: readonly number[], y: readonly number[]): number {
  const sx = stdev(x);
  const sy = stdev(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

/**
 * Percentile with linear interpolation between closest ranks
 * (Excel `PERCENTILE.INC`): rank = p·(n − 1).
 * Expects `p` in [0, 1].
 */
export function percentile(values: readonly number[], p: number): number {
  requireNonEmpty(values);
  if (!(p >= 0 && p <= 1)) throw new FinanceInputError("Percentile must be between 0 and 1.", "p");
  const s = [...values].sort((a, b) => a - b);
  return percentileSorted(s, p);
}

/** {@link percentile} on an already ascending-sorted array (no copy). */
export function percentileSorted(sorted: ArrayLike<number>, p: number): number {
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const w = rank - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/** Summary row used by comps tables: count, mean, median, min, max over finite values. */
export function summarize(values: ReadonlyArray<number | null | undefined>): {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
} {
  const v = finiteOnly(values);
  if (v.length === 0) return { count: 0, mean: null, median: null, min: null, max: null };
  return { count: v.length, mean: mean(v), median: median(v), min: Math.min(...v), max: Math.max(...v) };
}

/**
 * Standard normal cumulative distribution N(x).
 * Hart (1968) double-precision algorithm as given by G. West, "Better
 * approximations to cumulative normal functions" (2005); accurate to ~1e-15.
 */
export function normCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) {
    c = 0;
  } else {
    const e = Math.exp(-(z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/** Standard normal density n(x) = e^(−x²/2) / √(2π). */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
