import * as React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border border-border-strong bg-surface-2 px-1 font-mono text-[10px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
