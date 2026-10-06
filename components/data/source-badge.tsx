"use client";

import { cn } from "@/lib/utils";
import { formatAsOf, type SourceStatus } from "@/lib/data/sourced";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_STYLES: Record<SourceStatus, { dot: string; text: string; description: string }> = {
  LIVE: { dot: "bg-gain", text: "text-gain", description: "Real-time value from the provider." },
  DELAYED: { dot: "bg-warning", text: "text-warning", description: "Provider data published with a delay." },
  CACHED: { dot: "bg-info", text: "text-info", description: "Served from cache; the provider was unavailable or rate-limited." },
  MANUAL: { dot: "bg-subtle-foreground", text: "text-muted-foreground", description: "Entered or edited by you." },
};

export interface SourceBadgeProps {
  status: SourceStatus;
  source?: string;
  asOf?: string;
  /** Hide source text and show only the status pill (details stay in the tooltip). */
  compact?: boolean;
  className?: string;
}

/** Small provenance badge: "● LIVE  Finnhub · 3:58:12 PM". */
export function SourceBadge({ status, source, asOf, compact = false, className }: SourceBadgeProps) {
  const style = STATUS_STYLES[status];
  const when = asOf ? formatAsOf(asOf) : "";
  const detail = [source, when].filter(Boolean).join(" · ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm text-2xs leading-none whitespace-nowrap text-subtle-foreground",
            className,
          )}
        >
          <span className={cn("inline-flex items-center gap-1 font-medium tracking-wide", style.text)}>
            <span className={cn("size-1.5 rounded-full", style.dot, status === "LIVE" && "animate-pulse")} />
            {status}
          </span>
          {!compact && detail && <span className="num">{detail}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">{detail || status}</div>
        <div className="text-muted-foreground">{style.description}</div>
      </TooltipContent>
    </Tooltip>
  );
}
