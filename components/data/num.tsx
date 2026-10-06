"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent, signOf } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";

export type NumKind = "number" | "currency" | "percent";

export interface NumProps {
  value: number | null | undefined;
  kind?: NumKind;
  decimals?: number;
  compact?: boolean;
  signed?: boolean;
  /** Color by sign (gain/loss). Default: only negatives are red. */
  colorBySign?: boolean;
  /** Briefly flash green/red when the value changes. */
  flash?: boolean;
  className?: string;
}

/**
 * Formatted number honoring the user's locale, decimals and negative style.
 * Monospaced tabular figures; negatives in red.
 */
export function Num({
  value,
  kind = "number",
  decimals,
  compact,
  signed,
  colorBySign = false,
  flash = false,
  className,
}: NumProps) {
  const fmt = useNumberFormat();
  const opts = { locale: fmt.locale, decimals: decimals ?? fmt.decimals, negativeStyle: fmt.negativeStyle, compact, signed };
  const text =
    kind === "currency" ? formatCurrency(value, fmt.currency, opts) : kind === "percent" ? formatPercent(value, opts) : formatNumber(value, opts);
  const sign = signOf(value);
  const flashClass = useFlash(flash ? value : undefined);

  return (
    <span
      className={cn(
        "num rounded-sm",
        sign < 0 && "text-loss",
        colorBySign && sign > 0 && "text-gain",
        flashClass,
        className,
      )}
    >
      {text}
    </span>
  );
}

/** Returns a flash animation class for ~700ms after `value` moves up or down. */
export function useFlash(value: number | null | undefined): string {
  const prev = useRef(value);
  const [cls, setCls] = useState("");
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (typeof value !== "number" || typeof before !== "number" || value === before) return;
    setCls(value > before ? "animate-flash-gain" : "animate-flash-loss");
    const t = setTimeout(() => setCls(""), 720);
    return () => clearTimeout(t);
  }, [value]);
  return cls;
}
