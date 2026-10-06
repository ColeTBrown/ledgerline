/**
 * Fixed-rate bond analytics using street conventions: yields are quoted
 * with the same compounding frequency as the coupon (bond-equivalent yield
 * for semiannual bonds), and settlement between coupon dates is handled with
 * a fractional first period.
 *
 * With f coupons per year, periodic yield y/f, N remaining coupons and
 * w ∈ (0, 1] the fraction of a period until the next coupon:
 *
 *   Dirty price = Σ_{k=1..N} CF_k / (1 + y/f)^(k − 1 + w)
 *   Accrued     = C · (1 − w)
 *   Clean price = Dirty − Accrued
 */
import { FinanceInputError, assertFinite, assertNonNegative, assertPositive } from "./errors";
import { solveRobust } from "./solvers";

export type CouponFrequency = 1 | 2 | 4 | 12;

export interface BondInputs {
  /** Par / face value, e.g. 100 or 1000. */
  face: number;
  /** Annual coupon rate (decimal). */
  couponRate: number;
  /** Years from settlement to maturity (may be fractional). */
  yearsToMaturity: number;
  frequency?: CouponFrequency;
  /** Amount paid at redemption; defaults to face (use call price for YTC). */
  redemption?: number;
}

export interface BondCashflow {
  /** Time from settlement in years. */
  time: number;
  amount: number;
  presentValue: number;
}

export interface BondPricing {
  cleanPrice: number;
  dirtyPrice: number;
  accruedInterest: number;
  /** Clean price as a percentage of face. */
  pricePct: number;
  couponPayment: number;
  periodsRemaining: number;
  cashflows: BondCashflow[];
}

interface Schedule {
  n: number;
  w: number;
  coupon: number;
  f: number;
  redemption: number;
}

function schedule(b: BondInputs): Schedule {
  const { face, couponRate, yearsToMaturity, frequency = 2, redemption = face } = b;
  assertPositive(face, "face");
  assertNonNegative(couponRate, "couponRate");
  assertPositive(yearsToMaturity, "yearsToMaturity");
  assertPositive(redemption, "redemption");
  if (![1, 2, 4, 12].includes(frequency)) throw new FinanceInputError("Frequency must be 1, 2, 4 or 12.", "frequency");
  if (yearsToMaturity > 100) throw new FinanceInputError("Maturity is limited to 100 years.", "yearsToMaturity");
  const f = frequency;
  const periods = yearsToMaturity * f;
  const n = Math.max(1, Math.ceil(periods - 1e-9));
  const w = periods - (n - 1);
  return { n, w, coupon: (face * couponRate) / f, f, redemption };
}

function dirtyFromYield(s: Schedule, y: number): number {
  const r = y / s.f;
  let total = 0;
  for (let k = 1; k <= s.n; k++) {
    const cf = s.coupon + (k === s.n ? s.redemption : 0);
    total += cf / Math.pow(1 + r, k - 1 + s.w);
  }
  return total;
}

/**
 * Price a bond from its annual yield to maturity.
 * Requires y/f > −1.
 */
export function bondPrice(bond: BondInputs, annualYield: number): BondPricing {
  assertFinite(annualYield, "yield");
  const s = schedule(bond);
  if (annualYield / s.f <= -1) throw new FinanceInputError("Yield is too negative for this frequency.", "yield");
  const r = annualYield / s.f;
  const cashflows: BondCashflow[] = [];
  for (let k = 1; k <= s.n; k++) {
    const amount = s.coupon + (k === s.n ? s.redemption : 0);
    const t = k - 1 + s.w;
    cashflows.push({ time: t / s.f, amount, presentValue: amount / Math.pow(1 + r, t) });
  }
  const dirtyPrice = cashflows.reduce((sum, c) => sum + c.presentValue, 0);
  const accruedInterest = s.coupon * (1 - s.w);
  const cleanPrice = dirtyPrice - accruedInterest;
  return {
    cleanPrice,
    dirtyPrice,
    accruedInterest,
    pricePct: (cleanPrice / bond.face) * 100,
    couponPayment: s.coupon,
    periodsRemaining: s.n,
    cashflows,
  };
}

/**
 * Yield to maturity from a clean price: the y solving Clean(y) = price.
 * Returns null when no yield in (−f·99%, 500%) reproduces the price.
 */
export function yieldToMaturity(bond: BondInputs, cleanPrice: number, guess?: number): number | null {
  assertPositive(cleanPrice, "price");
  const s = schedule(bond);
  const accrued = s.coupon * (1 - s.w);
  const target = cleanPrice + accrued;
  const f = (y: number) => dirtyFromYield(s, y) - target;
  const h = 1e-7;
  const df = (y: number) => (f(y + h) - f(y - h)) / (2 * h);
  const lower = -0.99 * s.f;
  const grid: number[] = [];
  for (let y = Math.max(lower, -0.5); y <= 5; y += y < 0.3 ? 0.01 : 0.1) grid.push(y);
  const start = guess ?? (bond.couponRate > 0 ? bond.couponRate : 0.05);
  const y = solveRobust(f, df, start, grid, { tolerance: 1e-10 });
  return y !== null && y / s.f > -1 ? y : null;
}

/**
 * Yield to call: YTM computed to the call date, redeeming at the call price.
 */
export function yieldToCall(
  bond: Omit<BondInputs, "yearsToMaturity" | "redemption">,
  cleanPrice: number,
  yearsToCall: number,
  callPrice: number,
): number | null {
  return yieldToMaturity({ ...bond, yearsToMaturity: yearsToCall, redemption: callPrice }, cleanPrice);
}

/** Current yield: annual coupon / clean price. */
export function currentYield(bond: Pick<BondInputs, "face" | "couponRate">, cleanPrice: number): number {
  assertPositive(cleanPrice, "price");
  return (bond.face * bond.couponRate) / cleanPrice;
}

export interface RiskMeasures {
  /** Macaulay duration in years: Σ t·PV(CF) / Dirty. */
  macaulayDuration: number;
  /** Modified duration: Macaulay / (1 + y/f). */
  modifiedDuration: number;
  /** Convexity in years²: Σ PV(CF)·t·(t + 1/f) / [Dirty·(1 + y/f)²]. */
  convexity: number;
  /** Price value of a basis point per the given face: ModDur · Dirty · 0.0001. */
  dv01: number;
  dirtyPrice: number;
}

/** Analytic duration, convexity and DV01 at the given yield. */
export function bondRisk(bond: BondInputs, annualYield: number): RiskMeasures {
  const pricing = bondPrice(bond, annualYield);
  const f = bond.frequency ?? 2;
  const r = annualYield / f;
  const P = pricing.dirtyPrice;
  let mac = 0;
  let conv = 0;
  for (const c of pricing.cashflows) {
    mac += c.time * c.presentValue;
    conv += c.presentValue * c.time * (c.time + 1 / f);
  }
  const macaulayDuration = mac / P;
  const modifiedDuration = macaulayDuration / (1 + r);
  const convexity = conv / (P * (1 + r) ** 2);
  return { macaulayDuration, modifiedDuration, convexity, dv01: modifiedDuration * P * 1e-4, dirtyPrice: P };
}

/**
 * Effective duration and convexity by symmetric yield bumps:
 *   D_eff = (P₋ − P₊) / (2·P₀·Δy),  C_eff = (P₋ + P₊ − 2P₀) / (P₀·Δy²)
 */
export function effectiveRisk(bond: BondInputs, annualYield: number, bump = 0.0001): { duration: number; convexity: number } {
  assertPositive(bump, "bump");
  const p0 = bondPrice(bond, annualYield).dirtyPrice;
  const pUp = bondPrice(bond, annualYield + bump).dirtyPrice;
  const pDn = bondPrice(bond, annualYield - bump).dirtyPrice;
  return { duration: (pDn - pUp) / (2 * p0 * bump), convexity: (pDn + pUp - 2 * p0) / (p0 * bump * bump) };
}

export interface RateShockResult {
  shock: number;
  basePrice: number;
  /** −D_mod·Δy·P */
  durationEstimate: number;
  /** ½·C·Δy²·P */
  convexityAdjustment: number;
  /** Duration + convexity estimate of the new dirty price. */
  estimatedPrice: number;
  /** Full repricing at the shocked yield. */
  actualPrice: number;
  estimationError: number;
}

/**
 * Price change for a parallel yield shock Δy (decimal, e.g. 0.01 = +100bp):
 *   ΔP ≈ P·(−D_mod·Δy + ½·C·Δy²), compared with full repricing.
 */
export function rateShock(bond: BondInputs, annualYield: number, shock: number): RateShockResult {
  assertFinite(shock, "shock");
  const risk = bondRisk(bond, annualYield);
  const P = risk.dirtyPrice;
  const durationEstimate = -risk.modifiedDuration * shock * P;
  const convexityAdjustment = 0.5 * risk.convexity * shock * shock * P;
  const estimatedPrice = P + durationEstimate + convexityAdjustment;
  const actualPrice = bondPrice(bond, annualYield + shock).dirtyPrice;
  return {
    shock,
    basePrice: P,
    durationEstimate,
    convexityAdjustment,
    estimatedPrice,
    actualPrice,
    estimationError: estimatedPrice - actualPrice,
  };
}
