import { describe, expect, it } from "vitest";
import { annualFacts, createSecAdapter, extractFundamentals, parseTickerMap, type CompanyFactsResponse, type XbrlFact } from "@/lib/data/adapters/sec";
import { TokenBucket } from "@/lib/data/rate-limit";
import { json, mockFetch, noSleep } from "../helpers/mock-fetch";

const fy = (end: string, val: number, extra: Partial<XbrlFact> = {}): XbrlFact => ({
  start: `${Number(end.slice(0, 4)) - 1}${end.slice(4, 8)}${String(Number(end.slice(8)) + 1).padStart(2, "0")}`,
  end,
  val,
  accn: "0000320193-25-000079",
  fy: Number(end.slice(0, 4)),
  fp: "FY",
  form: "10-K",
  filed: `${end.slice(0, 4)}-10-31`,
  ...extra,
});
const inst = (end: string, val: number, extra: Partial<XbrlFact> = {}): XbrlFact => ({ ...fy(end, val, extra), start: undefined });
const usd = (facts: XbrlFact[]) => ({ units: { USD: facts } });

/** A trimmed companyfacts payload in the documented shape. */
const FACTS: CompanyFactsResponse = {
  cik: 320193,
  entityName: "Apple Inc.",
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: { units: { shares: [inst("2025-10-17", 14_776_353_000), inst("2024-10-18", 15_115_823_000)] } },
    },
    "us-gaap": {
      // Older years under a legacy tag, newer under ASC 606 tag — both must be found.
      Revenues: usd([fy("2023-09-30", 383_285_000_000)]),
      RevenueFromContractWithCustomerExcludingAssessedTax: usd([
        fy("2025-09-27", 416_161_000_000),
        fy("2024-09-28", 391_035_000_000),
        // Quarterly value inside a 10-K must be ignored.
        { ...fy("2025-09-27", 102_466_000_000), start: "2025-06-29" },
        // A 10-Q must be ignored.
        { ...fy("2025-06-28", 94_036_000_000), form: "10-Q", fp: "Q3" },
      ]),
      OperatingIncomeLoss: usd([fy("2025-09-27", 133_050_000_000), fy("2024-09-28", 123_216_000_000)]),
      DepreciationDepletionAndAmortization: usd([fy("2025-09-27", 11_698_000_000)]),
      NetIncomeLoss: usd([
        fy("2025-09-27", 112_010_000_000),
        // Restated in a later filing: the later filing wins.
        fy("2024-09-28", 93_736_000_000, { filed: "2024-11-01" }),
        fy("2024-09-28", 93_700_000_000, { filed: "2025-10-31", accn: "restated" }),
      ]),
      Assets: usd([inst("2025-09-27", 359_241_000_000), inst("2024-09-28", 364_980_000_000)]),
      LongTermDebtNoncurrent: usd([inst("2025-09-27", 78_328_000_000)]),
      LongTermDebtCurrent: usd([inst("2025-09-27", 12_350_000_000)]),
      CommercialPaper: usd([inst("2025-09-27", 7_979_000_000)]),
      CashAndCashEquivalentsAtCarryingValue: usd([inst("2025-09-27", 35_934_000_000)]),
      WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [fy("2025-09-27", 15_004_697_000)] } },
    },
  },
};

describe("SEC XBRL extraction", () => {
  it("keeps only annual-length duration facts from annual forms, latest filing per period", () => {
    const m = annualFacts(FACTS.facts["us-gaap"]!.RevenueFromContractWithCustomerExcludingAssessedTax!.units.USD!, "duration");
    expect([...m.keys()].sort()).toEqual(["2024-09-28", "2025-09-27"]);
    expect(m.get("2025-09-27")!.val).toBe(416_161_000_000);
    const ni = annualFacts(FACTS.facts["us-gaap"]!.NetIncomeLoss!.units.USD!, "duration");
    expect(ni.get("2024-09-28")!.accn).toBe("restated");
  });

  it("extracts periods newest first with tag fallbacks, derived fields and nulls for missing items", () => {
    const f = extractFundamentals(FACTS, "AAPL");
    expect(f.cik).toBe("0000320193");
    expect(f.periods.map((p) => p.fiscalYear)).toEqual(["FY2025", "FY2024", "FY2023"]);
    const [p25, p24, p23] = f.periods;
    expect(p25!.values.revenue).toBe(416_161_000_000);
    expect(p23!.values.revenue).toBe(383_285_000_000);
    expect(p25!.values.ebitda).toBe(133_050_000_000 + 11_698_000_000);
    expect(p25!.derived).toEqual(expect.arrayContaining(["ebitda", "totalDebt"]));
    expect(p25!.values.totalDebt).toBe(78_328_000_000 + 12_350_000_000 + 7_979_000_000);
    expect(p24!.values.ebitda).toBeNull(); // no D&A reported for FY2024 in this fixture
    expect(p24!.values.inventory).toBeNull();
    expect(p25!.values.dilutedShares).toBe(15_004_697_000);
    expect(f.sharesOutstanding).toEqual({ value: 14_776_353_000, asOf: "2025-10-17" });
  });

  it("parses the ticker → CIK file", () => {
    const m = parseTickerMap({ "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, "1": { cik_str: 1067983, ticker: "BRK-B", title: "Berkshire" }, bad: null });
    expect(m.get("AAPL")).toEqual({ cik: "0000320193", title: "Apple Inc." });
    expect(m.size).toBe(2);
  });
});

describe("SEC adapter", () => {
  const unlimited = () => new TokenBucket({ capacity: 100, refillPerSecond: 100 });
  const UA = "Ledgerline Research ops@example.com";

  it("sends the required User-Agent and resolves share-class tickers", async () => {
    const fetch = mockFetch((url, init) => {
      expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(UA);
      if (url.pathname === "/files/company_tickers.json") return json({ "0": { cik_str: 1067983, ticker: "BRK-B", title: "Berkshire Hathaway" } });
      expect(url.pathname).toBe("/api/xbrl/companyfacts/CIK0001067983.json");
      return json({ ...FACTS, cik: 1067983, entityName: "Berkshire Hathaway" });
    });
    const a = createSecAdapter({ userAgent: UA, fetch, limiter: unlimited(), sleep: noSleep });
    const r = await a.getFundamentals("BRK.B");
    expect(r.source).toBe("SEC 10-K FY2025");
    expect(r.status).toBe("DELAYED");
    expect(r.value.entityName).toBe("Berkshire Hathaway");
  });

  it("requires a User-Agent with a contact email", async () => {
    const fetch = mockFetch(() => json({}));
    await expect(createSecAdapter({ userAgent: undefined, fetch }).getFundamentals("AAPL")).rejects.toMatchObject({ reason: "missing_key" });
    await expect(createSecAdapter({ userAgent: "no email", fetch }).getFundamentals("AAPL")).rejects.toMatchObject({ reason: "missing_key" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns not_found for unknown tickers and companies without annual data", async () => {
    const tickers = { "0": { cik_str: 1, ticker: "SHELL", title: "Shell Co" } };
    const a = createSecAdapter({
      userAgent: UA,
      limiter: unlimited(),
      sleep: noSleep,
      fetch: mockFetch((url) => (url.pathname.includes("company_tickers") ? json(tickers) : json({ cik: 1, entityName: "Shell Co", facts: { "us-gaap": {} } }))),
    });
    await expect(a.getFundamentals("NOPE")).rejects.toMatchObject({ reason: "not_found" });
    await expect(a.getFundamentals("SHELL")).rejects.toMatchObject({ reason: "not_found" });
  });

  it("maps SEC rate limiting (429) to rate_limited", async () => {
    const a = createSecAdapter({ userAgent: UA, limiter: unlimited(), sleep: noSleep, fetch: mockFetch(() => json({}, 429)) });
    await expect(a.getFundamentals("AAPL")).rejects.toMatchObject({ reason: "rate_limited" });
  });
});
