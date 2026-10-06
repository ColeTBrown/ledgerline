"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, PlugZap } from "lucide-react";
import { ROLES } from "@/config/roles";
import { TOOLS, type ToolMeta } from "@/tools/registry";
import { useSettings } from "@/lib/store/settings";
import { Badge } from "@/components/ui/badge";
import { watchLabel } from "@/components/shell/ticker-strip";

export function RoleDashboard() {
  const role = useSettings((s) => s.role);
  const watchlist = useSettings((s) => s.watchlist);
  const config = ROLES[role];
  const roleTools = TOOLS.filter((t) => t.roles.includes(role));
  const sharedTools = TOOLS.filter((t) => t.roles.length === 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xs tracking-wider text-subtle-foreground uppercase">{config.label}</div>
          <h1 className="text-xl font-semibold tracking-tight">{config.terminology.dashboardTitle}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{config.description}</p>
        </div>
      </header>

      <section aria-labelledby="markets-heading">
        <SectionHeading id="markets-heading">Markets</SectionHeading>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {watchlist.slice(0, 10).map((symbol) => (
            <div key={symbol} className="rounded-md border border-border bg-surface p-3">
              <div className="text-xs font-medium">{watchLabel(symbol)}</div>
              <div className="num mt-1 text-lg text-subtle-foreground">—</div>
              <div className="num text-2xs text-subtle-foreground">No feed</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <PlugZap className="size-3.5 text-subtle-foreground" aria-hidden />
          Live market data is not connected. Every tool runs fully on manual inputs.
        </div>
      </section>

      <section aria-labelledby="tools-heading">
        <SectionHeading id="tools-heading">{config.shortLabel} tools</SectionHeading>
        <ToolGrid tools={roleTools} />
      </section>

      <section aria-labelledby="shared-heading">
        <SectionHeading id="shared-heading">Shared workspace</SectionHeading>
        <ToolGrid tools={sharedTools} />
      </section>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 text-2xs font-medium tracking-wider text-subtle-foreground uppercase">
      {children}
    </h2>
  );
}

function ToolGrid({ tools }: { tools: ToolMeta[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => (
        <li key={tool.id} className="overflow-hidden rounded-md border border-border bg-surface">
          <Link
            href={`/app/${tool.id}`}
            className="group flex h-full gap-3 p-3.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-background">
              <tool.icon className="size-4 text-accent" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{tool.name}</span>
                {tool.live && <Badge variant="accent">Live pre-fill</Badge>}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{tool.description}</span>
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
