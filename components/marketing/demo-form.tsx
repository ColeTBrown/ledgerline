"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { FIRM_TYPES, demoRequestSchema } from "@/lib/validation/demo-request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldErrors = Partial<Record<keyof z.input<typeof demoRequestSchema>, string>>;

export function DemoForm() {
  const [firmType, setFirmType] = useState<string>("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const seats = String(form.get("seats") ?? "").trim();
    const raw = {
      name: form.get("name"),
      email: form.get("email"),
      firm: form.get("firm"),
      firmType: firmType || undefined,
      seats: seats === "" ? undefined : seats,
      message: String(form.get("message") ?? "").trim() || undefined,
    };
    const parsed = demoRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])) as FieldErrors);
      return;
    }
    setErrors({});
    setStatus("submitting");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface p-10 text-center">
        <CheckCircle2 className="size-6 text-gain" aria-hidden />
        <p className="text-sm font-medium">Request received</p>
        <p className="text-xs text-muted-foreground">Our team will be in touch within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
      <Field id="name" label="Full name" error={errors.name}>
        <Input id="name" name="name" autoComplete="name" aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? "name-error" : undefined} />
      </Field>
      <Field id="email" label="Work email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? "email-error" : undefined} />
      </Field>
      <Field id="firm" label="Firm" error={errors.firm}>
        <Input id="firm" name="firm" autoComplete="organization" aria-invalid={!!errors.firm || undefined} aria-describedby={errors.firm ? "firm-error" : undefined} />
      </Field>
      <Field id="firmType" label="Firm type" error={errors.firmType}>
        <Select value={firmType} onValueChange={setFirmType}>
          <SelectTrigger id="firmType" aria-invalid={!!errors.firmType || undefined} aria-describedby={errors.firmType ? "firmType-error" : undefined}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {FIRM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="seats" label="Estimated seats (optional)" error={errors.seats}>
        <Input id="seats" name="seats" inputMode="numeric" className="num" aria-invalid={!!errors.seats || undefined} aria-describedby={errors.seats ? "seats-error" : undefined} />
      </Field>
      <div className="sm:col-span-2">
        <Field id="message" label="What would you like to see? (optional)" error={errors.message}>
          <Textarea id="message" name="message" rows={3} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p className="text-2xs text-subtle-foreground">We only use these details to arrange your demo.</p>
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" && <Loader2 className="animate-spin" />}
          Request a demo
        </Button>
      </div>
      {status === "error" && (
        <p role="alert" className="text-xs text-loss sm:col-span-2">
          Something went wrong sending your request. Please try again or email us directly.
        </p>
      )}
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
