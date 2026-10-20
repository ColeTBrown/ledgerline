"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { getTool } from "@/tools/registry";
import { varianceTable, type LineKind, type VarianceResult } from "@/lib/finance/variance";
import { formatCurrency, formatPercent } from "@/lib/format/number";
import { parseNumberInput } from "@/lib/format/parse";
import { useNumberFormat } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { ToolHeader } from "@/components/calc/tool-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

interface Line {
  id: string;
  label: string;
  kind: LineKind;
  budget: number;
  actual: number;
}
let seq = 0;
const line = (label: string, kind: LineKind, budget: number, actual: number): Line => ({ id: `ln-${seq++}`, label, kind, budget, actual });

const INITIAL: Line[] = [
  line("Product revenue", "revenue", 1000, 1080),
  line("Services revenue", "revenue", 400, 360),
  line("Cost of goods sold", "expense", 600, 640),
  line("Marketing", "expense", 150, 130),
  line("General & admin", "expense", 120, 128),
];

export function VarianceTool() {
  const tool = getTool("variance")!;
  const fmt = useNumberFormat();
  const [lines, setLines] = useState<Line[]>(INITIAL);

  const summary = useMemo(() => varianceTable(lines.map(({ label, kind, budget, actual }) => ({ label, kind, budget, actual }))), [lines]);

  function patch(id: string, p: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }
  const cur = (v: number | null | undefined) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0 });
  const signed = (v: number) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0, signed: true });
  const pct = (v: number | null) => (v == null ? "—" : formatPercent(v, { locale: fmt.locale, decimals: 1, signed: true }));

  function varCells(r: VarianceResult) {
    return (
      <>
        <td className="px-3 py-1.5">{cur(r.budget)}</td>
        <td className="px-3 py-1.5">{cur(r.actual)}</td>
        <td className={cn("px-3 py-1.5 num", r.favorable ? "text-gain" : "text-loss")}>{signed(r.variance)}</td>
        <td className={cn("px-3 py-1.5 num", r.favorable ? "text-gain" : "text-loss")}>{pct(r.variancePct)}</td>
        <td className="px-3 py-1.5 text-center">
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-2xs", r.favorable ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss")}>
            {r.favorable ? "Fav" : "Unfav"}
            {r.material ? " ●" : ""}
          </span>
        </td>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto bg-background p-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Line items</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setLines((p) => [...p, line("New revenue", "revenue", 0, 0)])}>
                <Plus /> Revenue
              </Button>
              <Button size="sm" variant="outline" onClick={() => setLines((p) => [...p, line("New expense", "expense", 0, 0)])}>
                <Plus /> Expense
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            {lines.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <Input value={l.label} onChange={(e) => patch(l.id, { label: e.target.value })} aria-label="Line label" className="h-7 flex-1" />
                <Segmented
                  aria-label="Line kind"
                  value={l.kind}
                  onValueChange={(v) => patch(l.id, { kind: v })}
                  options={[
                    { value: "revenue", label: "Rev" },
                    { value: "expense", label: "Exp" },
                  ]}
                />
                <Input defaultValue={String(l.budget)} onChange={(e) => patch(l.id, { budget: parseNumberInput(e.target.value, fmt.locale) ?? 0 })} inputMode="decimal" aria-label="Budget" className="num h-7 w-24 text-right" />
                <Input defaultValue={String(l.actual)} onChange={(e) => patch(l.id, { actual: parseNumberInput(e.target.value, fmt.locale) ?? 0 })} inputMode="decimal" aria-label="Actual" className="num h-7 w-24 text-right" />
                <button type="button" onClick={() => setLines((p) => (p.length > 1 ? p.filter((x) => x.id !== l.id) : p))} disabled={lines.length <= 1} className="rounded p-1 text-subtle-foreground hover:text-loss disabled:opacity-30" aria-label="Remove line">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Variance</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-right text-xs tabular-nums">
              <thead>
                <tr className="border-b border-border bg-surface text-subtle-foreground">
                  <th className="px-3 py-1.5 text-left font-medium">Line</th>
                  <th className="px-3 py-1.5 font-medium">Budget</th>
                  <th className="px-3 py-1.5 font-medium">Actual</th>
                  <th className="px-3 py-1.5 font-medium">Variance</th>
                  <th className="px-3 py-1.5 font-medium">%</th>
                  <th className="px-3 py-1.5 text-center font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-1.5 text-left">{r.label}</td>
                    {varCells(r)}
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-surface/60 font-medium">
                  <td className="px-3 py-1.5 text-left">Net income</td>
                  {varCells(summary.net)}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-prose text-2xs text-muted-foreground">
            Favorable = actual beats budget (higher revenue or lower expense). ● marks a material variance (≥ 10% of budget).
          </p>
        </section>
      </div>
    </div>
  );
}
