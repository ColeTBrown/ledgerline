import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground transition-colors placeholder:text-subtle-foreground",
        "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-loss aria-invalid:ring-loss/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
