import type { TreasuryCurveSet } from "./types";

/** Yield and daily change (decimal) for a "TREASURY:10Y" style watchlist id. */
export function treasuryWatchValue(set: TreasuryCurveSet, watchId: string): { yield: number; change: number | null } | null {
  const tenor = watchId.replace(/^TREASURY:/, "");
  const latest = set.latest.points.find((p) => p.tenor === tenor);
  if (!latest) return null;
  const prev = set.previous?.points.find((p) => p.tenor === tenor);
  return { yield: latest.yield, change: prev ? latest.yield - prev.yield : null };
}
