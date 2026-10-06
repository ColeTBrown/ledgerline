import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-sm text-foreground placeholder:text-subtle-foreground",
        "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 aria-invalid:border-loss",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
