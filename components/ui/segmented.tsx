"use client";

import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  className?: string;
  "aria-label": string;
}

/** Compact single-select segmented control (Radix ToggleGroup). */
function Segmented<T extends string>({ value, onValueChange, options, className, ...rest }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn("inline-flex h-8 rounded-md border border-border-strong bg-surface p-0.5", className)}
      {...rest}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="flex-1 rounded-sm px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground data-[state=on]:bg-surface-3 data-[state=on]:text-foreground"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export { Segmented };
