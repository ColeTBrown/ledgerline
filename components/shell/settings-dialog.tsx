"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Plus, RotateCcw, X } from "lucide-react";
import {
  CURRENCIES,
  NUMBER_LOCALES,
  normalizeWatchSymbol,
  useSettings,
  type Currency,
  type NumberLocale,
} from "@/lib/store/settings";
import { useUi } from "@/lib/store/ui";
import { formatCurrency, type NegativeStyle } from "@/lib/format/number";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { watchLabel } from "./ticker-strip";

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const s = useSettings();
  const { resolvedTheme, setTheme } = useTheme();
  const [symbol, setSymbol] = useState("");
  const [symbolError, setSymbolError] = useState<string | null>(null);

  const preview = formatCurrency(-1234567.891, s.currency, {
    locale: s.locale,
    decimals: s.decimals,
    negativeStyle: s.negativeStyle,
  });

  function addSymbol(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeWatchSymbol(symbol);
    if (!normalized) return setSymbolError("Enter a ticker (e.g. AAPL) or TREASURY:10Y.");
    if (s.watchlist.includes(normalized)) return setSymbolError(`${normalized} is already on the watchlist.`);
    if (s.watchlist.length >= 20) return setSymbolError("Watchlist is limited to 20 symbols.");
    s.addWatchSymbol(normalized);
    setSymbol("");
    setSymbolError(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[10vh] max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Display preferences are saved in this browser.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
          <Section title="Display">
            <Field label="Theme" htmlFor="set-theme">
              <Segmented
                aria-label="Theme"
                value={resolvedTheme === "light" ? "light" : "dark"}
                onValueChange={setTheme}
                options={[
                  { value: "dark", label: "Dark · Terminal" },
                  { value: "light", label: "Light · Client" },
                ]}
              />
            </Field>
          </Section>

          <Section title="Numbers">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" htmlFor="set-currency">
                <Select value={s.currency} onValueChange={(v) => s.setCurrency(v as Currency)}>
                  <SelectTrigger id="set-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Number format" htmlFor="set-locale">
                <Select value={s.locale} onValueChange={(v) => s.setLocale(v as NumberLocale)}>
                  <SelectTrigger id="set-locale" className="num">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NUMBER_LOCALES.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="num">{l.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Decimal places" htmlFor="set-decimals">
                <Segmented
                  aria-label="Decimal places"
                  value={String(s.decimals)}
                  onValueChange={(v) => s.setDecimals(Number(v))}
                  options={["0", "1", "2", "3", "4"].map((d) => ({ value: d, label: d }))}
                />
              </Field>
              <Field label="Negative numbers" htmlFor="set-negative">
                <Segmented<NegativeStyle>
                  aria-label="Negative number style"
                  value={s.negativeStyle}
                  onValueChange={s.setNegativeStyle}
                  options={[
                    { value: "minus", label: "-1,234" },
                    { value: "parens", label: "(1,234)" },
                  ]}
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Preview</span>
              <span className="num text-loss">{preview}</span>
            </div>
          </Section>

          <Section
            title="Watchlist"
            action={
              <Button variant="ghost" size="xs" onClick={s.resetWatchlist}>
                <RotateCcw /> Reset
              </Button>
            }
          >
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {s.watchlist.map((w) => (
                <li
                  key={w}
                  className="flex h-6 items-center gap-1 rounded-sm border border-border-strong bg-surface-2 pr-0.5 pl-2 text-xs"
                >
                  <span className="font-medium">{watchLabel(w)}</span>
                  <button
                    type="button"
                    onClick={() => s.removeWatchSymbol(w)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    aria-label={`Remove ${watchLabel(w)}`}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
              {s.watchlist.length === 0 && <li className="text-xs text-muted-foreground">No symbols.</li>}
            </ul>
            <form onSubmit={addSymbol} className="flex gap-2">
              <Input
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setSymbolError(null);
                }}
                placeholder="Add ticker, e.g. AAPL or TREASURY:2Y"
                aria-label="Add watchlist symbol"
                aria-invalid={symbolError ? true : undefined}
                aria-describedby={symbolError ? "watch-error" : undefined}
                className="uppercase placeholder:normal-case"
              />
              <Button type="submit" variant="outline">
                <Plus /> Add
              </Button>
            </form>
            {symbolError && (
              <p id="watch-error" className="mt-1.5 text-xs text-loss" role="alert">
                {symbolError}
              </p>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-2xs font-medium tracking-wider text-subtle-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
