import { describe, expect, it, vi } from "vitest";
import { InflightDeduper, MemoryCache } from "@/lib/data/cache";
import { TokenBucket } from "@/lib/data/rate-limit";
import { fetchWithRetry } from "@/lib/data/http";
import { ProviderError } from "@/lib/data/errors";
import { json, mockFetch, noSleep } from "../helpers/mock-fetch";

describe("MemoryCache", () => {
  it("expires entries by TTL but keeps them readable for stale fallback", () => {
    let t = 1000;
    const c = new MemoryCache(10, () => t);
    c.set("a", 1, 500);
    expect(c.get<number>("a")!.expiresAt).toBe(1500);
    t = 2000;
    const e = c.get<number>("a")!;
    expect(e.value).toBe(1);
    expect(t >= e.expiresAt).toBe(true);
  });
  it("evicts least recently used entries", () => {
    const c = new MemoryCache(2);
    c.set("a", 1, 1000);
    c.set("b", 2, 1000);
    c.get("a");
    c.set("c", 3, 1000);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBeDefined();
    expect(c.size).toBe(2);
  });
});

describe("InflightDeduper", () => {
  it("shares one promise across concurrent callers", async () => {
    const d = new InflightDeduper();
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 42;
    });
    const [a, b] = await Promise.all([d.run("k", fn), d.run("k", fn)]);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(d.size).toBe(0);
  });
});

describe("TokenBucket", () => {
  it("allows a burst then waits for refill", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 1, now: () => t, sleep: async (ms) => void sleeps.push(ms) });
    await bucket.take();
    await bucket.take();
    expect(sleeps).toEqual([]);
    await bucket.take();
    expect(sleeps[0]).toBeCloseTo(1000, 6);
    t = 5000;
    expect(bucket.available()).toBe(2);
  });
  it("fails fast with rate_limited when the wait would be too long", async () => {
    const bucket = new TokenBucket({ capacity: 1, refillPerSecond: 0.1, maxWaitMs: 1000, now: () => 0, sleep: noSleep });
    await bucket.take();
    await expect(bucket.take()).rejects.toMatchObject({ reason: "rate_limited" });
  });
});

describe("fetchWithRetry", () => {
  const opts = { provider: "Test", sleep: noSleep };
  it("retries 429 then succeeds, honoring Retry-After", async () => {
    let calls = 0;
    const sleep = vi.fn(noSleep);
    const f = mockFetch(() => (++calls === 1 ? json({}, 429, { "retry-after": "2" }) : json({ ok: 1 })));
    await expect(fetchWithRetry("https://x.test/a", { ...opts, fetch: f, sleep })).resolves.toEqual({ ok: 1 });
    expect(sleep).toHaveBeenCalledWith(2000);
  });
  it("gives up after retries with rate_limited", async () => {
    const f = mockFetch(() => json({}, 429));
    await expect(fetchWithRetry("https://x.test/a", { ...opts, fetch: f, retries: 2 })).rejects.toMatchObject({ reason: "rate_limited" });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("does not wait for very long Retry-After values", async () => {
    const f = mockFetch(() => json({}, 429, { "retry-after": "120" }));
    await expect(fetchWithRetry("https://x.test/a", { ...opts, fetch: f })).rejects.toMatchObject({ reason: "rate_limited", retryAfter: 120 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("maps outages, auth failures, 404s and network errors", async () => {
    await expect(fetchWithRetry("https://x.test", { ...opts, fetch: mockFetch(() => json({}, 503)) })).rejects.toMatchObject({ reason: "unavailable" });
    await expect(fetchWithRetry("https://x.test", { ...opts, fetch: mockFetch(() => json({}, 401)) })).rejects.toMatchObject({ reason: "missing_key" });
    await expect(fetchWithRetry("https://x.test", { ...opts, fetch: mockFetch(() => json({}, 404)) })).rejects.toMatchObject({ reason: "not_found" });
    const down = mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchWithRetry("https://x.test", { ...opts, fetch: down })).rejects.toBeInstanceOf(ProviderError);
    expect(down).toHaveBeenCalledTimes(3);
  });
  it("treats malformed JSON as unavailable", async () => {
    const f = mockFetch(() => new Response("<html>oops</html>", { status: 200 }));
    await expect(fetchWithRetry("https://x.test", { ...opts, fetch: f })).rejects.toMatchObject({ reason: "unavailable" });
  });
  it("never includes the URL (which may carry an API key) in error messages", async () => {
    const f = mockFetch(() => json({}, 500));
    const err = await fetchWithRetry("https://x.test/?token=SECRET", { ...opts, fetch: f }).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain("SECRET");
  });
});
