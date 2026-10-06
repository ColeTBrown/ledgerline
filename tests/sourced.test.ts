import { describe, expect, it } from "vitest";
import { formatAsOf, manual } from "@/lib/data/sourced";

describe("Sourced helpers", () => {
  const now = new Date(2026, 9, 6, 16, 30, 0);

  it("wraps manual values", () => {
    const v = manual(4.2, now);
    expect(v).toEqual({ value: 4.2, source: "Manual input", asOf: now.toISOString(), status: "MANUAL" });
  });

  it("shows time for same-day values and date otherwise", () => {
    expect(formatAsOf(new Date(2026, 9, 6, 15, 58, 12).toISOString(), now)).toBe("3:58:12 PM");
    expect(formatAsOf(new Date(2026, 9, 5, 12).toISOString(), now)).toBe("Oct 5");
  });

  it("returns empty string for invalid timestamps", () => {
    expect(formatAsOf("not a date", now)).toBe("");
  });
});
