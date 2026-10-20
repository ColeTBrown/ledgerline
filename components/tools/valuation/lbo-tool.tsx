"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { runLbo, type LboInputs, type DebtTranche } from "@/lib/finance/valuation/lbo";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";

interface LboState {
  ltmRevenue: number;
  ltmEbitda: number;
  entryMultiple: number;
  exitMultiple: number;
  years: number;
  revenueGrowth: number;
  ebitdaMargin: number;
  daPctRevenue: number;
  capexPctRevenue: number;
  nwcPctRevenue: number;
  taxRate: number;
  cashSweepPct: number;
  minimumCash: number;
  transactionFeePct: number;
  financingFeePct: number;
  tranches: DebtTranche[];
}

const DEFAULTS: LboState = {
  ltmRevenue: 1000,
  ltmEbitda: 300,
  entryMultiple: 10,
  exitMultiple: 10,
  years: 5,
  revenueGrowth: 0.06,
  ebitdaMargin: 0.3,
  daPctRevenue: 0.05,
  capexPctRevenue: 0.05,
  nwcPctRevenue: 0.02,
  taxRate: 0.25,
  cashSweepPct: 0.75,
  minimumCash: 25,
  transactionFeePct: 0.02,
  financingFeePct: 0.02,
  tranches: [
    { name: "Term Loan B", ebitdaMultiple: 3, rate: 0.08, amortizationPct: 0.05, sweep: true },
    { name: "Senior Notes", ebitdaMultiple: 2, rate: 0.1, amortizationPct: 0, sweep: false },
  ],
};

export function LboTool() {
  const tool = getTool("lbo")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<LboState>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      const inputs: LboInputs = { ...s };
      return { result: runLbo(inputs), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof LboState>(key: K, value: LboState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  function setTranche(idx: number, patch: Partial<DebtTranche>) {
    setS((prev) => ({ ...prev, tranches: prev.tranches.map((t, i) => (i === idx ? { ...t, ...patch } : t)) }));
  }

  const money = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });
  const turns = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${formatNumber(v, { locale: fmt.locale, decimals: 1 })}×`);
  const pct = (v: number | null | undefined) => formatPercent(v, { locale: fmt.locale, decimals: 1 });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 overflow-y-auto bg-surface p-4">
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Transaction</div>
            <NumberField label="LTM revenue" kind="currency" min={0} value={s.ltmRevenue} onChange={(v) => set("ltmRevenue", v)} />
            <NumberField label="LTM EBITDA" kind="currency" min={0} value={s.ltmEbitda} onChange={(v) => set("ltmEbitda", v)} />
            <NumberField label="Entry EV / EBITDA" kind="number" decimals={1} suffix="×" value={s.entryMultiple} onChange={(v) => set("entryMultiple", v)} />
            <NumberField label="Exit EV / EBITDA" kind="number" decimals={1} suffix="×" value={s.exitMultiple} onChange={(v) => set("exitMultiple", v)} />
            <NumberField label="Holding period" kind="integer" min={1} max={15} suffix="yr" value={s.years} onChange={(v) => set("years", v)} />
          </div>

          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Operating model</div>
            <NumberField label="Revenue growth / year" kind="percent" value={s.revenueGrowth} onChange={(v) => set("revenueGrowth", v)} />
            <NumberField label="EBITDA margin" kind="percent" value={s.ebitdaMargin} onChange={(v) => set("ebitdaMargin", v)} />
            <NumberField label="D&A (% revenue)" kind="percent" value={s.daPctRevenue} onChange={(v) => set("daPctRevenue", v)} />
            <NumberField label="CapEx (% revenue)" kind="percent" value={s.capexPctRevenue} onChange={(v) => set("capexPctRevenue", v)} />
            <NumberField label="ΔNWC (% of revenue change)" kind="percent" value={s.nwcPctRevenue} onChange={(v) => set("nwcPctRevenue", v)} />
            <NumberField label="Tax rate" kind="percent" min={0} max={0.9999} value={s.taxRate} onChange={(v) => set("taxRate", v)} />
          </div>

          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Financing</div>
            <NumberField label="Cash sweep" kind="percent" min={0} max={1} value={s.cashSweepPct} onChange={(v) => set("cashSweepPct", v)} />
            <NumberField label="Minimum cash" kind="currency" min={0} value={s.minimumCash} onChange={(v) => set("minimumCash", v)} />
            <NumberField label="Transaction fees (% EV)" kind="percent" min={0} value={s.transactionFeePct} onChange={(v) => set("transactionFeePct", v)} />
            <NumberField label="Financing fees (% debt)" kind="percent" min={0} value={s.financingFeePct} onChange={(v) => set("financingFeePct", v)} />
          </div>

          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Debt tranches</div>
            {s.tranches.map((t, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-2.5">
                <div className="text-2xs font-medium text-muted-foreground">{t.name}</div>
                <NumberField label="Size (× EBITDA)" kind="number" decimals={2} suffix="×" value={t.ebitdaMultiple} onChange={(v) => setTranche(i, { ebitdaMultiple: v })} />
                <NumberField label="Interest rate" kind="percent" value={t.rate} onChange={(v) => setTranche(i, { rate: v })} />
                <NumberField label="Mandatory amortization" kind="percent" min={0} value={t.amortizationPct} onChange={(v) => setTranche(i, { amortizationPct: v })} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={t.sweep} onChange={(e) => setTranche(i, { sweep: e.target.checked })} className="accent-accent" />
                  Eligible for cash sweep
                </label>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 overflow-y-auto bg-background p-4">
          {error ? (
            <div className="rounded-md border border-border-strong bg-surface p-4">
              <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Returns</div>
              <p className="mt-1 text-sm text-loss">{error}</p>
            </div>
          ) : result ? (
            <>
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Sponsor IRR" size="lg" tone={result.irr != null && result.irr >= 0 ? "gain" : "loss"} value={result.irr == null ? "—" : pct(result.irr)} />
                <Stat label="MOIC" size="lg" value={`${formatNumber(result.moic, { locale: fmt.locale, decimals: 2 })}×`} />
                <Stat label="Entry EV" value={money(result.sourcesAndUses.entryEnterpriseValue)} />
                <Stat label="Exit equity" value={money(result.exitEquity)} />
              </StatGrid>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-border">
                  <div className="border-b border-border bg-surface px-3 py-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Sources</div>
                  <table className="w-full text-right text-xs tabular-nums">
                    <tbody className="num">
                      {result.sourcesAndUses.sources.map((x) => (
                        <tr key={x.label} className="border-b border-border/50">
                          <td className="px-3 py-1.5 text-left text-muted-foreground">{x.label}</td>
                          <td className="px-3 py-1.5">{money(x.amount)}</td>
                        </tr>
                      ))}
                      <tr className="font-medium"><td className="px-3 py-1.5 text-left">Total sources</td><td className="px-3 py-1.5">{money(result.sourcesAndUses.totalSources)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-md border border-border">
                  <div className="border-b border-border bg-surface px-3 py-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Uses</div>
                  <table className="w-full text-right text-xs tabular-nums">
                    <tbody className="num">
                      {result.sourcesAndUses.uses.map((x) => (
                        <tr key={x.label} className="border-b border-border/50">
                          <td className="px-3 py-1.5 text-left text-muted-foreground">{x.label}</td>
                          <td className="px-3 py-1.5">{money(x.amount)}</td>
                        </tr>
                      ))}
                      <tr className="font-medium"><td className="px-3 py-1.5 text-left">Total uses</td><td className="px-3 py-1.5">{money(result.sourcesAndUses.totalUses)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Debt schedule</div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-right text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-border bg-surface text-subtle-foreground">
                        <th className="px-3 py-1.5 text-left font-medium">Year</th>
                        <th className="px-3 py-1.5 font-medium">Revenue</th>
                        <th className="px-3 py-1.5 font-medium">EBITDA</th>
                        <th className="px-3 py-1.5 font-medium">Levered FCF</th>
                        <th className="px-3 py-1.5 font-medium">Net debt</th>
                        <th className="px-3 py-1.5 font-medium">ND / EBITDA</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {result.years.map((y) => (
                        <tr key={y.year} className={cn("border-b border-border/50 last:border-0", y.cashShortfall && "bg-loss-soft")}>
                          <td className="px-3 py-1.5 text-left">{y.year}</td>
                          <td className="px-3 py-1.5">{money(y.revenue)}</td>
                          <td className="px-3 py-1.5">{money(y.ebitda)}</td>
                          <td className="px-3 py-1.5">{money(y.leveredFcf)}</td>
                          <td className="px-3 py-1.5">{money(y.totalDebt - y.cash)}</td>
                          <td className="px-3 py-1.5">{turns(y.netDebtToEbitda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="max-w-prose text-2xs text-muted-foreground">
                MOIC = exit equity / sponsor equity; IRR = MOIC^(1/years) − 1. Rows highlighted red hit a cash shortfall (the model has no revolver). Interest accrues on beginning-of-year balances.
              </p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
