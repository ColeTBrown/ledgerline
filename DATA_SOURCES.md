# Data Sources

Ledgerline uses only **official, documented APIs**. It does not scrape websites or use unofficial endpoints. All provider calls go through thin server routes (`app/api/market/*`), so credentials never reach the browser. If a source is missing or failing, the affected inputs fall back to MANUAL and every tool keeps working.

> **Before selling Ledgerline commercially,** review the "Commercial use" column for each provider. The free Finnhub tier in particular **is not licensed for commercial redistribution**.

## Summary

| Provider | Used for | Key | Free-tier limits | Server cache | Badge | Commercial use |
| --- | --- | --- | --- | --- | --- | --- |
| [Finnhub](https://finnhub.io/docs/api) | Quotes, symbol search, company profile, basic financials (beta, P/E…), company news | `FINNHUB_API_KEY` | ~60 calls/min; personal use | Quotes 20s · profile/metrics 24h · news 10m · search 24h | LIVE (quote ≤ 15 min old) / DELAYED | **Requires a paid commercial plan** |
| [U.S. Treasury](https://home.treasury.gov/resource-center/data-chart-center/interest-rates) | Daily par yield curve, risk-free rates, 10Y in the ticker strip | none | No published limit; one CSV per calendar year | 12h | DELAYED (end of day) | Public domain U.S. government data; attribution recommended |
| [SEC EDGAR XBRL API](https://www.sec.gov/edgar/sec-api-documentation) | Annual financial statements (10-K / 20-F / 40-F), shares outstanding, ticker → CIK mapping | `SEC_USER_AGENT` (name + email) | 10 requests/sec per SEC fair-access policy | 24h | DELAYED (as filed) | Public U.S. government data; must follow SEC fair-access policy |

## Finnhub

- **Endpoints used:** `/quote`, `/search`, `/stock/profile2`, `/stock/metric?metric=all`, `/company-news`.
- **Rate limiting:**
  - A server-side token bucket (55 calls/min, burst 10) keeps the app under the free-tier ceiling.
  - HTTP 429 responses are retried with exponential backoff, honoring `Retry-After` up to 10 seconds.
  - If the limit is still hit, the last good value is served with a **CACHED** badge.
- **Polling:**
  - The ticker strip and on-screen quotes poll one batched route (`/api/market/quotes`) every 15 seconds.
  - Polling covers only symbols on screen and pauses while the tab is hidden.
  - Successful responses carry CDN `s-maxage` headers, so on Vercel many users share the same upstream call.
- **WebSocket:** not used. Finnhub's WebSocket needs the API key in the browser, which would expose it, and a server-side relay can't run on Vercel's serverless functions. A WebSocket relay on a long-running host is listed below as an upgrade.
- **License:** Finnhub's free tier is for personal, non-commercial use. Selling access to Finnhub data, or showing it to paying customers, requires a paid commercial plan. Check Finnhub's current terms of service before launch.

## U.S. Department of the Treasury: Daily Treasury Par Yield Curve Rates

- **Feed:** `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{YEAR}/all?type=daily_treasury_yield_curve&field_tdr_date_value={YEAR}&page&_format=csv`
- **Parsing:** columns are matched by header, so newly added tenors (such as the 6-week bill) are picked up automatically. Blank and `N/A` cells are skipped. Values arrive as percentages and are converted to decimals.
- **Risk-free rate:** every tool uses `interpolateYield`, which interpolates linearly on the latest curve at the tool's horizon (option expiry, DCF horizon, bond maturity). The user can override it, which flips the badge to MANUAL.
- **License:** U.S. government work, public domain. Attribution ("Source: U.S. Department of the Treasury") is shown on every badge.

## SEC EDGAR XBRL

- **Endpoints:** `https://www.sec.gov/files/company_tickers.json` (ticker → CIK) and `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`.
- **User-Agent:** the SEC requires a descriptive `User-Agent` with contact details. Set `SEC_USER_AGENT="Your Firm you@yourfirm.com"`. Without it, SEC data is disabled and the related inputs stay manual.
- **Rate limit:** 8 requests/sec via a token bucket, under the SEC's 10/sec limit. The SEC answers HTTP 403 for undeclared agents or after excessive requests. The app reports that as temporarily unavailable.
- **Extraction rules:**
  - Only annual forms are used (10-K, 20-F, 40-F and their amendments).
  - Duration items (income and cash-flow statements) must cover 350–380 days, because 10-Ks also include quarterly figures.
  - When the same period is reported more than once (for example a restatement), the latest filing wins.
  - Each line item tries several US-GAAP tags, since filers use different concepts (for example `RevenueFromContractWithCustomerExcludingAssessedTax`, then `Revenues`, then `SalesRevenueNet`).
  - **Derived fields** are labeled "(derived)" in the UI: EBITDA = operating income + D&A; total debt = long-term + current debt + short-term borrowings + commercial paper; gross profit = revenue − cost of revenue, when not reported directly.
  - Missing items are **null and shown as "—"**, never zero.
- **License:** public U.S. government data. Follow the SEC's [fair-access policy](https://www.sec.gov/os/accessing-edgar-data).

## Paid data upgrades

These features need data that isn't available free from an official source, so they stay **manual input** rather than showing estimated or fake values:

| Feature | Why it's manual today | Upgrade path |
| --- | --- | --- |
| Full options chains, live option quotes, IV surfaces | No free official source | Licensed options data (e.g. OPRA via a vendor) |
| Historical / intraday price series (charts, historical volatility, correlations, beta regression) | Finnhub moved candles to paid plans | Paid Finnhub tier or another licensed market-data vendor |
| Portfolio volatility and correlations from history | Needs historical prices | Same as above; until then, editable capital-market assumptions |
| Real-time streaming (WebSocket) ticker | Key exposure on the free tier; serverless can't hold sockets | Paid feed plus a server-side relay on a long-running host |
| Consensus estimates, forward multiples | Not in free tiers | Licensed estimates vendor |
| Bond quotes for individual CUSIPs | Not available free | Licensed fixed-income pricing |

## Swapping providers

1. Add an adapter in `lib/data/adapters/` that implements `QuoteProvider`, `RatesProvider` or `FundamentalsProvider` from `lib/data/types.ts`.
2. Register it in `lib/data/registry.ts` under a new value for `QUOTE_PROVIDER`, `RATES_PROVIDER` or `FUNDAMENTALS_PROVIDER`.
3. Set the env variable. Caching, dedupe, stale fallback, badges and the UI need no changes.
4. Add adapter tests with mocked responses in `tests/data/`, covering success, 429, outage and missing key.
