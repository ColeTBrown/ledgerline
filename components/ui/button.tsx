import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent/90",
        outline: "border border-border-strong bg-transparent hover:bg-surface-2",
        secondary: "bg-surface-3 text-foreground hover:bg-surface-3/80",
        ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline",
        destructive: "bg-loss text-white hover:bg-loss/90",
      },
      size: {
        default: "h-8 px-3 text-sm",
        sm: "h-7 px-2.5 text-xs",
        xs: "h-6 px-2 text-2xs",
        lg: "h-10 px-5 text-sm",
        icon: "size-8",
        "icon-sm": "size-7",
        "icon-xs": "size-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
