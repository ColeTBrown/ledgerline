/**
 * Command-palette ranking. Prefers prefix and substring matches on the item
 * label over keyword matches, and only falls back to a subsequence match on
 * the label itself — so "monte" ranks Monte Carlo first, not "DCF Model".
 * Returns a score in [0, 1]; 0 hides the item (cmdk filter contract).
 */
export function paletteScore(value: string, search: string, keywords: readonly string[] = []): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const label = value.toLowerCase();

  if (label.startsWith(q)) return 1;
  if (label.split(/[\s/&·-]+/).some((w) => w.startsWith(q))) return 0.9;
  if (label.includes(q)) return 0.8;

  const kw = keywords.map((k) => k.toLowerCase());
  if (kw.some((k) => k.startsWith(q) || k.split(/[\s/&-]+/).some((w) => w.startsWith(q)))) return 0.6;
  if (kw.some((k) => k.includes(q))) return 0.5;

  return isSubsequence(q.replace(/\s+/g, ""), label) ? 0.1 : 0;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}
