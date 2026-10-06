"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_ROLE, isRoleId, type RoleId } from "@/config/roles";
import type { NegativeStyle } from "@/lib/format/number";

export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Locales offered as number-format presets, keyed by their display sample. */
export const NUMBER_LOCALES = [
  { id: "en-US", label: "1,234,567.89" },
  { id: "de-DE", label: "1.234.567,89" },
  { id: "fr-FR", label: "1 234 567,89" },
  { id: "en-IN", label: "12,34,567.89" },
] as const;
export type NumberLocale = (typeof NUMBER_LOCALES)[number]["id"];

/** Watchlist entry. `TREASURY:10Y` style ids address non-equity series. */
export type WatchSymbol = string;

export const DEFAULT_WATCHLIST: WatchSymbol[] = ["SPY", "QQQ", "DIA", "IWM", "TREASURY:10Y"];

export interface SettingsState {
  role: RoleId;
  currency: Currency;
  locale: NumberLocale;
  decimals: number;
  negativeStyle: NegativeStyle;
  watchlist: WatchSymbol[];
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  notes: string;

  setRole: (role: RoleId) => void;
  setCurrency: (currency: Currency) => void;
  setLocale: (locale: NumberLocale) => void;
  setDecimals: (decimals: number) => void;
  setNegativeStyle: (style: NegativeStyle) => void;
  addWatchSymbol: (symbol: WatchSymbol) => void;
  removeWatchSymbol: (symbol: WatchSymbol) => void;
  resetWatchlist: () => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setNotes: (notes: string) => void;
}

/** Normalize a user-typed watchlist symbol; returns null when invalid. */
export function normalizeWatchSymbol(input: string): WatchSymbol | null {
  const s = input.trim().toUpperCase();
  if (/^TREASURY:(1M|2M|3M|4M|6M|1Y|2Y|3Y|5Y|7Y|10Y|20Y|30Y)$/.test(s)) return s;
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) return s;
  return null;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      role: DEFAULT_ROLE,
      currency: "USD",
      locale: "en-US",
      decimals: 2,
      negativeStyle: "minus",
      watchlist: DEFAULT_WATCHLIST,
      sidebarCollapsed: false,
      rightPanelOpen: false,
      notes: "",

      setRole: (role) => set({ role }),
      setCurrency: (currency) => set({ currency }),
      setLocale: (locale) => set({ locale }),
      setDecimals: (decimals) => set({ decimals: Math.min(6, Math.max(0, Math.round(decimals))) }),
      setNegativeStyle: (negativeStyle) => set({ negativeStyle }),
      addWatchSymbol: (symbol) =>
        set((s) => {
          const normalized = normalizeWatchSymbol(symbol);
          if (!normalized || s.watchlist.includes(normalized) || s.watchlist.length >= 20) return s;
          return { watchlist: [...s.watchlist, normalized] };
        }),
      removeWatchSymbol: (symbol) => set((s) => ({ watchlist: s.watchlist.filter((w) => w !== symbol) })),
      resetWatchlist: () => set({ watchlist: DEFAULT_WATCHLIST }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      setNotes: (notes) => set({ notes }),
    }),
    {
      name: "ledgerline:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Hydrate manually after mount so server and first client render match.
      skipHydration: true,
      // Guard against corrupted or tampered storage.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          role: isRoleId(p.role) ? p.role : current.role,
          watchlist: Array.isArray(p.watchlist) ? p.watchlist.filter((w) => normalizeWatchSymbol(w)) : current.watchlist,
        };
      },
    },
  ),
);

/** Formatting options derived from settings, for passing to lib/format. */
export function useNumberFormat() {
  const locale = useSettings((s) => s.locale);
  const decimals = useSettings((s) => s.decimals);
  const negativeStyle = useSettings((s) => s.negativeStyle);
  const currency = useSettings((s) => s.currency);
  return { locale, decimals, negativeStyle, currency };
}

/** True once persisted settings have been loaded from localStorage. */
export function useSettingsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
    () => false,
  );
}
