"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { blackScholes, type OptionInputs, type OptionResult, type OptionType } from "@/lib/finance/options/black-scholes";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Segmented } from "@/components/ui/segmented";

interface BsState {
  type: OptionType;
  spot: number;
  strike: number;
  timeToExpiry: number;
  rate: number;
  volatility: number;
  dividendYield: number;
}

const DEFAULTS: BsState = { type: "call", spot: 100, strike: 100, timeToExpiry: 0.5, rate: 0.045, volatility: 0.25, dividendYield: 0 };

export function BlackScholesTool() {
  const tool = getTool("black-scholes")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<BsState>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      const inputs: OptionInputs = { ...s };
      return { result: blackScholes(inputs) as OptionResult, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof BsState>(key: K, value: BsState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 2 });
  const num = (v: number | null | undefined, d = 4) => formatNumber(v, { locale: fmt.locale, decimals: d });
  const pct = (v: number | null | undefined) => formatPercent(v, { locale: fmt.locale, decimals: 1 });

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
          <NumberField label="Spot price (S)" kind="currency" min={0} value={s.spot} onChange={(v) => set("spot", v)} />
          <NumberField label="Strike (K)" kind="currency" min={0} value={s.strike} onChange={(v) => set("strike", v)} />
          <NumberField label="Time to expiry" kind="number" decimals={3} min={0} suffix="yr" value={s.timeToExpiry} onChange={(v) => set("timeToExpiry", v)} />
          <NumberField label="Risk-free rate" kind="percent" value={s.rate} onChange={(v) => set("rate", v)} hint="Continuously compounded." />
          <NumberField label="Volatility (σ)" kind="percent" min={0} value={s.volatility} onChange={(v) => set("volatility", v)} />
          <NumberField label="Dividend yield" kind="percent" min={0} value={s.dividendYield} onChange={(v) => set("dividendYield", v)} />
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          <div className="rounded-md border border-border-strong bg-surface p-4">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Option value</div>
            <div className="num mt-1 text-3xl font-semibold tabular-nums">{result ? cur(result.price) : "—"}</div>
            {error && <p className="mt-1 text-2xs text-loss">{error}</p>}
            {result && (
              <p className="mt-1 text-2xs text-muted-foreground">
                Intrinsic {cur(result.intrinsicValue)} · time value {cur(result.timeValue)} · {pct(result.probabilityITM)} prob. ITM
              </p>
            )}
          </div>
          {result && (
            <>
              <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Greeks</div>
              <StatGrid className="grid-cols-2 xl:grid-cols-5">
                <Stat label="Delta" value={num(result.delta)} hint="per $1 spot" />
                <Stat label="Gamma" value={num(result.gamma)} hint="per $1 spot" />
                <Stat label="Vega" value={num(result.vega / 100)} hint="per 1% vol" />
                <Stat label="Theta" value={num(result.theta / 365)} hint="per day" />
                <Stat label="Rho" value={num(result.rho / 100)} hint="per 1% rate" />
              </StatGrid>
              <p className="max-w-prose text-2xs text-muted-foreground">
                Black-Scholes-Merton with continuous dividend yield. d₁ = {num(result.d1, 4)}, d₂ = {num(result.d2, 4)}.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
