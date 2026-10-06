"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { marketApi } from "@/lib/data/client";
import { interpolateYield } from "@/lib/finance/rates";
import type { Sourced } from "@/lib/data/sourced";

/** Poll interval for on-screen quotes. Polling pauses when the tab is hidden. */
export const QUOTE_POLL_MS = 15_000;

export function useMarketStatus() {
  return useQuery({ queryKey: ["market", "status"], queryFn: ({ signal }) => marketApi.status(signal), staleTime: Infinity });
}

export type Capability = "quotes" | "rates" | "fundamentals";
export type CapabilityState = "loading" | "on" | "off";

/**
 * Whether a data capability has a configured provider. Hooks only request
 * data for "on" capabilities, so an unconfigured source never generates
 * failing network calls; components show a quiet notice for "off".
 */
export function useCapability(cap: Capability): CapabilityState {
  const status = useMarketStatus();
  if (status.isPending) return "loading";
  return status.data?.[cap].configured ? "on" : "off";
}

/** True when a quote provider is configured, so quote polling is worthwhile. */
export function useQuotesEnabled(): boolean {
  return useCapability("quotes") === "on";
}

/**
 * Batched quotes for the given (on-screen) symbols. Only polls when a quote
 * provider is configured and the document is visible.
 */
export function useQuotes(symbols: readonly string[]) {
  const enabled = useQuotesEnabled();
  const key = useMemo(() => [...new Set(symbols.map((s) => s.toUpperCase()))].sort(), [symbols]);
  return useQuery({
    queryKey: ["market", "quotes", key],
    queryFn: ({ signal }) => marketApi.quotes(key, signal),
    enabled: enabled && key.length > 0,
    refetchInterval: QUOTE_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: QUOTE_POLL_MS - 1000,
    placeholderData: keepPreviousData,
  });
}

export function useQuote(symbol: string | null) {
  const enabled = useQuotesEnabled();
  return useQuery({
    queryKey: ["market", "quote", symbol],
    queryFn: ({ signal }) => marketApi.quote(symbol!, signal),
    enabled: enabled && Boolean(symbol),
    refetchInterval: QUOTE_POLL_MS,
    staleTime: QUOTE_POLL_MS - 1000,
  });
}

export function useProfile(symbol: string | null) {
  const enabled = useQuotesEnabled();
  return useQuery({
    queryKey: ["market", "profile", symbol],
    queryFn: ({ signal }) => marketApi.profile(symbol!, signal),
    enabled: enabled && Boolean(symbol),
    staleTime: 60 * 60_000,
  });
}

export function useMetrics(symbol: string | null) {
  const enabled = useQuotesEnabled();
  return useQuery({
    queryKey: ["market", "metrics", symbol],
    queryFn: ({ signal }) => marketApi.metrics(symbol!, signal),
    enabled: enabled && Boolean(symbol),
    staleTime: 60 * 60_000,
  });
}

export function useNews(symbol: string | null, days = 7) {
  const enabled = useQuotesEnabled();
  return useQuery({
    queryKey: ["market", "news", symbol, days],
    queryFn: ({ signal }) => marketApi.news(symbol!, days, signal),
    enabled: enabled && Boolean(symbol),
    staleTime: 5 * 60_000,
  });
}

export function useFundamentals(symbol: string | null) {
  const enabled = useCapability("fundamentals") === "on";
  return useQuery({
    queryKey: ["market", "fundamentals", symbol],
    queryFn: ({ signal }) => marketApi.fundamentals(symbol!, signal),
    enabled: enabled && Boolean(symbol),
    staleTime: 60 * 60_000,
  });
}

export function useTreasuryCurve(compare?: string) {
  const enabled = useCapability("rates") === "on";
  return useQuery({
    queryKey: ["market", "treasury", compare ?? "latest"],
    queryFn: ({ signal }) => marketApi.treasury(compare, signal),
    enabled,
    staleTime: 60 * 60_000,
  });
}

/** Debounced value, for search-as-you-type. */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export function useSymbolSearch(query: string) {
  const q = useDebounced(query.trim(), 250);
  const enabled = useQuotesEnabled();
  return useQuery({
    queryKey: ["market", "search", q.toLowerCase()],
    queryFn: ({ signal }) => marketApi.search(q, signal),
    enabled: enabled && q.length >= 1 && /^[\w .&'\-]+$/.test(q),
    staleTime: 60 * 60_000,
  });
}

/**
 * Risk-free rate matched to a horizon (years) by linear interpolation on the
 * latest Treasury par curve. Null while loading or when the curve is unavailable.
 */
export function useRiskFreeRate(horizonYears: number): Sourced<number> | null {
  const curve = useTreasuryCurve();
  return useMemo(() => {
    const r = curve.data;
    if (!r?.ok) return null;
    const y = interpolateYield(r.value.latest.points, horizonYears);
    return y === null ? null : { value: y, source: r.source, asOf: r.asOf, status: r.status };
  }, [curve.data, horizonYears]);
}
