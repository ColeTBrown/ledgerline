"use client";

import { useMemo } from "react";
import { useSettings } from "@/lib/store/settings";
import { treasuryWatchValue } from "@/lib/data/treasury-watch";
import type { SourceStatus } from "@/lib/data/sourced";
import { useQuotes, useTreasuryCurve } from "./use-market";

export interface WatchItem {
  id: string;
  label: string;
  kind: "equity" | "treasury";
  /** Price for equities, decimal yield for Treasuries. */
  value: number | null;
  /** Absolute change (price units, or decimal yield change for Treasuries). */
  change: number | null;
  /** Percent change for equities (decimal); null for Treasuries. */
  changePercent: number | null;
  status: SourceStatus | null;
  source: string | null;
  asOf: string | null;
  /** Reason the value is missing, for tooltips. */
  note: string | null;
  loading: boolean;
}

export function watchLabel(symbol: string): string {
  return symbol.startsWith("TREASURY:") ? `US${symbol.slice(9)}` : symbol;
}

/** Quotes for the user's watchlist: equities via the batched quote route, Treasuries from the par curve. */
export function useWatchlist(): WatchItem[] {
  const watchlist = useSettings((s) => s.watchlist);
  const equities = useMemo(() => watchlist.filter((w) => !w.startsWith("TREASURY:")), [watchlist]);
  const quotes = useQuotes(equities);
  const hasTreasury = watchlist.some((w) => w.startsWith("TREASURY:"));
  const curve = useTreasuryCurve();

  return useMemo(
    () =>
      watchlist.map<WatchItem>((id) => {
        const base = { id, label: watchLabel(id), value: null, change: null, changePercent: null, status: null, source: null, asOf: null };
        if (id.startsWith("TREASURY:")) {
          const r = curve.data;
          if (!hasTreasury || !r) return { ...base, kind: "treasury", note: null, loading: curve.isLoading };
          if (!r.ok) return { ...base, kind: "treasury", note: r.message, loading: false };
          const v = treasuryWatchValue(r.value, id);
          if (!v) return { ...base, kind: "treasury", note: "Tenor not published today.", loading: false };
          return { ...base, kind: "treasury", value: v.yield, change: v.change, status: r.status, source: r.source, asOf: r.asOf, note: null, loading: false };
        }
        const q = quotes.data?.[id];
        if (!q) {
          return {
            ...base,
            kind: "equity",
            note: quotes.fetchStatus === "idle" && !quotes.data ? "No market data feed connected." : null,
            loading: quotes.isLoading,
          };
        }
        if (!q.ok) return { ...base, kind: "equity", note: q.message, loading: false };
        return {
          ...base,
          kind: "equity",
          value: q.value.price,
          change: q.value.change,
          changePercent: q.value.changePercent,
          status: q.status,
          source: q.source,
          asOf: q.asOf,
          note: null,
          loading: false,
        };
      }),
    [watchlist, quotes.data, quotes.isLoading, quotes.fetchStatus, curve.data, curve.isLoading, hasTreasury],
  );
}
