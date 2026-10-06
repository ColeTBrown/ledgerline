/**
 * Market data domain types and the provider interface.
 *
 * Every adapter (Finnhub, U.S. Treasury, SEC EDGAR, or a paid replacement)
 * implements one or more capability interfaces below. The service composes
 * them into a single {@link MarketDataProvider}, so swapping a provider means
 * writing one adapter file and changing one env variable.
 */
import type { SourceStatus, Sourced } from "./sourced";

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  /** ISO timestamp of the last trade / quote update. */
  timestamp: string;
}

export interface SymbolMatch {
  symbol: string;
  description: string;
  type: string;
  displaySymbol: string;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  exchange: string | null;
  industry: string | null;
  country: string | null;
  currency: string | null;
  ipoDate: string | null;
  website: string | null;
  logoUrl: string | null;
  /** Market capitalization in absolute currency units. */
  marketCap: number | null;
  /** Shares outstanding (absolute count). */
  sharesOutstanding: number | null;
}

export interface BasicFinancials {
  symbol: string;
  beta: number | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  netMargin: number | null;
  roe: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  /** ISO timestamp. */
  publishedAt: string;
}

export interface CurvePointLabeled {
  /** Treasury label, e.g. "3M", "10Y". */
  tenor: string;
  tenorYears: number;
  /** Decimal yield (0.0425 = 4.25%). */
  yield: number;
}

export interface TreasuryCurve {
  /** ISO date (YYYY-MM-DD) of the curve. */
  date: string;
  points: CurvePointLabeled[];
}

export interface TreasuryCurveSet {
  latest: TreasuryCurve;
  /** The business day before `latest`, for daily change. */
  previous: TreasuryCurve | null;
  /** Curve on or before the requested comparison date, if requested. */
  comparison: TreasuryCurve | null;
}

/** Field names follow lib/finance/ratios FinancialStatement for direct reuse. */
export const FUNDAMENTAL_FIELDS = [
  "revenue",
  "costOfRevenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "depreciationAmortization",
  "interestExpense",
  "incomeTaxExpense",
  "pretaxIncome",
  "totalAssets",
  "totalLiabilities",
  "totalEquity",
  "currentAssets",
  "currentLiabilities",
  "cash",
  "shortTermInvestments",
  "receivables",
  "inventory",
  "payables",
  "totalDebt",
  "operatingCashFlow",
  "capitalExpenditure",
  "ebitda",
  "dilutedShares",
] as const;
export type FundamentalField = (typeof FUNDAMENTAL_FIELDS)[number];

export interface FundamentalPeriod {
  /** e.g. "FY2025" — the calendar year of the fiscal period end. */
  fiscalYear: string;
  periodEnd: string;
  form: string;
  filed: string;
  accessionNumber: string;
  values: Record<FundamentalField, number | null>;
  /** Fields computed from other line items rather than reported directly. */
  derived: FundamentalField[];
}

export interface Fundamentals {
  symbol: string;
  cik: string;
  entityName: string;
  /** Annual periods, newest first. */
  periods: FundamentalPeriod[];
  sharesOutstanding: { value: number; asOf: string } | null;
}

/** Why a request failed — drives the quiet manual-mode notices in the UI. */
export type DataErrorReason = "missing_key" | "rate_limited" | "unavailable" | "not_found" | "invalid_request";

export type DataResult<T> =
  | ({ ok: true } & Sourced<T>)
  | { ok: false; reason: DataErrorReason; message: string };

/** Value plus the status an adapter assigns to fresh data. */
export interface ProviderValue<T> {
  value: T;
  source: string;
  asOf: string;
  status: Exclude<SourceStatus, "CACHED" | "MANUAL">;
}

export interface QuoteProvider {
  readonly name: string;
  getQuote(symbol: string): Promise<ProviderValue<Quote>>;
  searchSymbols(query: string): Promise<ProviderValue<SymbolMatch[]>>;
  getCompanyProfile(symbol: string): Promise<ProviderValue<CompanyProfile>>;
  getBasicFinancials(symbol: string): Promise<ProviderValue<BasicFinancials>>;
  getNews(symbol: string, days: number): Promise<ProviderValue<NewsItem[]>>;
}

export interface RatesProvider {
  readonly name: string;
  getTreasuryCurve(compareDate?: string): Promise<ProviderValue<TreasuryCurveSet>>;
}

export interface FundamentalsProvider {
  readonly name: string;
  getFundamentals(symbol: string): Promise<ProviderValue<Fundamentals>>;
}

/** The single interface the rest of the app talks to (server side). */
export interface MarketDataProvider {
  getQuote(symbol: string): Promise<DataResult<Quote>>;
  getQuotes(symbols: readonly string[]): Promise<Record<string, DataResult<Quote>>>;
  searchSymbols(query: string): Promise<DataResult<SymbolMatch[]>>;
  getCompanyProfile(symbol: string): Promise<DataResult<CompanyProfile>>;
  getBasicFinancials(symbol: string): Promise<DataResult<BasicFinancials>>;
  getNews(symbol: string, days?: number): Promise<DataResult<NewsItem[]>>;
  getTreasuryCurve(compareDate?: string): Promise<DataResult<TreasuryCurveSet>>;
  getFundamentals(symbol: string): Promise<DataResult<Fundamentals>>;
}
