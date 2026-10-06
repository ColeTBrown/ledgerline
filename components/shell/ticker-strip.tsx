"use client";

import { useSettings } from "@/lib/store/settings";
import { cn } from "@/lib/utils";

/** Display label for a watchlist id: "TREASURY:10Y" → "US10Y". */
export function watchLabel(symbol: string): string {
  return symbol.startsWith("TREASURY:") ? `US${symbol.slice(9)}` : symbol;
}

/**
 * Slim watchlist strip in the top bar. Quotes are wired to the market data
 * layer in a later phase; until then each symbol shows an em dash rather
 * than any placeholder figure.
 */
export function TickerStrip({ className }: { className?: string }) {
  const watchlist = useSettings((s) => s.watchlist);

  return (
    <div
      className={cn("scrollbar-thin flex min-w-0 items-center gap-px overflow-x-auto", className)}
      aria-label="Watchlist"
      role="list"
    >
      {watchlist.map((symbol) => (
        <div
          key={symbol}
          role="listitem"
          className="flex h-7 shrink-0 items-center gap-2 rounded-sm px-2 text-xs hover:bg-surface-2"
          title="No market data feed connected"
        >
          <span className="font-medium text-foreground">{watchLabel(symbol)}</span>
          <span className="num text-subtle-foreground">—</span>
        </div>
      ))}
    </div>
  );
}
