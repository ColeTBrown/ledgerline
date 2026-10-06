import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Original geometric mark: a ledger rule broken by a rising signal line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", className)} fill="none">
      <rect x="1" y="1" width="22" height="22" rx="3" className="fill-accent" />
      <path d="M5 17h14" className="stroke-accent-foreground" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M5 15l4-4 3 2.5L19 7"
        className="stroke-accent-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showName && <span className="text-sm font-semibold tracking-tight">{brand.name}</span>}
    </span>
  );
}
