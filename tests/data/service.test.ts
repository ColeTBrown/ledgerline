import { describe, expect, it, vi } from "vitest";
import { createMarketDataService } from "@/lib/data/service";
import { MemoryCache } from "@/lib/data/cache";
import { ProviderError } from "@/lib/data/errors";
import type { ProviderValue, Quote, QuoteProvider } from "@/lib/data/types";

const quote = (symbol: string, price: number): ProviderValue<Quote> => ({
  value: { symbol, price, change: 0, changePercent: 0, open: null, high: null, low: null, previousClose: null, timestamp: "2026-10-06T19:00:00Z" },
  source: "Finnhub",
  asOf: "2026-10-06T19:00:00Z",
  status: "LIVE",
});

function provider(getQuote: QuoteProvider["getQuote"]): QuoteProvider {
  const unused = async () => {
    throw new ProviderError("unavailable", "unused");
  };
  return { name: "Mock", getQuote, searchSymbols: unused, getCompanyProfile: unused, getBasicFinancials: unused, getNews: unused };
}

describe("MarketDataService", () => {
  it("serves cache hits without calling the provider again", async () => {
    const get = vi.fn(async (s: string) => quote(s, 100));
    let t = 0;
    const svc = createMarketDataService({ quotes: provider(get), rates: null, fundamentals: null, cache: new MemoryCache(100, () => t), now: () => t });
    await svc.getQuote("aapl");
    const r = await svc.getQuote("AAPL");
    expect(r).toMatchObject({ ok: true, status: "LIVE", value: { price: 100 } });
    expect(get).toHaveBeenCalledTimes(1);
    t = 60_000; // past the 20s quote TTL
    await svc.getQuote("AAPL");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("serves the last good value as CACHED when the provider is rate-limited or down", async () => {
    let t = 0;
    let fail: ProviderError | null = null;
    const get = vi.fn(async (s: string) => {
      if (fail) throw fail;
      return quote(s, 101);
    });
    const svc = createMarketDataService({ quotes: provider(get), rates: null, fundamentals: null, cache: new MemoryCache(100, () => t), now: () => t });
    await svc.getQuote("SPY");
    t = 60_000;
    fail = new ProviderError("rate_limited", "limit");
    expect(await svc.getQuote("SPY")).toMatchObject({ ok: true, status: "CACHED", value: { price: 101 }, source: "Finnhub" });
    fail = new ProviderError("unavailable", "down");
    expect(await svc.getQuote("SPY")).toMatchObject({ ok: true, status: "CACHED" });
  });

  it("returns a typed failure (never fake data) when nothing is cached", async () => {
    const svc = createMarketDataService({
      quotes: provider(async () => {
        throw new ProviderError("unavailable", "down");
      }),
      rates: null,
      fundamentals: null,
    });
    expect(await svc.getQuote("SPY")).toEqual({ ok: false, reason: "unavailable", message: "down" });
  });

  it("maps unexpected exceptions to unavailable", async () => {
    const svc = createMarketDataService({
      quotes: provider(async () => {
        throw new Error("boom");
      }),
      rates: null,
      fundamentals: null,
    });
    expect(await svc.getQuote("SPY")).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("negative-caches unknown symbols briefly", async () => {
    const get = vi.fn(async () => {
      throw new ProviderError("not_found", "unknown");
    });
    const svc = createMarketDataService({ quotes: provider(get), rates: null, fundamentals: null });
    await svc.getQuote("ZZZZ");
    expect(await svc.getQuote("ZZZZ")).toMatchObject({ ok: false, reason: "not_found" });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("reports missing_key when a capability has no provider", async () => {
    const svc = createMarketDataService({ quotes: null, rates: null, fundamentals: null });
    expect(await svc.getQuote("SPY")).toMatchObject({ ok: false, reason: "missing_key" });
    expect(await svc.getTreasuryCurve()).toMatchObject({ ok: false, reason: "missing_key" });
    expect(await svc.getFundamentals("AAPL")).toMatchObject({ ok: false, reason: "missing_key" });
    expect(svc.status()).toEqual({ quotes: null, rates: null, fundamentals: null });
  });

  it("batches, dedupes and caps quote requests; concurrent calls share one fetch", async () => {
    const get = vi.fn(async (s: string) => {
      await new Promise((r) => setTimeout(r, 2));
      return quote(s, 1);
    });
    const svc = createMarketDataService({ quotes: provider(get), rates: null, fundamentals: null });
    const r = await svc.getQuotes(["spy", "SPY", "qqq"]);
    expect(Object.keys(r).sort()).toEqual(["QQQ", "SPY"]);
    expect(get).toHaveBeenCalledTimes(2);
    const many = await svc.getQuotes(Array.from({ length: 40 }, (_, i) => `S${i}`));
    expect(Object.keys(many)).toHaveLength(25);
    get.mockClear();
    await Promise.all([svc.getQuote("NEW"), svc.getQuote("NEW"), svc.getQuote("new")]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
