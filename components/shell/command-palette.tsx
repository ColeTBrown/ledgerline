"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Building2, LayoutDashboard, Loader2, Moon, PanelLeft, PanelRight, Settings, Users } from "lucide-react";
import { ROLE_IDS, ROLES } from "@/config/roles";
import { TOOLS, toolsForRole } from "@/tools/registry";
import { useSettings } from "@/lib/store/settings";
import { useUi } from "@/lib/store/ui";
import { paletteScore } from "@/lib/palette-filter";
import { useAltKey, useModKey } from "@/hooks/use-mod-key";
import { useSymbolSearch } from "@/hooks/use-market";
import { SYMBOL_RE } from "@/lib/data/symbols";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DropdownMenuShortcut as Shortcut } from "@/components/ui/dropdown-menu";

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const role = useSettings((s) => s.role);
  const setRole = useSettings((s) => s.setRole);
  const toggleSidebar = useSettings((s) => s.toggleSidebar);
  const toggleRightPanel = useSettings((s) => s.toggleRightPanel);
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const mod = useModKey();
  const alt = useAltKey();

  const [search, setSearch] = useState("");
  const tickerSearch = useSymbolSearch(search);
  const tickerResults = tickerSearch.data?.ok ? tickerSearch.data.value.slice(0, 8) : [];
  const typedSymbol = search.trim().toUpperCase();
  const looksLikeTicker = SYMBOL_RE.test(typedSymbol) && typedSymbol.length <= 6;
  const openSymbol = (symbol: string) => run(() => router.push(`/app/company?symbol=${encodeURIComponent(symbol)}`));

  const roleTools = toolsForRole(role);
  const roleToolIds = new Set(roleTools.map((t) => t.id));
  const otherTools = TOOLS.filter((t) => !roleToolIds.has(t.id));

  function run(action: () => void) {
    setOpen(false);
    setSearch("");
    action();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
    >
      <DialogContent className="max-w-xl overflow-hidden p-0" showClose={false} aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command loop filter={paletteScore}>
          <CommandInput placeholder="Search tickers, jump to a tool, or run a command…" value={search} onValueChange={setSearch} />
          <CommandList>
            {/* cmdk ignores force-mounted ticker rows when deciding "empty". */}
            {!looksLikeTicker && tickerResults.length === 0 && <CommandEmpty>No matches.</CommandEmpty>}
            {(looksLikeTicker || tickerResults.length > 0) && (
              <CommandGroup heading="Tickers" forceMount>
                {looksLikeTicker && !tickerResults.some((t) => t.symbol === typedSymbol) && (
                  <CommandItem forceMount value={`ticker-direct ${typedSymbol}`} onSelect={() => openSymbol(typedSymbol)}>
                    <Building2 />
                    <span>
                      Open <span className="font-medium">{typedSymbol}</span> snapshot
                    </span>
                    {tickerSearch.isFetching && <Loader2 className="ml-auto animate-spin" />}
                  </CommandItem>
                )}
                {tickerResults.map((t) => (
                  <CommandItem forceMount key={t.symbol} value={`ticker ${t.symbol}`} onSelect={() => openSymbol(t.symbol)}>
                    <Building2 />
                    <span className="w-16 shrink-0 font-medium">{t.displaySymbol}</span>
                    <span className="truncate text-muted-foreground">{t.description}</span>
                    <span className="ml-auto pl-4 text-2xs text-subtle-foreground">{t.type}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={`${ROLES[role].shortLabel} tools`}>
              <CommandItem value="Dashboard" keywords={["home"]} onSelect={() => run(() => router.push("/app"))}>
                <LayoutDashboard />
                Dashboard
              </CommandItem>
              {roleTools.map((tool) => (
                <CommandItem
                  key={tool.id}
                  value={tool.name}
                  keywords={[...tool.keywords]}
                  onSelect={() => run(() => router.push(`/app/${tool.id}`))}
                >
                  <tool.icon />
                  <span>{tool.name}</span>
                  <span className="ml-auto truncate pl-4 text-2xs text-subtle-foreground">{tool.group}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Other tools">
              {otherTools.map((tool) => (
                <CommandItem
                  key={tool.id}
                  value={tool.name}
                  keywords={[...tool.keywords]}
                  onSelect={() => run(() => router.push(`/app/${tool.id}`))}
                >
                  <tool.icon />
                  <span>{tool.name}</span>
                  <span className="ml-auto truncate pl-4 text-2xs text-subtle-foreground">
                    {tool.roles.map((r) => ROLES[r].shortLabel).join(" · ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Switch role">
              {ROLE_IDS.map((id) => (
                <CommandItem key={id} value={ROLES[id].label} keywords={["role", "switch", ROLES[id].shortLabel]} onSelect={() => run(() => setRole(id))}>
                  <Users />
                  {ROLES[id].label}
                  <Shortcut>
                    {alt}
                    {ROLES[id].shortcut}
                  </Shortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Commands">
              <CommandItem
                value="Toggle light / dark theme" keywords={["theme"]}
                onSelect={() => run(() => setTheme(resolvedTheme === "light" ? "dark" : "light"))}
              >
                <Moon />
                Toggle light / dark theme
              </CommandItem>
              <CommandItem value="Toggle sidebar" onSelect={() => run(toggleSidebar)}>
                <PanelLeft />
                Toggle sidebar
                <Shortcut>{mod}B</Shortcut>
              </CommandItem>
              <CommandItem value="Toggle notes panel" keywords={["right", "assumptions"]} onSelect={() => run(toggleRightPanel)}>
                <PanelRight />
                Toggle notes panel
                <Shortcut>{mod}.</Shortcut>
              </CommandItem>
              <CommandItem value="Settings" keywords={["preferences", "watchlist", "currency", "format"]} onSelect={() => run(() => setSettingsOpen(true))}>
                <Settings />
                Settings
                <Shortcut>{mod},</Shortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
