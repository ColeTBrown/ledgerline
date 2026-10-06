import { describe, expect, it } from "vitest";
import { createFinnhubAdapter } from "@/lib/data/adapters/finnhub";
import { TokenBucket } from "@/lib/data/rate-limit";
import { json, mockFetch, noSleep } from "../helpers/mock-fetch";

const NOW = Date.parse("2026-10-06T19:58:12Z");
const unlimited = () => new TokenBucket({ capacity: 1000, refillPerSecond: 1000 });

function adapter(responder: Parameters<typeof mockFetch>[0], opts: { apiKey?: string | undefined } = {}) {
  const apiKey = "apiKey" in opts ? opts.apiKey : "test-key";
  const fetch = mockFetch(responder);
  return { fetch, a: createFinnhubAdapter({ apiKey, fetch, limiter: unlimited(), now: () => NOW, sleep: noSleep }) };
}

describe("Finnhub adapter", () => {
  it("parses a quote and labels a fresh one LIVE", async () => {
    const { a, fetch } = adapter((url) => {
      expect(url.pathname).toBe("/api/v1/quote");
      expect(url.searchParams.get("symbol")).toBe("AAPL");
      expect(url.searchParams.get("token")).toBe("test-key");
      return json({ c: 231.5, d: 2.1, dp: 0.9155, h: 232, l: 228.9, o: 229.3, pc: 229.4, t: NOW / 1000 - 30 });
    });
    const r = await a.getQuote("AAPL");
    expect(r.status).toBe("LIVE");
    expect(r.source).toBe("Finnhub");
    expect(r.value.price).toBe(231.5);
    expect(r.value.changePercent).toBeCloseTo(0.009155, 8);
    expect(r.value.previousClose).toBe(229.4);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("labels an old quote (after the close) DELAYED", async () => {
    const { a } = adapter(() => json({ c: 100, d: 1, dp: 1, h: 101, l: 99, o: 99.5, pc: 99, t: NOW / 1000 - 3 * 3600 }));
    expect((await a.getQuote("SPY")).status).toBe("DELAYED");
  });

  it("treats Finnhub's all-zero payload as not_found", async () => {
    const { a } = adapter(() => json({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 }));
    await expect(a.getQuote("ZZZZ")).rejects.toMatchObject({ reason: "not_found" });
  });

  it("fails with missing_key without calling the API when no key is set", async () => {
    const { a, fetch } = adapter(() => json({}), { apiKey: undefined });
    await expect(a.getQuote("AAPL")).rejects.toMatchObject({ reason: "missing_key" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces rate limiting after retries", async () => {
    const { a, fetch } = adapter(() => json({ error: "API limit reached" }, 429));
    await expect(a.getQuote("AAPL")).rejects.toMatchObject({ reason: "rate_limited" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("surfaces outages as unavailable", async () => {
    const { a } = adapter(() => json({}, 502));
    await expect(a.getCompanyProfile("AAPL")).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("filters search results to plain symbols", async () => {
    const { a } = adapter(() =>
      json({
        count: 3,
        result: [
          { description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
          { description: "APPLE INC", displaySymbol: "AAPL.MX", symbol: "AAPL.MX", type: "Common Stock" },
          { description: "BINANCE APPLE", displaySymbol: "X", symbol: "BINANCE:AAPL", type: "Crypto" },
        ],
      }),
    );
    const r = await a.searchSymbols("apple");
    expect(r.value.map((m) => m.symbol)).toEqual(["AAPL", "AAPL.MX"]);
  });

  it("converts profile values reported in millions", async () => {
    const { a } = adapter(() =>
      json({ name: "Apple Inc", ticker: "AAPL", exchange: "NASDAQ NMS", marketCapitalization: 3_500_000, shareOutstanding: 15_000, finnhubIndustry: "Technology", weburl: "https://www.apple.com/" }),
    );
    const r = await a.getCompanyProfile("AAPL");
    expect(r.value.marketCap).toBe(3.5e12);
    expect(r.value.sharesOutstanding).toBe(1.5e10);
    expect(r.value.ipoDate).toBeNull();
  });

  it("maps basic financials, converting percent fields and leaving missing ones null", async () => {
    const { a } = adapter(() => json({ metric: { beta: 1.21, peTTM: 34.2, "52WeekHigh": 260, "52WeekLow": 164, dividendYieldIndicatedAnnual: 0.45, netProfitMarginTTM: 24.3 } }));
    const r = await a.getBasicFinancials("AAPL");
    expect(r.value.beta).toBe(1.21);
    expect(r.value.dividendYield).toBeCloseTo(0.0045, 10);
    expect(r.value.netMargin).toBeCloseTo(0.243, 10);
    expect(r.value.roe).toBeNull();
  });

  it("returns news newest first, dropping items without a valid URL", async () => {
    const { a } = adapter((url) => {
      expect(url.searchParams.get("from")).toBe("2026-09-29");
      expect(url.searchParams.get("to")).toBe("2026-10-06");
      return json([
        { id: 1, datetime: 1_759_700_000, headline: "Older", summary: "", source: "Wire", url: "https://news.test/1" },
        { id: 2, datetime: 1_759_780_000, headline: "Newer", summary: "", source: "Wire", url: "https://news.test/2" },
        { id: 3, datetime: 1_759_790_000, headline: "Bad link", summary: "", source: "Wire", url: "javascript:alert(1)" },
      ]);
    });
    const r = await a.getNews("AAPL", 7);
    expect(r.value.map((n) => n.headline)).toEqual(["Newer", "Older"]);
  });
});
