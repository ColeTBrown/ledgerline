import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/data/registry";
import { badRequest, parseSymbol } from "@/lib/data/http-response";

/** Batched quotes for on-screen symbols: ?symbols=SPY,QQQ (max 25). Per-symbol results. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return badRequest("Provide one or more symbols.");
  if (parts.length > 25) return badRequest("At most 25 symbols per request.");
  const symbols = parts.map(parseSymbol);
  if (symbols.some((s) => s === null)) return badRequest("One or more symbols are invalid.");
  const quotes = await getMarketData().getQuotes(symbols as string[]);
  return NextResponse.json({ ok: true, quotes }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
}
