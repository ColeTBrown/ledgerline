import "server-only";
/**
 * Provider selection from environment variables. Swapping in a paid provider
 * = add an adapter under ./adapters and a case below, then change the env var.
 *
 *   QUOTE_PROVIDER         finnhub (default) | none
 *   RATES_PROVIDER         treasury (default) | none
 *   FUNDAMENTALS_PROVIDER  sec (default) | none
 */
import { InflightDeduper, MemoryCache, TTL } from "./cache";
import { createFinnhubAdapter } from "./adapters/finnhub";
import { createSecAdapter, type TickerMap } from "./adapters/sec";
import { createTreasuryAdapter } from "./adapters/treasury";
import { createMarketDataService, type MarketDataService } from "./service";
import type { FundamentalsProvider, QuoteProvider, RatesProvider, TreasuryCurve } from "./types";

let instance: MarketDataService | null = null;

/** Process-wide service singleton (one cache per server instance). */
export function getMarketData(): MarketDataService {
  if (instance) return instance;
  const cache = new MemoryCache(5000);
  const memo = new InflightDeduper();

  async function memoized<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = cache.get<T>(key);
    if (hit && Date.now() < hit.expiresAt) return hit.value;
    return memo.run(key, async () => {
      const v = await load();
      cache.set(key, v, ttl);
      return v;
    });
  }

  const quotes: QuoteProvider | null =
    (process.env.QUOTE_PROVIDER ?? "finnhub") === "finnhub" ? createFinnhubAdapter({ apiKey: process.env.FINNHUB_API_KEY?.trim() || undefined }) : null;

  const rates: RatesProvider | null =
    (process.env.RATES_PROVIDER ?? "treasury") === "treasury"
      ? createTreasuryAdapter({ loadYear: (y, load) => memoized<TreasuryCurve[]>(`treasury:year:${y}`, TTL.treasury, load) })
      : null;

  const fundamentals: FundamentalsProvider | null =
    (process.env.FUNDAMENTALS_PROVIDER ?? "sec") === "sec"
      ? createSecAdapter({
          userAgent: process.env.SEC_USER_AGENT?.trim() || undefined,
          loadTickers: (load) => memoized<TickerMap>("sec:tickers", TTL.secTickers, load),
        })
      : null;

  instance = createMarketDataService({ quotes, rates, fundamentals, cache });
  return instance;
}

/** Whether credentials are present (without exposing them). */
export function credentialStatus() {
  return {
    finnhub: Boolean(process.env.FINNHUB_API_KEY?.trim()),
    sec: Boolean(process.env.SEC_USER_AGENT?.trim()),
  };
}
