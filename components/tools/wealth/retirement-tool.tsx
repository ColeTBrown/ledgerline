"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { projectRetirement, type RetirementInputs, type RetirementResult } from "@/lib/finance/retirement";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";

const DEFAULTS: RetirementInputs = {
  currentAge: 35,
  retirementAge: 65,
  planToAge: 95,
  currentSavings: 50000,
  annualContribution: 20000,
  contributionGrowth: 0.02,
  preRetirementReturn: 0.07,
  postRetirementReturn: 0.04,
  inflation: 0.025,
  desiredIncome: 80000,
  otherIncome: 25000,
};

/** Lightweight inline area chart of the nominal balance trajectory. */
function BalanceChart({ result, retirementAge }: { result: RetirementResult; retirementAge: number }) {
  const w = 640;
  const h = 170;
  const pad = 4;
  const pts = result.years;
  if (pts.length < 2) return null;
  const maxBal = Math.max(...pts.map((p) => p.endBalance), 1);
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - (Math.max(0, v) / maxBal) * (h - 2 * pad);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.endBalance).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${(h - pad).toFixed(1)} L${x(0).toFixed(1)},${(h - pad).toFixed(1)} Z`;
  const retireIdx = pts.findIndex((p) => p.age >= retirementAge);
  const rx = retireIdx >= 0 ? x(retireIdx) : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[170px] w-full" preserveAspectRatio="none" role="img" aria-label="Projected balance by age">
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {rx !== null && <line x1={rx} y1={pad} x2={rx} y2={h - pad} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export function RetirementTool() {
  const tool = getTool("retirement")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<RetirementInputs>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      return { result: projectRetirement(s) as RetirementResult, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof RetirementInputs>(key: K, value: number) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });
  const onTrack = result ? result.shortfall <= 0 : false;

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 overflow-y-auto bg-surface p-4">
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Timeline</div>
            <NumberField label="Current age" kind="integer" min={0} max={120} value={s.currentAge} onChange={(v) => set("currentAge", v)} />
            <NumberField label="Retirement age" kind="integer" min={0} max={120} value={s.retirementAge} onChange={(v) => set("retirementAge", v)} />
            <NumberField label="Plan to age" kind="integer" min={0} max={120} value={s.planToAge} onChange={(v) => set("planToAge", v)} />
          </div>
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Savings</div>
            <NumberField label="Current savings" kind="currency" min={0} value={s.currentSavings} onChange={(v) => set("currentSavings", v)} />
            <NumberField label="Annual contribution" kind="currency" min={0} value={s.annualContribution} onChange={(v) => set("annualContribution", v)} />
            <NumberField label="Contribution growth / yr" kind="percent" value={s.contributionGrowth} onChange={(v) => set("contributionGrowth", v)} />
          </div>
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Assumptions</div>
            <NumberField label="Return before retirement" kind="percent" value={s.preRetirementReturn} onChange={(v) => set("preRetirementReturn", v)} />
            <NumberField label="Return in retirement" kind="percent" value={s.postRetirementReturn} onChange={(v) => set("postRetirementReturn", v)} />
            <NumberField label="Inflation" kind="percent" value={s.inflation} onChange={(v) => set("inflation", v)} />
          </div>
          <div className="space-y-3">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Retirement income</div>
            <NumberField label="Desired annual income" kind="currency" min={0} value={s.desiredIncome} onChange={(v) => set("desiredIncome", v)} hint="In today's dollars." />
            <NumberField label="Other income (SS, pension)" kind="currency" min={0} value={s.otherIncome} onChange={(v) => set("otherIncome", v)} />
          </div>
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 overflow-y-auto bg-background p-4">
          {error && <p className="text-sm text-loss">{error}</p>}
          {result && (
            <>
              <div className="rounded-md border border-border-strong bg-surface p-4">
                <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Outlook</div>
                <div className={`num mt-1 text-2xl font-semibold tabular-nums ${onTrack ? "text-gain" : "text-loss"}`}>
                  {onTrack ? "On track" : `Short by ${cur(result.shortfall)}`}
                </div>
                <p className="mt-1 text-2xs text-muted-foreground">
                  {result.depletionAge != null
                    ? `Savings run out at age ${result.depletionAge}.`
                    : "Savings last through the full plan horizon."}
                </p>
              </div>

              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Balance at retirement" value={cur(result.balanceAtRetirement)} />
                <Stat label="Required at retirement" value={cur(result.requiredAtRetirement)} />
                <Stat label="First-year withdrawal" value={cur(result.firstYearWithdrawal)} />
                <Stat
                  label="Extra savings / yr needed"
                  tone={result.additionalAnnualSavingsNeeded > 0 ? "loss" : "gain"}
                  value={Number.isFinite(result.additionalAnnualSavingsNeeded) ? cur(Math.max(0, result.additionalAnnualSavingsNeeded)) : "—"}
                />
              </StatGrid>

              <div>
                <div className="mb-1 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Projected balance (nominal)</div>
                <BalanceChart result={result} retirementAge={s.retirementAge} />
                <div className="mt-1 flex justify-between text-2xs text-subtle-foreground">
                  <span>Age {result.years[0]?.age}</span>
                  <span>Retirement {s.retirementAge}</span>
                  <span>Age {result.years[result.years.length - 1]?.age}</span>
                </div>
              </div>
              <p className="max-w-prose text-2xs text-muted-foreground">
                Contributions grow until retirement, then withdrawals cover desired income (inflation-adjusted) less other income. The dashed line marks retirement.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
