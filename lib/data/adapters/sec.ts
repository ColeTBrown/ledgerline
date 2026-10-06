/**
 * SEC EDGAR XBRL "companyfacts" adapter (https://www.sec.gov/edgar/sec-api-documentation).
 * Keyless, but the SEC requires a descriptive User-Agent with contact email
 * (env SEC_USER_AGENT) and at most 10 requests/second.
 *
 * Extracts annual (10-K / 20-F / 40-F, fiscal-year) values for common line
 * items, trying several us-gaap tags per item because filers use different
 * concepts. Items that cannot be found are null — never zero.
 */
import { ProviderError } from "../errors";
import { fetchWithRetry, type FetchLike } from "../http";
import { TokenBucket } from "../rate-limit";
import {
  FUNDAMENTAL_FIELDS,
  type FundamentalField,
  type FundamentalPeriod,
  type Fundamentals,
  type FundamentalsProvider,
} from "../types";

const SOURCE = "SEC EDGAR";
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const FACTS_URL = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

export interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyFactsResponse {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { label?: string; units: Record<string, XbrlFact[]> }>>;
}

type Kind = "duration" | "instant";

/** Candidate us-gaap concepts per field, in priority order. */
export const CONCEPT_MAP: Record<Exclude<FundamentalField, "ebitda" | "totalDebt">, { kind: Kind; tags: string[]; unit?: string }> = {
  revenue: {
    kind: "duration",
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueGoodsNet",
    ],
  },
  costOfRevenue: { kind: "duration", tags: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"] },
  grossProfit: { kind: "duration", tags: ["GrossProfit"] },
  operatingIncome: { kind: "duration", tags: ["OperatingIncomeLoss"] },
  netIncome: { kind: "duration", tags: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"] },
  depreciationAmortization: {
    kind: "duration",
    tags: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet", "Depreciation"],
  },
  interestExpense: { kind: "duration", tags: ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"] },
  incomeTaxExpense: { kind: "duration", tags: ["IncomeTaxExpenseBenefit"] },
  pretaxIncome: {
    kind: "duration",
    tags: [
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ],
  },
  totalAssets: { kind: "instant", tags: ["Assets"] },
  totalLiabilities: { kind: "instant", tags: ["Liabilities"] },
  totalEquity: { kind: "instant", tags: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"] },
  currentAssets: { kind: "instant", tags: ["AssetsCurrent"] },
  currentLiabilities: { kind: "instant", tags: ["LiabilitiesCurrent"] },
  cash: { kind: "instant", tags: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"] },
  shortTermInvestments: { kind: "instant", tags: ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"] },
  receivables: { kind: "instant", tags: ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"] },
  inventory: { kind: "instant", tags: ["InventoryNet"] },
  payables: { kind: "instant", tags: ["AccountsPayableCurrent"] },
  operatingCashFlow: { kind: "duration", tags: ["NetCashProvidedByUsedInOperatingActivities"] },
  capitalExpenditure: { kind: "duration", tags: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"] },
  dilutedShares: { kind: "duration", tags: ["WeightedAverageNumberOfDilutedSharesOutstanding"], unit: "shares" },
};

/** Debt components summed into totalDebt (derived). */
const DEBT_COMPONENTS: Array<{ tags: string[] }> = [
  { tags: ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"] },
  { tags: ["LongTermDebtCurrent", "DebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"] },
  { tags: ["ShortTermBorrowings"] },
  { tags: ["CommercialPaper"] },
];

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

/**
 * Annual facts for one concept, keyed by period end date. For duration
 * concepts only ~12-month periods are kept (10-Ks also contain quarterly
 * figures). When several filings report the same period, the latest filing
 * (e.g. a restatement) wins.
 */
export function annualFacts(facts: readonly XbrlFact[], kind: Kind): Map<string, XbrlFact> {
  const byEnd = new Map<string, XbrlFact>();
  for (const f of facts) {
    if (!ANNUAL_FORMS.has(f.form) || !Number.isFinite(f.val)) continue;
    if (kind === "duration") {
      if (!f.start) continue;
      const d = daysBetween(f.start, f.end);
      if (d < 350 || d > 380) continue;
    } else if (f.start) {
      continue;
    }
    const prev = byEnd.get(f.end);
    if (!prev || f.filed > prev.filed) byEnd.set(f.end, f);
  }
  return byEnd;
}

function conceptFacts(data: CompanyFactsResponse, tag: string, unit = "USD"): XbrlFact[] {
  return data.facts["us-gaap"]?.[tag]?.units[unit] ?? [];
}

/** Values for the first tag (in priority order) that has data for each period end. */
function resolveField(data: CompanyFactsResponse, tags: string[], kind: Kind, unit?: string): Map<string, XbrlFact> {
  const merged = new Map<string, XbrlFact>();
  for (const tag of tags) {
    for (const [end, fact] of annualFacts(conceptFacts(data, tag, unit), kind)) {
      if (!merged.has(end)) merged.set(end, fact);
    }
  }
  return merged;
}

/**
 * Turn a companyfacts payload into up to `maxPeriods` annual periods (newest
 * first). Period ends are anchored on revenue, net income or total assets;
 * EBITDA (= operating income + D&A) and total debt are derived and flagged.
 */
export function extractFundamentals(data: CompanyFactsResponse, symbol: string, maxPeriods = 5): Fundamentals {
  const fieldMaps = new Map<FundamentalField, Map<string, XbrlFact>>();
  for (const [field, spec] of Object.entries(CONCEPT_MAP) as Array<[keyof typeof CONCEPT_MAP, (typeof CONCEPT_MAP)[keyof typeof CONCEPT_MAP]]>) {
    fieldMaps.set(field, resolveField(data, spec.tags, spec.kind, spec.unit));
  }
  const debtMaps = DEBT_COMPONENTS.map((c) => resolveField(data, c.tags, "instant"));
  const totalDebtFallback = resolveField(data, ["LongTermDebt", "DebtInstrumentCarryingAmount"], "instant");

  const anchors = new Set<string>();
  for (const f of ["revenue", "netIncome", "totalAssets"] as const) for (const end of fieldMaps.get(f)!.keys()) anchors.add(end);
  const ends = [...anchors].sort((a, b) => (a < b ? 1 : -1));

  // Collapse period ends within ~2 weeks of each other (52/53-week fiscal years report slightly different instants).
  const periodEnds: string[] = [];
  for (const e of ends) if (!periodEnds.some((p) => Math.abs(daysBetween(e, p)) < 15)) periodEnds.push(e);

  const near = (map: Map<string, XbrlFact>, end: string): XbrlFact | undefined => {
    const exact = map.get(end);
    if (exact) return exact;
    for (const [k, v] of map) if (Math.abs(daysBetween(k, end)) < 15) return v;
    return undefined;
  };

  const periods: FundamentalPeriod[] = periodEnds.slice(0, maxPeriods).map((end) => {
    const values = Object.fromEntries(FUNDAMENTAL_FIELDS.map((f) => [f, null])) as Record<FundamentalField, number | null>;
    const derived: FundamentalField[] = [];
    let latestFact: XbrlFact | undefined;
    for (const [field, map] of fieldMaps) {
      const fact = near(map, end);
      if (fact) {
        values[field] = fact.val;
        if (!latestFact || fact.filed > latestFact.filed) latestFact = fact;
      }
    }
    const debtParts = debtMaps.map((m) => near(m, end)?.val).filter((v): v is number => typeof v === "number");
    if (debtParts.length > 0) {
      values.totalDebt = debtParts.reduce((s, v) => s + v, 0);
      derived.push("totalDebt");
    } else {
      const fallback = near(totalDebtFallback, end);
      if (fallback) values.totalDebt = fallback.val;
    }
    if (values.operatingIncome !== null && values.depreciationAmortization !== null) {
      values.ebitda = values.operatingIncome + values.depreciationAmortization;
      derived.push("ebitda");
    }
    if (values.grossProfit === null && values.revenue !== null && values.costOfRevenue !== null) {
      values.grossProfit = values.revenue - values.costOfRevenue;
      derived.push("grossProfit");
    }
    return {
      fiscalYear: `FY${end.slice(0, 4)}`,
      periodEnd: end,
      form: latestFact?.form ?? "10-K",
      filed: latestFact?.filed ?? end,
      accessionNumber: latestFact?.accn ?? "",
      values,
      derived,
    };
  });

  const sharesFacts = data.facts["dei"]?.["EntityCommonStockSharesOutstanding"]?.units["shares"] ?? [];
  const latestShares = [...sharesFacts].sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : a.filed < b.filed ? 1 : -1))[0];

  return {
    symbol,
    cik: String(data.cik).padStart(10, "0"),
    entityName: data.entityName,
    periods,
    sharesOutstanding: latestShares ? { value: latestShares.val, asOf: latestShares.end } : null,
  };
}

export type TickerMap = Map<string, { cik: string; title: string }>;

/** Parse SEC's company_tickers.json ({"0": {cik_str, ticker, title}, …}). */
export function parseTickerMap(raw: unknown): TickerMap {
  const map: TickerMap = new Map();
  if (!raw || typeof raw !== "object") return map;
  for (const row of Object.values(raw as Record<string, { cik_str?: number; ticker?: string; title?: string }>)) {
    if (row && typeof row.ticker === "string" && typeof row.cik_str === "number") {
      map.set(row.ticker.toUpperCase(), { cik: String(row.cik_str).padStart(10, "0"), title: row.title ?? "" });
    }
  }
  return map;
}

export interface SecOptions {
  userAgent: string | undefined;
  fetch?: FetchLike;
  limiter?: TokenBucket;
  sleep?: (ms: number) => Promise<void>;
  /** Memo for the large ticker file (shared cache). */
  loadTickers?: (load: () => Promise<TickerMap>) => Promise<TickerMap>;
}

/** 8 requests/second, under SEC's 10/s fair-access limit. */
export function secLimiter(): TokenBucket {
  return new TokenBucket({ capacity: 8, refillPerSecond: 8, maxWaitMs: 2_000 });
}

export function createSecAdapter(opts: SecOptions): FundamentalsProvider {
  const limiter = opts.limiter ?? secLimiter();

  async function get<T>(url: string): Promise<T> {
    if (!opts.userAgent || !/@/.test(opts.userAgent)) {
      throw new ProviderError("missing_key", "SEC_USER_AGENT with a contact email is not configured.");
    }
    await limiter.take();
    return fetchWithRetry<T>(url, {
      provider: SOURCE,
      fetch: opts.fetch,
      sleep: opts.sleep,
      headers: { "User-Agent": opts.userAgent, Accept: "application/json" },
      // SEC answers 403 for undeclared User-Agents or after exceeding fair-access limits.
      forbiddenAs: "unavailable",
      forbiddenMessage: "SEC EDGAR refused the request. Check SEC_USER_AGENT, or retry in a few minutes.",
    });
  }

  const tickers = () => {
    const load = async () => parseTickerMap(await get<unknown>(TICKERS_URL));
    return opts.loadTickers ? opts.loadTickers(load) : load();
  };

  return {
    name: SOURCE,
    async getFundamentals(symbol) {
      const map = await tickers();
      // SEC uses "-" for share classes (BRK-B); Finnhub/most UIs use ".".
      const entry = map.get(symbol.toUpperCase()) ?? map.get(symbol.toUpperCase().replace(".", "-"));
      if (!entry) throw new ProviderError("not_found", `${symbol} is not in the SEC company list.`);
      const data = await get<CompanyFactsResponse>(FACTS_URL(entry.cik));
      if (!data?.facts) throw new ProviderError("not_found", `No XBRL financial data for ${symbol}.`);
      const fundamentals = extractFundamentals(data, symbol.toUpperCase());
      if (fundamentals.periods.length === 0) throw new ProviderError("not_found", `No annual filings with financial data for ${symbol}.`);
      const latest = fundamentals.periods[0]!;
      return {
        value: fundamentals,
        source: `SEC ${latest.form} ${latest.fiscalYear}`,
        asOf: new Date(`${latest.filed}T00:00:00Z`).toISOString(),
        status: "DELAYED",
      };
    },
  };
}
