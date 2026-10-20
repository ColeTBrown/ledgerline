"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { getTool } from "@/tools/registry";
import { compsTable, impliedValuation, type Peer, type MultipleKey } from "@/lib/finance/valuation/comps";
import { formatCurrency, formatNumber, EMPTY_VALUE } from "@/lib/format/number";
import { parseNumberInput } from "@/lib/format/parse";
import { useNumberFormat } from "@/lib/store/settings";
import { ToolHeader } from "@/components/calc/tool-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

interface PeerRow {
  id: string;
  ticker: string;
  price: number | null;
  sharesOutstanding: number | null;
  totalDebt: number | null;
  cash: number | null;
  revenue: number | null;
  ebitda: number | null;
  netIncome: number | null;
}

let seq = 0;
const row = (p: Omit<PeerRow, "id">): PeerRow => ({ id: `peer-${seq++}`, ...p });

const INITIAL: PeerRow[] = [
  row({ ticker: "AAA", price: 120, sharesOutstanding: 500, totalDebt: 2000, cash: 800, revenue: 9000, ebitda: 2600, netIncome: 1500 }),
  row({ ticker: "BBB", price: 64, sharesOutstanding: 900, totalDebt: 3500, cash: 500, revenue: 12000, ebitda: 2900, netIncome: 1400 }),
  row({ ticker: "CCC", price: 210, sharesOutstanding: 240, totalDebt: 900, cash: 1200, revenue: 5200, ebitda: 1800, netIncome: 1100 }),
];

const INITIAL_TARGET: PeerRow = row({ ticker: "TGT", price: 48, sharesOutstanding: 600, totalDebt: 2500, cash: 600, revenue: 7000, ebitda: 1900, netIncome: 950 });

const NUMERIC: ReadonlyArray<[keyof PeerRow, string]> = [
  ["price", "Price"],
  ["sharesOutstanding", "Shares"],
  ["totalDebt", "Debt"],
  ["cash", "Cash"],
  ["revenue", "Revenue"],
  ["ebitda", "EBITDA"],
  ["netIncome", "Net income"],
];

const METHOD_LABEL: Record<MultipleKey, string> = {
  evToEbitda: "EV / EBITDA",
  priceToEarnings: "P / E",
  evToSales: "EV / Sales",
};

function toPeer(r: PeerRow): Peer {
  return { ticker: r.ticker, price: r.price, sharesOutstanding: r.sharesOutstanding, totalDebt: r.totalDebt, cash: r.cash, revenue: r.revenue, ebitda: r.ebitda, netIncome: r.netIncome };
}

export function CompsTool() {
  const tool = getTool("comps")!;
  const fmt = useNumberFormat();
  const [peers, setPeers] = useState<PeerRow[]>(INITIAL);
  const [target, setTarget] = useState<PeerRow>(INITIAL_TARGET);
  const [stat, setStat] = useState<"median" | "mean">("median");

  const comps = useMemo(() => compsTable(peers.map(toPeer)), [peers]);
  const implied = useMemo(() => impliedValuation(toPeer(target), comps, stat), [target, comps, stat]);

  function setCell(id: string, key: keyof PeerRow, value: number | null) {
    setPeers((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }
  function setTicker(id: string, value: string) {
    setPeers((prev) => prev.map((r) => (r.id === id ? { ...r, ticker: value.toUpperCase() } : r)));
  }
  function addRow() {
    setPeers((prev) => [...prev, row({ ticker: "", price: null, sharesOutstanding: null, totalDebt: null, cash: null, revenue: null, ebitda: null, netIncome: null })]);
  }
  function removeRow(id: string) {
    setPeers((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  const mult = (v: number | null) => (v === null || !Number.isFinite(v) ? "NM" : `${formatNumber(v, { locale: fmt.locale, decimals: 1 })}×`);
  const money = (v: number | null) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 0, compact: true });
  const price = (v: number | null) => formatCurrency(v, fmt.currency, { locale: fmt.locale, decimals: 2 });

  const statRow = (key: MultipleKey) => comps.stats[key];

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto bg-background p-4">
        {/* Peer set */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Peer set</div>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus /> Add peer
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-right text-xs tabular-nums">
              <thead>
                <tr className="border-b border-border bg-surface text-subtle-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">Ticker</th>
                  {NUMERIC.map(([, label]) => (
                    <th key={label} className="px-2 py-1.5 font-medium">{label}</th>
                  ))}
                  <th className="w-8 px-2 py-1.5" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {peers.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="px-1.5 py-1">
                      <Input
                        value={r.ticker}
                        onChange={(e) => setTicker(r.id, e.target.value)}
                        aria-label="Ticker"
                        className="h-7 w-20 font-mono uppercase"
                      />
                    </td>
                    {NUMERIC.map(([key]) => (
                      <td key={key} className="px-1.5 py-1">
                        <Input
                          defaultValue={r[key] === null ? "" : String(r[key])}
                          onChange={(e) => setCell(r.id, key, parseNumberInput(e.target.value, fmt.locale))}
                          inputMode="decimal"
                          aria-label={String(key)}
                          className="num h-7 w-24 text-right"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="rounded p-1 text-subtle-foreground hover:text-loss disabled:opacity-30"
                        disabled={peers.length <= 1}
                        aria-label={`Remove ${r.ticker || "peer"}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Trading multiples */}
        <section>
          <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Trading multiples</div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-right text-xs tabular-nums">
              <thead>
                <tr className="border-b border-border bg-surface text-subtle-foreground">
                  <th className="px-3 py-1.5 text-left font-medium">Ticker</th>
                  <th className="px-3 py-1.5 font-medium">Market cap</th>
                  <th className="px-3 py-1.5 font-medium">EV</th>
                  <th className="px-3 py-1.5 font-medium">EV/EBITDA</th>
                  <th className="px-3 py-1.5 font-medium">P/E</th>
                  <th className="px-3 py-1.5 font-medium">EV/Sales</th>
                </tr>
              </thead>
              <tbody className="num">
                {comps.rows.map((r) => (
                  <tr key={r.ticker} className="border-b border-border/50">
                    <td className="px-3 py-1.5 text-left font-mono">{r.ticker || "—"}</td>
                    <td className="px-3 py-1.5">{money(r.marketCap)}</td>
                    <td className="px-3 py-1.5">{money(r.enterpriseValue)}</td>
                    <td className="px-3 py-1.5">{mult(r.evToEbitda)}</td>
                    <td className="px-3 py-1.5">{mult(r.priceToEarnings)}</td>
                    <td className="px-3 py-1.5">{mult(r.evToSales)}</td>
                  </tr>
                ))}
                {(["median", "mean", "max", "min"] as const).map((k) => (
                  <tr key={k} className="border-t border-border bg-surface/60 font-medium">
                    <td className="px-3 py-1.5 text-left capitalize">{k === "max" ? "High" : k === "min" ? "Low" : k}</td>
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5">{mult(statRow("evToEbitda")[k])}</td>
                    <td className="px-3 py-1.5">{mult(statRow("priceToEarnings")[k])}</td>
                    <td className="px-3 py-1.5">{mult(statRow("evToSales")[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Target & implied valuation */}
        <section className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Target company</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="w-24 text-xs text-muted-foreground">Ticker</label>
                <Input value={target.ticker} onChange={(e) => setTarget((t) => ({ ...t, ticker: e.target.value.toUpperCase() }))} aria-label="Target ticker" className="h-7 font-mono uppercase" />
              </div>
              {NUMERIC.map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <label className="w-24 text-xs text-muted-foreground">{label}</label>
                  <Input
                    defaultValue={target[key] === null ? "" : String(target[key])}
                    onChange={(e) => setTarget((t) => ({ ...t, [key]: parseNumberInput(e.target.value, fmt.locale) }))}
                    inputMode="decimal"
                    aria-label={`Target ${label}`}
                    className="num h-7 text-right"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5">
              <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Implied value — {target.ticker || "target"}</div>
              <Segmented
                aria-label="Peer statistic"
                value={stat}
                onValueChange={setStat}
                options={[
                  { value: "median", label: "Median" },
                  { value: "mean", label: "Mean" },
                ]}
              />
            </div>
            {implied.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">
                Not enough data to imply a value. Enter the target&apos;s shares, net debt and the relevant metric (EBITDA, revenue or net income).
              </p>
            ) : (
              <table className="w-full text-right text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-border text-subtle-foreground">
                    <th className="px-3 py-1.5 text-left font-medium">Method</th>
                    <th className="px-3 py-1.5 font-medium">Multiple</th>
                    <th className="px-3 py-1.5 font-medium">Equity value</th>
                    <th className="px-3 py-1.5 font-medium">Value / share</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {implied.map((v) => (
                    <tr key={v.method} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-1.5 text-left">{METHOD_LABEL[v.method]}</td>
                      <td className="px-3 py-1.5">{mult(v.multiple)}</td>
                      <td className="px-3 py-1.5">{money(v.equityValue)}</td>
                      <td className="px-3 py-1.5 font-medium">{price(v.pricePerShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <p className="max-w-prose text-2xs text-muted-foreground">
          EV = market cap + debt − cash. {EMPTY_VALUE} shows for missing inputs; NM (not meaningful) when a denominator is zero or negative. Implied value applies the peer {stat} multiple to the target&apos;s own metric.
        </p>
      </div>
    </div>
  );
}
