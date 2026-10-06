/**
 * Implied volatility: the σ for which Black–Scholes reproduces a market premium.
 */
import { assertPositive } from "../errors";
import { bisection, newton } from "../solvers";
import { blackScholes, priceBounds, type OptionInputs } from "./black-scholes";

export interface ImpliedVolResult {
  volatility: number;
  /** "newton" when Newton–Raphson converged, "bisection" when the fallback was needed. */
  method: "newton" | "bisection";
}

const MIN_VOL = 1e-6;
const MAX_VOL = 10;

/**
 * Solve σ from a premium. Newton–Raphson on vega (σ_{n+1} = σ_n − (BS(σ_n) − P)/vega)
 * starting from the Brenner–Subrahmanyam estimate σ₀ ≈ √(2π/T)·P/S, with a
 * bisection fallback on [1e-6, 10].
 *
 * Returns null when the premium violates no-arbitrage bounds (no σ can
 * produce it) or T = 0.
 */
export function impliedVolatility(
  inputs: Omit<OptionInputs, "volatility">,
  marketPrice: number,
): ImpliedVolResult | null {
  assertPositive(marketPrice, "marketPrice");
  if (inputs.timeToExpiry <= 0) return null;
  const { lower, upper } = priceBounds(inputs);
  const tol = 1e-12 * Math.max(1, inputs.spot);
  if (marketPrice <= lower + tol || marketPrice >= upper - tol) return null;

  const f = (sigma: number) => blackScholes({ ...inputs, volatility: sigma }).price - marketPrice;
  const vega = (sigma: number) => blackScholes({ ...inputs, volatility: sigma }).vega;
  const guess = Math.min(Math.max(Math.sqrt((2 * Math.PI) / inputs.timeToExpiry) * (marketPrice / inputs.spot), 0.05), 3);

  const n = newton(f, vega, guess, { tolerance: 1e-10, maxIterations: 50 });
  if (n !== null && n > MIN_VOL && n < MAX_VOL) return { volatility: n, method: "newton" };

  const b = bisection(f, MIN_VOL, MAX_VOL, { tolerance: 1e-10, maxIterations: 500 });
  return b === null ? null : { volatility: b, method: "bisection" };
}
