import { vi } from "vitest";
import type { FetchLike } from "@/lib/data/http";

export type Responder = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** A fetch mock that records calls and routes them to a responder. Never touches the network. */
export function mockFetch(responder: Responder) {
  const fn = vi.fn<FetchLike>(async (input, init) => responder(new URL(input), init));
  return fn;
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export const text = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/csv" } });

export const noSleep = async () => {};
