import type { ReactNode } from "react";
import type { ToolMeta } from "@/tools/registry";
import { Badge } from "@/components/ui/badge";

/** Standard header strip shown at the top of every tool. */
export function ToolHeader({ tool, actions }: { tool: ToolMeta; actions?: ReactNode }) {
  const Icon = tool.icon;
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-border bg-surface/80 px-4 py-2 backdrop-blur">
      <Icon className="size-4 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold">{tool.name}</h1>
          <span className="text-2xs tracking-wider text-subtle-foreground uppercase">{tool.group}</span>
          {tool.live && <Badge variant="accent">Live pre-fill</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
      </div>
      {actions}
    </div>
  );
}
