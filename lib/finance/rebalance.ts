/**
 * Portfolio rebalancing: trades needed to move from current holdings to
 * target weights at current prices.
 */
import { FinanceInputError, assertFinite, assertNonNegative, assertPositive } from "./errors";

export interface RebalanceHolding {
  symbol: string;
  shares: number;
  price: number;
  /** Target weight of total portfolio value (decimal). */
  targetWeight: number;
}

export interface RebalanceOptions {
  /** Allow fractional shares. Default false (whole shares, truncated toward zero). */
  fractional?: boolean;
  /** Skip trades smaller than this dollar amount. */
  minTradeValue?: number;
}

export interface RebalanceRow {
  symbol: string;
  price: number;
  currentShares: number;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  /** currentWeight − targetWeight */
  drift: number;
  targetValue: number;
  /** Positive = buy, negative = sell. */
  tradeShares: number;
  tradeValue: number;
  postShares: number;
  postValue: number;
  postWeight: number;
}

export interface RebalanceResult {
  rows: RebalanceRow[];
  totalValue: number;
  cashBefore: number;
  cashAfter: number;
  /** Target cash weight = 1 − Σ target weights. */
  targetCashWeight: number;
  totalBuys: number;
  totalSells: number;
  /** Σ |trade value| / total value / 2 — one-way turnover. */
  turnover: number;
}

/**
 * Compute rebalancing trades. Target weights must sum to ≤ 100%; any
 * remainder is held as cash. Whole-share trades round toward zero so the
 * plan never needs more cash than it frees.
 */
export function rebalance(holdings: readonly RebalanceHolding[], cash = 0, options: RebalanceOptions = {}): RebalanceResult {
  const { fractional = false, minTradeValue = 0 } = options;
  assertNonNegative(cash, "cash");
  assertNonNegative(minTradeValue, "minTradeValue");
  if (holdings.length === 0) throw new FinanceInputError("Add at least one holding.", "holdings");
  holdings.forEach((h, i) => {
    assertNonNegative(h.shares, `holdings[${i}].shares`);
    assertPositive(h.price, `holdings[${i}].price`);
    assertFinite(h.targetWeight, `holdings[${i}].targetWeight`);
    if (h.targetWeight < 0) throw new FinanceInputError("Target weights cannot be negative.", "targetWeight");
  });
  const targetSum = holdings.reduce((s, h) => s + h.targetWeight, 0);
  if (targetSum > 1 + 1e-9) throw new FinanceInputError("Target weights add up to more than 100%.", "targetWeight");

  const totalValue = holdings.reduce((s, h) => s + h.shares * h.price, 0) + cash;
  if (!(totalValue > 0)) throw new FinanceInputError("Portfolio value must be greater than zero.", "holdings");

  let cashAfter = cash;
  let totalBuys = 0;
  let totalSells = 0;
  const rows: RebalanceRow[] = holdings.map((h) => {
    const currentValue = h.shares * h.price;
    const targetValue = totalValue * h.targetWeight;
    const rawShares = (targetValue - currentValue) / h.price;
    let tradeShares = fractional ? rawShares : Math.trunc(rawShares + Math.sign(rawShares) * 1e-9);
    if (Math.abs(tradeShares * h.price) < minTradeValue) tradeShares = 0;
    if (tradeShares < 0) tradeShares = Math.max(tradeShares, -h.shares);
    const tradeValue = tradeShares * h.price;
    cashAfter -= tradeValue;
    if (tradeValue > 0) totalBuys += tradeValue;
    else totalSells -= tradeValue;
    const postShares = h.shares + tradeShares;
    return {
      symbol: h.symbol,
      price: h.price,
      currentShares: h.shares,
      currentValue,
      currentWeight: currentValue / totalValue,
      targetWeight: h.targetWeight,
      drift: currentValue / totalValue - h.targetWeight,
      targetValue,
      tradeShares,
      tradeValue,
      postShares,
      postValue: postShares * h.price,
      postWeight: (postShares * h.price) / totalValue,
    };
  });

  return {
    rows,
    totalValue,
    cashBefore: cash,
    cashAfter,
    targetCashWeight: Math.max(0, 1 - targetSum),
    totalBuys,
    totalSells,
    turnover: (totalBuys + totalSells) / totalValue / 2,
  };
}
