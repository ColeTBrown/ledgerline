"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { getTool } from "@/tools/registry";
import { npvT0, irr, mirr, paybackPeriod, discountedPaybackPeriod, profitabilityIndex } from "@/lib/finance/cashflow";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { parseNumberInput } from "@/lib/format/parse";
import { useNumberFormat } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Flow {
  id: string;
  amount: number;
}
let seq = 0;
const flow = (amount: number): Flow => ({ id: `cf-${seq++}`, amount });

export function CapitalBudgetingTool() {
  const tool = getTool("capital-budgeting")!;
  const fmt = useNumberFormat();
  const [rate, setRate] = useState(0.1);
  const [financeRate, setFinanceRate] = useState(0.08);
  const [reinvestRate, setReinvestRate] = useState(0.1);
  const [flows, setFlows] = useState<Flow[]>([flow(-1000), flow(300), flow(350), flow(400), flow(450), flow(300)]);

  const cf = flows.map((f) => f.amount);
  const r = useMemo(
    () => ({
      npv: npvT0(rate, cf),
      irr: irr(cf),
      mirr: mirr(cf, financeRate, reinvestRate),
      payback: paybackPeriod(cf),
      discPayback: discountedPaybackPeriod(rate, cf),
      pi: profitabilityIndex(rate, cf),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rate, financeRate, reinvestRate, flows],
  );

  function setAmount(id: string, amount: number) {
    setFlows((prev) => prev.map((f) => (f.id === id ? { ...f, amount } : f)));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });
  const pct = (v: number | null | undefined) => (v == null ? "—" : formatPercent(v, { locale: fmt.locale, decimals: 2 }));
  const yrs = (v: number | null | undefined) => (v == null ? "Never" : `${formatNumber(v, { locale: fmt.locale, decimals: 2 })} yr`);

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 overflow-y-auto bg-surface p-4">
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Rates</div>
            <NumberField label="Discount rate (WACC)" kind="percent" value={rate} onChange={setRate} />
            <NumberField label="Finance rate (MIRR)" kind="percent" value={financeRate} onChange={setFinanceRate} />
            <NumberField label="Reinvestment rate (MIRR)" kind="percent" value={reinvestRate} onChange={setReinvestRate} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Cash flows</div>
              <Button size="sm" variant="outline" onClick={() => setFlows((p) => [...p, flow(0)])}>
                <Plus /> Year
              </Button>
            </div>
            <div className="space-y-1.5">
              {flows.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-2xs text-subtle-foreground">Year {i}</span>
                  <Input
                    defaultValue={String(f.amount)}
                    onChange={(e) => setAmount(f.id, parseNumberInput(e.target.value, fmt.locale) ?? 0)}
                    inputMode="decimal"
                    aria-label={`Year ${i} cash flow`}
                    className="num h-7 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setFlows((p) => (p.length > 2 ? p.filter((x) => x.id !== f.id) : p))}
                    disabled={flows.length <= 2}
                    className="rounded p-1 text-subtle-foreground hover:text-loss disabled:opacity-30"
                    aria-label={`Remove year ${i}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">Year 0 is the initial outlay (enter it negative).</p>
          </div>
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          <div className="rounded-md border border-border-strong bg-surface p-4">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Net present value</div>
            <div className={cn("num mt-1 text-3xl font-semibold tabular-nums", r.npv >= 0 ? "text-gain" : "text-loss")}>{cur(r.npv)}</div>
            <p className="mt-1 text-2xs text-muted-foreground">{r.npv >= 0 ? "Positive NPV — accept the project." : "Negative NPV — reject at this discount rate."}</p>
          </div>
          <StatGrid className="grid-cols-2 xl:grid-cols-3">
            <Stat label="IRR" value={pct(r.irr)} />
            <Stat label="MIRR" value={pct(r.mirr)} />
            <Stat label="Profitability index" value={formatNumber(r.pi, { locale: fmt.locale, decimals: 2 })} />
            <Stat label="Payback" value={yrs(r.payback)} />
            <Stat label="Discounted payback" value={yrs(r.discPayback)} />
            <Stat label="Decision" value={r.npv >= 0 ? "Accept" : "Reject"} tone={r.npv >= 0 ? "gain" : "loss"} />
          </StatGrid>
          <p className="max-w-prose text-2xs text-muted-foreground">
            NPV discounts every cash flow to today. IRR is the rate that zeroes NPV; MIRR reinvests interim flows at the reinvestment rate. PI &gt; 1 corresponds to a positive NPV.
          </p>
        </section>
      </div>
    </div>
  );
}
