import { NextResponse } from "next/server";
import { credentialStatus, getMarketData } from "@/lib/data/registry";

/** Which data providers are configured — never exposes credentials themselves. */
export async function GET() {
  const status = getMarketData().status();
  const creds = credentialStatus();
  return NextResponse.json(
    {
      quotes: { provider: status.quotes, configured: Boolean(status.quotes) && creds.finnhub },
      rates: { provider: status.rates, configured: Boolean(status.rates) },
      fundamentals: { provider: status.fundamentals, configured: Boolean(status.fundamentals) && creds.sec },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
