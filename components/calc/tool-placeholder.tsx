import { getTool } from "@/tools/registry";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolHeader } from "./tool-header";

/**
 * Layout frame for a tool that has not been built yet: same two-pane
 * geometry (inputs left, results right) the finished calculator will use.
 */
export function ToolPlaceholder({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  if (!tool) return null;
  return (
    <div className="flex min-h-full flex-col">
      <ToolHeader tool={tool} />
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Inputs" className="space-y-3 bg-surface p-4">
          <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Inputs</div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24 animate-none" />
              <Skeleton className="h-8 animate-none" />
            </div>
          ))}
        </section>
        <section aria-label="Results" className="flex flex-col bg-background p-4">
          <div className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">Results</div>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 animate-none" />
            ))}
          </div>
          <div className="mt-3 flex flex-1 items-center justify-center rounded-md border border-dashed border-border-strong p-8 text-center">
            <div>
              <p className="text-sm font-medium">{tool.name} is on the build plan</p>
              <p className="mt-1 text-xs text-muted-foreground">Scheduled for build phase {tool.phase}.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
