import { describe, expect, it } from "vitest";
import { paletteScore } from "@/lib/palette-filter";

describe("paletteScore", () => {
  it("ranks label prefix above keyword and subsequence matches", () => {
    const monte = paletteScore("Monte Carlo", "monte", ["simulation"]);
    const dcf = paletteScore("DCF Model", "monte", ["discounted cash flow", "terminal value"]);
    expect(monte).toBe(1);
    expect(dcf).toBe(0);
  });

  it("matches word prefixes and substrings in the label", () => {
    expect(paletteScore("Time Value of Money", "value")).toBe(0.9);
    expect(paletteScore("Black-Scholes", "scholes")).toBe(0.9);
    expect(paletteScore("Rebalancer", "balance")).toBe(0.8);
  });

  it("matches keywords below label matches", () => {
    expect(paletteScore("Capital Budgeting", "irr", ["npv", "irr"])).toBe(0.6);
    expect(paletteScore("WACC", "capm", ["cost of capital", "capm"])).toBe(0.6);
    expect(paletteScore("Bond Pricer", "ield", ["yield"])).toBe(0.5);
  });

  it("falls back to subsequence on the label only", () => {
    expect(paletteScore("Black-Scholes", "bsch")).toBe(0.1);
    expect(paletteScore("WACC", "zzz", ["cost"])).toBe(0);
  });

  it("shows everything for an empty query", () => {
    expect(paletteScore("Anything", "  ")).toBe(1);
  });
});
