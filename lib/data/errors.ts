import type { DataErrorReason } from "./types";

/** Error thrown by adapters; the service maps it to a DataResult failure. */
export class ProviderError extends Error {
  constructor(
    public readonly reason: DataErrorReason,
    message: string,
    /** Seconds the provider asked us to wait (from Retry-After), if any. */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}
