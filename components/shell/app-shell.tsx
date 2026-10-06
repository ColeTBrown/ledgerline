"use client";

import type { ReactNode } from "react";
import { useSettingsHydrated } from "@/lib/store/settings";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { Skeleton } from "@/components/ui/skeleton";
import { CommandPalette } from "./command-palette";
import { RightPanel } from "./right-panel";
import { SettingsDialog } from "./settings-dialog";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  useGlobalShortcuts();
  const hydrated = useSettingsHydrated();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {hydrated ? <TopBar /> : <TopBarSkeleton />}
      <div className="flex min-h-0 flex-1">
        {hydrated ? <Sidebar /> : <SidebarSkeleton />}
        <main id="main" className="bg-grid scrollbar-thin min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
        {hydrated && <RightPanel />}
      </div>
      <StatusBar />
      {hydrated && (
        <>
          <CommandPalette />
          <SettingsDialog />
        </>
      )}
    </div>
  );
}

/** Same footprint as the real bars so nothing shifts once settings load. */
function TopBarSkeleton() {
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-7 w-56 lg:w-72" />
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="w-56 shrink-0 space-y-2 border-r border-border bg-surface p-3">
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="h-5" />
      ))}
    </div>
  );
}
