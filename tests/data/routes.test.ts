import { describe, expect, it } from "vitest";
import { GET as quoteGET } from "@/app/api/market/quote/route";
import { GET as quotesGET } from "@/app/api/market/quotes/route";
import { GET as searchGET } from "@/app/api/market/search/route";
import { GET as treasuryGET } from "@/app/api/market/treasury/route";
import { GET as statusGET } from "@/app/api/market/status/route";

// vitest.config sets FINNHUB_API_KEY="" and RATES_PROVIDER=none: no route here can reach the network.
const req = (path: string) => new Request(`http://localhost${path}`);

describe("market API routes", () => {
  it("validate symbols", async () => {
    expect((await quoteGET(req("/api/market/quote"))).status).toBe(400);
    expect((await quoteGET(req("/api/market/quote?symbol=%3Cscript%3E"))).status).toBe(400);
    expect((await quotesGET(req("/api/market/quotes?symbols="))).status).toBe(400);
    expect((await quotesGET(req(`/api/market/quotes?symbols=${Array.from({ length: 26 }, (_, i) => `S${i}`).join(",")}`))).status).toBe(400);
    expect((await searchGET(req("/api/market/search?q="))).status).toBe(400);
    expect((await treasuryGET(req("/api/market/treasury?compare=yesterday"))).status).toBe(400);
  });

  it("degrade to a 503 missing_key result when no API key is configured", async () => {
    const res = await quoteGET(req("/api/market/quote?symbol=AAPL"));
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ ok: false, reason: "missing_key" });
  });

  it("return per-symbol results for batches", async () => {
    const res = await quotesGET(req("/api/market/quotes?symbols=SPY,QQQ"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.quotes.SPY).toMatchObject({ ok: false, reason: "missing_key" });
  });

  it("report provider configuration without exposing credentials", async () => {
    const body = await (await statusGET()).json();
    expect(body.quotes).toEqual({ provider: "Finnhub", configured: false });
    expect(body.rates).toEqual({ provider: null, configured: false });
    expect(JSON.stringify(body)).not.toMatch(/key|token|user.?agent/i);
  });
});
