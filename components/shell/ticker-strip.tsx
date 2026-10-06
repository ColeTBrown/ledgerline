"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useWatchlist, type WatchItem } from "@/hooks/use-watchlist";
import { Num, useFlash } from "@/components/data/num";
import { SourceBadge } from "@/components/data/source-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export { watchLabel } from "@/hooks/use-watchlist";

/**
 * Slim watchlist strip in the top bar. Equities poll every 15s while the tab
 * is visible; Treasury yields come from the daily par curve. Missing values
 * render as an em dash — never a placeholder figure.
 */
export function TickerStrip({ className }: { className?: string }) {
  const items = useWatchlist();
  return (
    <div className={cn("scrollbar-thin flex min-w-0 items-center gap-px overflow-x-auto", className)} aria-label="Watchlist" role="list">
      {items.map((item) => (
        <TickerChip key={item.id} item={item} />
      ))}
    </div>
  );
}

function TickerChip({ item }: { item: WatchItem }) {
  const flash = useFlash(item.value);
  const href = item.kind === "equity" ? `/app/company?symbol=${encodeURIComponent(item.id)}` : "/app/yield-curve";
  const up = (item.change ?? 0) > 0;
  const down = (item.change ?? 0) < 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          role="listitem"
          className={cn("flex h-7 shrink-0 items-center gap-2 rounded-sm px-2 text-xs transition-colors hover:bg-surface-2", flash)}
        >
          <span className="font-medium text-foreground">{item.label}</span>
          {item.loading ? (
            <Skeleton className="h-3 w-14" />
          ) : item.value === null ? (
            <span className="num text-subtle-foreground">—</span>
          ) : item.kind === "treasury" ? (
            <>
              <Num value={item.value} kind="percent" decimals={2} className="text-muted-foreground" />
              {item.change !== null && (
                <span className={cn("num", up && "text-gain", down && "text-loss", !up && !down && "text-subtle-foreground")}>
                  {item.change > 0 ? "+" : item.change < 0 ? "−" : ""}
                  {Math.abs(Math.round(item.change * 10000))}bp
                </span>
              )}
            </>
          ) : (
            <>
              <Num value={item.value} decimals={2} className="text-muted-foreground" />
              <Num value={item.changePercent} kind="percent" decimals={2} signed colorBySign />
            </>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        {item.status ? (
          <SourceBadge status={item.status} source={item.source ?? undefined} asOf={item.asOf ?? undefined} />
        ) : (
          <span className="text-muted-foreground">{item.note ?? "Loading…"}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
