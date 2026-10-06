import { getMarketData } from "@/lib/data/registry";
import { badRequest, respond } from "@/lib/data/http-response";

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 40 || !/^[\w .&'\-]+$/.test(q)) return badRequest("Enter 1–40 letters, numbers or spaces.");
  return respond(await getMarketData().searchSymbols(q), 3600);
}
