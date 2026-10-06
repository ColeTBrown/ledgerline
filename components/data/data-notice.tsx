import { CircleSlash, Clock, KeyRound, SearchX, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataErrorReason } from "@/lib/data/types";

const ICONS: Record<DataErrorReason, typeof KeyRound> = {
  missing_key: KeyRound,
  rate_limited: Clock,
  unavailable: WifiOff,
  not_found: SearchX,
  invalid_request: CircleSlash,
};

const DEFAULT_COPY: Record<DataErrorReason, string> = {
  missing_key: "This data source is not configured. Values can be entered manually.",
  rate_limited: "The data provider's request limit was reached. Retrying shortly; manual inputs still work.",
  unavailable: "The data provider is temporarily unavailable. Manual inputs still work.",
  not_found: "No data was found for this symbol.",
  invalid_request: "The request was not valid.",
};

/** How to enable each capability, for missing-configuration notices. */
const SETUP: Record<"quotes" | "rates" | "fundamentals", string> = {
  quotes: "Live quotes, profiles and news need a Finnhub API key (FINNHUB_API_KEY). Inputs remain editable.",
  fundamentals: "SEC filings data needs SEC_USER_AGENT set to your name and contact email. Inputs remain editable.",
  rates: "The Treasury yield curve feed is turned off (RATES_PROVIDER). Rates can be entered manually.",
};

/** Quiet, professional inline notice for a data source failure. */
export function DataNotice({
  reason,
  message,
  capability,
  className,
}: {
  reason: DataErrorReason;
  message?: string;
  /** For missing_key: which capability is unconfigured, for specific setup copy. */
  capability?: keyof typeof SETUP;
  className?: string;
}) {
  const Icon = ICONS[reason];
  const copy =
    reason === "missing_key" && capability
      ? SETUP[capability]
      : reason === "missing_key" || reason === "unavailable" || reason === "rate_limited"
        ? DEFAULT_COPY[reason]
        : (message ?? DEFAULT_COPY[reason]);
  return (
    <div role="status" className={cn("flex items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground", className)}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
      <span>{copy}</span>
    </div>
  );
}
