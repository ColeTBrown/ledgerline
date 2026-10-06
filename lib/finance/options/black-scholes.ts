/**
 * Black–Scholes–Merton pricing for European options on an underlying with a
 * continuous dividend yield q. Rates are continuously compounded.
 *
 *   d1 = [ln(S/K) + (r − q + σ²/2)·T] / (σ√T),   d2 = d1 − σ√T
 *   C  = S·e^(−qT)·N(d1) − K·e^(−rT)·N(d2)
 *   P  = K·e^(−rT)·N(−d2) − S·e^(−qT)·N(−d1)
 */
import { assertFinite, assertNonNegative, assertPositive } from "../errors";
import { normCdf, normPdf } from "../stats";

export type OptionType = "call" | "put";

export interface OptionInputs {
  type: OptionType;
  /** Spot price S. */
  spot: number;
  /** Strike K. */
  strike: number;
  /** Time to expiry in years T. */
  timeToExpiry: number;
  /** Continuously compounded risk-free rate r. */
  rate: number;
  /** Annualized volatility σ. */
  volatility: number;
  /** Continuous dividend yield q. Default 0. */
  dividendYield?: number;
}

export interface Greeks {
  /** ∂V/∂S */
  delta: number;
  /** ∂²V/∂S² */
  gamma: number;
  /** ∂V/∂σ per 1.00 (100 vol points). Divide by 100 for per-vol-point. */
  vega: number;
  /** ∂V/∂t per year (negative = time decay). Divide by 365 for per-day. */
  theta: number;
  /** ∂V/∂r per 1.00 (100%). Divide by 100 for per-1%. */
  rho: number;
}

export interface OptionResult extends Greeks {
  price: number;
  d1: number;
  d2: number;
  /** Max(S − K, 0) for calls, max(K − S, 0) for puts. */
  intrinsicValue: number;
  timeValue: number;
  /** Risk-neutral probability of finishing in the money: N(d2) / N(−d2). */
  probabilityITM: number;
}

function validate(o: OptionInputs): void {
  assertPositive(o.spot, "spot");
  assertPositive(o.strike, "strike");
  assertNonNegative(o.timeToExpiry, "timeToExpiry");
  assertFinite(o.rate, "rate");
  assertNonNegative(o.volatility, "volatility");
  assertFinite(o.dividendYield ?? 0, "dividendYield");
}

/**
 * Price and Greeks. At expiry (T = 0) or zero volatility the option is
 * valued at its (discounted forward) intrinsic value and Greeks degrade to
 * their limiting values instead of producing NaN.
 */
export function blackScholes(o: OptionInputs): OptionResult {
  validate(o);
  const { type, spot: S, strike: K, timeToExpiry: T, rate: r, volatility: sigma } = o;
  const q = o.dividendYield ?? 0;
  const isCall = type === "call";
  const intrinsicValue = Math.max(isCall ? S - K : K - S, 0);
  const dq = Math.exp(-q * T);
  const dr = Math.exp(-r * T);

  if (T === 0 || sigma === 0) {
    const fwdIntrinsic = Math.max(isCall ? S * dq - K * dr : K * dr - S * dq, 0);
    const itm = isCall ? S * dq > K * dr : K * dr > S * dq;
    return {
      price: fwdIntrinsic,
      d1: Number.NaN,
      d2: Number.NaN,
      intrinsicValue,
      timeValue: fwdIntrinsic - intrinsicValue,
      probabilityITM: itm ? 1 : 0,
      delta: itm ? (isCall ? dq : -dq) : 0,
      gamma: 0,
      vega: 0,
      theta: itm ? (isCall ? q * S * dq - r * K * dr : r * K * dr - q * S * dq) : 0,
      rho: itm ? (isCall ? K * T * dr : -K * T * dr) : 0,
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normPdf(d1);

  const price = isCall
    ? S * dq * normCdf(d1) - K * dr * normCdf(d2)
    : K * dr * normCdf(-d2) - S * dq * normCdf(-d1);
  const delta = isCall ? dq * normCdf(d1) : dq * (normCdf(d1) - 1);
  const gamma = (dq * nd1) / (S * sigma * sqrtT);
  const vega = S * dq * nd1 * sqrtT;
  const decay = -(S * dq * nd1 * sigma) / (2 * sqrtT);
  const theta = isCall
    ? decay - r * K * dr * normCdf(d2) + q * S * dq * normCdf(d1)
    : decay + r * K * dr * normCdf(-d2) - q * S * dq * normCdf(-d1);
  const rho = isCall ? K * T * dr * normCdf(d2) : -K * T * dr * normCdf(-d2);

  return {
    price,
    d1,
    d2,
    intrinsicValue,
    timeValue: price - intrinsicValue,
    probabilityITM: isCall ? normCdf(d2) : normCdf(-d2),
    delta,
    gamma,
    vega,
    theta,
    rho,
  };
}

/** Just the premium; convenience for solvers and payoff curves. */
export function optionPrice(o: OptionInputs): number {
  return blackScholes(o).price;
}

/**
 * No-arbitrage price bounds for a European option:
 *   call ∈ [max(S·e^(−qT) − K·e^(−rT), 0), S·e^(−qT)]
 *   put  ∈ [max(K·e^(−rT) − S·e^(−qT), 0), K·e^(−rT)]
 */
export function priceBounds(o: Omit<OptionInputs, "volatility">): { lower: number; upper: number } {
  const q = o.dividendYield ?? 0;
  const s = o.spot * Math.exp(-q * o.timeToExpiry);
  const k = o.strike * Math.exp(-o.rate * o.timeToExpiry);
  return o.type === "call" ? { lower: Math.max(s - k, 0), upper: s } : { lower: Math.max(k - s, 0), upper: k };
}
