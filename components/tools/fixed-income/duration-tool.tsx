"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { bondRisk, rateShock, type BondInputs, type CouponFrequency } from "@/lib/finance/bonds";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Segmented } from "@/components/ui/segmented";

interface DurState {
  face: number;
  couponRate: number;
  yearsToMaturity: number;
  frequency: CouponFrequency;
  annualYield: number;
  shockBp: number;
}

const DEFAULTS: DurState = { face: 1000, couponRate: 0.05, yearsToMaturity: 10, frequency: 2, annualYield: 0.045, shockBp: 100 };

const FREQS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "1", label: "Annual" },
  { value: "2", label: "Semi" },
  { value: "4", label: "Quarterly" },
  { value: "12", label: "Monthly" },
];

export function DurationTool() {
  const tool = getTool("duration")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<DurState>(DEFAULTS);

  const { risk, shock, error } = useMemo(() => {
    const bond: BondInputs = { face: s.face, couponRate: s.couponRate, yearsToMaturity: s.yearsToMaturity, frequency: s.frequency };
    try {
      return { risk: bondRisk(bond, s.annualYield), shock: rateShock(bond, s.annualYield, s.shockBp / 10000), error: null as string | null };
    } catch (e) {
      return { risk: null, shock: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof DurState>(key: K, value: DurState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 2 });
  const yrs = (v: number | null | undefined) => `${formatNumber(v, { locale: fmt.locale, decimals: 3 })} yr`;

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <NumberField label="Face / par value" kind="currency" min={0} value={s.face} onChange={(v) => set("face", v)} />
          <NumberField label="Coupon rate" kind="percent" min={0} value={s.couponRate} onChange={(v) => set("couponRate", v)} />
          <NumberField label="Years to maturity" kind="number" decimals={2} min={0} suffix="yr" value={s.yearsToMaturity} onChange={(v) => set("yearsToMaturity", v)} />
          <div>
            <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Coupon frequency</div>
            <Segmented aria-label="Coupon frequency" value={String(s.frequency)} onValueChange={(v) => set("frequency", Number(v) as CouponFrequency)} options={FREQS} className="w-full" />
          </div>
          <NumberField label="Yield to maturity" kind="percent" value={s.annualYield} onChange={(v) => set("annualYield", v)} />
          <NumberField label="Rate shock" kind="number" decimals={0} suffix="bp" value={s.shockBp} onChange={(v) => set("shockBp", v)} hint="Parallel yield move, e.g. +100 bp." />
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          {error && <p className="text-sm text-loss">{error}</p>}
          {risk && shock && (
            <>
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Modified duration" size="lg" value={yrs(risk.modifiedDuration)} />
                <Stat label="Macaulay duration" value={yrs(risk.macaulayDuration)} />
                <Stat label="Convexity" value={formatNumber(risk.convexity, { locale: fmt.locale, decimals: 2 })} />
                <Stat label="DV01" value={cur(risk.dv01)} hint="per bp" />
              </StatGrid>

              <div>
                <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">
                  Price impact of a {s.shockBp >= 0 ? "+" : ""}{formatNumber(s.shockBp, { locale: fmt.locale, decimals: 0 })} bp shock
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-right text-xs tabular-nums">
                    <tbody className="num">
                      <tr className="border-b border-border/50"><td className="px-3 py-1.5 text-left text-muted-foreground">Base dirty price</td><td className="px-3 py-1.5">{cur(shock.basePrice)}</td></tr>
                      <tr className="border-b border-border/50"><td className="px-3 py-1.5 text-left text-muted-foreground">Duration estimate</td><td className={cn("px-3 py-1.5", shock.durationEstimate >= 0 ? "text-gain" : "text-loss")}>{formatCurrency(shock.durationEstimate, fmt.currency, { locale: fmt.locale, decimals: 2, signed: true })}</td></tr>
                      <tr className="border-b border-border/50"><td className="px-3 py-1.5 text-left text-muted-foreground">Convexity adjustment</td><td className="px-3 py-1.5">{formatCurrency(shock.convexityAdjustment, fmt.currency, { locale: fmt.locale, decimals: 2, signed: true })}</td></tr>
                      <tr className="border-b border-border/50 font-medium"><td className="px-3 py-1.5 text-left">Estimated new price</td><td className="px-3 py-1.5">{cur(shock.estimatedPrice)}</td></tr>
                      <tr className="border-b border-border/50"><td className="px-3 py-1.5 text-left text-muted-foreground">Full repricing</td><td className="px-3 py-1.5">{cur(shock.actualPrice)}</td></tr>
                      <tr><td className="px-3 py-1.5 text-left text-muted-foreground">Estimation error</td><td className="px-3 py-1.5">{cur(shock.estimationError)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="max-w-prose text-2xs text-muted-foreground">
                ΔP ≈ P·(−D_mod·Δy + ½·C·Δy²). Convexity makes the second-order estimate track full repricing closely even for large shocks.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
