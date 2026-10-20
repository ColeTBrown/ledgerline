"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { runDcf, type DcfInputs, type DcfResult, type TerminalMethod } from "@/lib/finance/valuation/dcf";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Segmented } from "@/components/ui/segmented";

type TerminalKind = "gordon" | "exit-multiple";

interface DcfState {
  baseRevenue: number;
  years: number;
  revenueGrowth: number;
  ebitMargin: number;
  taxRate: number;
  daPctRevenue: number;
  capexPctRevenue: number;
  nwcPctRevenue: number;
  wacc: number;
  terminalKind: TerminalKind;
  terminalGrowth: number;
  exitMultiple: number;
  netDebt: number;
  sharesOutstanding: number;
  currentPrice: number;
  midYear: boolean;
}

const DEFAULTS: DcfState = {
  baseRevenue: 1000,
  years: 5,
  revenueGrowth: 0.08,
  ebitMargin: 0.2,
  taxRate: 0.21,
  daPctRevenue: 0.05,
  capexPctRevenue: 0.06,
  nwcPctRevenue: 0.02,
  wacc: 0.09,
  terminalKind: "gordon",
  terminalGrowth: 0.025,
  exitMultiple: 12,
  netDebt: 150,
  sharesOutstanding: 100,
  currentPrice: 60,
  midYear: false,
};

export function DcfTool() {
  const tool = getTool("dcf")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<DcfState>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      const terminal: TerminalMethod =
        s.terminalKind === "gordon" ? { method: "gordon", growth: s.terminalGrowth } : { method: "exit-multiple", multiple: s.exitMultiple };
      const inputs: DcfInputs = {
        baseRevenue: s.baseRevenue,
        revenueGrowth: Array.from({ length: Math.max(1, Math.round(s.years)) }, () => s.revenueGrowth),
        ebitMargin: s.ebitMargin,
        taxRate: s.taxRate,
        daPctRevenue: s.daPctRevenue,
        capexPctRevenue: s.capexPctRevenue,
        nwcPctRevenue: s.nwcPctRevenue,
        wacc: s.wacc,
        terminal,
        netDebt: s.netDebt,
        sharesOutstanding: s.sharesOutstanding,
        currentPrice: s.currentPrice > 0 ? s.currentPrice : undefined,
        midYear: s.midYear,
      };
      return { result: runDcf(inputs) as DcfResult, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof DcfState>(key: K, value: DcfState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });
  const curPs = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 2 });
  const pct = (v: number | null | undefined) => formatPercent(v, { locale: fmt.locale, decimals: 1 });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 overflow-y-auto bg-surface p-4">
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Projection</div>
            <NumberField label="Base-year revenue" kind="currency" min={0} value={s.baseRevenue} onChange={(v) => set("baseRevenue", v)} />
            <NumberField label="Projection years" kind="integer" min={1} max={30} value={s.years} onChange={(v) => set("years", v)} />
            <NumberField label="Revenue growth / year" kind="percent" value={s.revenueGrowth} onChange={(v) => set("revenueGrowth", v)} />
            <NumberField label="EBIT margin" kind="percent" value={s.ebitMargin} onChange={(v) => set("ebitMargin", v)} />
            <NumberField label="Tax rate" kind="percent" min={0} max={0.9999} value={s.taxRate} onChange={(v) => set("taxRate", v)} />
            <NumberField label="D&A (% revenue)" kind="percent" value={s.daPctRevenue} onChange={(v) => set("daPctRevenue", v)} />
            <NumberField label="CapEx (% revenue)" kind="percent" value={s.capexPctRevenue} onChange={(v) => set("capexPctRevenue", v)} />
            <NumberField label="ΔNWC (% of revenue change)" kind="percent" value={s.nwcPctRevenue} onChange={(v) => set("nwcPctRevenue", v)} />
          </div>

          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Discounting & terminal value</div>
            <NumberField label="WACC" kind="percent" value={s.wacc} onChange={(v) => set("wacc", v)} />
            <div>
              <div className="mb-1.5 text-2xs text-subtle-foreground">Terminal method</div>
              <Segmented
                aria-label="Terminal value method"
                value={s.terminalKind}
                onValueChange={(v) => set("terminalKind", v)}
                options={[
                  { value: "gordon", label: "Gordon growth" },
                  { value: "exit-multiple", label: "Exit multiple" },
                ]}
                className="w-full"
              />
            </div>
            {s.terminalKind === "gordon" ? (
              <NumberField label="Terminal growth" kind="percent" value={s.terminalGrowth} onChange={(v) => set("terminalGrowth", v)} hint="Must be below WACC." />
            ) : (
              <NumberField label="Exit EV / EBITDA" kind="number" decimals={1} suffix="×" value={s.exitMultiple} onChange={(v) => set("exitMultiple", v)} />
            )}
            <div>
              <div className="mb-1.5 text-2xs text-subtle-foreground">Discounting convention</div>
              <Segmented
                aria-label="Discounting convention"
                value={s.midYear ? "mid" : "year-end"}
                onValueChange={(v) => set("midYear", v === "mid")}
                options={[
                  { value: "year-end", label: "Year-end" },
                  { value: "mid", label: "Mid-year" },
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Bridge to equity</div>
            <NumberField label="Net debt" kind="currency" value={s.netDebt} onChange={(v) => set("netDebt", v)} hint="Debt − cash. Negative for net cash." />
            <NumberField label="Shares outstanding" kind="number" decimals={0} min={0} value={s.sharesOutstanding} onChange={(v) => set("sharesOutstanding", v)} />
            <NumberField label="Current price" kind="currency" min={0} value={s.currentPrice} onChange={(v) => set("currentPrice", v)} hint="Optional, for upside." />
          </div>
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 overflow-y-auto bg-background p-4">
          <div>
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Value per share</div>
            <div className="mt-2 rounded-md border border-border-strong bg-surface p-4">
              <div className="flex items-baseline gap-3">
                <span className="num text-3xl font-semibold tabular-nums">{result ? curPs(result.valuePerShare) : "—"}</span>
                {result?.upside != null && (
                  <span className={cn("num text-sm font-medium", result.upside >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(result.upside, { locale: fmt.locale, decimals: 1, signed: true })} vs. price
                  </span>
                )}
              </div>
              {error && <p className="mt-1 text-2xs text-loss">{error}</p>}
            </div>
          </div>

          {result && (
            <>
              <StatGrid className="sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Enterprise value" value={cur(result.enterpriseValue)} />
                <Stat label="Equity value" value={cur(result.equityValue)} />
                <Stat label="PV of FCF" value={cur(result.sumPvFcf)} />
                <Stat label="PV of terminal" value={cur(result.pvTerminalValue)} hint={`${pct(result.terminalShareOfEv)} of EV`} />
              </StatGrid>

              <div>
                <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Free cash flow projection</div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-right text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-border bg-surface text-subtle-foreground">
                        <th className="px-3 py-1.5 text-left font-medium">Year</th>
                        <th className="px-3 py-1.5 font-medium">Revenue</th>
                        <th className="px-3 py-1.5 font-medium">EBIT</th>
                        <th className="px-3 py-1.5 font-medium">FCF</th>
                        <th className="px-3 py-1.5 font-medium">PV of FCF</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {result.years.map((y) => (
                        <tr key={y.year} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-1.5 text-left">{y.year}</td>
                          <td className="px-3 py-1.5">{cur(y.revenue)}</td>
                          <td className="px-3 py-1.5">{cur(y.ebit)}</td>
                          <td className="px-3 py-1.5">{cur(y.fcf)}</td>
                          <td className="px-3 py-1.5">{cur(y.pvFcf)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="max-w-prose text-2xs text-muted-foreground">
                Unlevered FCF discounted at WACC, plus a discounted terminal value.
                {result.impliedPerpetualGrowth != null && s.terminalKind === "exit-multiple"
                  ? ` Implied perpetual growth: ${pct(result.impliedPerpetualGrowth)}.`
                  : ` Implied exit EV/EBITDA: ${formatNumber(result.impliedExitMultiple, { locale: fmt.locale, decimals: 1 })}×.`}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
