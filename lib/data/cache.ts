/**
 * Server-side TTL cache with LRU eviction, stale reads (to serve CACHED data
 * when a provider is down or rate-limited) and in-flight request dedupe.
 * Behind the {@link CacheStore} interface so Redis / Vercel KV can replace
 * the in-memory store without touching callers.
 */

export interface CacheEntry<T> {
  value: T;
  /** Epoch ms when the entry was stored. */
  storedAt: number;
  /** Epoch ms after which the entry is stale (still readable via getStale). */
  expiresAt: number;
}

export interface CacheStore {
  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
}

export class MemoryCache implements CacheStore {
  private readonly map = new Map<string, CacheEntry<unknown>>();

  constructor(
    private readonly maxEntries = 2000,
    private readonly now: () => number = Date.now,
  ) {}

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Refresh recency for LRU.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry as CacheEntry<T>;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const t = this.now();
    this.map.delete(key);
    this.map.set(key, { value, storedAt: t, expiresAt: t + ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Collapses concurrent calls for the same key into one promise. */
export class InflightDeduper {
  private readonly pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const p = fn().finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  get size(): number {
    return this.pending.size;
  }
}

/** Cache TTLs per data type (ms). */
export const TTL = {
  quote: 20_000,
  search: 24 * 60 * 60_000,
  profile: 24 * 60 * 60_000,
  metrics: 24 * 60 * 60_000,
  news: 10 * 60_000,
  treasury: 12 * 60 * 60_000,
  fundamentals: 24 * 60 * 60_000,
  secTickers: 24 * 60 * 60_000,
} as const;
