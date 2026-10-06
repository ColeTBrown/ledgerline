import { describe, expect, it } from "vitest";
import { EMPTY_VALUE, formatCurrency, formatNumber, formatPercent, signOf } from "@/lib/format/number";

describe("formatNumber", () => {
  it("groups thousands and fixes decimals", () => {
    expect(formatNumber(1234567.891)).toBe("1,234,567.89");
    expect(formatNumber(1234567.891, { decimals: 0 })).toBe("1,234,568");
    expect(formatNumber(0.5, { decimals: 3 })).toBe("0.500");
  });

  it("renders negatives with minus or parentheses", () => {
    expect(formatNumber(-1234.5)).toBe("-1,234.50");
    expect(formatNumber(-1234.5, { negativeStyle: "parens" })).toBe("(1,234.50)");
  });

  it("never renders negative zero", () => {
    expect(formatNumber(-0.0001)).toBe("0.00");
    expect(formatNumber(-0.0001, { negativeStyle: "parens" })).toBe("0.00");
  });

  it("supports signed and compact output", () => {
    expect(formatNumber(12.3, { signed: true, decimals: 1 })).toBe("+12.3");
    expect(formatNumber(0, { signed: true })).toBe("0.00");
    expect(formatNumber(2_410_000_000_000, { compact: true, decimals: 2 })).toBe("2.41T");
  });

  it("respects locale separators", () => {
    // Intl uses narrow no-break spaces for fr-FR grouping; normalize for assertion.
    expect(formatNumber(1234567.89, { locale: "de-DE" })).toBe("1.234.567,89");
    expect(formatNumber(1234567.89, { locale: "fr-FR" }).replace(/\s/g, " ")).toBe("1 234 567,89");
    expect(formatNumber(1234567.89, { locale: "en-IN" })).toBe("12,34,567.89");
  });

  it("returns an em dash for missing or non-finite values", () => {
    for (const v of [null, undefined, Number.NaN, Infinity, -Infinity]) {
      expect(formatNumber(v)).toBe(EMPTY_VALUE);
      expect(formatCurrency(v)).toBe(EMPTY_VALUE);
      expect(formatPercent(v)).toBe(EMPTY_VALUE);
    }
  });

  it("handles very large magnitudes", () => {
    expect(formatNumber(1e15, { decimals: 0 })).toBe("1,000,000,000,000,000");
  });
});

describe("formatCurrency", () => {
  it("formats USD and other currencies", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(-1234.5)).toBe("-$1,234.50");
    expect(formatCurrency(-1234.5, "USD", { negativeStyle: "parens" })).toBe("($1,234.50)");
    expect(formatCurrency(1234.5, "EUR", { locale: "de-DE" }).replace(/\s/g, " ")).toBe("1.234,50 €");
    expect(formatCurrency(1500, "JPY", { decimals: 0 })).toBe("¥1,500");
  });
});

describe("formatPercent", () => {
  it("treats input as a decimal fraction", () => {
    expect(formatPercent(0.0525)).toBe("5.25%");
    expect(formatPercent(-0.031, { decimals: 1 })).toBe("-3.1%");
    expect(formatPercent(-0.031, { decimals: 1, negativeStyle: "parens" })).toBe("(3.1%)");
    expect(formatPercent(0.0042, { signed: true })).toBe("+0.42%");
  });
});

describe("signOf", () => {
  it("classifies values", () => {
    expect(signOf(3)).toBe(1);
    expect(signOf(-0.1)).toBe(-1);
    expect(signOf(0)).toBe(0);
    expect(signOf(null)).toBe(0);
    expect(signOf(Number.NaN)).toBe(0);
  });
});
