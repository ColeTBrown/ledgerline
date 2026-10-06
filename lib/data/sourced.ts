/**
 * Provenance wrapper carried by every value that can come from a live source.
 * Drives source badges, MANUAL overrides, "reset to live" and scenario timestamps.
 */

export const SOURCE_STATUSES = ["LIVE", "DELAYED", "CACHED", "MANUAL"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export interface Sourced<T> {
  value: T;
  /** Human-readable provider name, e.g. "Finnhub", "U.S. Treasury", "SEC 10-K FY2025". */
  source: string;
  /** ISO-8601 timestamp of when the provider published / we fetched the value. */
  asOf: string;
  status: SourceStatus;
}

/** Wrap a user-entered value. */
export function manual<T>(value: T, now: Date = new Date()): Sourced<T> {
  return { value, source: "Manual input", asOf: now.toISOString(), status: "MANUAL" };
}

/**
 * Short timestamp for a badge: time of day when `asOf` is today,
 * otherwise the calendar date ("Oct 5").
 */
export function formatAsOf(asOf: string, now: Date = new Date(), locale = "en-US"): string {
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", second: "2-digit" })
    : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
