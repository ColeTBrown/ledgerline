"use client";

import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { useMarketStatus } from "@/hooks/use-market";

/** Bottom status bar: data-mode indicator and the regulatory disclaimer. */
export function StatusBar() {
  const { data } = useMarketStatus();
  const live = data ? [data.quotes.configured && "Finnhub", data.rates.configured && "U.S. Treasury", data.fundamentals.configured && "SEC EDGAR"].filter(Boolean) : [];
  const allLive = data && data.quotes.configured && data.rates.configured && data.fundamentals.configured;
  const label = !data ? "Checking data sources…" : live.length === 0 ? "Manual mode" : allLive ? `Live data · ${live.join(" · ")}` : `Partial data · ${live.join(" · ")}`;
  const title =
    data && !allLive
      ? "Some market data sources are not configured. Affected inputs stay editable and are marked Manual."
      : undefined;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-2xs text-subtle-foreground">
      <span className="inline-flex shrink-0 items-center gap-1.5" title={title}>
        <span
          className={cn("size-1.5 rounded-full", allLive ? "bg-gain" : live.length > 0 ? "bg-warning" : "bg-subtle-foreground")}
          aria-hidden
        />
        {label}
      </span>
      <span className="h-3 w-px bg-border" aria-hidden />
      <span className="truncate">{brand.disclaimer}</span>
    </footer>
  );
}
