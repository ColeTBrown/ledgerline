import { NextResponse } from "next/server";
import type { DataErrorReason, DataResult } from "./types";

const STATUS_FOR: Record<DataErrorReason, number> = {
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429,
  missing_key: 503,
  unavailable: 503,
};

export { normalizeSymbol as parseSymbol } from "./symbols";

export function badRequest(message: string) {
  return NextResponse.json({ ok: false, reason: "invalid_request", message } satisfies DataResult<never>, { status: 400 });
}

/**
 * JSON response for a DataResult. Successful responses get CDN caching
 * headers (s-maxage) so serverless instances share load against provider
 * quotas; failures are never cached at the edge.
 */
export function respond<T>(result: DataResult<T>, sMaxAge: number) {
  if (result.ok) {
    return NextResponse.json(result, {
      headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}` },
    });
  }
  return NextResponse.json(result, { status: STATUS_FOR[result.reason], headers: { "Cache-Control": "no-store" } });
}
