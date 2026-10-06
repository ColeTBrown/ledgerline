"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { getTool } from "@/tools/registry";
import { normalizeSymbol } from "@/lib/data/symbols";
import type { DataResult, Fundamentals, FundamentalField } from "@/lib/data/types";
import { useSettings } from "@/lib/store/settings";
import { cn } from "@/lib/utils";
import { useCapability, useFundamentals, useMetrics, useNews, useProfile, useQuote, type Capability } from "@/hooks/use-market";
import { ToolHeader } from "@/components/calc/tool-header";
import { DataNotice } from "@/components/data/data-notice";
import { Num, useFlash } from "@/components/data/num";
import { SourceBadge } from "@/components/data/source-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanySnapshot() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const symbol = normalizeSymbol(params.get("symbol"));
  const [input, setInput] = useState(symbol ?? "");
  const [inputError, setInputError] = useState<string | null>(null);
  const watchlist = useSettings((s) => s.watchlist).filter((w) => !w.startsWith("TREASURY:"));
  const tool = getTool("company")!;

  function load(e: FormEvent) {
    e.preventDefault();
    const s = normalizeSymbol(input);
    if (!s) return setInputError("Enter a valid ticker, e.g. AAPL.");
    setInputError(null);
    router.replace(`${pathname}?symbol=${encodeURIComponent(s)}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader
        tool={tool}
        actions={
          <form onSubmit={load} className="flex items-start gap-2" role="search">
            <div>
              <Input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.toUpperCase());
                  setInputError(null);
                }}
                placeholder="Ticker"
                aria-label="Ticker symbol"
                aria-invalid={inputError ? true : undefined}
                className="h-7 w-28 font-mono uppercase"
              />
              {inputError && <p className="mt-1 text-2xs text-loss">{inputError}</p>}
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Search /> Load
            </Button>
          </form>
        }
      />
      {symbol ? (
        <SnapshotBody key={symbol} symbol={symbol} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="max-w-sm text-center">
            <p className="text-sm font-medium">Load a company</p>
            <p className="mt-1 text-xs text-muted-foreground">Enter a ticker above, or press ⌘K / Ctrl+K and search by name.</p>
            {watchlist.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {watchlist.map((w) => (
                  <Button key={w} size="xs" variant="outline" onClick={() => router.replace(`${pathname}?symbol=${w}`)}>
                    {w}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SnapshotBody({ symbol }: { symbol: string }) {
  return (
    <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <QuoteHeader symbol={symbol} />
        <KeyMetrics symbol={symbol} />
        <SecFinancials symbol={symbol} />
      </div>
      <div className="min-w-0 space-y-4">
        <ProfilePanel symbol={symbol} />
        <NewsPanel symbol={symbol} />
      </div>
    </div>
  );
}

function Panel({ title, badge, children, className }: { title: string; badge?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-border bg-surface", className)} aria-label={title}>
      <header className="flex h-9 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">{title}</h2>
        {badge}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/**
 * Render a data-backed section: skeleton while loading, a setup notice when
 * the capability is not configured, a quiet notice on failure, else content.
 */
function DataSection<T>({
  capability,
  query,
  skeleton,
  children,
}: {
  capability: Capability;
  query: { data: DataResult<T> | undefined; isLoading: boolean };
  skeleton: ReactNode;
  children: (value: T) => ReactNode;
}) {
  const cap = useCapability(capability);
  if (cap === "off") return <DataNotice reason="missing_key" capability={capability} />;
  if (cap === "loading" || query.isLoading || !query.data) return <>{skeleton}</>;
  if (!query.data.ok) return <DataNotice reason={query.data.reason} message={query.data.message} capability={capability} />;
  return <>{children(query.data.value)}</>;
}

const lines = (n: number, h = "h-4") => (
  <div className="space-y-2">
    {Array.from({ length: n }, (_, i) => (
      <Skeleton key={i} className={h} />
    ))}
  </div>
);

function badgeFor<T>(r: DataResult<T> | undefined) {
  return r?.ok ? <SourceBadge status={r.status} source={r.source} asOf={r.asOf} /> : null;
}

function QuoteHeader({ symbol }: { symbol: string }) {
  const quote = useQuote(symbol);
  const profile = useProfile(symbol);
  const q = quote.data;
  const flash = useFlash(q?.ok ? q.value.price : undefined);
  const name = profile.data?.ok ? profile.data.value.name : null;

  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-label="Quote">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{symbol}</h2>
            {profile.data?.ok && profile.data.value.exchange && (
              <span className="truncate text-2xs text-subtle-foreground uppercase">{profile.data.value.exchange}</span>
            )}
          </div>
          <div className="h-5 truncate text-sm text-muted-foreground">{profile.isLoading ? <Skeleton className="mt-1 h-3.5 w-48" /> : name}</div>
        </div>
        {badgeFor(q)}
      </div>
      <div className="mt-3 flex min-h-10 flex-wrap items-baseline gap-x-4 gap-y-1">
        <DataSection capability="quotes" query={quote} skeleton={<Skeleton className="h-9 w-48" />}>
          {(v) => (
            <>
              <span className={cn("rounded-sm px-1 text-3xl", flash)}>
                <Num value={v.price} decimals={2} />
              </span>
              <span className="flex gap-3 text-sm">
                <Num value={v.change} decimals={2} signed colorBySign />
                <Num value={v.changePercent} kind="percent" decimals={2} signed colorBySign />
              </span>
              <span className="flex gap-4 text-2xs text-subtle-foreground">
                <span>
                  O <Num value={v.open} decimals={2} />
                </span>
                <span>
                  H <Num value={v.high} decimals={2} />
                </span>
                <span>
                  L <Num value={v.low} decimals={2} />
                </span>
                <span>
                  PC <Num value={v.previousClose} decimals={2} />
                </span>
              </span>
            </>
          )}
        </DataSection>
      </div>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-2xs text-subtle-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function KeyMetrics({ symbol }: { symbol: string }) {
  const metrics = useMetrics(symbol);
  const profile = useProfile(symbol);
  const p = profile.data?.ok ? profile.data.value : null;
  const skeleton = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 10 }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );

  return (
    <Panel title="Key metrics" badge={badgeFor(metrics.data)}>
      <DataSection capability="quotes" query={metrics} skeleton={skeleton}>
        {(m) => (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Market cap">
              <Num value={p?.marketCap} kind="currency" compact decimals={2} />
            </Metric>
            <Metric label="Shares outstanding">
              <Num value={p?.sharesOutstanding} compact decimals={2} />
            </Metric>
            <Metric label="P/E (TTM)">
              <Num value={m.peRatio} decimals={1} />
            </Metric>
            <Metric label="EPS (TTM)">
              <Num value={m.eps} decimals={2} />
            </Metric>
            <Metric label="Beta">
              <Num value={m.beta} decimals={2} />
            </Metric>
            <Metric label="Dividend yield">
              <Num value={m.dividendYield} kind="percent" decimals={2} />
            </Metric>
            <Metric label="52-week range">
              <span className="num">
                <Num value={m.week52Low} decimals={2} /> – <Num value={m.week52High} decimals={2} />
              </span>
            </Metric>
            <Metric label="Net margin (TTM)">
              <Num value={m.netMargin} kind="percent" decimals={1} />
            </Metric>
            <Metric label="ROE (TTM)">
              <Num value={m.roe} kind="percent" decimals={1} />
            </Metric>
            <Metric label="Debt / equity">
              <Num value={m.debtToEquity} decimals={2} />
            </Metric>
          </dl>
        )}
      </DataSection>
    </Panel>
  );
}

const SEC_ROWS: Array<{ field: FundamentalField; label: string }> = [
  { field: "revenue", label: "Revenue" },
  { field: "grossProfit", label: "Gross profit" },
  { field: "operatingIncome", label: "Operating income" },
  { field: "ebitda", label: "EBITDA" },
  { field: "netIncome", label: "Net income" },
  { field: "operatingCashFlow", label: "Operating cash flow" },
  { field: "capitalExpenditure", label: "Capital expenditure" },
  { field: "cash", label: "Cash & equivalents" },
  { field: "totalDebt", label: "Total debt" },
  { field: "totalEquity", label: "Shareholders' equity" },
];

function SecFinancials({ symbol }: { symbol: string }) {
  const f = useFundamentals(symbol);
  return (
    <Panel title="Annual financials (SEC filings)" badge={badgeFor(f.data)}>
      <DataSection capability="fundamentals" query={f} skeleton={lines(6)}>
        {(data) => <FundamentalsTable data={data} />}
      </DataSection>
    </Panel>
  );
}

function FundamentalsTable({ data }: { data: Fundamentals }) {
  const periods = [...data.periods].reverse();
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <caption className="sr-only">Annual financials for {data.entityName}, in reporting currency</caption>
        <thead>
          <tr className="border-b border-border text-subtle-foreground">
            <th scope="col" className="py-1.5 pr-3 text-left font-normal">
              {data.entityName}
            </th>
            {periods.map((p) => (
              <th key={p.periodEnd} scope="col" className="num py-1.5 pl-3 text-right font-normal" title={`Period ended ${p.periodEnd} · ${p.form} filed ${p.filed}`}>
                {p.fiscalYear}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SEC_ROWS.map((row) => (
            <tr key={row.field} className="border-b border-border/60 last:border-0">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted-foreground">
                {row.label}
                {periods.some((p) => p.derived.includes(row.field)) && (
                  <span className="ml-1 text-2xs text-subtle-foreground" title="Derived from reported line items">
                    (derived)
                  </span>
                )}
              </th>
              {periods.map((p) => (
                <td key={p.periodEnd} className="py-1.5 pl-3 text-right">
                  <Num value={p.values[row.field]} compact decimals={2} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.sharesOutstanding && (
        <p className="mt-2 text-2xs text-subtle-foreground">
          Shares outstanding <Num value={data.sharesOutstanding.value} compact decimals={2} /> as of {data.sharesOutstanding.asOf} (cover page).
        </p>
      )}
    </div>
  );
}

function ProfilePanel({ symbol }: { symbol: string }) {
  const profile = useProfile(symbol);
  return (
    <Panel title="Profile" badge={badgeFor(profile.data)}>
      <DataSection capability="quotes" query={profile} skeleton={lines(4)}>
        {(v) => (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            {[
              ["Industry", v.industry],
              ["Country", v.country],
              ["Currency", v.currency],
              ["IPO date", v.ipoDate],
            ].map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-subtle-foreground">{k}</dt>
                <dd className="truncate">{val ?? "—"}</dd>
              </div>
            ))}
            <dt className="text-subtle-foreground">Website</dt>
            <dd className="truncate">
              {v.website && /^https?:\/\//.test(v.website) ? (
                <a href={v.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  {v.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        )}
      </DataSection>
    </Panel>
  );
}

function NewsPanel({ symbol }: { symbol: string }) {
  const news = useNews(symbol);
  return (
    <Panel title="Recent headlines" badge={badgeFor(news.data)}>
      <DataSection capability="quotes" query={news} skeleton={lines(5, "h-8")}>
        {(items) =>
          items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No headlines in the past 7 days.</p>
          ) : (
            <ul className="-my-1 divide-y divide-border">
              {items.slice(0, 10).map((n) => (
                <li key={n.id} className="py-2">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block">
                    <span className="line-clamp-2 text-xs leading-snug group-hover:text-accent">{n.headline}</span>
                    <span className="mt-0.5 flex gap-2 text-2xs text-subtle-foreground">
                      <span>{n.source}</span>
                      <time dateTime={n.publishedAt}>
                        {new Date(n.publishedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </time>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )
        }
      </DataSection>
    </Panel>
  );
}
