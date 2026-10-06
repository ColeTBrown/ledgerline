import { describe, expect, it } from "vitest";
import { createTreasuryAdapter, parseTenorHeader, parseTreasuryCsv, treasuryCsvUrl } from "@/lib/data/adapters/treasury";
import { mockFetch, noSleep, text } from "../helpers/mock-fetch";

// Shape of the official CSV (newest first; 1.5-month bill column added in 2025).
const CSV_2026 = `Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"
10/05/2026,4.10,4.08,4.06,4.02,3.98,3.90,3.75,3.55,3.50,3.60,3.75,4.05,4.50,4.62
10/02/2026,4.11,4.09,4.07,4.03,3.99,3.91,3.77,3.58,3.52,3.62,3.77,4.07,4.52,4.64
01/02/2026,4.30,,4.28,4.25,4.20,4.10,3.95,3.80,3.78,3.85,3.98,4.20,4.60,4.70
`;
const CSV_2025 = `Date,"1 Mo","2 Mo","3 Mo","6 Mo","1 Yr","2 Yr","5 Yr","10 Yr","30 Yr"
12/31/2025,4.32,4.30,4.27,4.12,3.99,3.82,3.88,4.22,4.72
06/30/2025,N/A,4.40,4.38,4.25,4.05,3.90,3.95,4.25,4.80
`;

describe("Treasury CSV parsing", () => {
  it("maps headers to tenors", () => {
    expect(parseTenorHeader('"1 Mo"')).toEqual({ tenor: "1M", tenorYears: 1 / 12 });
    expect(parseTenorHeader("1.5 Month")).toEqual({ tenor: "1.5M", tenorYears: 0.125 });
    expect(parseTenorHeader("6 Wk")?.tenor).toBe("6W");
    expect(parseTenorHeader("10 Yr")).toEqual({ tenor: "10Y", tenorYears: 10 });
    expect(parseTenorHeader("Date")).toBeNull();
  });
  it("parses rows newest first, converting percent to decimal and skipping blanks", () => {
    const curves = parseTreasuryCsv(CSV_2026);
    expect(curves.map((c) => c.date)).toEqual(["2026-10-05", "2026-10-02", "2026-01-02"]);
    const ten = curves[0]!.points.find((p) => p.tenor === "10Y")!;
    expect(ten.yield).toBeCloseTo(0.0405, 12);
    expect(curves[2]!.points.some((p) => p.tenor === "1.5M")).toBe(false);
    // Points are sorted by maturity.
    const yrs = curves[0]!.points.map((p) => p.tenorYears);
    expect([...yrs].sort((a, b) => a - b)).toEqual(yrs);
    expect(parseTreasuryCsv("N/A,N/A\n")).toEqual([]);
    expect(parseTreasuryCsv("")).toEqual([]);
  });
  it("skips N/A cells", () => {
    const c = parseTreasuryCsv(CSV_2025);
    expect(c[1]!.points.some((p) => p.tenor === "1M")).toBe(false);
  });
  it("builds the official CSV URL", () => {
    expect(treasuryCsvUrl(2026)).toContain("home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all");
    expect(treasuryCsvUrl(2026)).toContain("type=daily_treasury_yield_curve");
  });
});

describe("Treasury adapter", () => {
  const now = () => Date.parse("2026-10-06T12:00:00Z");
  const responder = (url: URL) => (url.pathname.includes("/2026/") ? text(CSV_2026) : url.pathname.includes("/2025/") ? text(CSV_2025) : text("", 404));

  it("returns latest and previous curves labeled DELAYED", async () => {
    const a = createTreasuryAdapter({ fetch: mockFetch(responder), now, sleep: noSleep });
    const r = await a.getTreasuryCurve();
    expect(r.status).toBe("DELAYED");
    expect(r.source).toBe("U.S. Treasury");
    expect(r.value.latest.date).toBe("2026-10-05");
    expect(r.value.previous?.date).toBe("2026-10-02");
    expect(r.value.comparison).toBeNull();
    expect(r.asOf.startsWith("2026-10-05")).toBe(true);
  });
  it("finds the comparison curve on or before a date, crossing into the prior year", async () => {
    const a = createTreasuryAdapter({ fetch: mockFetch(responder), now, sleep: noSleep });
    expect((await a.getTreasuryCurve("2026-10-04")).value.comparison?.date).toBe("2026-10-02");
    expect((await a.getTreasuryCurve("2025-07-04")).value.comparison?.date).toBe("2025-06-30");
    expect((await a.getTreasuryCurve("2026-01-01")).value.comparison?.date).toBe("2025-12-31");
  });
  it("falls back to the previous year's file early in January", async () => {
    const a = createTreasuryAdapter({
      fetch: mockFetch((url) => (url.pathname.includes("/2027/") ? text(`Date,"10 Yr"\n01/02/2027,4.10\n`) : responder(url))),
      now: () => Date.parse("2027-01-03T12:00:00Z"),
      sleep: noSleep,
    });
    const r = await a.getTreasuryCurve();
    expect(r.value.latest.date).toBe("2027-01-02");
    expect(r.value.previous?.date).toBe("2026-10-05");
  });
  it("reports unavailable on outages and empty feeds", async () => {
    await expect(createTreasuryAdapter({ fetch: mockFetch(() => text("", 503)), now, sleep: noSleep }).getTreasuryCurve()).rejects.toMatchObject({ reason: "unavailable" });
    await expect(createTreasuryAdapter({ fetch: mockFetch(() => text("Date\n")), now, sleep: noSleep }).getTreasuryCurve()).rejects.toMatchObject({ reason: "unavailable" });
  });
  it("reports a blocked (403) keyless feed as unavailable, not a credentials problem", async () => {
    await expect(createTreasuryAdapter({ fetch: mockFetch(() => text("", 403)), now, sleep: noSleep }).getTreasuryCurve()).rejects.toMatchObject({ reason: "unavailable" });
  });
  it("rejects malformed comparison dates", async () => {
    const a = createTreasuryAdapter({ fetch: mockFetch(responder), now, sleep: noSleep });
    await expect(a.getTreasuryCurve("10/04/2026")).rejects.toMatchObject({ reason: "invalid_request" });
  });
});
