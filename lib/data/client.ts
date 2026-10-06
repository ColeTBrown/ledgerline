/**
 * Browser-side fetchers for /api/market/*. They always resolve to a
 * DataResult (never throw for provider failures) so the UI can show a quiet
 * manual-mode notice instead of an error screen.
 */
import type {
  BasicFinancials,
  CompanyProfile,
  DataResult,
  Fundamentals,
  NewsItem,
  Quote,
  SymbolMatch,
  TreasuryCurveSet,
} from "./types";

async function getResult<T>(path: string, signal?: AbortSignal): Promise<DataResult<T>> {
  try {
    const res = await fetch(path, { signal });
    const body = (await res.json()) as DataResult<T>;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, reason: "unavailable", message: "Unexpected response from the data service." };
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    return { ok: false, reason: "unavailable", message: "The data service could not be reached." };
  }
}

const enc = encodeURIComponent;

export const marketApi = {
  quote: (symbol: string, signal?: AbortSignal) => getResult<Quote>(`/api/market/quote?symbol=${enc(symbol)}`, signal),
  async quotes(symbols: readonly string[], signal?: AbortSignal): Promise<Record<string, DataResult<Quote>>> {
    if (symbols.length === 0) return {};
    try {
      const res = await fetch(`/api/market/quotes?symbols=${enc(symbols.join(","))}`, { signal });
      const body = (await res.json()) as { ok: boolean; quotes?: Record<string, DataResult<Quote>> };
      if (body.ok && body.quotes) return body.quotes;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
    }
    const failure: DataResult<Quote> = { ok: false, reason: "unavailable", message: "Quotes are unavailable." };
    return Object.fromEntries(symbols.map((s) => [s, failure]));
  },
  search: (q: string, signal?: AbortSignal) => getResult<SymbolMatch[]>(`/api/market/search?q=${enc(q)}`, signal),
  profile: (symbol: string, signal?: AbortSignal) => getResult<CompanyProfile>(`/api/market/profile?symbol=${enc(symbol)}`, signal),
  metrics: (symbol: string, signal?: AbortSignal) => getResult<BasicFinancials>(`/api/market/metrics?symbol=${enc(symbol)}`, signal),
  news: (symbol: string, days = 7, signal?: AbortSignal) => getResult<NewsItem[]>(`/api/market/news?symbol=${enc(symbol)}&days=${days}`, signal),
  fundamentals: (symbol: string, signal?: AbortSignal) => getResult<Fundamentals>(`/api/market/fundamentals?symbol=${enc(symbol)}`, signal),
  treasury: (compare?: string, signal?: AbortSignal) =>
    getResult<TreasuryCurveSet>(`/api/market/treasury${compare ? `?compare=${enc(compare)}` : ""}`, signal),
  async status(signal?: AbortSignal): Promise<MarketStatus | null> {
    try {
      const res = await fetch("/api/market/status", { signal });
      return res.ok ? ((await res.json()) as MarketStatus) : null;
    } catch {
      return null;
    }
  },
};

export interface MarketStatus {
  quotes: { provider: string | null; configured: boolean };
  rates: { provider: string | null; configured: boolean };
  fundamentals: { provider: string | null; configured: boolean };
}
