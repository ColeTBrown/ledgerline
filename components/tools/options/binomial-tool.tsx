"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { binomialPrice, type ExerciseStyle } from "@/lib/finance/options/binomial";
import { type OptionInputs, type OptionType } from "@/lib/finance/options/black-scholes";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Segmented } from "@/components/ui/segmented";

interface BinState {
  type: OptionType;
  style: ExerciseStyle;
  spot: number;
  strike: number;
  timeToExpiry: number;
  rate: number;
  volatility: number;
  dividendYield: number;
  steps: number;
}

const DEFAULTS: BinState = { type: "put", style: "american", spot: 100, strike: 100, timeToExpiry: 1, rate: 0.045, volatility: 0.3, dividendYield: 0.01, steps: 200 };

export function BinomialTool() {
  const tool = getTool("binomial")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<BinState>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      const inputs: OptionInputs = { type: s.type, spot: s.spot, strike: s.strike, timeToExpiry: s.timeToExpiry, rate: s.rate, volatility: s.volatility, dividendYield: s.dividendYield };
      return { result: binomialPrice(inputs, { steps: Math.max(1, Math.round(s.steps)), style: s.style }), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof BinState>(key: K, value: BinState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 3 });
  const num = (v: number | null | undefined, d = 4) => formatNumber(v, { locale: fmt.locale, decimals: d });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Type</div>
              <Segmented aria-label="Option type" value={s.type} onValueChange={(v) => set("type", v)} options={[{ value: "call", label: "Call" }, { value: "put", label: "Put" }]} className="w-full" />
            </div>
            <div>
              <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Style</div>
              <Segmented aria-label="Exercise style" value={s.style} onValueChange={(v) => set("style", v)} options={[{ value: "american", label: "Amer." }, { value: "european", label: "Euro." }]} className="w-full" />
            </div>
          </div>
          <NumberField label="Spot price (S)" kind="currency" min={0} value={s.spot} onChange={(v) => set("spot", v)} />
          <NumberField label="Strike (K)" kind="currency" min={0} value={s.strike} onChange={(v) => set("strike", v)} />
          <NumberField label="Time to expiry" kind="number" decimals={3} min={0} suffix="yr" value={s.timeToExpiry} onChange={(v) => set("timeToExpiry", v)} />
          <NumberField label="Risk-free rate" kind="percent" value={s.rate} onChange={(v) => set("rate", v)} />
          <NumberField label="Volatility (σ)" kind="percent" min={0} value={s.volatility} onChange={(v) => set("volatility", v)} />
          <NumberField label="Dividend yield" kind="percent" min={0} value={s.dividendYield} onChange={(v) => set("dividendYield", v)} />
          <NumberField label="Tree steps" kind="integer" min={1} max={2000} value={s.steps} onChange={(v) => set("steps", v)} hint="More steps converge toward Black-Scholes." />
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          <div className="rounded-md border border-border-strong bg-surface p-4">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">
              {s.style === "american" ? "American" : "European"} {s.type} value
            </div>
            <div className="num mt-1 text-3xl font-semibold tabular-nums">{result ? cur(result.price) : "—"}</div>
            {error && <p className="mt-1 text-2xs text-loss">{error}</p>}
            {result && result.earlyExercisePremium > 1e-6 && (
              <p className="mt-1 text-2xs text-muted-foreground">Early-exercise premium over European: {cur(result.earlyExercisePremium)}</p>
            )}
          </div>
          {result && (
            <>
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Delta" value={num(result.delta)} />
                <Stat label="Gamma" value={num(result.gamma)} />
                <Stat label="Theta" value={num(result.theta / 365)} hint="per day" />
                <Stat label="Early exercise" value={cur(result.earlyExercisePremium)} />
              </StatGrid>
              <StatGrid className="grid-cols-3">
                <Stat label="Up factor" value={num(result.up, 4)} />
                <Stat label="Down factor" value={num(result.down, 4)} />
                <Stat label="Prob. up (risk-neutral)" value={formatNumber(result.probabilityUp, { locale: fmt.locale, decimals: 4 })} />
              </StatGrid>
              <p className="max-w-prose text-2xs text-muted-foreground">
                Cox-Ross-Rubinstein lattice. American options allow early exercise at every node; the premium is the value above the equivalent European option.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
