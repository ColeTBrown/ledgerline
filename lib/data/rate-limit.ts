import { ProviderError } from "./errors";

export interface TokenBucketOptions {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
  /** Longest a caller will wait for a token before failing fast (ms). */
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Token-bucket limiter keeping us under provider quotas
 * (Finnhub ≈ 60/min, SEC 10/s). Callers `await take()`; if a token would
 * take longer than `maxWaitMs` to become available, it throws a
 * `rate_limited` ProviderError instead of queueing indefinitely.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxWaitMs: number;

  constructor(private readonly opts: TokenBucketOptions) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxWaitMs = opts.maxWaitMs ?? 5_000;
    this.tokens = opts.capacity;
    this.last = this.now();
  }

  private refill(): void {
    const t = this.now();
    const elapsed = (t - this.last) / 1000;
    this.tokens = Math.min(this.opts.capacity, this.tokens + elapsed * this.opts.refillPerSecond);
    this.last = t;
  }

  /** Tokens currently available (after refill). */
  available(): number {
    this.refill();
    return this.tokens;
  }

  async take(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.opts.refillPerSecond) * 1000;
    if (waitMs > this.maxWaitMs) {
      throw new ProviderError("rate_limited", "Request quota reached; please retry shortly.", Math.ceil(waitMs / 1000));
    }
    // Reserve the token now so concurrent callers queue behind us.
    this.tokens -= 1;
    await this.sleep(waitMs);
  }
}
