"use client";

import Link from "next/link";
import { PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketStatus } from "@/hooks/use-market";
import { useWatchlist, type WatchItem } from "@/hooks/use-watchlist";
import { Num, useFlash } from "@/components/data/num";
import { SourceBadge } from "@/components/data/source-badge";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketTiles() {
  const items = useWatchlist().slice(0, 10);
  const status = useMarketStatus().data;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <Tile key={item.id} item={item} />
        ))}
      </div>
      {status && !status.quotes.configured && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <PlugZap className="size-3.5 text-subtle-foreground" aria-hidden />
          Live equity quotes are not configured (add a Finnhub key). Every tool still runs fully on manual inputs.
        </div>
      )}
    </>
  );
}

function Tile({ item }: { item: WatchItem }) {
  const flash = useFlash(item.value);
  const href = item.kind === "equity" ? `/app/company?symbol=${encodeURIComponent(item.id)}` : "/app/yield-curve";
  return (
    <Link href={href} className={cn("block rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong", flash)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{item.label}</span>
        {item.status && <SourceBadge status={item.status} source={item.source ?? undefined} asOf={item.asOf ?? undefined} compact />}
      </div>
      <div className="mt-1 h-7 text-lg">
        {item.loading ? (
          <Skeleton className="mt-1 h-5 w-20" />
        ) : item.value === null ? (
          <span className="num text-subtle-foreground">—</span>
        ) : (
          <Num value={item.value} kind={item.kind === "treasury" ? "percent" : "number"} decimals={2} />
        )}
      </div>
      <div className="h-4 text-2xs">
        {item.loading ? null : item.value === null ? (
          <span className="text-subtle-foreground">{item.note ? "Unavailable" : "No feed"}</span>
        ) : item.kind === "treasury" ? (
          item.change !== null && (
            <span className={cn("num", item.change > 0 ? "text-gain" : item.change < 0 ? "text-loss" : "text-subtle-foreground")}>
              {item.change >= 0 ? "+" : "−"}
              {Math.abs(Math.round(item.change * 10000))} bp
            </span>
          )
        ) : (
          <span className="flex gap-2">
            <Num value={item.change} decimals={2} signed colorBySign />
            <Num value={item.changePercent} kind="percent" decimals={2} signed colorBySign />
          </span>
        )}
      </div>
    </Link>
  );
}
