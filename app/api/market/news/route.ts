import { getMarketData } from "@/lib/data/registry";
import { badRequest, parseSymbol, respond } from "@/lib/data/http-response";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = parseSymbol(params.get("symbol"));
  if (!symbol) return badRequest("Provide a valid ticker symbol.");
  const days = Math.min(30, Math.max(1, Math.round(Number(params.get("days") ?? 7)) || 7));
  return respond(await getMarketData().getNews(symbol, days), 300);
}
