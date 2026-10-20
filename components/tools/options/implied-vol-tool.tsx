"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { impliedVolatility } from "@/lib/finance/options/implied-vol";
import { blackScholes, type OptionType } from "@/lib/finance/options/black-scholes";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Segmented } from "@/components/ui/segmented";

interface IvState {
  type: OptionType;
  spot: number;
  strike: number;
  timeToExpiry: number;
  rate: number;
  dividendYield: number;
  marketPrice: number;
}

const DEFAULTS: IvState = { type: "call", spot: 100, strike: 105, timeToExpiry: 0.25, rate: 0.045, dividendYield: 0, marketPrice: 3.5 };

export function ImpliedVolTool() {
  const tool = getTool("implied-vol")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<IvState>(DEFAULTS);

  const solved = useMemo(() => {
    const base = { type: s.type, spot: s.spot, strike: s.strike, timeToExpiry: s.timeToExpiry, rate: s.rate, dividendYield: s.dividendYield };
    const iv = s.marketPrice > 0 ? impliedVolatility(base, s.marketPrice) : null;
    const greeks = iv ? blackScholes({ ...base, volatility: iv.volatility }) : null;
    return { iv, greeks };
  }, [s]);

  function set<K extends keyof IvState>(key: K, value: IvState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const num = (v: number | null | undefined, d = 4) => formatNumber(v, { locale: fmt.locale, decimals: d });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <div>
            <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Option type</div>
            <Segmented
              aria-label="Option type"
              value={s.type}
              onValueChange={(v) => set("type", v)}
              options={[
                { value: "call", label: "Call" },
                { value: "put", label: "Put" },
              ]}
              className="w-full"
            />
          </div>
          <NumberField label="Market premium" kind="currency" min={0} value={s.marketPrice} onChange={(v) => set("marketPrice", v)} hint="Observed option price." />
          <NumberField label="Spot price (S)" kind="currency" min={0} value={s.spot} onChange={(v) => set("spot", v)} />
          <NumberField label="Strike (K)" kind="currency" min={0} value={s.strike} onChange={(v) => set("strike", v)} />
          <NumberField label="Time to expiry" kind="number" decimals={3} min={0} suffix="yr" value={s.timeToExpiry} onChange={(v) => set("timeToExpiry", v)} />
          <NumberField label="Risk-free rate" kind="percent" value={s.rate} onChange={(v) => set("rate", v)} />
          <NumberField label="Dividend yield" kind="percent" min={0} value={s.dividendYield} onChange={(v) => set("dividendYield", v)} />
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          <div className="rounded-md border border-border-strong bg-surface p-4">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Implied volatility</div>
            <div className="num mt-1 text-3xl font-semibold tabular-nums">{solved.iv ? formatPercent(solved.iv.volatility, { locale: fmt.locale, decimals: 2 }) : "No solution"}</div>
            {solved.iv ? (
              <p className="mt-1 text-2xs text-muted-foreground">Solved by {solved.iv.method === "newton" ? "Newton–Raphson" : "bisection fallback"}.</p>
            ) : (
              <p className="mt-1 text-2xs text-muted-foreground">The premium is outside no-arbitrage bounds for these inputs.</p>
            )}
          </div>
          {solved.greeks && (
            <>
              <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Greeks at implied vol</div>
              <StatGrid className="grid-cols-2 xl:grid-cols-5">
                <Stat label="Delta" value={num(solved.greeks.delta)} />
                <Stat label="Gamma" value={num(solved.greeks.gamma)} />
                <Stat label="Vega" value={num(solved.greeks.vega / 100)} hint="per 1% vol" />
                <Stat label="Theta" value={num(solved.greeks.theta / 365)} hint="per day" />
                <Stat label="Rho" value={num(solved.greeks.rho / 100)} hint="per 1% rate" />
              </StatGrid>
              <p className="max-w-prose text-2xs text-muted-foreground">
                Back-solves the Black-Scholes volatility that reproduces the market premium, then re-prices the Greeks at that level.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
