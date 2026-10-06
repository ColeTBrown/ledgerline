import { ProviderError } from "./errors";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchJsonOptions {
  fetch?: FetchLike;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Retries on 429 / 5xx / network errors. */
  retries?: number;
  /** Base backoff in ms; doubles each attempt (with jitter). */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Parse body as text instead of JSON. */
  as?: "json" | "text";
  /** Provider name for error messages. */
  provider: string;
  /**
   * How to report HTTP 401/403. Keyed providers default to `missing_key`;
   * keyless feeds should pass "unavailable" so a blocked request is not
   * mistaken for a credentials problem.
   */
  forbiddenAs?: "missing_key" | "unavailable";
  /** Override the message for 401/403 responses. */
  forbiddenMessage?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryAfterSeconds(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(0, n);
  const date = Date.parse(h);
  return Number.isNaN(date) ? undefined : Math.max(0, (date - Date.now()) / 1000);
}

/**
 * GET a URL with timeout, exponential backoff on 429/5xx/network errors
 * (honoring Retry-After up to 10s), and typed ProviderError failures.
 * Never logs or echoes the URL, which may contain an API key.
 */
export async function fetchWithRetry<T = unknown>(url: string, opts: FetchJsonOptions): Promise<T> {
  const {
    fetch: f = fetch,
    headers,
    timeoutMs = 8_000,
    retries = 2,
    backoffMs = 500,
    sleep = defaultSleep,
    as = "json",
    provider,
    forbiddenAs = "missing_key",
    forbiddenMessage,
  } = opts;
  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await f(url, { headers, signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (res.ok) {
        try {
          return (as === "text" ? await res.text() : await res.json()) as T;
        } catch {
          throw new ProviderError("unavailable", `${provider} returned an unreadable response.`);
        }
      }
      if (res.status === 401 || res.status === 403) {
        const fallback = forbiddenAs === "missing_key" ? `${provider} rejected the credentials.` : `${provider} refused the request.`;
        throw new ProviderError(forbiddenAs, forbiddenMessage ?? fallback);
      }
      if (res.status === 404) throw new ProviderError("not_found", `${provider} has no data for this request.`);
      if (res.status === 429) {
        const ra = retryAfterSeconds(res);
        lastError = new ProviderError("rate_limited", `${provider} rate limit reached.`, ra);
        if (attempt < retries && (ra === undefined || ra <= 10)) {
          await sleep(ra !== undefined ? ra * 1000 : backoffMs * 2 ** attempt * (1 + Math.random() * 0.25));
          continue;
        }
        throw lastError;
      }
      if (res.status >= 500) {
        lastError = new ProviderError("unavailable", `${provider} is temporarily unavailable.`);
        if (attempt < retries) {
          await sleep(backoffMs * 2 ** attempt * (1 + Math.random() * 0.25));
          continue;
        }
        throw lastError;
      }
      throw new ProviderError("unavailable", `${provider} request failed (HTTP ${res.status}).`);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ProviderError) throw e;
      // Network failure or timeout.
      lastError = new ProviderError("unavailable", `${provider} could not be reached.`);
      if (attempt < retries) {
        await sleep(backoffMs * 2 ** attempt * (1 + Math.random() * 0.25));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new ProviderError("unavailable", `${provider} could not be reached.`);
}
