/** Ticker syntax accepted across the app: letters/digits with optional . or - class suffix. */
export const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;

export function normalizeSymbol(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toUpperCase();
  return SYMBOL_RE.test(s) ? s : null;
}
