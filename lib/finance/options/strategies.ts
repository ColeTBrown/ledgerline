/**
 * Multi-leg option strategy payoffs.
 *
 * A leg's P&L at expiry, per unit:
 *   long call:  max(S − K, 0) − premium      long put:  max(K − S, 0) − premium
 *   stock:      S − entry price
 * Short legs negate the per-unit P&L. Position P&L = Σ side·quantity·multiplier·unit P&L.
 */
import { FinanceInputError, assertFinite, assertNonNegative, assertPositive } from "../errors";
import { blackScholes, type OptionType } from "./black-scholes";

export type LegKind = OptionType | "stock";
export type Side = "long" | "short";

export interface StrategyLeg {
  kind: LegKind;
  side: Side;
  /** Contracts (options) or shares (stock). */
  quantity: number;
  /** Strike for options; ignored for stock. */
  strike: number;
  /** Premium paid/received per share for options; entry price for stock. */
  premium: number;
  /** Shares per contract; 100 for listed U.S. equity options, 1 for stock. */
  multiplier: number;
  /** Implied volatility for mark-to-model "today" values. */
  volatility?: number;
  /** Years to expiry for this leg (allows calendar spreads). */
  timeToExpiry?: number;
}

export interface MarketContext {
  rate: number;
  dividendYield?: number;
}

function sideSign(side: Side): 1 | -1 {
  return side === "long" ? 1 : -1;
}

function validateLeg(leg: StrategyLeg, i: number): void {
  assertPositive(leg.quantity, `legs[${i}].quantity`);
  assertNonNegative(leg.premium, `legs[${i}].premium`);
  assertPositive(leg.multiplier, `legs[${i}].multiplier`);
  if (leg.kind !== "stock") assertPositive(leg.strike, `legs[${i}].strike`);
}

function validateLegs(legs: readonly StrategyLeg[]): void {
  if (legs.length === 0) throw new FinanceInputError("Add at least one leg.", "legs");
  legs.forEach(validateLeg);
}

function legPayoffAtExpiry(leg: StrategyLeg, S: number): number {
  const unit =
    leg.kind === "stock"
      ? S - leg.premium
      : (leg.kind === "call" ? Math.max(S - leg.strike, 0) : Math.max(leg.strike - S, 0)) - leg.premium;
  return sideSign(leg.side) * leg.quantity * leg.multiplier * unit;
}

/** Total P&L at expiry for underlying price S. */
export function payoffAtExpiry(legs: readonly StrategyLeg[], S: number): number {
  validateLegs(legs);
  assertNonNegative(S, "spot");
  return legs.reduce((sum, leg) => sum + legPayoffAtExpiry(leg, S), 0);
}

/**
 * Mark-to-model P&L at underlying price S after `elapsedYears`, valuing each
 * option leg with Black–Scholes at its remaining time and volatility.
 */
export function payoffToday(legs: readonly StrategyLeg[], S: number, market: MarketContext, elapsedYears = 0): number {
  validateLegs(legs);
  assertPositive(S, "spot");
  assertFinite(market.rate, "rate");
  return legs.reduce((sum, leg) => {
    const sign = sideSign(leg.side) * leg.quantity * leg.multiplier;
    if (leg.kind === "stock") return sum + sign * (S - leg.premium);
    const T = Math.max((leg.timeToExpiry ?? 0) - elapsedYears, 0);
    const value = blackScholes({
      type: leg.kind,
      spot: S,
      strike: leg.strike,
      timeToExpiry: T,
      rate: market.rate,
      volatility: leg.volatility ?? 0,
      dividendYield: market.dividendYield,
    }).price;
    return sum + sign * (value - leg.premium);
  }, 0);
}

/** Net premium: positive = debit paid, negative = credit received (stock legs excluded). */
export function netPremium(legs: readonly StrategyLeg[]): number {
  return legs
    .filter((l) => l.kind !== "stock")
    .reduce((s, l) => s + sideSign(l.side) * l.quantity * l.multiplier * l.premium, 0);
}

export interface StrategyGreeks {
  delta: number;
  gamma: number;
  /** Per vol point (1%). */
  vega: number;
  /** Per calendar day. */
  theta: number;
}

/** Position Greeks (dollar-weighted by quantity × multiplier) at spot S. */
export function strategyGreeks(legs: readonly StrategyLeg[], S: number, market: MarketContext): StrategyGreeks {
  validateLegs(legs);
  const total = { delta: 0, gamma: 0, vega: 0, theta: 0 };
  for (const leg of legs) {
    const w = sideSign(leg.side) * leg.quantity * leg.multiplier;
    if (leg.kind === "stock") {
      total.delta += w;
      continue;
    }
    const g = blackScholes({
      type: leg.kind,
      spot: S,
      strike: leg.strike,
      timeToExpiry: leg.timeToExpiry ?? 0,
      rate: market.rate,
      volatility: leg.volatility ?? 0,
      dividendYield: market.dividendYield,
    });
    total.delta += w * g.delta;
    total.gamma += w * g.gamma;
    total.vega += (w * g.vega) / 100;
    total.theta += (w * g.theta) / 365;
  }
  return total;
}

export interface PayoffProfile {
  /** Prices where expiry P&L crosses zero, ascending. */
  breakevens: number[];
  /** Maximum expiry P&L; Infinity when unlimited. */
  maxProfit: number;
  /** Minimum expiry P&L (negative = loss); −Infinity when unlimited. */
  maxLoss: number;
}

/**
 * Analyze the piecewise-linear expiry payoff exactly: evaluate at S = 0 and
 * every strike, and use the slope beyond the highest strike (Σ long calls −
 * short calls + stock) to detect unlimited profit or loss.
 */
export function payoffProfile(legs: readonly StrategyLeg[]): PayoffProfile {
  validateLegs(legs);
  const strikes = [...new Set(legs.filter((l) => l.kind !== "stock").map((l) => l.strike))].sort((a, b) => a - b);
  const knots = [0, ...strikes];
  const maxKnot = knots[knots.length - 1]!;
  const farPoint = Math.max(maxKnot * 2, maxKnot + 1, ...legs.map((l) => (l.kind === "stock" ? l.premium * 2 : 0)));
  knots.push(farPoint);
  const values = knots.map((k) => legs.reduce((s, leg) => s + legPayoffAtExpiry(leg, k), 0));

  const slopeBeyond = legs.reduce((s, leg) => {
    const w = sideSign(leg.side) * leg.quantity * leg.multiplier;
    return s + (leg.kind === "put" ? 0 : w);
  }, 0);

  const breakevens: number[] = [];
  for (let i = 1; i < knots.length; i++) {
    const x0 = knots[i - 1]!;
    const x1 = knots[i]!;
    const y0 = values[i - 1]!;
    const y1 = values[i]!;
    if (y0 === 0 && !breakevens.some((b) => Math.abs(b - x0) < 1e-9)) breakevens.push(x0);
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) breakevens.push(x0 + ((0 - y0) * (x1 - x0)) / (y1 - y0));
  }
  const lastValue = values[values.length - 1]!;
  // Beyond the far point the payoff continues with slopeBeyond.
  if (slopeBeyond !== 0 && Math.sign(lastValue) === -Math.sign(slopeBeyond) && lastValue !== 0) {
    breakevens.push(farPoint - lastValue / slopeBeyond);
  }

  const finiteMax = Math.max(...values);
  const finiteMin = Math.min(...values);
  return {
    breakevens: breakevens.sort((a, b) => a - b),
    maxProfit: slopeBeyond > 0 ? Infinity : finiteMax,
    maxLoss: slopeBeyond < 0 ? -Infinity : finiteMin,
  };
}

export type StrategyPreset =
  | "long-call"
  | "long-put"
  | "covered-call"
  | "protective-put"
  | "bull-call-spread"
  | "bear-put-spread"
  | "long-straddle"
  | "short-straddle"
  | "long-strangle"
  | "iron-condor"
  | "long-butterfly";

export const STRATEGY_PRESETS: ReadonlyArray<{ id: StrategyPreset; label: string }> = [
  { id: "long-call", label: "Long call" },
  { id: "long-put", label: "Long put" },
  { id: "covered-call", label: "Covered call" },
  { id: "protective-put", label: "Protective put" },
  { id: "bull-call-spread", label: "Bull call spread" },
  { id: "bear-put-spread", label: "Bear put spread" },
  { id: "long-straddle", label: "Long straddle" },
  { id: "short-straddle", label: "Short straddle" },
  { id: "long-strangle", label: "Long strangle" },
  { id: "iron-condor", label: "Iron condor" },
  { id: "long-butterfly", label: "Long butterfly" },
];

export interface PresetParams {
  spot: number;
  /** Distance between strikes, in price units. */
  width: number;
  volatility: number;
  timeToExpiry: number;
  rate: number;
  dividendYield?: number;
  contracts?: number;
  multiplier?: number;
}

/**
 * Build a preset strategy around `spot`, pricing each leg's premium with
 * Black–Scholes so the payoff is internally consistent. Strikes are rounded
 * to the nearest 0.5.
 */
export function buildPreset(preset: StrategyPreset, p: PresetParams): StrategyLeg[] {
  assertPositive(p.spot, "spot");
  assertPositive(p.width, "width");
  const q = p.contracts ?? 1;
  const m = p.multiplier ?? 100;
  const round = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);
  const atm = round(p.spot);
  const opt = (kind: OptionType, side: Side, strike: number): StrategyLeg => ({
    kind,
    side,
    quantity: q,
    strike,
    multiplier: m,
    volatility: p.volatility,
    timeToExpiry: p.timeToExpiry,
    premium: blackScholes({
      type: kind,
      spot: p.spot,
      strike,
      timeToExpiry: p.timeToExpiry,
      rate: p.rate,
      volatility: p.volatility,
      dividendYield: p.dividendYield,
    }).price,
  });
  const stock = (): StrategyLeg => ({ kind: "stock", side: "long", quantity: q * m, strike: 0, premium: p.spot, multiplier: 1 });
  const w = p.width;
  switch (preset) {
    case "long-call":
      return [opt("call", "long", atm)];
    case "long-put":
      return [opt("put", "long", atm)];
    case "covered-call":
      return [stock(), opt("call", "short", round(atm + w))];
    case "protective-put":
      return [stock(), opt("put", "long", round(atm - w))];
    case "bull-call-spread":
      return [opt("call", "long", atm), opt("call", "short", round(atm + w))];
    case "bear-put-spread":
      return [opt("put", "long", atm), opt("put", "short", round(atm - w))];
    case "long-straddle":
      return [opt("call", "long", atm), opt("put", "long", atm)];
    case "short-straddle":
      return [opt("call", "short", atm), opt("put", "short", atm)];
    case "long-strangle":
      return [opt("put", "long", round(atm - w)), opt("call", "long", round(atm + w))];
    case "iron-condor":
      return [
        opt("put", "long", round(atm - 2 * w)),
        opt("put", "short", round(atm - w)),
        opt("call", "short", round(atm + w)),
        opt("call", "long", round(atm + 2 * w)),
      ];
    case "long-butterfly":
      return [opt("call", "long", round(atm - w)), { ...opt("call", "short", atm), quantity: 2 * q }, opt("call", "long", round(atm + w))];
  }
}
