"use client";

import { RotateCcw } from "lucide-react";
import type { SourceStatus, Sourced } from "@/lib/data/sourced";
import { NumberField, type NumberFieldProps } from "@/components/calc/number-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SourceBadge } from "./source-badge";

export interface LiveNumberFieldProps extends Omit<NumberFieldProps, "adornment"> {
  status: SourceStatus;
  live: Sourced<number> | null;
  onReset: () => void;
}

/**
 * NumberField with a provenance badge. Shows MANUAL once edited, plus a
 * "reset to live" button when a live value is available.
 */
export function LiveNumberField({ status, live, onReset, ...field }: LiveNumberFieldProps) {
  const showReset = status === "MANUAL" && live !== null;
  return (
    <NumberField
      {...field}
      adornment={
        <span className="flex items-center gap-1">
          <SourceBadge
            status={status}
            source={status === "MANUAL" ? "Manual input" : live?.source}
            asOf={status === "MANUAL" ? undefined : live?.asOf}
            compact
          />
          {showReset && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-sm p-0.5 text-subtle-foreground hover:bg-surface-3 hover:text-accent"
                  aria-label={`Reset ${field.label} to live value`}
                >
                  <RotateCcw className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset to live ({live.source})</TooltipContent>
            </Tooltip>
          )}
        </span>
      }
    />
  );
}
