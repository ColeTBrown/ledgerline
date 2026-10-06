import { getMarketData } from "@/lib/data/registry";
import { badRequest, respond } from "@/lib/data/http-response";

/** Latest Treasury par yield curve, previous day, and optional ?compare=YYYY-MM-DD. */
export async function GET(request: Request) {
  const compare = new URL(request.url).searchParams.get("compare") ?? undefined;
  if (compare !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(compare) || Number.isNaN(Date.parse(compare)))) {
    return badRequest("Comparison date must be YYYY-MM-DD.");
  }
  if (compare && Number(compare.slice(0, 4)) < 1990) return badRequest("Treasury par curve data starts in 1990.");
  return respond(await getMarketData().getTreasuryCurve(compare), 3600);
}
