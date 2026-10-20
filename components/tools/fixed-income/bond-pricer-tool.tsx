"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { bondPrice, yieldToMaturity, currentYield, type BondInputs, type CouponFrequency } from "@/lib/finance/bonds";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";
import { Segmented } from "@/components/ui/segmented";

type Mode = "yield" | "price";

interface BondState {
  face: number;
  couponRate: number;
  yearsToMaturity: number;
  frequency: CouponFrequency;
  annualYield: number;
  cleanPrice: number;
}

const DEFAULTS: BondState = { face: 1000, couponRate: 0.05, yearsToMaturity: 10, frequency: 2, annualYield: 0.045, cleanPrice: 960 };

const FREQS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "1", label: "Annual" },
  { value: "2", label: "Semi" },
  { value: "4", label: "Quarterly" },
  { value: "12", label: "Monthly" },
];

export function BondPricerTool() {
  const tool = getTool("bond-pricer")!;
  const fmt = useNumberFormat();
  const [mode, setMode] = useState<Mode>("yield");
  const [s, setS] = useState<BondState>(DEFAULTS);

  const bond: BondInputs = { face: s.face, couponRate: s.couponRate, yearsToMaturity: s.yearsToMaturity, frequency: s.frequency };

  const { pricing, ytm, error } = useMemo(() => {
    try {
      if (mode === "yield") {
        const p = bondPrice(bond, s.annualYield);
        return { pricing: p, ytm: s.annualYield, error: null as string | null };
      }
      const y = yieldToMaturity(bond, s.cleanPrice);
      const p = y != null ? bondPrice(bond, y) : null;
      return { pricing: p, ytm: y, error: y == null ? "No yield reproduces that price." : null };
    } catch (e) {
      return { pricing: null, ytm: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, s]);

  const effectivePrice = pricing?.cleanPrice ?? s.cleanPrice;
  const curYield = useMemo(() => {
    try {
      return currentYield({ face: s.face, couponRate: s.couponRate }, effectivePrice);
    } catch {
      return null;
    }
  }, [s.face, s.couponRate, effectivePrice]);

  function set<K extends keyof BondState>(key: K, value: BondState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 2 });
  const pct = (v: number | null | undefined) => formatPercent(v, { locale: fmt.locale, decimals: 3 });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <div>
            <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Solve</div>
            <Segmented
              aria-label="Solve mode"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "yield", label: "Price from yield" },
                { value: "price", label: "Yield from price" },
              ]}
              className="w-full"
            />
          </div>
          <NumberField label="Face / par value" kind="currency" min={0} value={s.face} onChange={(v) => set("face", v)} />
          <NumberField label="Coupon rate" kind="percent" min={0} value={s.couponRate} onChange={(v) => set("couponRate", v)} />
          <NumberField label="Years to maturity" kind="number" decimals={2} min={0} suffix="yr" value={s.yearsToMaturity} onChange={(v) => set("yearsToMaturity", v)} />
          <div>
            <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Coupon frequency</div>
            <Segmented aria-label="Coupon frequency" value={String(s.frequency)} onValueChange={(v) => set("frequency", Number(v) as CouponFrequency)} options={FREQS} className="w-full" />
          </div>
          {mode === "yield" ? (
            <NumberField label="Yield to maturity" kind="percent" value={s.annualYield} onChange={(v) => set("annualYield", v)} />
          ) : (
            <NumberField label="Clean price" kind="currency" min={0} value={s.cleanPrice} onChange={(v) => set("cleanPrice", v)} />
          )}
        </section>

        <section aria-label="Results" className="flex flex-col gap-4 bg-background p-4">
          <div className="rounded-md border border-border-strong bg-surface p-4">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">{mode === "yield" ? "Clean price" : "Yield to maturity"}</div>
            <div className="num mt-1 text-3xl font-semibold tabular-nums">
              {mode === "yield" ? (pricing ? cur(pricing.cleanPrice) : "—") : ytm != null ? pct(ytm) : "—"}
            </div>
            {error && <p className="mt-1 text-2xs text-loss">{error}</p>}
            {pricing && <p className="mt-1 text-2xs text-muted-foreground">{formatNumber(pricing.pricePct, { locale: fmt.locale, decimals: 3 })}% of face</p>}
          </div>
          {pricing && (
            <>
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Dirty price" value={cur(pricing.dirtyPrice)} />
                <Stat label="Accrued interest" value={cur(pricing.accruedInterest)} />
                <Stat label="Current yield" value={pct(curYield)} />
                <Stat label="Coupon payment" value={cur(pricing.couponPayment)} hint={`${FREQS.find((f) => f.value === String(s.frequency))?.label.toLowerCase()}`} />
              </StatGrid>
              <p className="max-w-prose text-2xs text-muted-foreground">
                Clean price excludes accrued interest; dirty (invoice) price is what settles. Current yield = annual coupon / clean price. YTM assumes coupons reinvest at the yield.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
