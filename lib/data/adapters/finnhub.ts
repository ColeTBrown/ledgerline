/**
 * Finnhub adapter (https://finnhub.io/docs/api) — free tier.
 * Quotes, symbol search, company profile, basic financials and company news.
 * The API key is read server-side only and sent as the documented `token`
 * query parameter; URLs are never logged.
 */
import { ProviderError } from "../errors";
import { fetchWithRetry, type FetchLike } from "../http";
import { TokenBucket } from "../rate-limit";
import type { BasicFinancials, CompanyProfile, NewsItem, ProviderValue, Quote, QuoteProvider, SymbolMatch } from "../types";

const BASE = "https://finnhub.io/api/v1";
const SOURCE = "Finnhub";
/** A quote older than this is labeled DELAYED (e.g. after the close). */
const LIVE_WINDOW_MS = 15 * 60_000;

export interface FinnhubOptions {
  apiKey: string | undefined;
  fetch?: FetchLike;
  limiter?: TokenBucket;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface RawQuote { c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number; t: number }
interface RawSearch { count: number; result: Array<{ description: string; displaySymbol: string; symbol: string; type: string }> }
interface RawProfile {
  country?: string; currency?: string; exchange?: string; ipo?: string; marketCapitalization?: number; name?: string;
  shareOutstanding?: number; ticker?: string; weburl?: string; logo?: string; finnhubIndustry?: string;
}
interface RawMetric { metric?: Record<string, number | string | null | undefined> }
interface RawNews { id: number; datetime: number; headline: string; summary: string; source: string; url: string }

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
/** Finnhub reports some ratios in percent (e.g. 12.5 = 12.5%). */
const pct = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : n / 100;
};

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Default limiter: 55 calls/minute with a burst of 10 (free tier is ~60/min). */
export function finnhubLimiter(): TokenBucket {
  return new TokenBucket({ capacity: 10, refillPerSecond: 55 / 60, maxWaitMs: 3_000 });
}

export function createFinnhubAdapter(opts: FinnhubOptions): QuoteProvider {
  const now = opts.now ?? Date.now;
  const limiter = opts.limiter ?? finnhubLimiter();

  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!opts.apiKey) throw new ProviderError("missing_key", "Finnhub API key is not configured.");
    await limiter.take();
    const qs = new URLSearchParams({ ...params, token: opts.apiKey });
    return fetchWithRetry<T>(`${BASE}${path}?${qs.toString()}`, { provider: SOURCE, fetch: opts.fetch, sleep: opts.sleep });
  }

  function wrap<T>(value: T, asOf: number, status: "LIVE" | "DELAYED" = "LIVE"): ProviderValue<T> {
    return { value, source: SOURCE, asOf: new Date(asOf).toISOString(), status };
  }

  return {
    name: SOURCE,

    async getQuote(symbol) {
      const q = await get<RawQuote>("/quote", { symbol });
      // Finnhub returns zeros for unknown symbols.
      if (!q || (q.c === 0 && q.t === 0) || num(q.c) === null) {
        throw new ProviderError("not_found", `No quote available for ${symbol}.`);
      }
      const ts = q.t > 0 ? q.t * 1000 : now();
      const quote: Quote = {
        symbol,
        price: q.c,
        change: num(q.d) ?? q.c - q.pc,
        changePercent: q.dp !== null && Number.isFinite(q.dp) ? q.dp / 100 : q.pc ? q.c / q.pc - 1 : 0,
        open: num(q.o) || null,
        high: num(q.h) || null,
        low: num(q.l) || null,
        previousClose: num(q.pc) || null,
        timestamp: new Date(ts).toISOString(),
      };
      return wrap(quote, ts, now() - ts <= LIVE_WINDOW_MS ? "LIVE" : "DELAYED");
    },

    async searchSymbols(query) {
      const r = await get<RawSearch>("/search", { q: query });
      const matches: SymbolMatch[] = (r?.result ?? [])
        .filter((m) => m.symbol && !m.symbol.includes(":"))
        .slice(0, 20)
        .map((m) => ({ symbol: m.symbol, description: m.description, type: m.type, displaySymbol: m.displaySymbol }));
      return wrap(matches, now());
    },

    async getCompanyProfile(symbol) {
      const p = await get<RawProfile>("/stock/profile2", { symbol });
      if (!p || !p.name) throw new ProviderError("not_found", `No profile available for ${symbol}.`);
      const millions = (v: unknown) => {
        const n = num(v);
        return n === null ? null : n * 1e6;
      };
      const profile: CompanyProfile = {
        symbol,
        name: p.name,
        exchange: str(p.exchange),
        industry: str(p.finnhubIndustry),
        country: str(p.country),
        currency: str(p.currency),
        ipoDate: str(p.ipo),
        website: str(p.weburl),
        logoUrl: str(p.logo),
        marketCap: millions(p.marketCapitalization),
        sharesOutstanding: millions(p.shareOutstanding),
      };
      return wrap(profile, now());
    },

    async getBasicFinancials(symbol) {
      const r = await get<RawMetric>("/stock/metric", { symbol, metric: "all" });
      const m = r?.metric;
      if (!m || Object.keys(m).length === 0) throw new ProviderError("not_found", `No metrics available for ${symbol}.`);
      const financials: BasicFinancials = {
        symbol,
        beta: num(m["beta"]),
        peRatio: num(m["peTTM"]) ?? num(m["peBasicExclExtraTTM"]),
        eps: num(m["epsTTM"]) ?? num(m["epsBasicExclExtraItemsTTM"]),
        dividendYield: pct(m["dividendYieldIndicatedAnnual"]) ?? pct(m["currentDividendYieldTTM"]),
        week52High: num(m["52WeekHigh"]),
        week52Low: num(m["52WeekLow"]),
        netMargin: pct(m["netProfitMarginTTM"]),
        roe: pct(m["roeTTM"]),
        currentRatio: num(m["currentRatioQuarterly"]) ?? num(m["currentRatioAnnual"]),
        debtToEquity: num(m["totalDebt/totalEquityQuarterly"]) ?? num(m["totalDebt/totalEquityAnnual"]),
      };
      return wrap(financials, now());
    },

    async getNews(symbol, days) {
      const to = now();
      const from = to - Math.max(1, Math.min(days, 30)) * 86_400_000;
      const items = await get<RawNews[]>("/company-news", { symbol, from: isoDate(from), to: isoDate(to) });
      const news: NewsItem[] = (Array.isArray(items) ? items : [])
        .filter((n) => n.headline && /^https?:\/\//.test(n.url))
        .sort((a, b) => b.datetime - a.datetime)
        .slice(0, 15)
        .map((n) => ({
          id: String(n.id),
          headline: n.headline,
          summary: n.summary ?? "",
          source: n.source ?? "",
          url: n.url,
          publishedAt: new Date(n.datetime * 1000).toISOString(),
        }));
      return wrap(news, to);
    },
  };
}
