"use client";

import { useMemo, useState } from "react";
import { getTool } from "@/tools/registry";
import { analyzeRatios, type FinancialStatement, type RatioCategory, type RatioFormat, type RatioValue } from "@/lib/finance/ratios";
import { formatNumber, formatPercent } from "@/lib/format/number";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { NumberField } from "@/components/calc/number-field";

type FieldKey = keyof FinancialStatement;

const DEFAULTS: Record<FieldKey, number> = {
  revenue: 1000,
  costOfRevenue: 600,
  grossProfit: 400,
  operatingIncome: 180,
  netIncome: 120,
  depreciationAmortization: 50,
  ebitda: 230,
  interestExpense: 20,
  incomeTaxExpense: 32,
  pretaxIncome: 152,
  totalAssets: 1500,
  totalLiabilities: 900,
  totalEquity: 600,
  currentAssets: 500,
  currentLiabilities: 300,
  cash: 150,
  shortTermInvestments: 50,
  receivables: 120,
  inventory: 90,
  payables: 80,
  totalDebt: 400,
  operatingCashFlow: 200,
  capitalExpenditure: 70,
};

const GROUPS: ReadonlyArray<{ title: string; fields: ReadonlyArray<[FieldKey, string]> }> = [
  {
    title: "Income statement",
    fields: [
      ["revenue", "Revenue"],
      ["costOfRevenue", "Cost of revenue"],
      ["operatingIncome", "Operating income"],
      ["depreciationAmortization", "D&A"],
      ["interestExpense", "Interest expense"],
      ["pretaxIncome", "Pre-tax income"],
      ["incomeTaxExpense", "Income tax"],
      ["netIncome", "Net income"],
    ],
  },
  {
    title: "Balance sheet",
    fields: [
      ["totalAssets", "Total assets"],
      ["totalEquity", "Total equity"],
      ["totalDebt", "Total debt"],
      ["currentAssets", "Current assets"],
      ["currentLiabilities", "Current liabilities"],
      ["cash", "Cash"],
      ["receivables", "Receivables"],
      ["inventory", "Inventory"],
      ["payables", "Payables"],
    ],
  },
  {
    title: "Cash flow",
    fields: [
      ["operatingCashFlow", "Operating cash flow"],
      ["capitalExpenditure", "CapEx"],
    ],
  },
];

const CATEGORIES: readonly RatioCategory[] = ["Liquidity", "Leverage", "Profitability", "Efficiency"];

function formatRatio(format: RatioFormat, value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return "NM";
  switch (format) {
    case "multiple":
      return `${formatNumber(value, { locale, decimals: 2 })}×`;
    case "percent":
      return formatPercent(value, { locale, decimals: 1 });
    case "days":
      return `${formatNumber(value, { locale, decimals: 0 })} d`;
  }
}

export function RatiosTool() {
  const tool = getTool("ratios")!;
  const fmt = useNumberFormat();
  const [state, setState] = useState<Record<FieldKey, number>>(DEFAULTS);

  const ratios = useMemo<RatioValue[]>(() => {
    const statement: FinancialStatement = { ...state };
    return analyzeRatios(statement);
  }, [state]);

  function set(key: FieldKey, value: number) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-4 overflow-y-auto bg-surface p-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">{group.title}</div>
              {group.fields.map(([key, label]) => (
                <NumberField key={key} label={label} kind="currency" value={state[key]} onChange={(v) => set(key, v)} />
              ))}
            </div>
          ))}
        </section>

        <section aria-label="Results" className="overflow-y-auto bg-background p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {CATEGORIES.map((category) => {
              const rows = ratios.filter((r) => r.category === category);
              return (
                <div key={category} className="rounded-md border border-border">
                  <div className="border-b border-border bg-surface px-3 py-1.5 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">
                    {category}
                  </div>
                  <dl>
                    {rows.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-1.5 last:border-0">
                        <dt className="min-w-0 truncate text-xs" title={r.formula}>
                          {r.label}
                        </dt>
                        <dd className="num shrink-0 text-xs font-medium tabular-nums">{formatRatio(r.format, r.value, fmt.locale)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="mt-4 max-w-prose text-2xs text-muted-foreground">
            Ratios whose inputs are missing or whose denominator is zero show <span className="font-medium">NM</span> (not meaningful). Hover a ratio for its formula. Average-balance ratios use the current period when no prior is given.
          </p>
        </section>
      </div>
    </div>
  );
}
