"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format/number";
import { parseNumberInput } from "@/lib/format/parse";
import { useNumberFormat } from "@/lib/store/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FieldKind = "number" | "currency" | "percent" | "integer";

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  kind?: FieldKind;
  decimals?: number;
  min?: number;
  max?: number;
  /** External validation message (e.g. from a FinanceInputError). */
  error?: string | null;
  hint?: ReactNode;
  /** Rendered at the right of the label row (e.g. a source badge). */
  adornment?: ReactNode;
  suffix?: string;
  className?: string;
  id?: string;
}

/**
 * Numeric input with locale-aware parsing and formatting. Percent fields
 * display 5.25 for a stored value of 0.0525. Invalid text shows an inline
 * error and does not propagate.
 */
export function NumberField({
  label,
  value,
  onChange,
  kind = "number",
  decimals,
  min,
  max,
  error,
  hint,
  adornment,
  suffix,
  className,
  id: idProp,
}: NumberFieldProps) {
  const fmt = useNumberFormat();
  const autoId = useId();
  const id = idProp ?? autoId;
  const scale = kind === "percent" ? 100 : 1;
  const places = decimals ?? (kind === "integer" ? 0 : kind === "percent" ? 2 : fmt.decimals);
  const display = (v: number) => (Number.isFinite(v) ? formatNumber(v * scale, { locale: fmt.locale, decimals: places }) : "");

  const [text, setText] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function commit(raw: string) {
    const parsed = parseNumberInput(raw, fmt.locale);
    if (parsed === null) {
      setLocalError("Enter a number.");
      return;
    }
    const v = parsed / scale;
    if (kind === "integer" && !Number.isInteger(v)) return setLocalError("Enter a whole number.");
    if (min !== undefined && v < min) return setLocalError(`Must be at least ${display(min)}${kind === "percent" ? "%" : ""}.`);
    if (max !== undefined && v > max) return setLocalError(`Must be at most ${display(max)}${kind === "percent" ? "%" : ""}.`);
    setLocalError(null);
    if (v !== value) onChange(v);
  }

  const shownError = localError ?? error ?? null;
  const unit = suffix ?? (kind === "percent" ? "%" : kind === "currency" ? fmt.currency : undefined);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex min-h-4 items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {adornment}
      </div>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={text ?? display(value)}
          onFocus={(e) => {
            setText(display(value));
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            setLocalError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText(null);
              setLocalError(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          className={cn("num text-right", unit && "pr-11")}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-2xs text-subtle-foreground">{unit}</span>
        )}
      </div>
      {shownError ? (
        <p id={`${id}-error`} className="text-2xs text-loss" role="alert">
          {shownError}
        </p>
      ) : hint ? (
        <p className="text-2xs text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
