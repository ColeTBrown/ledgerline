import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "gain" | "loss" | "accent";

/** Compact labelled figure used across tool result panels. */
export function Stat({
  label,
  value,
  tone = "default",
  hint,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  hint?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
      <div className="text-2xs tracking-wide text-subtle-foreground uppercase">{label}</div>
      <div
        className={cn(
          "num font-semibold tabular-nums",
          size === "lg" ? "text-2xl" : "text-base",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-2xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Grid wrapper giving stat tiles the hairline-separated card look. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-px overflow-hidden rounded-md border border-border bg-border", className)}>{children}</div>;
}
