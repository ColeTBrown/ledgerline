import { describe, expect, it } from "vitest";
import { parseNumberInput } from "@/lib/format/parse";

describe("parseNumberInput", () => {
  it("parses plain, grouped and decimal numbers", () => {
    expect(parseNumberInput("1234.5")).toBe(1234.5);
    expect(parseNumberInput("1,234,567.89")).toBe(1234567.89);
    expect(parseNumberInput(".5")).toBe(0.5);
    expect(parseNumberInput("12.")).toBe(12);
  });
  it("handles negatives, parentheses, currency and percent", () => {
    expect(parseNumberInput("-42")).toBe(-42);
    expect(parseNumberInput("(1,000)")).toBe(-1000);
    expect(parseNumberInput("$2,500.00")).toBe(2500);
    expect(parseNumberInput("5.25%")).toBe(5.25);
    expect(parseNumberInput("+3")).toBe(3);
  });
  it("supports magnitude suffixes", () => {
    expect(parseNumberInput("1.5m")).toBe(1_500_000);
    expect(parseNumberInput("2B")).toBe(2e9);
    expect(parseNumberInput("750k")).toBe(750_000);
  });
  it("respects locale separators", () => {
    expect(parseNumberInput("1.234.567,89", "de-DE")).toBe(1234567.89);
    expect(parseNumberInput("1 234 567,89", "fr-FR")).toBe(1234567.89);
    expect(parseNumberInput("12,34,567.89", "en-IN")).toBe(1234567.89);
  });
  it("rejects garbage", () => {
    for (const bad of ["", "abc", "1.2.3", "--5", "12a", "1e", "$"]) expect(parseNumberInput(bad)).toBeNull();
  });
});
