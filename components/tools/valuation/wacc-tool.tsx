"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { costOfEquityCapm, wacc, type WaccResult } from "@/lib/finance/valuation/wacc";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";

interface WaccState {
  riskFreeRate: number;
  beta: number;
  equityRiskPremium: number;
  equityValue: number;
  debtValue: number;
  preTaxCostOfDebt: number;
  taxRate: number;
}

const DEFAULTS: WaccState = {
  riskFreeRate: 0.042,
  beta: 1.1,
  equityRiskPremium: 0.055,
  equityValue: 800,
  debtValue: 200,
  preTaxCostOfDebt: 0.06,
  taxRate: 0.21,
};

export function WaccTool() {
  const tool = getTool("wacc")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<WaccState>(DEFAULTS);

  const { result, costOfEquity, error } = useMemo(() => {
    try {
      const ke = costOfEquityCapm({ riskFreeRate: s.riskFreeRate, beta: s.beta, equityRiskPremium: s.equityRiskPremium });
      const r = wacc({
        equityValue: s.equityValue,
        debtValue: s.debtValue,
        costOfEquity: ke,
        preTaxCostOfDebt: s.preTaxCostOfDebt,
        taxRate: s.taxRate,
      });
      return { result: r as WaccResult, costOfEquity: ke, error: null as string | null };
    } catch (e) {
      const msg = e instanceof FinanceInputError ? e.message : "Check the inputs.";
      return { result: null, costOfEquity: null, error: msg };
    }
  }, [s]);

  function set<K extends keyof WaccState>(key: K, value: number) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  const pct = (v: number | null) => formatPercent(v, { locale: fmt.locale, decimals: 2 });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 bg-surface p-4">
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Cost of equity (CAPM)</div>
            <NumberField label="Risk-free rate" kind="percent" value={s.riskFreeRate} onChange={(v) => set("riskFreeRate", v)} hint="e.g. 10-year Treasury yield." />
            <NumberField label="Beta" kind="number" decimals={2} value={s.beta} onChange={(v) => set("beta", v)} />
            <NumberField label="Equity risk premium" kind="percent" value={s.equityRiskPremium} onChange={(v) => set("equityRiskPremium", v)} hint="Expected market return − risk-free rate." />
          </div>
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Capital structure</div>
            <NumberField label="Equity value" kind="currency" min={0} value={s.equityValue} onChange={(v) => set("equityValue", v)} hint="Market value of equity." />
            <NumberField label="Debt value" kind="currency" min={0} value={s.debtValue} onChange={(v) => set("debtValue", v)} />
            <NumberField label="Pre-tax cost of debt" kind="percent" value={s.preTaxCostOfDebt} onChange={(v) => set("preTaxCostOfDebt", v)} />
            <NumberField label="Tax rate" kind="percent" min={0} max={0.9999} value={s.taxRate} onChange={(v) => set("taxRate", v)} />
          </div>
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          <div>
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Weighted average cost of capital</div>
            <div className="mt-2 rounded-md border border-border-strong bg-surface p-4">
              <div className="num text-3xl font-semibold tabular-nums">{result ? pct(result.wacc) : "—"}</div>
              {error && <p className="mt-1 text-2xs text-loss">{error}</p>}
            </div>
          </div>

          {result && (
            <>
              <StatGrid className="sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Cost of equity" value={pct(costOfEquity)} />
                <Stat label="After-tax cost of debt" value={pct(result.afterTaxCostOfDebt)} />
                <Stat label="Equity weight" value={pct(result.equityWeight)} />
                <Stat label="Debt weight" value={pct(result.debtWeight)} />
              </StatGrid>

              <div className="max-w-prose text-2xs text-muted-foreground">
                WACC = E/V·Ke + D/V·Kd·(1 − tax). Capital weights use market values. Feed this rate into the DCF model as the discount rate.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
