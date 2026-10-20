"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { solveTvm, type TvmVariable, type PaymentTiming } from "@/lib/finance/tvm";
import { formatCurrency, formatNumber, formatPercent, EMPTY_VALUE } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Segmented } from "@/components/ui/segmented";

interface TvmState {
  rate: number;
  nper: number;
  pmt: number;
  pv: number;
  fv: number;
  type: PaymentTiming;
}

const DEFAULTS: TvmState = { rate: 0.05, nper: 10, pmt: 0, pv: -1000, fv: 0, type: 0 };

const VARIABLE_OPTIONS: ReadonlyArray<{ value: TvmVariable; label: string }> = [
  { value: "pv", label: "PV" },
  { value: "fv", label: "FV" },
  { value: "pmt", label: "PMT" },
  { value: "nper", label: "N" },
  { value: "rate", label: "Rate" },
];

const LABELS: Record<TvmVariable, string> = {
  pv: "Present value (PV)",
  fv: "Future value (FV)",
  pmt: "Payment (PMT)",
  nper: "Periods (N)",
  rate: "Rate / period",
};

/** Format a resolved TVM value in the convention appropriate to its variable. */
function formatVariable(
  variable: TvmVariable,
  value: number | null,
  fmt: { locale: string; currency: string },
): string {
  if (value === null || !Number.isFinite(value)) return EMPTY_VALUE;
  switch (variable) {
    case "pv":
    case "fv":
    case "pmt":
      return formatCurrency(value, fmt.currency, { locale: fmt.locale });
    case "rate":
      return formatPercent(value, { locale: fmt.locale, decimals: 4 });
    case "nper":
      return formatNumber(value, { locale: fmt.locale, decimals: 2 });
  }
}

export function TvmCalculator() {
  const tool = getTool("tvm")!;
  const fmt = useNumberFormat();
  const [solveFor, setSolveFor] = useState<TvmVariable>("fv");
  const [state, setState] = useState<TvmState>(DEFAULTS);

  const result = useMemo(() => solveTvm(solveFor, state), [solveFor, state]);

  const resolved: TvmState = { ...state, [solveFor]: result ?? state[solveFor] };
  const known: TvmVariable[] = (["pv", "fv", "pmt", "nper", "rate"] as const).filter((v) => v !== solveFor);

  function set<K extends keyof TvmState>(key: K, value: TvmState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 bg-surface p-4">
          <div>
            <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Solve for</div>
            <Segmented
              aria-label="Variable to solve for"
              value={solveFor}
              onValueChange={setSolveFor}
              options={VARIABLE_OPTIONS}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            {known.includes("rate") && (
              <NumberField label="Rate / period" kind="percent" decimals={4} value={state.rate} onChange={(v) => set("rate", v)} hint="Interest rate for one period." />
            )}
            {known.includes("nper") && (
              <NumberField label="Periods (N)" kind="number" decimals={2} min={0} value={state.nper} onChange={(v) => set("nper", v)} hint="Number of compounding periods." />
            )}
            {known.includes("pv") && (
              <NumberField label="Present value (PV)" kind="currency" value={state.pv} onChange={(v) => set("pv", v)} hint="Cash paid out is negative." />
            )}
            {known.includes("pmt") && (
              <NumberField label="Payment (PMT)" kind="currency" value={state.pmt} onChange={(v) => set("pmt", v)} hint="Recurring payment each period." />
            )}
            {known.includes("fv") && (
              <NumberField label="Future value (FV)" kind="currency" value={state.fv} onChange={(v) => set("fv", v)} />
            )}
          </div>

          <div>
            <div className="mb-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Payment timing</div>
            <Segmented
              aria-label="Payment timing"
              value={String(state.type)}
              onValueChange={(v) => set("type", Number(v) as PaymentTiming)}
              options={[
                { value: "0", label: "End" },
                { value: "1", label: "Begin" },
              ]}
              className="w-full"
            />
          </div>
        </section>

        <section aria-label="Results" className="flex flex-col bg-background p-4">
          <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Result</div>
          <div className="mt-3 rounded-md border border-border-strong bg-surface p-4">
            <div className="text-xs text-muted-foreground">{LABELS[solveFor]}</div>
            <div className={cn("num mt-1 text-3xl font-semibold tabular-nums", result === null && "text-loss")}>
              {result === null ? "No solution" : formatVariable(solveFor, result, fmt)}
            </div>
            {result === null && <p className="mt-1 text-2xs text-muted-foreground">These inputs do not satisfy the TVM identity.</p>}
          </div>

          <div className="mt-4 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Resolved values</div>
          <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            {(["pv", "fv", "pmt", "nper", "rate"] as const).map((v) => (
              <div key={v} className={cn("flex flex-col gap-0.5 bg-surface px-3 py-2", v === solveFor && "bg-surface-3")}>
                <dt className="text-2xs text-subtle-foreground">{LABELS[v]}</dt>
                <dd className="num text-sm tabular-nums">{formatVariable(v, resolved[v], fmt)}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
              <dt className="text-2xs text-subtle-foreground">Timing</dt>
              <dd className="text-sm">{state.type === 0 ? "End of period" : "Begin of period"}</dd>
            </div>
          </dl>

          <p className="mt-4 max-w-prose text-2xs text-muted-foreground">
            Follows Excel / financial-calculator sign conventions: cash paid out is negative, cash received is positive. Rate is per period — divide an annual rate by the number of periods per year.
          </p>
        </section>
      </div>
    </div>
  );
}
