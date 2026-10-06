/**
 * Comparable company (trading multiples) analysis.
 */
import { summarize } from "../stats";

export interface Peer {
  ticker: string;
  name?: string;
  price: number | null;
  sharesOutstanding: number | null;
  totalDebt: number | null;
  cash: number | null;
  revenue: number | null;
  ebitda: number | null;
  netIncome: number | null;
}

export interface PeerMultiples {
  ticker: string;
  marketCap: number | null;
  enterpriseValue: number | null;
  /** EV / EBITDA; null ("NM") when EBITDA ≤ 0 or inputs are missing. */
  evToEbitda: number | null;
  /** Price / EPS = Market cap / Net income; null when earnings ≤ 0. */
  priceToEarnings: number | null;
  /** EV / Revenue; null when revenue ≤ 0. */
  evToSales: number | null;
}

function present(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Multiple = numerator / denominator, or null when not meaningful (denominator ≤ 0 or missing). */
export function safeMultiple(numerator: number | null, denominator: number | null): number | null {
  if (!present(numerator) || !present(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

/**
 * Market cap = price × shares; EV = market cap + debt − cash
 * (missing debt or cash are treated as unknown, making EV null).
 */
export function peerMultiples(p: Peer): PeerMultiples {
  const marketCap = present(p.price) && present(p.sharesOutstanding) ? p.price * p.sharesOutstanding : null;
  const enterpriseValue = marketCap !== null && present(p.totalDebt) && present(p.cash) ? marketCap + p.totalDebt - p.cash : null;
  return {
    ticker: p.ticker,
    marketCap,
    enterpriseValue,
    evToEbitda: safeMultiple(enterpriseValue, p.ebitda),
    priceToEarnings: safeMultiple(marketCap, p.netIncome),
    evToSales: safeMultiple(enterpriseValue, p.revenue),
  };
}

export type MultipleKey = "evToEbitda" | "priceToEarnings" | "evToSales";

export interface CompsResult {
  rows: PeerMultiples[];
  stats: Record<MultipleKey, ReturnType<typeof summarize>>;
}

/** Multiples for every peer plus mean / median / high / low rows (NM values excluded). */
export function compsTable(peers: readonly Peer[]): CompsResult {
  const rows = peers.map(peerMultiples);
  const keys: MultipleKey[] = ["evToEbitda", "priceToEarnings", "evToSales"];
  const stats = Object.fromEntries(keys.map((k) => [k, summarize(rows.map((r) => r[k]))])) as CompsResult["stats"];
  return { rows, stats };
}

export interface ImpliedValue {
  method: MultipleKey;
  multiple: number;
  enterpriseValue: number | null;
  equityValue: number;
  pricePerShare: number;
}

/**
 * Apply peer median multiples to a target's metrics:
 *   EV-based: Equity = multiple × metric − net debt
 *   P/E:      Equity = multiple × net income
 * Methods whose target metric or peer median is unavailable are omitted.
 */
export function impliedValuation(target: Peer, comps: CompsResult, statistic: "median" | "mean" = "median"): ImpliedValue[] {
  const out: ImpliedValue[] = [];
  const shares = target.sharesOutstanding;
  if (!present(shares) || shares <= 0) return out;
  const netDebt = present(target.totalDebt) && present(target.cash) ? target.totalDebt - target.cash : null;
  const evMethods: Array<[MultipleKey, number | null]> = [
    ["evToEbitda", target.ebitda],
    ["evToSales", target.revenue],
  ];
  for (const [key, metric] of evMethods) {
    const m = comps.stats[key][statistic];
    if (m === null || !present(metric) || metric <= 0 || netDebt === null) continue;
    const ev = m * metric;
    const equity = ev - netDebt;
    out.push({ method: key, multiple: m, enterpriseValue: ev, equityValue: equity, pricePerShare: equity / shares });
  }
  const pe = comps.stats.priceToEarnings[statistic];
  if (pe !== null && present(target.netIncome) && target.netIncome > 0) {
    const equity = pe * target.netIncome;
    out.push({ method: "priceToEarnings", multiple: pe, enterpriseValue: null, equityValue: equity, pricePerShare: equity / shares });
  }
  return out;
}
