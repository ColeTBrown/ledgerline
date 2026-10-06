/**
 * MarketDataService: composes capability adapters into the single
 * {@link MarketDataProvider} interface and adds caching, in-flight dedupe,
 * short negative caching for unknown symbols, and stale fallback — when a
 * provider is rate-limited or down, the last good value is served with
 * status CACHED instead of failing.
 */
import { InflightDeduper, MemoryCache, TTL, type CacheStore } from "./cache";
import { ProviderError, isProviderError } from "./errors";
import type { SourceStatus } from "./sourced";
import type {
  DataErrorReason,
  DataResult,
  FundamentalsProvider,
  MarketDataProvider,
  ProviderValue,
  QuoteProvider,
  RatesProvider,
} from "./types";

export interface ServiceDeps {
  quotes: QuoteProvider | null;
  rates: RatesProvider | null;
  fundamentals: FundamentalsProvider | null;
  cache?: CacheStore;
  now?: () => number;
}

const NEGATIVE_TTL = 5 * 60_000;
/** Reasons for which serving a stale value is appropriate. */
const STALE_OK: ReadonlySet<DataErrorReason> = new Set(["rate_limited", "unavailable"]);
const MAX_BATCH = 25;

export interface MarketDataService extends MarketDataProvider {
  /** Which capabilities have a configured provider (for the UI's data-mode indicator). */
  status(): { quotes: string | null; rates: string | null; fundamentals: string | null };
}

export function createMarketDataService(deps: ServiceDeps): MarketDataService {
  const cache = deps.cache ?? new MemoryCache();
  const dedupe = new InflightDeduper();
  const now = deps.now ?? Date.now;

  function fail<T>(reason: DataErrorReason, message: string): DataResult<T> {
    return { ok: false, reason, message };
  }

  function toResult<T>(v: ProviderValue<T>, status: SourceStatus = v.status): DataResult<T> {
    return { ok: true, value: v.value, source: v.source, asOf: v.asOf, status };
  }

  async function load<T>(key: string, ttl: number, fetcher: () => Promise<ProviderValue<T>>): Promise<DataResult<T>> {
    const negative = cache.get<{ reason: DataErrorReason; message: string }>(`neg:${key}`);
    if (negative && now() < negative.expiresAt) return fail(negative.value.reason, negative.value.message);

    const entry = cache.get<ProviderValue<T>>(key);
    if (entry && now() < entry.expiresAt) return toResult(entry.value);

    return dedupe.run(key, async () => {
      try {
        const fresh = await fetcher();
        cache.set(key, fresh, ttl);
        return toResult(fresh);
      } catch (e) {
        const err = isProviderError(e) ? e : new ProviderError("unavailable", "Unexpected data provider error.");
        if (entry && STALE_OK.has(err.reason)) return toResult(entry.value, "CACHED");
        if (err.reason === "not_found") cache.set(`neg:${key}`, { reason: err.reason, message: err.message }, NEGATIVE_TTL);
        return fail<T>(err.reason, err.message);
      }
    });
  }

  function requireProvider<P>(p: P | null, what: string): P {
    if (!p) throw new ProviderError("missing_key", `No ${what} provider is configured.`);
    return p;
  }

  const norm = (s: string) => s.trim().toUpperCase();

  const service: MarketDataService = {
    status: () => ({
      quotes: deps.quotes?.name ?? null,
      rates: deps.rates?.name ?? null,
      fundamentals: deps.fundamentals?.name ?? null,
    }),

    getQuote: (symbol) =>
      load(`quote:${norm(symbol)}`, TTL.quote, () => requireProvider(deps.quotes, "quote").getQuote(norm(symbol))),

    async getQuotes(symbols) {
      const unique = [...new Set(symbols.map(norm))].slice(0, MAX_BATCH);
      const results = await Promise.all(unique.map((s) => service.getQuote(s)));
      return Object.fromEntries(unique.map((s, i) => [s, results[i]!]));
    },

    searchSymbols: (query) =>
      load(`search:${query.trim().toLowerCase()}`, TTL.search, () => requireProvider(deps.quotes, "quote").searchSymbols(query.trim())),

    getCompanyProfile: (symbol) =>
      load(`profile:${norm(symbol)}`, TTL.profile, () => requireProvider(deps.quotes, "quote").getCompanyProfile(norm(symbol))),

    getBasicFinancials: (symbol) =>
      load(`metrics:${norm(symbol)}`, TTL.metrics, () => requireProvider(deps.quotes, "quote").getBasicFinancials(norm(symbol))),

    getNews: (symbol, days = 7) =>
      load(`news:${norm(symbol)}:${days}`, TTL.news, () => requireProvider(deps.quotes, "quote").getNews(norm(symbol), days)),

    getTreasuryCurve: (compareDate) =>
      load(`treasury:${compareDate ?? "latest"}`, TTL.treasury, () => requireProvider(deps.rates, "rates").getTreasuryCurve(compareDate)),

    getFundamentals: (symbol) =>
      load(`fundamentals:${norm(symbol)}`, TTL.fundamentals, () =>
        requireProvider(deps.fundamentals, "fundamentals").getFundamentals(norm(symbol)),
      ),
  };
  return service;
}
