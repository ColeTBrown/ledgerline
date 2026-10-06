/**
 * Number formatting used everywhere numbers are displayed.
 * Pure functions — no React, no store access — so they are trivially testable
 * and usable in exports (XLSX/PDF) as well as the UI.
 */

export type NegativeStyle = "minus" | "parens";

export interface NumberFormatOptions {
  /** BCP-47 locale controlling separators, e.g. "en-US" or "de-DE". */
  locale?: string;
  /** Fixed number of decimals. */
  decimals?: number;
  /** Render negatives as "-1,234" or "(1,234)". */
  negativeStyle?: NegativeStyle;
  /** Compact notation: 1.2K, 3.4M, 5.6B, 7.8T. */
  compact?: boolean;
  /** Always show a sign for positive values (for changes). */
  signed?: boolean;
}

/** Placeholder rendered for missing or non-finite values. */
export const EMPTY_VALUE = "—";

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

function applySign(body: string, value: number, negativeStyle: NegativeStyle, signed: boolean): string {
  if (value < 0) return negativeStyle === "parens" ? `(${body})` : `-${body}`;
  if (signed && value > 0) return `+${body}`;
  return body;
}

function isPresent(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Format a plain number with grouping separators.
 * Non-finite or missing values render as an em dash.
 */
export function formatNumber(value: number | null | undefined, opts: NumberFormatOptions = {}): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  const { locale = "en-US", decimals = 2, negativeStyle = "minus", compact = false, signed = false } = opts;
  const body = getFormatter(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? "compact" : "standard",
    useGrouping: true,
  }).format(Math.abs(value));
  // Avoid "-0.00": treat values that round to zero as zero.
  const rounded = Number(Math.abs(value).toFixed(decimals));
  return applySign(body, rounded === 0 ? 0 : value, negativeStyle, signed);
}

/** Format a currency amount, e.g. $1,234.56 or (€1.234,56). */
export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  opts: NumberFormatOptions = {},
): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  const { locale = "en-US", decimals = 2, negativeStyle = "minus", compact = false, signed = false } = opts;
  const body = getFormatter(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? "compact" : "standard",
  }).format(Math.abs(value));
  const rounded = Number(Math.abs(value).toFixed(decimals));
  return applySign(body, rounded === 0 ? 0 : value, negativeStyle, signed);
}

/**
 * Format a fraction as a percentage: 0.0525 → "5.25%".
 * Inputs are always decimal fractions, never pre-multiplied percentages.
 */
export function formatPercent(value: number | null | undefined, opts: NumberFormatOptions = {}): string {
  if (!isPresent(value)) return EMPTY_VALUE;
  const { locale = "en-US", decimals = 2, negativeStyle = "minus", signed = false } = opts;
  const body = getFormatter(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));
  const rounded = Number((Math.abs(value) * 100).toFixed(decimals));
  return applySign(body, rounded === 0 ? 0 : value, negativeStyle, signed);
}

/** -1, 0 or 1 for coloring gains/losses; 0 for missing values. */
export function signOf(value: number | null | undefined): -1 | 0 | 1 {
  if (!isPresent(value) || value === 0) return 0;
  return value > 0 ? 1 : -1;
}
