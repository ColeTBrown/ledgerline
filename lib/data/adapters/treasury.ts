/**
 * U.S. Department of the Treasury — Daily Treasury Par Yield Curve Rates.
 * Official, keyless CSV feed published on home.treasury.gov (one file per
 * calendar year, newest date first). Values are percentages; we convert to
 * decimals. Published once per business day, so values are labeled DELAYED.
 */
import { ProviderError } from "../errors";
import { fetchWithRetry, type FetchLike } from "../http";
import type { CurvePointLabeled, RatesProvider, TreasuryCurve, TreasuryCurveSet } from "../types";

const SOURCE = "U.S. Treasury";

export function treasuryCsvUrl(year: number): string {
  const qs = new URLSearchParams({ type: "daily_treasury_yield_curve", field_tdr_date_value: String(year), page: "", _format: "csv" });
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?${qs.toString()}`;
}

/**
 * Map a CSV header such as "1 Mo", "1.5 Month", "6 Wk", "10 Yr" to a tenor
 * label and its length in years. Returns null for non-tenor columns.
 */
export function parseTenorHeader(header: string): { tenor: string; tenorYears: number } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(wk|week|weeks|mo|month|months|yr|year|years)\s*$/i.exec(header.replace(/"/g, ""));
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith("w")) return { tenor: `${n}W`, tenorYears: (n * 7) / 365 };
  if (unit.startsWith("m")) return { tenor: `${n}M`, tenorYears: n / 12 };
  return { tenor: `${n}Y`, tenorYears: n };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "10/03/2025" or "2025-10-03" → "2025-10-03". */
function toIsoDate(s: string): string | null {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Parse the Treasury CSV into curves sorted newest first. Header-driven, so
 * new tenors (e.g. the 6-week bill added in 2025) are picked up automatically.
 * Blank / "N/A" cells are skipped.
 */
export function parseTreasuryCsv(csv: string): TreasuryCurve[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!);
  const dateIdx = header.findIndex((h) => h.replace(/"/g, "").toLowerCase() === "date");
  if (dateIdx < 0) return [];
  const columns = header.map((h) => parseTenorHeader(h));

  const curves: TreasuryCurve[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const date = toIsoDate(cells[dateIdx] ?? "");
    if (!date) continue;
    const points: CurvePointLabeled[] = [];
    columns.forEach((col, i) => {
      if (!col) return;
      const v = Number(cells[i]);
      if (cells[i] === "" || cells[i] === undefined || !Number.isFinite(v)) return;
      points.push({ ...col, yield: v / 100 });
    });
    if (points.length > 0) curves.push({ date, points: points.sort((a, b) => a.tenorYears - b.tenorYears) });
  }
  return curves.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface TreasuryOptions {
  fetch?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Optional per-year memo (e.g. the shared cache) to avoid refetching. */
  loadYear?: (year: number, load: () => Promise<TreasuryCurve[]>) => Promise<TreasuryCurve[]>;
}

export function createTreasuryAdapter(opts: TreasuryOptions = {}): RatesProvider {
  const now = opts.now ?? Date.now;

  const fetchYear = async (year: number): Promise<TreasuryCurve[]> => {
    const load = async () => {
      const csv = await fetchWithRetry<string>(treasuryCsvUrl(year), {
        provider: SOURCE,
        fetch: opts.fetch,
        sleep: opts.sleep,
        as: "text",
        headers: { Accept: "text/csv" },
        forbiddenAs: "unavailable",
      });
      return parseTreasuryCsv(csv);
    };
    return opts.loadYear ? opts.loadYear(year, load) : load();
  };

  return {
    name: SOURCE,
    async getTreasuryCurve(compareDate) {
      const year = new Date(now()).getUTCFullYear();
      let curves = await fetchYear(year);
      // Early January: the new year's file may have fewer than two days.
      if (curves.length < 2) curves = [...curves, ...(await fetchYear(year - 1).catch(() => []))];
      const latest = curves[0];
      if (!latest) throw new ProviderError("unavailable", "The Treasury yield curve feed returned no data.");

      let comparison: TreasuryCurve | null = null;
      if (compareDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(compareDate)) throw new ProviderError("invalid_request", "Comparison date must be YYYY-MM-DD.");
        const cy = Number(compareDate.slice(0, 4));
        let pool = cy === year ? curves : await fetchYear(cy).catch(() => [] as TreasuryCurve[]);
        // If the date falls before the first business day of its year, look in the prior year.
        if (!pool.some((c) => c.date <= compareDate)) pool = await fetchYear(cy - 1).catch(() => []);
        comparison = pool.find((c) => c.date <= compareDate) ?? null;
      }

      const value: TreasuryCurveSet = { latest, previous: curves[1] ?? null, comparison };
      return { value, source: SOURCE, asOf: `${latest.date}T21:00:00.000Z`, status: "DELAYED" };
    },
  };
}
