/**
 * Yield-curve helpers. Used to pick the risk-free rate matching each tool's
 * horizon (e.g. option expiry, DCF horizon, bond maturity).
 */
import { FinanceInputError, assertFinite } from "./errors";

export interface CurvePoint {
  /** Tenor in years (1 month = 1/12). */
  tenorYears: number;
  /** Annualized yield (decimal). */
  yield: number;
}

/** Standard U.S. Treasury par-curve tenors. */
export const TREASURY_TENORS = ["1M", "2M", "3M", "4M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"] as const;
export type TreasuryTenor = (typeof TREASURY_TENORS)[number];

/** Parse a tenor label like "3M" or "10Y" into years. */
export function tenorToYears(tenor: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*([MY])$/i.exec(tenor.trim());
  if (!m) throw new FinanceInputError(`Unrecognized tenor "${tenor}".`, "tenor");
  const n = Number(m[1]);
  return m[2]!.toUpperCase() === "M" ? n / 12 : n;
}

/**
 * Linear interpolation on the curve at `horizonYears`, with flat
 * extrapolation beyond the shortest and longest tenors.
 * Points may be unsorted; non-finite yields are ignored.
 * Returns null for an empty curve.
 */
export function interpolateYield(curve: readonly CurvePoint[], horizonYears: number): number | null {
  assertFinite(horizonYears, "horizonYears");
  const pts = curve
    .filter((p) => Number.isFinite(p.yield) && Number.isFinite(p.tenorYears))
    .slice()
    .sort((a, b) => a.tenorYears - b.tenorYears);
  if (pts.length === 0) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (horizonYears <= first.tenorYears) return first.yield;
  if (horizonYears >= last.tenorYears) return last.yield;
  for (let i = 1; i < pts.length; i++) {
    const hi = pts[i]!;
    if (horizonYears <= hi.tenorYears) {
      const lo = pts[i - 1]!;
      const w = (horizonYears - lo.tenorYears) / (hi.tenorYears - lo.tenorYears);
      return lo.yield + w * (hi.yield - lo.yield);
    }
  }
  return last.yield;
}

/**
 * Convert a bond-equivalent (semiannual) par yield to a continuously
 * compounded rate, for option models: r_c = 2·ln(1 + y/2).
 */
export function bondEquivalentToContinuous(y: number): number {
  assertFinite(y, "yield");
  return 2 * Math.log1p(y / 2);
}

/** Discount factor for time t at a continuously compounded rate: e^(−r·t). */
export function discountFactor(rate: number, years: number): number {
  return Math.exp(-rate * years);
}
