import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-2xs font-medium uppercase tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-surface-3 text-muted-foreground",
        accent: "border-accent/30 bg-accent-soft text-accent",
        gain: "border-gain/30 bg-gain-soft text-gain",
        loss: "border-loss/30 bg-loss-soft text-loss",
        outline: "border-border-strong text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
