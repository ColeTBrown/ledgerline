import { brand } from "@/config/brand";

/** Bottom status bar: data-mode indicator and the regulatory disclaimer. */
export function StatusBar() {
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-2xs text-subtle-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-subtle-foreground" aria-hidden />
        Manual mode
      </span>
      <span className="h-3 w-px bg-border" aria-hidden />
      <span className="truncate">{brand.disclaimer}</span>
    </footer>
  );
}
