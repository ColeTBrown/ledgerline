/**
 * Parse user-typed numbers: thousands separators for the active locale,
 * "(1,234)" negatives, currency symbols, a trailing "%", and k/m/b/t
 * magnitude suffixes. Returns null for anything unparseable.
 */
export function parseNumberInput(raw: string, locale = "en-US"): number | null {
  let s = raw.trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$€£¥₹\s  ]/g, "").replace(/^(CHF|CAD|AUD|USD|EUR|GBP|JPY)/i, "");
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  let multiplier = 1;
  const suffix = /([kmbt])$/i.exec(s);
  if (suffix) {
    multiplier = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[suffix[1]!.toLowerCase() as "k" | "m" | "b" | "t"];
    s = s.slice(0, -1);
  }
  if (s.endsWith("%")) s = s.slice(0, -1);

  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  // Normalize locale separators: drop grouping, convert decimal to ".".
  const groupRe = group.trim() === "" ? /[\s  ]/g : new RegExp(`\\${group}`, "g");
  s = s.replace(groupRe, "");
  if (decimal !== ".") s = s.replace(decimal, ".");
  if (!/^\d*\.?\d+(e[+-]?\d+)?$|^\d+\.$/i.test(s)) return null;
  const n = Number(s) * multiplier;
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
