import { getMarketData } from "@/lib/data/registry";
import { badRequest, parseSymbol, respond } from "@/lib/data/http-response";

export async function GET(request: Request) {
  const symbol = parseSymbol(new URL(request.url).searchParams.get("symbol"));
  if (!symbol) return badRequest("Provide a valid ticker symbol.");
  return respond(await getMarketData().getBasicFinancials(symbol), 3600);
}
