"use client";
import type { ReactNode } from "react";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, PanelLeft, PanelRight, Search, Settings, Sun } from "lucide-react";
import { useSettings } from "@/lib/store/settings";
import { useUi } from "@/lib/store/ui";
import { useModKey } from "@/hooks/use-mod-key";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RoleSwitcher } from "./role-switcher";
import { TickerStrip } from "./ticker-strip";

export function TopBar() {
  const toggleSidebar = useSettings((s) => s.toggleSidebar);
  const toggleRightPanel = useSettings((s) => s.toggleRightPanel);
  const rightPanelOpen = useSettings((s) => s.rightPanelOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const mod = useModKey();

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
      <IconButton label="Toggle sidebar" shortcut={`${mod}B`} onClick={toggleSidebar}>
        <PanelLeft />
      </IconButton>
      <Link href="/app" className="mr-1 rounded-sm px-1" aria-label="Dashboard">
        <Logo />
      </Link>
      <RoleSwitcher />

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-7 w-56 shrink-0 items-center gap-2 rounded-md border border-border-strong bg-background px-2 text-xs text-subtle-foreground transition-colors hover:border-accent/50 hover:text-muted-foreground lg:w-72"
        aria-label="Search tickers and tools"
      >
        <Search className="size-3.5" />
        <span className="flex-1 truncate text-left">Search tickers, tools, commands…</span>
        <Kbd>{mod}K</Kbd>
      </button>

      <Separator orientation="vertical" className="mx-1 h-5" />
      <TickerStrip className="flex-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />

      <ThemeToggle />
      <IconButton
        label={rightPanelOpen ? "Hide notes panel" : "Show notes panel"}
        shortcut={`${mod}.`}
        onClick={toggleRightPanel}
        pressed={rightPanelOpen}
      >
        <PanelRight />
      </IconButton>
      <IconButton label="Settings" shortcut={`${mod},`} onClick={() => setSettingsOpen(true)}>
        <Settings />
      </IconButton>
    </header>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return (
    <IconButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setTheme(dark ? "light" : "dark")}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </IconButton>
  );
}

function IconButton({
  label,
  shortcut,
  onClick,
  pressed,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={pressed ? "bg-surface-3 text-foreground" : undefined}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 font-mono text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
