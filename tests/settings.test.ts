import { describe, expect, it } from "vitest";
import { normalizeWatchSymbol } from "@/lib/store/settings";

describe("normalizeWatchSymbol", () => {
  it("accepts and upper-cases tickers", () => {
    expect(normalizeWatchSymbol(" aapl ")).toBe("AAPL");
    expect(normalizeWatchSymbol("brk.b")).toBe("BRK.B");
  });

  it("accepts Treasury tenors", () => {
    expect(normalizeWatchSymbol("treasury:10y")).toBe("TREASURY:10Y");
    expect(normalizeWatchSymbol("TREASURY:3M")).toBe("TREASURY:3M");
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "  ", "1ABC", "TOOLONGTICKER1", "TREASURY:15Y", "AA PL", "<script>"]) {
      expect(normalizeWatchSymbol(bad)).toBeNull();
    }
  });
});
