"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { breakEven, type BreakEvenInputs, type BreakEvenResult } from "@/lib/finance/breakeven";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";

interface BeState {
  fixedCosts: number;
  pricePerUnit: number;
  variableCostPerUnit: number;
  expectedUnits: number;
  targetProfit: number;
}

const DEFAULTS: BeState = { fixedCosts: 500000, pricePerUnit: 80, variableCostPerUnit: 45, expectedUnits: 20000, targetProfit: 200000 };

export function BreakEvenTool() {
  const tool = getTool("break-even")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<BeState>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      const inputs: BreakEvenInputs = {
        fixedCosts: s.fixedCosts,
        pricePerUnit: s.pricePerUnit,
        variableCostPerUnit: s.variableCostPerUnit,
        expectedUnits: s.expectedUnits > 0 ? s.expectedUnits : undefined,
        targetProfit: s.targetProfit !== 0 ? s.targetProfit : undefined,
      };
      return { result: breakEven(inputs) as BreakEvenResult, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof BeState>(key: K, value: number) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const units = (v: number | null | undefined) => (v == null ? "—" : `${formatNumber(v, { locale: fmt.locale, decimals: 0 })} units`);
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });
  const pct = (v: number | null | undefined) => (v == null ? "—" : formatPercent(v, { locale: fmt.locale, decimals: 1 }));

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <NumberField label="Fixed costs" kind="currency" min={0} value={s.fixedCosts} onChange={(v) => set("fixedCosts", v)} />
          <NumberField label="Price per unit" kind="currency" min={0} value={s.pricePerUnit} onChange={(v) => set("pricePerUnit", v)} />
          <NumberField label="Variable cost per unit" kind="currency" min={0} value={s.variableCostPerUnit} onChange={(v) => set("variableCostPerUnit", v)} />
          <NumberField label="Expected units" kind="number" decimals={0} min={0} value={s.expectedUnits} onChange={(v) => set("expectedUnits", v)} hint="For margin of safety." />
          <NumberField label="Target profit" kind="currency" min={0} value={s.targetProfit} onChange={(v) => set("targetProfit", v)} hint="Units needed to reach it." />
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          {error && <p className="text-sm text-loss">{error}</p>}
          {result && (
            <>
              <div className="rounded-md border border-border-strong bg-surface p-4">
                <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Break-even</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className="num text-3xl font-semibold tabular-nums">{units(result.breakEvenUnits)}</span>
                  <span className="num text-lg text-muted-foreground tabular-nums">{cur(result.breakEvenRevenue)} revenue</span>
                </div>
              </div>
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Contribution margin" value={cur(result.contributionMargin)} hint={pct(result.contributionMarginRatio)} />
                <Stat label="Units for target" value={units(result.targetUnits)} />
                <Stat label="Expected profit" value={cur(result.expectedProfit)} tone={result.expectedProfit != null && result.expectedProfit >= 0 ? "gain" : "loss"} />
                <Stat label="Margin of safety" value={pct(result.marginOfSafety)} />
                <Stat label="Operating leverage" value={result.operatingLeverage == null ? "—" : `${formatNumber(result.operatingLeverage, { locale: fmt.locale, decimals: 2 })}×`} />
              </StatGrid>
              <p className="max-w-prose text-2xs text-muted-foreground">
                Contribution margin = price − variable cost. Break-even units = fixed costs / contribution margin. Margin of safety is how far expected volume sits above break-even.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
