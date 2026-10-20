"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { amortizationSchedule, type AmortizationInputs, type AmortizationResult } from "@/lib/finance/loans";
import { FinanceInputError } from "@/lib/finance/errors";
import { formatCurrency, formatNumber } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";
import { Stat, StatGrid } from "@/components/calc/stat";

interface LoanState {
  principal: number;
  annualRate: number;
  years: number;
  periodsPerYear: number;
  extraPayment: number;
}

const DEFAULTS: LoanState = { principal: 300000, annualRate: 0.065, years: 30, periodsPerYear: 12, extraPayment: 0 };

export function LoanAmortizationTool() {
  const tool = getTool("loan-amortization")!;
  const fmt = useNumberFormat();
  const [s, setS] = useState<LoanState>(DEFAULTS);

  const { result, error } = useMemo(() => {
    try {
      const inputs: AmortizationInputs = {
        principal: s.principal,
        annualRate: s.annualRate,
        numberOfPayments: Math.max(1, Math.round(s.years * s.periodsPerYear)),
        periodsPerYear: s.periodsPerYear,
        extraPayment: s.extraPayment > 0 ? s.extraPayment : undefined,
      };
      return { result: amortizationSchedule(inputs) as AmortizationResult, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof FinanceInputError ? e.message : "Check the inputs." };
    }
  }, [s]);

  function set<K extends keyof LoanState>(key: K, value: number) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 2 });
  const cur0 = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <NumberField label="Loan amount" kind="currency" min={0} value={s.principal} onChange={(v) => set("principal", v)} />
          <NumberField label="Annual interest rate" kind="percent" value={s.annualRate} onChange={(v) => set("annualRate", v)} />
          <NumberField label="Term" kind="number" decimals={0} min={1} suffix="yr" value={s.years} onChange={(v) => set("years", v)} />
          <NumberField label="Payments per year" kind="integer" min={1} max={365} value={s.periodsPerYear} onChange={(v) => set("periodsPerYear", v)} hint="12 = monthly, 26 = bi-weekly." />
          <NumberField label="Extra payment / period" kind="currency" min={0} value={s.extraPayment} onChange={(v) => set("extraPayment", v)} hint="Applied to principal each period." />
        </section>

        <section aria-label="Results" className="flex min-h-0 flex-col gap-4 bg-background p-4">
          {error && <p className="text-sm text-loss">{error}</p>}
          {result && (
            <>
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat label="Payment" size="lg" value={cur(result.scheduledPayment)} hint={`${s.periodsPerYear === 12 ? "monthly" : "per period"}`} />
                <Stat label="Total interest" value={cur0(result.totalInterest)} />
                <Stat label="Total paid" value={cur0(result.totalPaid)} />
                <Stat label="Payoff" value={`${formatNumber(result.payoffPeriods / s.periodsPerYear, { locale: fmt.locale, decimals: 1 })} yr`} />
              </StatGrid>
              {s.extraPayment > 0 && (
                <StatGrid className="grid-cols-2">
                  <Stat label="Interest saved" tone="gain" value={cur0(result.interestSaved)} />
                  <Stat label="Time saved" tone="gain" value={`${formatNumber(result.periodsSaved / s.periodsPerYear, { locale: fmt.locale, decimals: 1 })} yr`} />
                </StatGrid>
              )}
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Amortization schedule</div>
                <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
                  <table className="w-full text-right text-xs tabular-nums">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border text-subtle-foreground">
                        <th className="px-3 py-1.5 text-left font-medium">#</th>
                        <th className="px-3 py-1.5 font-medium">Payment</th>
                        <th className="px-3 py-1.5 font-medium">Interest</th>
                        <th className="px-3 py-1.5 font-medium">Principal</th>
                        <th className="px-3 py-1.5 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {result.rows.map((row) => (
                        <tr key={row.period} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-1 text-left">{row.period}</td>
                          <td className="px-3 py-1">{cur(row.payment + row.extra)}</td>
                          <td className="px-3 py-1">{cur(row.interest)}</td>
                          <td className="px-3 py-1">{cur(row.principal + row.extra)}</td>
                          <td className="px-3 py-1">{cur(row.endingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
